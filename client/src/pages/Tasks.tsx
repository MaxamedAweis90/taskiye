import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth-client';
import { useTaskiyeStore, GuestTask } from '../store/useTaskiyeStore';
import { TaskHistoryHeader } from '../components/tasks/TaskHistoryHeader';
import { TaskHistoryDaySection, HistoryDayBucket } from '../components/tasks/TaskHistoryDaySection';
import { TaskHistoryUpcomingSection } from '../components/tasks/TaskHistoryUpcomingSection';
import { HistoryTask } from '../components/tasks/TaskHistoryRow';
import { TaskRescheduleModal } from '../components/tasks/TaskRescheduleModal';
import { TaskEditCreateModal } from '../components/tasks/TaskEditCreateModal';
import { TaskHistorySkeleton } from '../components/tasks/TaskHistorySkeleton';
import { Calendar, CheckCircle2, Trash2, X } from 'lucide-react';
import { normalizeCategory } from '../constants/categories';
import { SEOHead } from '../components/common/SEOHead';

interface DashboardCacheTask {
  _id?: string;
  id?: string;
  title: string;
  isCompleted?: boolean;
  isHabitInstance?: boolean;
  habitId?: string | { _id: string };
  sortOrder?: number;
  category?: string;
  priority?: 'normal' | 'high';
  timeTag?: string;
  createdAt?: string;
}

