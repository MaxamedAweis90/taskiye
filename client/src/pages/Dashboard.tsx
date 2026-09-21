import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Check,
  Sparkles,
  TrendingUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth-client';
import { useTaskiyeStore, DEFAULT_INITIAL_TASKS } from '../store/useTaskiyeStore';
import { HeatmapMatrix } from '../components/dashboard/HeatmapMatrix';
import { TodayChecklist, ChecklistItem } from '../components/dashboard/TodayChecklist';
import { CustomScrollArea } from '../components/common/CustomScrollArea';
import { APP_CATEGORIES, normalizeCategory, getCategoryBadgeStyle } from '../constants/categories';
import { SEOHead } from '../components/common/SEOHead';

interface ServerTaskItem {
  _id: string;
  title: string;
  isCompleted: boolean;
  isHabitInstance: boolean;
  habitId?: string | { _id: string };
  sortOrder?: number;
  category?: string;
  priority?: 'normal' | 'high';
  timeTag?: string;
  createdAt?: string;
}

export const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  // Zustand Guest Store
  const {
    tasks: guestTasks,
    habits: guestHabits,
    currentDateStr,
    getGuestActivityMap,
    toggleGuestTask,
    addGuestTask,
    updateGuestTask,
    removeGuestTask,
    reorderGuestTasks,
    syncHabitsToTodayTasks,
    setBaseStreakDays,
    showToast,
    restoredTaskId,
  } = useTaskiyeStore();

  // Quick Action form state (Task-only creation)
  const [itemTitle, setItemTitle] = useState('');
  const [category, setCategory] = useState<string>('Work');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [editingTask, setEditingTask] = useState<ChecklistItem | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);

  // 1. Immediately unsuppress task when restored from TrashModal or Undo toast
  React.useEffect(() => {
    if (restoredTaskId) {
      setDeletedTaskIds((prev) => {
        if (prev.has(restoredTaskId)) {
          const next = new Set(prev);
          next.delete(restoredTaskId);
          return next;
        }
        return prev;
      });
    }
  }, [restoredTaskId]);

  // 2. Listen for task highlight events (from AI Chat "View in Dashboard" link)
  React.useEffect(() => {
    const handleHighlightEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ taskId: string }>;
      const taskId = customEvent.detail?.taskId;
      if (taskId) {
        setHighlightedTaskId(taskId);
        scrollWorkspaceToTask(taskId);
        setTimeout(() => {
          setHighlightedTaskId((curr) => (curr === taskId ? null : curr));
          sessionStorage.removeItem('taskiye_highlight_task');
        }, 3000);
      }
    };

    window.addEventListener('taskiye-highlight-task', handleHighlightEvent);

    // Also check on mount / navigation if a task highlight was queued
    const storedHighlight = sessionStorage.getItem('taskiye_highlight_task');
    if (storedHighlight) {
      setTimeout(() => {
        setHighlightedTaskId(storedHighlight);
        scrollWorkspaceToTask(storedHighlight);
        setTimeout(() => {
          setHighlightedTaskId((curr) => (curr === storedHighlight ? null : curr));
          sessionStorage.removeItem('taskiye_highlight_task');
        }, 3000);
      }, 350);
    }

    return () => {
      window.removeEventListener('taskiye-highlight-task', handleHighlightEvent);
    };
  }, []);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const modalTitleInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Today ISO Date string from store (reacts immediately to midnight date rollover)
  const todayStr = currentDateStr || new Date().toLocaleDateString('en-CA');

  // Persistent checklist order key per user and date
  const orderStorageKey = `taskiye_checklist_order_${session?.user?.id || 'guest'}_${todayStr}`;

  const [customChecklistOrder, setCustomChecklistOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(orderStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync saved order whenever active user or date changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(orderStorageKey);
      if (saved) {
        setCustomChecklistOrder(JSON.parse(saved));
      } else {
        setCustomChecklistOrder([]);
      }
    } catch {
      setCustomChecklistOrder([]);
    }
  }, [orderStorageKey]);

  // Sync active due habits into today's tasks overview on initial load and date rollover
  React.useEffect(() => {
    if (!isAuthenticated) {
      syncHabitsToTodayTasks();
    }
  }, [isAuthenticated, syncHabitsToTodayTasks, todayStr]);

  // TanStack Query for Authenticated Tasks
  const { data: serverTasks = [] } = useQuery({
    queryKey: ['tasks', todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?date=${todayStr}`, { credentials: 'include' });
      const json = await res.json();
      return (json.data || []) as Array<{
        _id: string;
        title: string;
        isCompleted: boolean;
        isHabitInstance: boolean;
        habitId?: string | { _id: string };
        sortOrder: number;
        category?: string;
        priority?: 'normal' | 'high';
        timeTag?: string;
        createdAt?: string;
      }>;
    },
    enabled: isAuthenticated,
  });

  // TanStack Query for Authenticated Tasks Activity Map (Heatmap Historical Activity)
  const { data: serverActivity = {} } = useQuery({
    queryKey: ['tasks', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/activity', { credentials: 'include' });
      const json = await res.json();
      return (json.data || {}) as Record<string, { completedCount: number; totalCount: number }>;
    },
    enabled: isAuthenticated,
  });

  // Unified Activity Data for Heatmap
  const activityLogs = useMemo(() => {
    if (isAuthenticated) {
      return serverActivity;
    }
    if (!guestTasks && !guestHabits) return {};
    return getGuestActivityMap();
  }, [isAuthenticated, serverActivity, getGuestActivityMap, guestTasks, guestHabits]);

  // TanStack Query for Authenticated Habits
  const { data: serverHabits = [] } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits', { credentials: 'include' });
      const json = await res.json();
      return (json.data || []) as Array<{
        _id: string;
        title: string;
        frequency: string;
        category?: string;
        timeOfDay?: string;
        activeDays?: number[];
        isArchived?: boolean;
        streakDays?: number;
        totalCompletions?: number;
        warnings?: number;
        lastCompletedDate?: string;
        isStreakFrozen?: boolean;
      }>;
    },
    enabled: isAuthenticated,
  });

  // Task Toggle Mutation (Auth Mode) with instant Optimistic Updates
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted }),
        credentials: 'include',
      });
      return res.json();
    },
    onMutate: async ({ id, isCompleted }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks', todayStr] });

      // Snapshot the previous tasks
      const previousTasks = queryClient.getQueryData(['tasks', todayStr]);

      // Optimistically update the cache immediately
      queryClient.setQueryData<ServerTaskItem[]>(['tasks', todayStr], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((t) =>
          t._id === id ? { ...t, isCompleted } : t
        );
      });

      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', todayStr], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  // Task Creation Mutation (Auth Mode)
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: {
      title: string;
      date?: string;
      category?: string;
      priority?: 'normal' | 'high';
      timeTag?: string;
      isHabitInstance?: boolean;
    }) => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });



  // Task Update Mutation (Auth Mode)
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      priority,
      category,
    }: {
      id: string;
      title: string;
      priority?: 'normal' | 'high';
      category?: string;
    }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority, category }),
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Task Delete Mutation (Auth Mode)
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Active items mapping with starter fallback
  const checklistItems: ChecklistItem[] = useMemo(() => {
    let items: ChecklistItem[] = [];

    const now = new Date();
    const jsDay = now.getDay();
    const monBasedDay = (jsDay + 6) % 7; // Mon: 0, Tue: 1, ..., Sun: 6

    if (isAuthenticated) {
      items = serverTasks
        .filter((t) => {
          if (!t.isHabitInstance) return true;
          const rawHabitId = typeof t.habitId === 'string' ? t.habitId : t.habitId?._id;
          const linkedHabit = serverHabits.find(
            (h) =>
              h._id === rawHabitId ||
              (h.title && t.title && h.title.toLowerCase().trim() === t.title.toLowerCase().trim())
          );
          // If the habit was removed (deleted or archived), omit its task instance
          if (!linkedHabit || linkedHabit.isArchived) return false;
          return true;
        })
        .map((t) => {
          const rawHabitId = typeof t.habitId === 'string' ? t.habitId : t.habitId?._id;
          const linkedHabit = serverHabits.find(
            (h) =>
              h._id === rawHabitId ||
              (h.title && t.title && h.title.toLowerCase().trim() === t.title.toLowerCase().trim())
          );

          return {
            id: t._id,
            title: t.title,
            isCompleted: Boolean(t.isCompleted),
            category: normalizeCategory(
              t.isHabitInstance
                ? (linkedHabit?.category || t.category || 'Routine Activity')
                : (t.category || 'Work')
            ),
            priority: t.priority || 'normal',
            timeTag: t.timeTag || (t.isHabitInstance ? 'Continuous' : 'Today'),
            isHabitInstance: Boolean(t.isHabitInstance),
            habitId: rawHabitId || linkedHabit?._id,
            streakDays: linkedHabit?.streakDays,
            warnings: linkedHabit?.warnings,
            isStreakFrozen: Boolean(linkedHabit?.isStreakFrozen),
          };
        });

      // Ensure active server habits scheduled for today are present in overview
      const existingTitles = new Set(items.map((i) => i.title.toLowerCase().trim()));
      serverHabits.forEach((h) => {
        if (h.isArchived) return;
        const isDueToday =
          Array.isArray(h.activeDays) && h.activeDays.length > 0
            ? h.activeDays.includes(monBasedDay)
            : (h.frequency || '').toLowerCase().includes('daily') ||
              (h.frequency || '').toLowerCase().includes('everyday');

        if (isDueToday && !existingTitles.has(h.title.toLowerCase().trim())) {
          items.unshift({
            id: `server_habit_${h._id}`,
            title: h.title,
            isCompleted: false,
            category: normalizeCategory(h.category),
            priority: 'normal',
            timeTag: h.timeOfDay || 'Continuous',
            isHabitInstance: true,
            habitId: h._id,
            streakDays: h.streakDays ?? 0,
            warnings: h.warnings ?? 0,
            isStreakFrozen: Boolean(h.isStreakFrozen),
          });
        }
      });
    } else {
      const tasksToUse = [...(guestTasks ?? DEFAULT_INITIAL_TASKS)]
        .filter((t) => !t.date || t.date.startsWith(todayStr))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      items = tasksToUse
        .filter((t) => {
          if (!t.isHabitInstance) return true;
          const linkedHabit = guestHabits.find(
            (h) =>
              h.id === t.habitId ||
              (h.title && t.title && h.title.toLowerCase().trim() === t.title.toLowerCase().trim())
          );
          // If the habit was removed (deleted or archived), omit its task instance
          if (!linkedHabit || linkedHabit.isArchived) return false;
          return true;
        })
        .map((t) => {
          const linkedHabit = guestHabits.find(
            (h) =>
              h.id === t.habitId ||
              (h.title && t.title && h.title.toLowerCase().trim() === t.title.toLowerCase().trim())
          );

          return {
            id: t.id,
            title: t.title,
            isCompleted: t.isCompleted,
            category: normalizeCategory(
              t.isHabitInstance
                ? (linkedHabit?.category || t.category || 'Routine Activity')
                : (t.category || 'Work')
            ),
            priority: t.priority || 'normal',
            timeTag: t.timeTag || (t.isHabitInstance ? 'Continuous' : 'Today'),
            isHabitInstance: Boolean(t.isHabitInstance),
            habitId: t.habitId || linkedHabit?.id,
            streakDays: linkedHabit?.streakDays,
            warnings: linkedHabit?.warnings,
            isStreakFrozen: Boolean(linkedHabit?.isStreakFrozen),
          };
        });

      // Ensure any active guest habit scheduled for today in Habit Manager is included
      const existingHabitIds = new Set(
        items.filter((t) => t.isHabitInstance).map((t) => t.habitId).filter(Boolean)
      );
      const existingTitles = new Set(
        items.map((t) => t.title.toLowerCase().trim())
      );

      guestHabits.forEach((h) => {
        if (h.isArchived) return;
        const isDueToday =
          Array.isArray(h.activeDays) && h.activeDays.length > 0
            ? h.activeDays.includes(monBasedDay)
            : (h.frequency || '').toLowerCase().includes('daily') ||
              (h.frequency || '').toLowerCase().includes('everyday');

        if (
          isDueToday &&
          !existingHabitIds.has(h.id) &&
          !existingTitles.has(h.title.toLowerCase().trim())
        ) {
          items.unshift({
            id: `guest_task_habit_${h.id}_today`,
            title: h.title,
            isCompleted: false,
            category: normalizeCategory(h.category),
            priority: 'normal',
            timeTag: h.timeOfDay || 'Continuous',
            isHabitInstance: true,
            habitId: h.id,
            streakDays: h.streakDays ?? 0,
            warnings: h.warnings ?? 0,
          });
        }
      });
    }

    // Strict Deduplication Pass: Ensure each habit or task appears exactly once
    const uniqueMap = new Map<string, ChecklistItem>();
    for (const item of items) {
      const key = item.habitId ? `habit_${item.habitId}` : `title_${item.title.toLowerCase().trim()}`;
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, item);
      } else {
        // Conflict resolution:
        // 1. Prefer completed status
        // 2. Prefer real persistent DB task over placeholder unpersisted habit
        const isExistingVirtual = existing.id.startsWith('server_habit_') || existing.id.startsWith('guest_task_habit_');
        const isNewPersisted = !item.id.startsWith('server_habit_') && !item.id.startsWith('guest_task_habit_');
        if ((!existing.isCompleted && item.isCompleted) || (isExistingVirtual && isNewPersisted && !existing.isCompleted)) {
          uniqueMap.set(key, item);
        }
      }
    }

    const deduplicatedItems = Array.from(uniqueMap.values());
    const baseItems = deduplicatedItems.filter((item) => !deletedTaskIds.has(item.id));

    if (customChecklistOrder.length > 0) {
      const orderMap = new Map(customChecklistOrder.map((id, index) => [id, index]));
      return [...baseItems].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
        return orderA - orderB;
      });
    }

    return baseItems;
  }, [isAuthenticated, serverTasks, serverHabits, guestTasks, guestHabits, deletedTaskIds, customChecklistOrder, todayStr]);

  // Derived Metrics
  const totalItemsCount = checklistItems.length;
  const completedCount = checklistItems.filter((i) => i.isCompleted).length;
  const pendingTasksCount = checklistItems.filter((i) => !i.isCompleted).length;
  const highPriorityPendingCount = checklistItems.filter(
    (i) => !i.isCompleted && i.priority === 'high'
  ).length;
  const normalPriorityPendingCount = Math.max(0, pendingTasksCount - highPriorityPendingCount);

  const habitsList = isAuthenticated ? serverHabits : guestHabits;
  const todayHabitItems = checklistItems.filter((i) => i.isHabitInstance);
  const habitsDoneCount = todayHabitItems.filter((i) => i.isCompleted).length;
  const habitsTodayTotalCount = todayHabitItems.length;

  // Per-Habit Streaks are maintained individually on each habit (h.streakDays).
  // Global Daily Streak: counts if user checked ANY task or habit on that calendar day.
  const pastConsecutiveDailyStreak = useMemo(() => {
    if (!activityLogs) return 0;
    let streak = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1); // Start checking backwards from yesterday

    for (let i = 0; i < 365; i++) {
      const localStr = d.toLocaleDateString('en-CA');
      const utcStr = d.toISOString().slice(0, 10);
      const dayRecord = activityLogs[localStr] || activityLogs[utcStr];
      if (dayRecord && dayRecord.completedCount > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [activityLogs]);

  // Base daily streak prior to today, strictly matching calendar activity logs
  const baseDailyStreak = pastConsecutiveDailyStreak;

  // If user completed ANY task or habit today, increment daily streak by 1
  const localTodayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const utcTodayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isAnyItemDoneToday =
    completedCount > 0 ||
    (activityLogs[todayStr]?.completedCount || 0) > 0 ||
    (activityLogs[localTodayStr]?.completedCount || 0) > 0 ||
    (activityLogs[utcTodayStr]?.completedCount || 0) > 0;
  const globalDailyStreak = baseDailyStreak + (isAnyItemDoneToday ? 1 : 0);

  useEffect(() => {
    setBaseStreakDays(baseDailyStreak);
  }, [baseDailyStreak, setBaseStreakDays]);

  const completionRate =
    totalItemsCount > 0 ? Math.round((completedCount / totalItemsCount) * 100) : 0;

  // Toggle handler for items
  const handleToggleItem = (id: string) => {
    if (isAuthenticated) {
      const item = checklistItems.find((i) => i.id === id);
      if (!item) return;

      if (id.startsWith('server_habit_')) {
        const habitId = id.replace('server_habit_', '');
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            isHabitInstance: true,
            habitId,
            isCompleted: true,
            date: new Date().toISOString(),
          }),
          credentials: 'include',
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['habits'] });
        });
      } else {
        toggleMutation.mutate({ id, isCompleted: !item.isCompleted });
      }
    } else {
      const isDynamicHabit = id.startsWith('guest_task_habit_') && !guestTasks.some((t) => t.id === id);
      if (isDynamicHabit) {
        const item = checklistItems.find((i) => i.id === id);
        if (item) {
          const habitId = id.replace('guest_task_habit_', '').replace('_today', '');
          addGuestTask({
            id,
            title: item.title,
            isHabitInstance: true,
            habitId,
            isCompleted: true,
            category: item.category,
            timeTag: item.timeTag,
          });
          return;
        }
      }
      toggleGuestTask(id);
    }
  };

  // Reorder handler for drag and drop
  const handleReorderChecklist = (reorderedItems: ChecklistItem[]) => {
    const ids = reorderedItems.map((i) => i.id);
    setCustomChecklistOrder(ids);
    try {
      localStorage.setItem(orderStorageKey, JSON.stringify(ids));
    } catch {
      // ignore storage write errors
    }

    if (!isAuthenticated) {
      const itemsToOrder = reorderedItems.map((item, index) => ({
        id: item.id,
        sortOrder: index,
      }));
      reorderGuestTasks(itemsToOrder);
    } else {
      // Authenticated mode: filter out virtual habit placeholders
      const realTasks = reorderedItems
        .filter((item) => !item.id.startsWith('server_habit_'))
        .map((item, index) => ({
          id: item.id,
          sortOrder: index,
        }));

      if (realTasks.length > 0) {
        // Optimistically update TanStack query cache for ['tasks', todayStr]
        queryClient.setQueryData<ServerTaskItem[]>(['tasks', todayStr], (old) => {
          if (!old || !Array.isArray(old)) return old;
          const orderMap = new Map(realTasks.map((t) => [t.id, t.sortOrder]));
          return [...old]
            .map((task) => {
              if (orderMap.has(task._id)) {
                return { ...task, sortOrder: orderMap.get(task._id)! };
              }
              return task;
            })
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        });

        // Persist to backend
        fetch('/api/tasks/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: realTasks }),
          credentials: 'include',
        }).catch((err) => {
          console.error('Failed to persist task reordering:', err);
        });
      }
    }
  };

  // Edit task handler: loads task into Quick Action form & focuses (Habits cannot be edited here)
  const handleEditItem = (item: ChecklistItem) => {
    if (item.isHabitInstance) return; // Habits are managed in Habit Manager

    setEditingTask(item);
    setItemTitle(item.title);
    setCategory(normalizeCategory(item.category));
    setPriority(item.priority || 'normal');

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsQuickActionModalOpen(true);
      setTimeout(() => modalTitleInputRef.current?.focus(), 80);
    } else {
      titleInputRef.current?.focus();
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingTask(null);
    setItemTitle('');
    setCategory('Work');
    setPriority('normal');
    setIsQuickActionModalOpen(false);
  };

  // Delete task handler (Habits cannot be deleted here)
  const handleDeleteItem = (id: string) => {
    const item = checklistItems.find((i) => i.id === id);
    if (item?.isHabitInstance) return; // Habits are managed in Habit Manager

    if (editingTask?.id === id) {
      handleCancelEdit();
    }

    const taskToDelete = checklistItems.find((t) => t.id === id);
    const taskTitle = taskToDelete?.title || 'Task';

    // Instantly remove from view optimistically with 0ms delay
    setDeletedTaskIds((prev) => new Set(prev).add(id));
    setCustomChecklistOrder((prev) => {
      const next = prev.filter((taskId) => taskId !== id);
      try {
        localStorage.setItem(orderStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    if (isAuthenticated) {
      queryClient.setQueryData<ServerTaskItem[]>(['tasks', todayStr], (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((t) => t._id !== id);
      });

      deleteTaskMutation.mutate(id, {
        onSuccess: () => {
          showToast(
            'Moved to Trash',
            `"${taskTitle}" will be safely kept in 30-Day Trash before permanent cleanup.`,
            'info',
            {
              label: 'Undo',
              onClick: async () => {
                try {
                  await fetch(`/api/tasks/${id}/restore`, {
                    method: 'POST',
                    credentials: 'include',
                  });
                  setDeletedTaskIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                  queryClient.invalidateQueries({ queryKey: ['tasks'] });
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
                  showToast('Task Restored', `"${taskTitle}" has been restored to your checklist.`, 'success');
                } catch (err) {
                  console.error('Failed to undo task deletion:', err);
                }
              },
            }
          );
        },
        onError: () => {
          setDeletedTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    } else {
      const removedTask = guestTasks.find((t) => t.id === id);
      removeGuestTask(id);
      if (removedTask) {
        showToast(
          'Removed',
          `"${taskTitle}" removed from checklist.`,
          'info',
          {
            label: 'Undo',
            onClick: () => {
              addGuestTask({
                title: removedTask.title,
                date: removedTask.date,
                priority: removedTask.priority,
                category: removedTask.category,
                timeTag: removedTask.timeTag,
              });
              setDeletedTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              showToast('Task Restored', `"${taskTitle}" has been restored.`, 'success');
            },
          }
        );
      }
    }
  };

  // Callback when typewriter typing animation completes
  const handleCreationAnimationComplete = (targetId: string) => {
    setCreatingTaskId((curr) => (curr === targetId ? null : curr));
    setHighlightedTaskId(targetId);
    setTimeout(() => {
      setHighlightedTaskId((curr) => (curr === targetId ? null : curr));
    }, 1800);
  };

  // Scroll workspace smoothly to newly created task with retries
  const scrollWorkspaceToTask = (taskId: string, attempts = 0) => {
    const el = document.getElementById(`task-item-${taskId}`);
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
    } else {
      if (attempts === 0) {
        const checklist = document.getElementById('today-checklist-container');
        if (checklist) {
          checklist.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      if (attempts < 15) {
        setTimeout(() => scrollWorkspaceToTask(taskId, attempts + 1), 40);
      }
    }
  };

  // Quick Action form submission (handles both Add Task and Save Edit)
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = itemTitle.trim();
    if (!trimmedTitle) return;

    if (editingTask) {
      const targetId = editingTask.id;
      const cleanCategory = normalizeCategory(category);

      // Immediately activate blur loading state on this task
      setUpdatingTaskId(targetId);

      // Smoothly scroll down to the edited task in the checklist
      setTimeout(() => {
        const el = document.getElementById(`task-item-${targetId}`);
        const main =
          document.getElementById('main-workspace') ||
          document.querySelector('main') ||
          document.documentElement;
        if (el && main && 'scrollTop' in main) {
          const mainRect = main.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const targetScrollTop =
            main.scrollTop + (elRect.top - mainRect.top) - (main.clientHeight / 2) + (elRect.height / 2);
          main.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
        } else if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);

      const finishUpdate = () => {
        setUpdatingTaskId(null);
        setHighlightedTaskId(targetId);
        setTimeout(() => {
          setHighlightedTaskId((curr) => (curr === targetId ? null : curr));
        }, 1800);
      };

      if (isAuthenticated) {
        updateTaskMutation.mutate(
          {
            id: targetId,
            title: trimmedTitle,
            priority,
            category: cleanCategory,
          },
          {
            onSettled: finishUpdate,
          }
        );
      } else {
        // Guest mode: simulate realistic smooth transition so user sees the blur load
        setTimeout(() => {
          updateGuestTask(targetId, {
            title: trimmedTitle,
            category: cleanCategory,
            priority,
          });
          finishUpdate();
        }, 450);
      }

      setEditingTask(null);
      setItemTitle('');
      setPriority('normal');
      setIsQuickActionModalOpen(false);
      return;
    }

    // --- New Task Creation with Typewriter ("writing itself") Animation & Instant Scroll ---
    const newTaskId = `guest_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanCategory = normalizeCategory(category);

    // Release focus from the input/button at top so browser doesn't anchor viewport to top
    titleInputRef.current?.blur();
    modalTitleInputRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Immediately activate typewriter creating state on this newly created task
    setCreatingTaskId(newTaskId);

    if (isAuthenticated) {
      // Optimistically insert task into TanStack cache so it appears immediately in DOM
      queryClient.setQueryData<ServerTaskItem[]>(['tasks', todayStr], (old) => {
        const optimisticTask: ServerTaskItem = {
          _id: newTaskId,
          title: trimmedTitle,
          category: cleanCategory,
          priority,
          isCompleted: false,
          timeTag: 'Today',
          isHabitInstance: false,
          createdAt: new Date().toISOString(),
        };
        return Array.isArray(old) ? [...old, optimisticTask] : [optimisticTask];
      });

      createTaskMutation.mutate(
        {
          title: trimmedTitle,
          date: todayStr,
          isHabitInstance: false,
          category: cleanCategory,
          priority,
        },
        {
          onSuccess: (data: { data?: { _id?: string } }) => {
            const serverId = data?.data?._id;
            if (serverId && serverId !== newTaskId) {
              queryClient.setQueryData<ServerTaskItem[]>(['tasks', todayStr], (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((t) => (t._id === newTaskId ? { ...t, _id: serverId } : t));
              });
            }
          },
          onError: () => {
            queryClient.setQueryData<ServerTaskItem[]>(['tasks', todayStr], (old) => {
              if (!Array.isArray(old)) return old;
              return old.filter((t) => t._id !== newTaskId);
            });
            setCreatingTaskId(null);
          },
        }
      );
    } else {
      addGuestTask({
        id: newTaskId,
        title: trimmedTitle,
        category: cleanCategory,
        priority,
        timeTag: 'Today',
        isHabitInstance: false,
      });
    }

    // Instantly scroll workspace smoothly down to the newly created task card
    scrollWorkspaceToTask(newTaskId);

    setItemTitle('');
    setPriority('normal');
    setIsQuickActionModalOpen(false);
  };

  const focusQuickAction = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setEditingTask(null);
      setItemTitle('');
      setPriority('normal');
      setIsQuickActionModalOpen(true);
      setTimeout(() => modalTitleInputRef.current?.focus(), 80);
    } else {
      titleInputRef.current?.focus();
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-6 w-full min-w-0 overflow-x-hidden">
      <SEOHead
        title="Taskiye - Daily Habits, Tasks & Heatmap Tracker"
        description="Track daily habits with interactive heatmaps, manage today's task checklist, and build unstoppable streaks on Taskiye."
        canonicalPath="/"
      />
      {/* 1. Hero Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1 w-full min-w-0">
        <div className="flex items-start sm:items-end justify-between gap-3 w-full sm:w-auto">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1">
              Total Habit & Task Completion
            </span>
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                {completionRate}%
              </h1>
              <div className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-[#092B21] dark:border-emerald-500/30 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{completedCount} completed today</span>
              </div>
            </div>
          </div>

          {/* Mobile "+ Add Task" button next to Total Habit & Task Completion */}
          <button
            type="button"
            onClick={() => {
              setEditingTask(null);
              setItemTitle('');
              setPriority('normal');
              setIsQuickActionModalOpen(true);
              setTimeout(() => modalTitleInputRef.current?.focus(), 80);
            }}
            className="flex lg:hidden items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white dark:bg-[#FACC15] dark:hover:bg-[#EAB308] dark:text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md dark:shadow-[0_0_15px_rgba(250,204,21,0.25)] active:scale-95 transition-all cursor-pointer shrink-0 select-none mt-1"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Task</span>
          </button>
        </div>

        {/* Right Active Sprint Tag */}
        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          Daily Cadence:{' '}
          <span className="text-amber-600 dark:text-amber-400 font-bold">{pendingTasksCount === 0 && totalItemsCount > 0 ? 'All Done' : `${pendingTasksCount} remaining`}</span>
        </div>
      </div>

      {/* 2. Main Grid:
          - On Mobile (< lg):
              1. 3 Stat Cards (Order 1 - compact single row)
              2. Today's Checklist (Order 2 - moved directly beneath stat cards!)
              3. Heatmap Matrix (Order 3)
              4. Quick Action + Active Routines (Order 4)
          - On Desktop (lg:):
              - Left Column (8 cols, Order 1): 3 Stat Cards + HeatmapMatrix
              - Right Column (4 cols, Order 2): Quick Action + Active Routines
              - Bottom Row (12 cols, Order 3): Today's Checklist spanning full width
      */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-6 items-start w-full min-w-0">
        {/* Left Column on Desktop / CSS Contents on Mobile so children follow flex order */}
        <div className="contents lg:flex lg:flex-col lg:col-span-8 lg:gap-6 lg:order-1">
          {/* 3 Stat Cards Row - 1 line on mobile (grid-cols-3), 3-col on desktop */}
          <div className="order-1 grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-4 w-full min-w-0">
            {/* Card 1: Today's Completion Rate */}
            <div className="bg-white dark:bg-[#162032] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] rounded-xl sm:rounded-2xl p-2 sm:p-5 flex flex-col justify-between transition-all min-w-0 w-full overflow-hidden shadow-sm dark:shadow-none">
              {/* Mobile View (< sm) */}
              <div className="flex sm:hidden flex-col items-center text-center gap-0.5">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Today</span>
                </div>
                <div className="text-base xs:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                  {completionRate}%
                </div>
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate w-full">
                  {completedCount}/{totalItemsCount} Done
                </span>
              </div>

              {/* Desktop / Tablet View (sm:) */}
              <div className="hidden sm:flex sm:flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Today
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Today's Completion
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                    {completionRate}%
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.04]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {completedCount} of {totalItemsCount} items
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {totalItemsCount > 0 && completedCount === totalItemsCount ? 'Complete' : `${totalItemsCount - completedCount} left`}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Daily Habits */}
            <div className="bg-white dark:bg-[#162032] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] rounded-xl sm:rounded-2xl p-2 sm:p-5 flex flex-col justify-between transition-all min-w-0 w-full overflow-hidden shadow-sm dark:shadow-none">
              {/* Mobile View (< sm) */}
              <div className="flex sm:hidden flex-col items-center text-center gap-0.5">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Routines</span>
                </div>
                <div className="text-base xs:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
                  {habitsDoneCount}/{habitsTodayTotalCount}
                </div>
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate w-full">
                  {habitsTodayTotalCount > 0 ? `${Math.round((habitsDoneCount / habitsTodayTotalCount) * 100)}% Done` : '0 Routines'}
                </span>
              </div>

              {/* Desktop / Tablet View (sm:) */}
              <div className="hidden sm:flex sm:flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-400/10 dark:border-emerald-400/20 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-400/15 dark:border-emerald-400/30 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Routines
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                    Daily Habits
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {habitsDoneCount}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold text-base">
                      / {habitsTodayTotalCount} Done
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${habitsTodayTotalCount > 0 ? Math.round((habitsDoneCount / habitsTodayTotalCount) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block font-medium">
                    {habitsTodayTotalCount > 0 ? `${Math.round((habitsDoneCount / habitsTodayTotalCount) * 100)}% consistency rate today` : 'No routines scheduled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Tasks Left */}
            <div className="bg-white dark:bg-[#162032] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.1] rounded-xl sm:rounded-2xl p-2 sm:p-5 flex flex-col justify-between transition-all min-w-0 w-full overflow-hidden shadow-sm dark:shadow-none">
              {/* Mobile View (< sm) */}
              <div className="flex sm:hidden flex-col items-center text-center gap-0.5">
                <div className="flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Pending</span>
                </div>
                <div className="text-base xs:text-lg font-black text-amber-600 dark:text-amber-400 tracking-tight leading-none mt-0.5">
                  {pendingTasksCount}
                </div>
                <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium truncate w-full">
                  {highPriorityPendingCount > 0 ? `${highPriorityPendingCount} High` : `${pendingTasksCount} Left`}
                </span>
              </div>

              {/* Desktop / Tablet View (sm:) */}
              <div className="hidden sm:flex sm:flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-400 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Pending
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Tasks Left</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {pendingTasksCount}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold text-base sm:text-lg">
                      Pending
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{highPriorityPendingCount} High Priority</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
                      <span>{normalPriorityPendingCount} Normal</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                    {pendingTasksCount === 0 ? 'All caught up!' : `${pendingTasksCount} item${pendingTasksCount === 1 ? '' : 's'} remaining`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Heatmap Matrix - Order 3 on mobile (after checklist) */}
          <div className="order-3 w-full min-w-0">
            <HeatmapMatrix
              streakDays={globalDailyStreak}
              totalCompletedHabits={completedCount}
              todayCompletedCount={completedCount}
              todayTotalCount={totalItemsCount || 0}
              historyLogs={activityLogs}
            />
          </div>
        </div>

        {/* Right Column (4 cols on Desktop, Order 4 on Mobile): Quick Action at top + Active Goals */}
        <div className="order-4 lg:order-2 lg:col-span-4 flex flex-col gap-6 w-full min-w-0">
          {/* Widget 1: QUICK ACTION (Visible on desktop, hidden on mobile) */}
          <div className="hidden lg:block bg-white dark:bg-[#162032] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 sm:p-6 transition-all hover:border-slate-300 dark:hover:border-white/[0.1] shadow-sm dark:shadow-none">
            {/* Header with Task Indicator or Editing Indicator */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  {editingTask ? 'Edit Task' : 'Quick Action'}
                </h3>
                {editingTask ? (
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Editing
                  </span>
                ) : (
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/25 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
                    Task
                  </span>
                )}
              </div>

              {editingTask && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-300 font-medium transition-colors cursor-pointer underline"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Quick Form */}
            <form onSubmit={handleAddItem} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                  Title
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Review Q3 Roadmap"
                  className="w-full bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40 dark:focus:ring-amber-400/40 transition-all"
                />
              </div>

              {/* 2-Column Selects: Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {APP_CATEGORIES.map((cat) => {
                      const style = getCategoryBadgeStyle(cat);
                      return (
                        <option key={cat} value={cat} className="bg-white dark:bg-[#101827] text-slate-800 dark:text-slate-200">
                          {style.icon} {cat}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
                    className="w-full bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="normal" className="bg-white dark:bg-[#101827] text-slate-800 dark:text-slate-200">Normal</option>
                    <option value="high" className="bg-white dark:bg-[#101827] text-slate-800 dark:text-slate-200">High Priority</option>
                  </select>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white dark:bg-[#FACC15] dark:hover:bg-[#EAB308] dark:text-slate-950 font-extrabold text-sm py-3 rounded-xl shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-lg dark:hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {editingTask ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Save Edit</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ Add Task</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Widget 2: ACTIVE ROUTINES & GOALS */}
          <div className="bg-white dark:bg-[#162032] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 sm:p-6 transition-all hover:border-slate-300 dark:hover:border-white/[0.1] shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  Active Routines
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {habitsList.filter((h) => !h.isArchived).length} {habitsList.filter((h) => !h.isArchived).length === 1 ? 'Target' : 'Targets'}
                </span>
              </div>

              <Link
                to="/habits"
                className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Manage
              </Link>
            </div>

            {/* List of Active Habits / Goals */}
            <div className="relative">
              {habitsList.filter((h) => !h.isArchived).length === 0 ? (
                <div className="py-7 px-3 text-center flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-400/10 dark:border-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">No active targets</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px]">
                    Add recurring habits or routines to track your consistency
                  </span>
                  <Link
                    to="/habits"
                    className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold underline mt-1"
                  >
                    + Create Routine
                  </Link>
                </div>
              ) : (
                <>
                  <CustomScrollArea maxHeight="195px" className="flex flex-col gap-3.5">
                    {habitsList
                      .filter((h) => !h.isArchived)
                      .map((habit: {
                        _id?: string;
                        id?: string;
                        title?: string;
                        category?: string;
                        streakDays?: number;
                        totalCompletions?: number;
                        isArchived?: boolean;
                      }) => {
                        const habitId = habit._id || habit.id || '';
                        const isDoneToday = checklistItems.some(
                          (it) => it.isHabitInstance && (it.habitId === habitId || it.title.toLowerCase().trim() === (habit.title || '').toLowerCase().trim()) && it.isCompleted
                        );
                        const streak = habit.streakDays ?? 0;
                        const targetCompletions = 7;
                        const progressPercent = Math.min(100, Math.round(((habit.totalCompletions ?? (isDoneToday ? 1 : 0)) % targetCompletions) / targetCompletions * 100)) || (isDoneToday ? 100 : 0);

                        return (
                          <div
                            key={habitId}
                            className="bg-slate-50 dark:bg-[#111A2E] border border-slate-200/80 dark:border-white/[0.05] rounded-xl p-3.5 flex flex-col gap-2 shrink-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[170px]">
                                  {habit.title}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                {streak > 0 ? `${streak}d streak` : isDoneToday ? 'Done' : 'Pending'}
                              </span>
                            </div>

                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 dark:bg-[#FACC15] rounded-full transition-all duration-300"
                                style={{ width: `${isDoneToday ? 100 : progressPercent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                              <span>{habit.category || 'Routine'}</span>
                              <span>{isDoneToday ? 'Done today' : 'Scheduled today'}</span>
                            </div>
                          </div>
                        );
                      })}
                  </CustomScrollArea>

                  {/* Bottom Fade Mask with Scroll Indicator */}
                  {habitsList.filter((h) => !h.isArchived).length > 2 && (
                    <div className="pointer-events-none absolute -bottom-1 left-0 right-0 h-10 bg-gradient-to-t from-white via-white/85 dark:from-[#162032] dark:via-[#162032]/85 to-transparent flex items-end justify-center pb-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400/90 font-bold tracking-wide">
                        <ChevronDown className="w-3 h-3 animate-bounce" />
                        <span>Scroll for more</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Quarterly Pace Footer */}
            <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-white/[0.04] mt-4 pt-3">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Daily cadence:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span>{habitsTodayTotalCount > 0 ? `${habitsDoneCount}/${habitsTodayTotalCount} Routines` : '0/0 Routines'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Today's Focus & Routine Checklist - Order 2 on mobile (directly after Cards!), Full width bottom row on desktop */}
        <div className="order-2 lg:order-3 w-full min-w-0 lg:col-span-12">
          <TodayChecklist
            items={checklistItems}
            onToggle={handleToggleItem}
            onReorder={handleReorderChecklist}
            onQuickTaskClick={focusQuickAction}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
            updatingTaskId={updatingTaskId}
            creatingTaskId={creatingTaskId}
            highlightedTaskId={highlightedTaskId}
            onCreationAnimationComplete={handleCreationAnimationComplete}
          />
        </div>
      </div>

      {/* 3. Mobile Quick Action Modal Popup (Visible on Mobile/Tablet, Hidden on Desktop) */}
      {isQuickActionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => {
              setIsQuickActionModalOpen(false);
              if (editingTask) handleCancelEdit();
            }}
          />

          {/* Modal Content Box */}
          <div className="relative bg-white dark:bg-[#162032] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl w-full sm:max-w-md z-10 animate-in slide-in-from-bottom-6 duration-200">
            {/* Mobile Sheet Handle */}
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700/80 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  {editingTask ? 'Edit Task' : 'Quick Action'}
                </h3>
                {editingTask ? (
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Editing
                  </span>
                ) : (
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/25 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
                    Task
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingTask && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-300 font-medium transition-colors cursor-pointer underline mr-1"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionModalOpen(false);
                    if (editingTask) handleCancelEdit();
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Action Form (Exact replica of desktop widget) */}
            <form onSubmit={handleAddItem} className="flex flex-col gap-3.5">
              <div>
                <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                  Title
                </label>
                <input
                  ref={modalTitleInputRef}
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Review Q3 Roadmap"
                  className="w-full bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40 dark:focus:ring-amber-400/40 transition-all"
                  autoFocus
                />
              </div>

              {/* 2-Column Selects: Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {APP_CATEGORIES.map((cat) => {
                      const style = getCategoryBadgeStyle(cat);
                      return (
                        <option key={cat} value={cat} className="bg-white dark:bg-[#101827] text-slate-800 dark:text-slate-200">
                          {style.icon} {cat}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
                    className="w-full bg-slate-50 dark:bg-[#101827] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="normal" className="bg-white dark:bg-[#101827] text-slate-800 dark:text-slate-200">Normal</option>
                    <option value="high" className="bg-white dark:bg-[#101827] text-slate-800 dark:text-slate-200">High Priority</option>
                  </select>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white dark:bg-[#FACC15] dark:hover:bg-[#EAB308] dark:text-slate-950 font-extrabold text-sm py-3 rounded-xl shadow-md dark:shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-lg dark:hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {editingTask ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Save Edit</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>+ Add Task</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
