import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth-client';
import { useTaskiyeStore } from '../store/useTaskiyeStore';

/**
 * Custom hook that monitors date transitions (midnight rollover).
 * Automatically refreshes today's scheduled habits and resets daily checklists
 * without requiring a hard browser refresh.
 */
export function useMidnightRollover() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const {
    currentDateStr,
    setCurrentDateStr,
    syncHabitsToTodayTasks,
    setTodayChecklistCompletedCount,
  } = useTaskiyeStore();

  const lastCheckedDateRef = useRef<string>(
    currentDateStr || new Date().toLocaleDateString('en-CA')
  );

  const handleRollover = useCallback(
    (newDateStr: string) => {
      lastCheckedDateRef.current = newDateStr;
      setCurrentDateStr(newDateStr);

      if (isAuthenticated) {
        // Invalidate queries so TanStack queries automatically refetch for the new date
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['tasks', 'activity'] });
      } else {
        // Guest mode: roll over habits and generate today's instances with isCompleted: false
        syncHabitsToTodayTasks();
      }

      // Reset today's checklist counter for the new day
      setTodayChecklistCompletedCount(0);
    },
    [
      isAuthenticated,
      queryClient,
      setCurrentDateStr,
      syncHabitsToTodayTasks,
      setTodayChecklistCompletedCount,
    ]
  );

  useEffect(() => {
    // Helper to get local date in YYYY-MM-DD
    const getLocalTodayStr = () => new Date().toLocaleDateString('en-CA');

    const checkDateTransition = () => {
      const today = getLocalTodayStr();
      if (today !== lastCheckedDateRef.current) {
        handleRollover(today);
      }
    };

    // 1. Initial check
    checkDateTransition();

    // 2. Set timeout targeting the upcoming midnight (plus 1 second grace period)
    let timeoutId: NodeJS.Timeout;
    const scheduleMidnightTimer = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1
      );
      const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());

      timeoutId = setTimeout(() => {
        checkDateTransition();
        scheduleMidnightTimer();
      }, delay);
    };

    scheduleMidnightTimer();

    // 3. 30-second interval fallback (protects against system sleep / tab suspension)
    const intervalId = setInterval(checkDateTransition, 30000);

    // 4. Tab visibility and focus listener (detects wake-from-sleep instantly)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDateTransition();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkDateTransition);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkDateTransition);
    };
  }, [handleRollover]);

  return { currentDateStr };
}