export const Tasks: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const {
    showToast,
    markTaskRestored,
    tasks: guestTasks,
    addGuestTask,
    updateGuestTask,
    deleteGuestTask,
    reorderGuestTasks,
    setTodayChecklistCompletedCount,
  } = useTaskiyeStore();

  // Filter and Toolbar State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Modals & Interactive State
  const [rescheduleTask, setRescheduleTask] = useState<HistoryTask | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [editCreateTask, setEditCreateTask] = useState<HistoryTask | null>(null);
  const [isEditCreateOpen, setIsEditCreateOpen] = useState(false);
  const [defaultCreateDate, setDefaultCreateDate] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Animation, Scroll & Delete Confirmation States
  const [taskToDelete, setTaskToDelete] = useState<HistoryTask | null>(null);
  const [swipingOutTaskId, setSwipingOutTaskId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  // Intersection Observer ref for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Today & Tomorrow date strings
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const tomorrowStr = useMemo(() => {
    const tom = new Date(today.getTime() + 86400000);
    return tom.toISOString().slice(0, 10);
  }, [today]);

  // Query Key for History caching
  const historyQueryKey = useMemo(
    () => ['tasks', 'history', { searchQuery, selectedCategory, hideCompleted }],
    [searchQuery, selectedCategory, hideCompleted]
  );

  // TanStack Query: Cached Historical Tasks Data (5 min staleTime, 10 min gcTime)
  const {
    data: historyData,
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: historyQueryKey,
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.set('days', '14');
      if (searchQuery) queryParams.set('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'All Categories') {
        queryParams.set('category', selectedCategory);
      }
      if (hideCompleted) queryParams.set('hideCompleted', 'true');

      const res = await fetch(`/api/tasks/history?${queryParams.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch history');
      const json = await res.json();
      return json?.data as {
        upcomingTasks?: HistoryTask[];
        days: HistoryDayBucket[];
        nextCursorDate: string | null;
        hasMore: boolean;
        totalLoggedCount: number;
      };
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  /**
   * Local Guest Mode History Builder (excludes habit instances)
   */
  const guestHistoryData = useMemo(() => {
    if (isAuthenticated) return null;

    // Strictly standalone tasks, never habit instances!
    const allTasks = (guestTasks || []).filter((t: GuestTask) => !t.isHabitInstance && !t.habitId);

    // 1. Separate Upcoming Tasks (future dates beyond today, sorted ascending so earliest is first)
    const upcomingRaw = allTasks
      .filter((t: GuestTask) => (t.date || todayStr).slice(0, 10) > todayStr)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const upcomingTasks: HistoryTask[] = upcomingRaw
      .filter((t) => {
        if (hideCompleted && t.isCompleted) return false;
        const cat = normalizeCategory(t.category);
        if (selectedCategory !== 'All Categories' && cat !== selectedCategory) return false;
        if (searchQuery) {
          const matchTitle = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase());
          const matchCat = cat.toLowerCase().includes(searchQuery.toLowerCase());
          if (!matchTitle && !matchCat) return false;
        }
        return true;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        isCompleted: t.isCompleted,
        category: normalizeCategory(t.category),
        priority: t.priority || 'normal',
        timeTag: t.timeTag || null,
        isHabitInstance: false,
        habitId: null,
        status: t.isCompleted ? 'completed' : 'pending',
        date: (t.date || todayStr).slice(0, 10),
        createdAt: t.createdAt || new Date().toISOString(),
      }));

    // 2. Historical tasks (today and past days only)
    const historyTasks = allTasks.filter((t: GuestTask) => (t.date || todayStr).slice(0, 10) <= todayStr);

    // Group tasks by date
    const map = new Map<string, GuestTask[]>();
    historyTasks.forEach((t: GuestTask) => {
      const d = (t.date || todayStr).slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    });

    // Ensure Today bucket always exists
    if (!map.has(todayStr)) map.set(todayStr, []);

    // Sort dates in descending order
    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

    const dayBuckets: HistoryDayBucket[] = sortedDates.map((dateStr) => {
      const dateObj = new Date(dateStr + 'T12:00:00.000Z');
      const isToday = dateStr === todayStr;
      const isYesterday = dateStr === yesterdayStr;

      const label = isToday
        ? 'TODAY'
        : isYesterday
        ? 'YESTERDAY'
        : dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          }).toUpperCase();

      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });

      const dayTasksRaw = (map.get(dateStr) || []).sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      const totalCount = dayTasksRaw.length;
      const completedCount = dayTasksRaw.filter((t) => t.isCompleted).length;
      const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      const filteredTasks: HistoryTask[] = dayTasksRaw
        .filter((t) => {
          if (hideCompleted && t.isCompleted) return false;
          const cat = normalizeCategory(t.category);
          if (selectedCategory !== 'All Categories' && cat !== selectedCategory) return false;
          if (searchQuery) {
            const matchTitle = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchCat = cat.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchTitle && !matchCat) return false;
          }
          return true;
        })
        .map((t) => {
          let status: 'completed' | 'pending' | 'missed' = 'pending';
          if (t.isCompleted) {
            status = 'completed';
          } else if (dateStr < todayStr) {
            status = 'missed';
          } else {
            status = 'pending';
          }

          return {
            id: t.id,
            title: t.title,
            isCompleted: t.isCompleted,
            category: normalizeCategory(t.category),
            priority: t.priority || 'normal',
            timeTag: t.timeTag || null,
            isHabitInstance: false,
            habitId: null,
            status,
            date: dateStr,
            createdAt: t.createdAt || new Date().toISOString(),
          };
        });

      return {
        date: dateStr,
        label,
        formattedDate,
        isTomorrow: false,
        isToday,
        isYesterday,
        tasks: filteredTasks,
        totalCount,
        completedCount,
        completionPercentage,
      };
    });

    return {
      upcomingTasks,
      days: dayBuckets,
      totalLoggedCount: allTasks.length,
      hasMore: false,
      nextCursorDate: null,
    };
  }, [isAuthenticated, guestTasks, today, todayStr, hideCompleted, selectedCategory, searchQuery]);

  // Unified State & Skeletons
  const days: HistoryDayBucket[] = isAuthenticated ? historyData?.days || [] : guestHistoryData?.days || [];
  const upcomingTasks: HistoryTask[] = isAuthenticated
    ? historyData?.upcomingTasks || []
    : guestHistoryData?.upcomingTasks || [];
  const totalLoggedCount: number = isAuthenticated
    ? historyData?.totalLoggedCount ?? 0
    : guestHistoryData?.totalLoggedCount ?? 0;
  const hasMore: boolean = isAuthenticated ? Boolean(historyData?.hasMore) : false;
  const isLoadingInitial: boolean = isAuthenticated ? isHistoryLoading && !historyData : false;

  // Highlight & scroll to specific task (e.g. redirected from AI Chatbot or action)
  useEffect(() => {
    const scrollAndHighlight = (taskId: string) => {
      const el = document.getElementById(`task-history-item-${taskId}`);
      if (el) {
        setHighlightedTaskId(taskId);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timer = setTimeout(() => {
          setHighlightedTaskId((curr) => (curr === taskId ? null : curr));
          sessionStorage.removeItem('taskiye_highlight_task');
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    const handleHighlightEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ taskId: string }>;
      const taskId = customEvent.detail?.taskId;
      if (taskId) {
        scrollAndHighlight(taskId);
      }
    };

    window.addEventListener('taskiye-highlight-task', handleHighlightEvent);

    const storedHighlight = sessionStorage.getItem('taskiye_highlight_task');
    if (storedHighlight) {
      // Delay slightly for DOM render
      const timer = setTimeout(() => {
        scrollAndHighlight(storedHighlight);
      }, 350);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('taskiye-highlight-task', handleHighlightEvent);
    };
  }, [days]);

  /**
   * Infinite Scroll Page Loader
   */
  const loadMore = useCallback(async () => {
    if (!isAuthenticated || !historyData?.hasMore || isLoadingMore || !historyData.nextCursorDate) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('cursorDate', historyData.nextCursorDate);
      queryParams.set('days', '14');
      if (searchQuery) queryParams.set('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'All Categories') {
        queryParams.set('category', selectedCategory);
      }
      if (hideCompleted) queryParams.set('hideCompleted', 'true');

      const res = await fetch(`/api/tasks/history?${queryParams.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch more history');
      const json = await res.json();
      if (json?.data) {
        const incomingDays: HistoryDayBucket[] = json.data.days || [];
        const nextCursor: string | null = json.data.nextCursorDate;
        const more: boolean = Boolean(json.data.hasMore);
        const total: number = json.data.totalLoggedCount ?? historyData.totalLoggedCount;

        queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
          if (!old) return old;
          const existingDates = new Set(old.days.map((d) => d.date));
          const uniqueIncoming = incomingDays.filter((d) => !existingDates.has(d.date));
          return {
            ...old,
            days: [...old.days, ...uniqueIncoming],
            nextCursorDate: nextCursor,
            hasMore: more,
            totalLoggedCount: total,
          };
        });
      }
    } catch (err) {
      console.warn('Failed to load more history:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isAuthenticated,
    historyData,
    isLoadingMore,
    searchQuery,
    selectedCategory,
    hideCompleted,
    queryClient,
    historyQueryKey,
  ]);

  // Infinite Scroll Intersection Observer
  useEffect(() => {
    if (!hasMore || isLoadingMore || !historyData?.nextCursorDate) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, historyData?.nextCursorDate, loadMore]);

  // Callback when typewriter typing animation completes
  const handleCreationAnimationComplete = (targetId: string) => {
    setCreatingTaskId((curr) => (curr === targetId ? null : curr));
    setHighlightedTaskId(targetId);
    setTimeout(() => {
      setHighlightedTaskId((curr) => (curr === targetId ? null : curr));
    }, 1800);
  };

  // Auto-scroll workspace smoothly to task with retries
  const scrollWorkspaceToTask = useCallback((taskId: string, attempts = 0) => {
    const el =
      document.getElementById(`task-history-item-${taskId}`) ||
      document.getElementById(`task-item-${taskId}`);
    const main = document.getElementById('main-workspace') || document.querySelector('main');

    if (el) {
      if (main && 'scrollTo' in main) {
        const mainRect = main.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetScrollTop =
          main.scrollTop + (elRect.top - mainRect.top) - (main.clientHeight / 2) + (elRect.height / 2);
        main.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (attempts < 15) {
      setTimeout(() => scrollWorkspaceToTask(taskId, attempts + 1), 40);
    }
  }, []);

  // Auto-scroll to newly created task smoothly when creatingTaskId is set
  useEffect(() => {
    if (!creatingTaskId) return;

    if (document.activeElement instanceof HTMLElement && document.activeElement.tagName !== 'BODY') {
      document.activeElement.blur();
    }

    scrollWorkspaceToTask(creatingTaskId);
  }, [creatingTaskId, scrollWorkspaceToTask]);

  /**
   * Intra-day Task Reordering Handler (Strictly scoped within a day's date container)
   */
  const handleReorderTaskInDay = (dateStr: string, taskId: string, direction: 'up' | 'down') => {
    const targetDay = days.find((d) => d.date === dateStr);
    if (!targetDay || !targetDay.tasks || targetDay.tasks.length <= 1) return;

    const currentIndex = targetDay.tasks.findIndex((t) => t.id === taskId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    // Strictly clamp within current day boundaries - impossible to cross into another day
    if (targetIndex < 0 || targetIndex >= targetDay.tasks.length) return;

    const reorderedTasks = [...targetDay.tasks];
    const [moved] = reorderedTasks.splice(currentIndex, 1);
    reorderedTasks.splice(targetIndex, 0, moved);

    const reorderedPayload = reorderedTasks.map((t, idx) => ({
      id: t.id,
      sortOrder: idx,
    }));

    if (isAuthenticated) {
      // 1. Optimistically update TanStack history query cache
      queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
        if (!old || !old.days) return old;
        return {
          ...old,
          days: old.days.map((d) => {
            if (d.date !== dateStr) return d;
            return {
              ...d,
              tasks: reorderedTasks,
            };
          }),
        };
      });

      // 2. If reordering today's tasks, also optimistically update Dashboard cache
      if (dateStr === todayStr) {
        queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
          if (!oldTasks) return oldTasks;
          const sortMap = new Map(reorderedPayload.map((p) => [p.id, p.sortOrder]));
          return [...oldTasks]
            .map((item) => {
              const itemId = item._id || item.id;
              if (itemId && sortMap.has(itemId)) {
                return { ...item, sortOrder: sortMap.get(itemId)! };
              }
              return item;
            })
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        });
      }

      // 3. Persist to backend
      fetch('/api/tasks/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderedPayload }),
        credentials: 'include',
      }).catch((err) => {
        console.error('Failed to persist intra-day task reorder:', err);
      });
    } else {
      // Guest mode: update Zustand store which syncs to localStorage
      reorderGuestTasks(reorderedPayload);
    }
  };

  /**
   * Task Checkbox Toggle Handler with optimistic state updates & global sync
   */
  const handleToggleTask = async (id: string, nextCompleted: boolean) => {
    // Past tasks are historical and immutable
    const targetDay = days.find((d) => d.tasks.some((t) => t.id === id));
    if (targetDay && targetDay.date < todayStr) {
      return;
    }

    if (isAuthenticated) {
      // 1. Optimistically update local query cache
      queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
        if (!old) return old;
        return {
          ...old,
          upcomingTasks: (old.upcomingTasks || []).map((t) =>
            t.id === id
              ? {
                  ...t,
                  isCompleted: nextCompleted,
                  status: (nextCompleted ? 'completed' : 'pending') as HistoryTask['status'],
                }
              : t
          ),
          days: old.days.map((day) => {
            const hasTask = day.tasks.some((t) => t.id === id);
            if (!hasTask) return day;

            const updatedTasks = day.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    isCompleted: nextCompleted,
                    status: (nextCompleted
                      ? 'completed'
                      : day.date < todayStr
                      ? 'missed'
                      : 'pending') as HistoryTask['status'],
                  }
                : t
            );

            const newCompletedCount = updatedTasks.filter((t) => t.isCompleted).length;
            const newPercentage =
              day.totalCount > 0 ? Math.round((newCompletedCount / day.totalCount) * 100) : 0;

            if (day.isToday) {
              setTodayChecklistCompletedCount(newCompletedCount);
            }

            return {
              ...day,
              tasks: updatedTasks,
              completedCount: newCompletedCount,
              completionPercentage: newPercentage,
            };
          }),
        };
      });

      // 2. Optimistically update Dashboard cache if task is today
      queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
        if (!oldTasks) return oldTasks;
        return oldTasks.map((t) => (t._id === id ? { ...t, isCompleted: nextCompleted } : t));
      });

      // 3. Invalidate tasks queries in background
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // 4. Send PATCH to server
      try {
        await fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isCompleted: nextCompleted }),
        });
      } catch (err) {
        console.warn('Failed to update task completion on server:', err);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    } else {
      // Guest mode
      updateGuestTask(id, { isCompleted: nextCompleted });
    }
  };

  /**
   * Reschedule Handler (Copies missed task to Today, Tomorrow, or Custom Date)
   */
  const handleReschedule = async (targetDate: 'today' | 'tomorrow' | string) => {
    if (!rescheduleTask) return;

    let targetDateStr = '';
    if (targetDate === 'today') {
      targetDateStr = todayStr;
    } else if (targetDate === 'tomorrow') {
      targetDateStr = tomorrowStr;
    } else {
      targetDateStr = targetDate;
    }

    const origDateStr = (rescheduleTask.date || todayStr).slice(0, 10);
    const isPastTask = origDateStr < todayStr;
    const shouldRemoveFromOriginal = !isPastTask; // Today and Tomorrow tasks are moved (removed from original day)

    if (isAuthenticated) {
      try {
        const res = await fetch(`/api/tasks/${rescheduleTask.id}/reschedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetDate: targetDateStr }),
        });

        const json = await res.json();
        if (json?.success && json?.data?.newTask) {
          const newTask = json.data.newTask;
          const wasMoved = json.data.wasMoved ?? shouldRemoveFromOriginal;
          const mappedTask: HistoryTask = {
            id: newTask._id,
            title: newTask.title,
            isCompleted: false,
            category: normalizeCategory(newTask.category),
            priority: newTask.priority || 'normal',
            timeTag: newTask.timeTag || null,
            isHabitInstance: false,
            habitId: newTask.habitId || null,
            status: 'pending',
            date: targetDateStr,
            createdAt: newTask.createdAt,
          };

          // Update UI cache for task history
          queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
            if (!old) return old;
            return {
              ...old,
              days: old.days.map((day) => {
                let updatedTasks = day.tasks;
                let newTotalCount = day.totalCount;
                let newCompletedCount = day.completedCount;

                // If task was moved (Today, Tomorrow, or future), remove from original day
                if (wasMoved && day.date === origDateStr) {
                  const removed = updatedTasks.find((t) => t.id === rescheduleTask.id);
                  updatedTasks = updatedTasks.filter((t) => t.id !== rescheduleTask.id);
                  newTotalCount = Math.max(0, newTotalCount - 1);
                  if (removed?.isCompleted) {
                    newCompletedCount = Math.max(0, newCompletedCount - 1);
                  }
                }

                // Add to target day
                if (day.date === targetDateStr) {
                  updatedTasks = [mappedTask, ...updatedTasks];
                  newTotalCount += 1;
                }

                const newPercentage =
                  newTotalCount > 0 ? Math.round((newCompletedCount / newTotalCount) * 100) : 0;

                return {
                  ...day,
                  tasks: updatedTasks,
                  totalCount: newTotalCount,
                  completedCount: newCompletedCount,
                  completionPercentage: newPercentage,
                };
              }),
            };
          });

          // If moved from today to another date, remove from Dashboard cache
          if (wasMoved && origDateStr === todayStr && targetDateStr !== todayStr) {
            queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
              if (!oldTasks) return oldTasks;
              return oldTasks.filter((t) => t._id !== rescheduleTask.id);
            });
          }

          // If scheduled for today, add to Dashboard cache
          if (targetDateStr === todayStr) {
            queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
              if (!oldTasks) return oldTasks;
              const cleanTasks =
                wasMoved && origDateStr === todayStr
                  ? oldTasks.filter((t) => t._id !== rescheduleTask.id)
                  : oldTasks;
              return [
                {
                  _id: newTask._id,
                  title: newTask.title,
                  isCompleted: false,
                  isHabitInstance: false,
                  sortOrder: 0,
                  category: normalizeCategory(newTask.category),
                  priority: newTask.priority || 'normal',
                  timeTag: newTask.timeTag,
                  createdAt: newTask.createdAt,
                },
                ...cleanTasks,
              ];
            });
          }

          // Invalidate tasks queries so Dashboard & other views stay dynamically in sync
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          showToast(
            wasMoved ? 'Task Moved! 🎯' : 'Task Rescheduled! 🎯',
            wasMoved
              ? `"${rescheduleTask.title}" has been moved to ${
                  targetDate === 'today' ? 'Today' : targetDate === 'tomorrow' ? 'Tomorrow' : targetDateStr
                }.`
              : `"${rescheduleTask.title}" has been cloned and scheduled for ${
                  targetDate === 'today' ? 'Today' : targetDate === 'tomorrow' ? 'Tomorrow' : targetDateStr
                }.`,
            'success'
          );
        }
      } catch (err) {
        console.warn('Reschedule failed:', err);
      }
    } else {
      // Guest Mode Reschedule
      if (shouldRemoveFromOriginal) {
        deleteGuestTask(rescheduleTask.id);
      }

      const newGuestTask: GuestTask = {
        id: `guest_task_${Date.now()}`,
        title: rescheduleTask.title,
        date: targetDateStr,
        isCompleted: false,
        isHabitInstance: false,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        category: normalizeCategory(rescheduleTask.category),
        priority: rescheduleTask.priority,
        timeTag: rescheduleTask.timeTag || undefined,
      };

      addGuestTask(newGuestTask);
      showToast(
        shouldRemoveFromOriginal ? 'Task Moved! 🎯' : 'Task Rescheduled! 🎯',
        shouldRemoveFromOriginal
          ? `"${rescheduleTask.title}" moved to ${
              targetDate === 'today' ? 'Today' : targetDate === 'tomorrow' ? 'Tomorrow' : targetDateStr
            }.`
          : `"${rescheduleTask.title}" scheduled for ${
              targetDate === 'today' ? 'Today' : targetDate === 'tomorrow' ? 'Tomorrow' : targetDateStr
            }.`,
        'success'
      );
    }
  };

  /**
   * Delete Task Handler (Confirmed from Modal)
   * Smoothly plays swipe-out animation without UI jumping or flash-back,
   * optimistically removes from cache, and dispatches soft-delete
   */
  const handleConfirmDelete = (task: HistoryTask) => {
    const targetId = task.id;
    const taskTitle = task.title || 'Task';
    const taskDate = (task.date || todayStr).slice(0, 10);

    // 1. Close modal immediately and start smooth swipe-out CSS transition
    setTaskToDelete(null);
    setSwipingOutTaskId(targetId);

    // 2. Wait 380ms for swipe-out animation to complete
    setTimeout(async () => {
      // Optimistically remove from History cache
      queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
        if (!old) return old;
        return {
          ...old,
          upcomingTasks: (old.upcomingTasks || []).filter((t) => t.id !== targetId),
          days: old.days.map((d) => {
            const filtered = d.tasks.filter((t) => t.id !== targetId);
            if (filtered.length === d.tasks.length) return d;
            const completed = filtered.filter((t) => t.isCompleted).length;
            const total = filtered.length;
            return {
              ...d,
              tasks: filtered,
              totalCount: total,
              completedCount: completed,
              completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
          }),
          totalLoggedCount: Math.max(0, (old.totalLoggedCount ?? 1) - 1),
        };
      });

      // If task belongs to Today, optimistically remove from Dashboard cache
      if (taskDate === todayStr) {
        queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
          if (!Array.isArray(oldTasks)) return oldTasks;
          return oldTasks.filter((t) => (t._id || t.id) !== targetId);
        });
      }

      // Reset swiping out id
      setSwipingOutTaskId((curr) => (curr === targetId ? null : curr));

      if (isAuthenticated) {
        try {
          await fetch(`/api/tasks/${targetId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          // Update Trash view cache
          queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
        } catch (err) {
          console.error('Failed to soft-delete task:', err);
        }
      } else {
        deleteGuestTask(targetId);
      }

      showToast('Moved to Trash', `"${taskTitle}" moved to 30-day trash.`, 'info', {
        label: 'Undo',
        onClick: async () => {
          if (isAuthenticated) {
            try {
              await fetch(`/api/tasks/${targetId}/restore`, {
                method: 'POST',
                credentials: 'include',
              });
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
            } catch (err) {
              console.error('Failed to restore task:', err);
            }
          }
          markTaskRestored(targetId);
        },
      });
    }, 380);
  };

  /**
   * Save Task (Create new or Edit existing with dynamic Dashboard sync)
   */
  const handleSaveTask = async (taskData: {
    id?: string;
    title: string;
    date: string;
    category: string;
    priority: 'normal' | 'high';
    timeTag?: string;
  }) => {
    if (taskData.id) {
      // Edit existing task
      if (isAuthenticated) {
        // 1. Optimistically update history cache
        queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
          if (!old) return old;
          return {
            ...old,
            upcomingTasks: (old.upcomingTasks || []).map((t) =>
              t.id === taskData.id
                ? {
                    ...t,
                    title: taskData.title,
                    category: normalizeCategory(taskData.category),
                    priority: taskData.priority,
                    timeTag: taskData.timeTag || null,
                    date: taskData.date,
                  }
                : t
            ),
            days: old.days.map((d) => ({
              ...d,
              tasks: d.tasks.map((t) =>
                t.id === taskData.id
                  ? {
                      ...t,
                      title: taskData.title,
                      category: normalizeCategory(taskData.category),
                      priority: taskData.priority,
                      timeTag: taskData.timeTag || null,
                      date: taskData.date,
                    }
                  : t
              ),
            })),
          };
        });

        // 2. If task date is today, optimistically update Dashboard cache
        if (taskData.date === todayStr) {
          queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
            if (!oldTasks) return oldTasks;
            return oldTasks.map((t) =>
              t._id === taskData.id
                ? {
                    ...t,
                    title: taskData.title,
                    category: normalizeCategory(taskData.category),
                    priority: taskData.priority,
                    timeTag: taskData.timeTag,
                  }
                : t
            );
          });
        }

        // 3. Invalidate tasks queries
        queryClient.invalidateQueries({ queryKey: ['tasks'] });

        await fetch(`/api/tasks/${taskData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: taskData.title,
            date: taskData.date,
            category: taskData.category,
            priority: taskData.priority,
            timeTag: taskData.timeTag,
          }),
        });

        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        updateGuestTask(taskData.id, {
          title: taskData.title,
          date: taskData.date,
          category: normalizeCategory(taskData.category),
          priority: taskData.priority,
          timeTag: taskData.timeTag,
        });
      }

      showToast('Task Updated', `"${taskData.title}" details saved.`, 'success');
    } else {
      // Create new task
      const newTaskId = `history_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const targetDateStr = (taskData.date || todayStr).slice(0, 10);

      // Dismiss any active inputs to avoid browser viewport pinning
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Close modal immediately
      setIsEditCreateOpen(false);

      // Immediately activate typewriter creating state for smooth typing effect
      setCreatingTaskId(newTaskId);

      const optimisticTask: HistoryTask = {
        id: newTaskId,
        title: taskData.title.trim(),
        isCompleted: false,
        category: normalizeCategory(taskData.category),
        priority: taskData.priority,
        timeTag: taskData.timeTag || null,
        isHabitInstance: false,
        habitId: null,
        status: 'pending',
        date: targetDateStr,
        createdAt: new Date().toISOString(),
      };

      if (isAuthenticated) {
        // Optimistically insert into history cache
        queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
          if (!old) return old;

          // If task is scheduled for tomorrow or a future date, insert into upcomingTasks
          if (targetDateStr > todayStr) {
            const nextUpcoming = [...(old.upcomingTasks || []), optimisticTask].sort(
              (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
            );
            return {
              ...old,
              upcomingTasks: nextUpcoming,
              totalLoggedCount: (old.totalLoggedCount ?? 0) + 1,
            };
          }

          const exists = old.days.some((d) => d.date === targetDateStr);
          let nextDays: HistoryDayBucket[];
          if (exists) {
            nextDays = old.days.map((d) => {
              if (d.date === targetDateStr) {
                const updatedTasks = [optimisticTask, ...d.tasks];
                const totalCount = updatedTasks.length;
                const completedCount = updatedTasks.filter((t) => t.isCompleted).length;
                return {
                  ...d,
                  tasks: updatedTasks,
                  totalCount,
                  completedCount,
                  completionPercentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
                };
              }
              return d;
            });
          } else {
            const dateObj = new Date(targetDateStr + 'T12:00:00.000Z');
            const newDayBucket: HistoryDayBucket = {
              date: targetDateStr,
              label: dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              }).toUpperCase(),
              formattedDate: dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              }),
              isTomorrow: targetDateStr === tomorrowStr,
              isToday: targetDateStr === todayStr,
              isYesterday: false,
              tasks: [optimisticTask],
              totalCount: 1,
              completedCount: 0,
              completionPercentage: 0,
            };
            nextDays = [...old.days, newDayBucket].sort((a, b) => b.date.localeCompare(a.date));
          }
          return {
            ...old,
            days: nextDays,
            totalLoggedCount: (old.totalLoggedCount ?? 0) + 1,
          };
        });

        // If created for today, optimistically append to Dashboard cache
        if (targetDateStr === todayStr) {
          queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
            const dashTask = {
              _id: newTaskId,
              title: taskData.title.trim(),
              category: normalizeCategory(taskData.category),
              priority: taskData.priority,
              timeTag: taskData.timeTag || 'Today',
              isCompleted: false,
              isHabitInstance: false,
              createdAt: new Date().toISOString(),
            };
            return Array.isArray(oldTasks) ? [dashTask, ...oldTasks] : [dashTask];
          });
        }

        // Trigger smooth scroll to newly created task
        scrollWorkspaceToTask(newTaskId);

        // Send POST to server without premature query refetch that cancels animations
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: taskData.title.trim(),
            date: targetDateStr,
            category: taskData.category,
            priority: taskData.priority,
            timeTag: taskData.timeTag,
            isCompleted: false,
          }),
        })
          .then((res) => res.json())
          .then((json) => {
            const serverTask = json?.data;
            if (serverTask?._id) {
              const serverId = serverTask._id;
              // Seamlessly update ID in history cache
              queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
                if (!old) return old;
                return {
                  ...old,
                  days: old.days.map((d) => ({
                    ...d,
                    tasks: d.tasks.map((t) => (t.id === newTaskId ? { ...t, id: serverId } : t)),
                  })),
                };
              });

              if (targetDateStr === todayStr) {
                queryClient.setQueryData(['tasks', todayStr], (oldTasks: DashboardCacheTask[] | undefined) => {
                  if (!Array.isArray(oldTasks)) return oldTasks;
                  return oldTasks.map((t) => (t._id === newTaskId ? { ...t, _id: serverId } : t));
                });
              }
            }
          })
          .catch((err) => {
            console.error('Failed to save created task:', err);
            // Rollback on error
            queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
              if (!old) return old;
              return {
                ...old,
                days: old.days.map((d) => ({
                  ...d,
                  tasks: d.tasks.filter((t) => t.id !== newTaskId),
                })),
              };
            });
            setCreatingTaskId(null);
          });
      } else {
        // Guest mode
        addGuestTask({
          id: newTaskId,
          title: taskData.title.trim(),
          date: targetDateStr,
          isCompleted: false,
          isHabitInstance: false,
          sortOrder: 0,
          category: normalizeCategory(taskData.category),
          priority: taskData.priority,
          timeTag: taskData.timeTag,
        });
        scrollWorkspaceToTask(newTaskId);
      }

      showToast('Task Created', `"${taskData.title}" added to your history schedule.`, 'success');
    }
  };

  const handleOpenEdit = (task: HistoryTask) => {
    setEditCreateTask(task);
    setDefaultCreateDate(task.date);
    setIsEditCreateOpen(true);
  };

  const handleOpenNewTask = (date?: string) => {
    setEditCreateTask(null);
    setDefaultCreateDate(date || todayStr);
    setIsEditCreateOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 px-2 sm:px-4 select-none">
      <SEOHead
        title="Daily Tasks & Focus - Taskiye Task Manager"
        description="Organize your daily tasks, set priorities, reschedule with one click, and maintain productive momentum on Taskiye."
        canonicalPath="/tasks"
      />
      {/* 1. Header Toolbar */}
      <TaskHistoryHeader
        totalLoggedCount={totalLoggedCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        hideCompleted={hideCompleted}
        onToggleHideCompleted={() => setHideCompleted((prev) => !prev)}
        onNewTaskClick={() => handleOpenNewTask()}
      />

      {/* 2. Upcoming Scheduled Tasks (Expandable Section at top) */}
      <TaskHistoryUpcomingSection
        upcomingTasks={upcomingTasks}
        expandedTaskId={expandedTaskId}
        creatingTaskId={creatingTaskId}
        highlightedTaskId={highlightedTaskId}
        swipingOutTaskId={swipingOutTaskId}
        onCreationAnimationComplete={handleCreationAnimationComplete}
        onToggleExpand={(id) => setExpandedTaskId((prev) => (prev === id ? null : id))}
        onToggle={handleToggleTask}
        onEdit={handleOpenEdit}
        onDelete={(task) => setTaskToDelete(task)}
        onOpenReschedule={(task) => {
          setRescheduleTask(task);
          setIsRescheduleOpen(true);
        }}
        onAddTask={() => handleOpenNewTask(tomorrowStr)}
      />

      {/* 3. Chronological Day Sections */}
      {isLoadingInitial ? (
        <TaskHistorySkeleton />
      ) : days.length > 0 ? (
        <div className="flex flex-col gap-6 w-full">
          {days.map((day) => (
            <TaskHistoryDaySection
              key={day.date}
              day={day}
              expandedTaskId={expandedTaskId}
              creatingTaskId={creatingTaskId}
              highlightedTaskId={highlightedTaskId}
              swipingOutTaskId={swipingOutTaskId}
              onCreationAnimationComplete={handleCreationAnimationComplete}
              onToggleExpand={(id) => setExpandedTaskId((prev) => (prev === id ? null : id))}
              onToggle={handleToggleTask}
              onEdit={handleOpenEdit}
              onDelete={(task) => setTaskToDelete(task)}
              onOpenReschedule={(task) => {
                setRescheduleTask(task);
                setIsRescheduleOpen(true);
              }}
              onQuickReschedule={(id, target) => {
                const found = day.tasks.find((t) => t.id === id);
                if (found) {
                  setRescheduleTask(found);
                  handleReschedule(target);
                }
              }}
              onAddTaskForDay={handleOpenNewTask}
              onReorderTask={handleReorderTaskInDay}
            />
          ))}

          {/* Infinite Scroll Bottom Trigger & Skeleton Indicator */}
          <div ref={loadMoreRef} className="w-full">
            {isLoadingMore && (
              <TaskHistorySkeleton
                isLoadingMore={true}
                moreDaysCount={14}
                currentMonthLabel={days[days.length - 1]?.label || 'earlier dates'}
              />
            )}
            {!hasMore && days.length > 3 && (
              <div className="py-8 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>All historical logs loaded</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3 rounded-3xl bg-white dark:bg-[#10192D] border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No tasks match your filters</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Try adjusting your search criteria, category filters, or add a new scheduled task.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All Categories');
              setHideCompleted(false);
            }}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30 hover:bg-amber-500/20 dark:hover:bg-amber-400/20 transition-all cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Reschedule Modal */}
      <TaskRescheduleModal
        isOpen={isRescheduleOpen}
        onClose={() => {
          setIsRescheduleOpen(false);
          setRescheduleTask(null);
        }}
        taskTitle={rescheduleTask?.title || ''}
        taskDate={rescheduleTask?.date}
        onReschedule={handleReschedule}
      />

      {/* Edit / Create Task Modal */}
      <TaskEditCreateModal
        isOpen={isEditCreateOpen}
        onClose={() => {
          setIsEditCreateOpen(false);
          setEditCreateTask(null);
        }}
        taskToEdit={editCreateTask}
        defaultDate={defaultCreateDate}
        onSave={handleSaveTask}
      />

      {/* Move to Trash Confirmation Modal */}
      {taskToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setTaskToDelete(null)}
        >
          <div
            className="bg-white dark:bg-[#162032] border border-slate-200 dark:border-amber-400/20 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setTaskToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Trash Icon & Heading with clear 30-day instruction */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.15)] dark:shadow-[0_0_12px_rgba(250,204,21,0.15)]">
                <Trash2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Move to Trash?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                  Retained in 30-Day Trash. You can restore it anytime.
                </p>
              </div>
            </div>

            {/* Target Item Preview */}
            <div className="bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 truncate">
              <span className="text-slate-400 mr-1.5">Task:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{taskToDelete.title}</span>
            </div>

            {/* Actions: Cancel & Move to Trash */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(taskToDelete)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
