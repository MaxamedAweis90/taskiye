import React, { useState, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth-client';
import { useTaskiyeStore, DEFAULT_INITIAL_TASKS } from '../store/useTaskiyeStore';
import { HeatmapMatrix } from '../components/dashboard/HeatmapMatrix';
import { TodayChecklist, ChecklistItem } from '../components/dashboard/TodayChecklist';
import { CustomScrollArea } from '../components/common/CustomScrollArea';

export const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  // Zustand Guest Store
  const {
    tasks: guestTasks,
    habits: guestHabits,
    toggleGuestTask,
    addGuestTask,
    updateGuestTask,
    removeGuestTask,
    reorderGuestTasks,
    syncHabitsToTodayTasks,
  } = useTaskiyeStore();

  // Quick Action form state (Task-only creation)
  const [itemTitle, setItemTitle] = useState('');
  const [category, setCategory] = useState('Focus / Work');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [editingTask, setEditingTask] = useState<ChecklistItem | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());
  const [customChecklistOrder, setCustomChecklistOrder] = useState<string[]>([]);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Today ISO Date string for query
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Sync active due habits into today's tasks overview on initial load
  React.useEffect(() => {
    if (!isAuthenticated) {
      syncHabitsToTodayTasks();
    }
  }, [isAuthenticated]);

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
        habitId?: any;
        sortOrder: number;
        category?: string;
        priority?: 'normal' | 'high';
        timeTag?: string;
      }>;
    },
    enabled: isAuthenticated,
  });

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
      queryClient.setQueryData(['tasks', todayStr], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t: any) =>
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
    }: {
      id: string;
      title: string;
      priority?: 'normal' | 'high';
    }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority }),
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
            category: t.category || (t.isHabitInstance ? 'Routine' : 'Work'),
            priority: t.priority || 'normal',
            timeTag: t.timeTag || (t.isHabitInstance ? 'Continuous' : 'Today'),
            isHabitInstance: Boolean(t.isHabitInstance),
            habitId: rawHabitId || linkedHabit?._id,
            streakDays: linkedHabit?.streakDays,
            warnings: linkedHabit?.warnings,
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
            category: h.category || 'Routine',
            priority: 'normal',
            timeTag: h.timeOfDay || 'Continuous',
            isHabitInstance: true,
            habitId: h._id,
            streakDays: h.streakDays ?? 0,
            warnings: h.warnings ?? 0,
          });
        }
      });
    } else {
      const tasksToUse = [...(guestTasks ?? DEFAULT_INITIAL_TASKS)].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
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
            category: t.category || (t.isHabitInstance ? 'Routine' : 'Work'),
            priority: t.priority || 'normal',
            timeTag: t.timeTag || (t.isHabitInstance ? 'Continuous' : 'Today'),
            isHabitInstance: Boolean(t.isHabitInstance),
            habitId: t.habitId || linkedHabit?.id,
            streakDays: linkedHabit?.streakDays,
            warnings: linkedHabit?.warnings,
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
            category: h.category || 'Routine',
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

    const baseItems = items.filter((item) => !deletedTaskIds.has(item.id));

    if (customChecklistOrder.length > 0) {
      const orderMap = new Map(customChecklistOrder.map((id, index) => [id, index]));
      return [...baseItems].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
        return orderA - orderB;
      });
    }

    return baseItems;
  }, [isAuthenticated, serverTasks, serverHabits, guestTasks, guestHabits, deletedTaskIds, customChecklistOrder]);

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
    setCustomChecklistOrder(reorderedItems.map((i) => i.id));
    if (!isAuthenticated) {
      const itemsToOrder = reorderedItems.map((item, index) => ({
        id: item.id,
        sortOrder: index,
      }));
      reorderGuestTasks(itemsToOrder);
    }
  };

  // Edit task handler: loads task into Quick Action form & focuses (Habits cannot be edited here)
  const handleEditItem = (item: ChecklistItem) => {
    if (item.isHabitInstance) return; // Habits are managed in Habit Manager

    setEditingTask(item);
    setItemTitle(item.title);

    const catLower = item.category.toLowerCase();
    if (catLower.includes('health') || catLower.includes('routine')) {
      setCategory('Health / Routine');
    } else if (catLower.includes('mind') || catLower.includes('reading')) {
      setCategory('Mind / Reading');
    } else if (catLower.includes('personal') || catLower.includes('goal')) {
      setCategory('Personal Goal');
    } else {
      setCategory('Focus / Work');
    }

    setPriority(item.priority || 'normal');

    titleInputRef.current?.focus();
    titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setItemTitle('');
    setPriority('normal');
  };

  // Delete task handler (Habits cannot be deleted here)
  const handleDeleteItem = (id: string) => {
    const item = checklistItems.find((i) => i.id === id);
    if (item?.isHabitInstance) return; // Habits are managed in Habit Manager

    if (editingTask?.id === id) {
      handleCancelEdit();
    }

    // Instantly remove from view optimistically with 0ms delay
    setDeletedTaskIds((prev) => new Set(prev).add(id));

    if (isAuthenticated) {
      deleteTaskMutation.mutate(id, {
        onError: () => {
          setDeletedTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    } else {
      removeGuestTask(id);
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
      const cleanCategory = category.replace(/^[^\w]+/, '').trim();

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
      return;
    }

    // --- New Task Creation with Typewriter ("writing itself") Animation & Instant Scroll ---
    const newTaskId = `guest_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanCategory = category.replace(/^[^\w]+/, '').trim();

    // Release focus from the input/button at top so browser doesn't anchor viewport to top
    titleInputRef.current?.blur();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Immediately activate typewriter creating state on this newly created task
    setCreatingTaskId(newTaskId);

    if (isAuthenticated) {
      // Optimistically insert task into TanStack cache so it appears immediately in DOM
      queryClient.setQueryData(['tasks', todayStr], (old: any) => {
        const optimisticTask = {
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
        },
        {
          onSuccess: (data: any) => {
            const serverId = data?.data?._id;
            if (serverId && serverId !== newTaskId) {
              queryClient.setQueryData(['tasks', todayStr], (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.map((t: any) => (t._id === newTaskId ? { ...t, _id: serverId } : t));
              });
            }
          },
          onError: () => {
            queryClient.setQueryData(['tasks', todayStr], (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.filter((t: any) => t._id !== newTaskId);
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
  };

  const focusQuickAction = () => {
    titleInputRef.current?.focus();
    titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-6">
      {/* 1. Hero Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
            Total Habit & Task Completion
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white tracking-tight leading-none">
              {completionRate}%
            </h1>
            <div className="inline-flex items-center gap-1 bg-[#092B21] border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{completedCount} completed today</span>
            </div>
          </div>
        </div>

        {/* Right Active Sprint Tag */}
        <div className="text-xs sm:text-sm text-slate-400 font-medium">
          Daily Cadence:{' '}
          <span className="text-amber-400 font-bold">{pendingTasksCount === 0 && totalItemsCount > 0 ? 'All Done' : `${pendingTasksCount} remaining`}</span>
        </div>
      </div>

      {/* 2. Top Two-Column Grid:
          - Left Column (8 cols): 3 Stat Cards spanning exact width of Heatmap + HeatmapMatrix
          - Right Column (4 cols): Quick Action at the top + Active Goals
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3 Stat Cards + Heatmap Matrix */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 3 Stat Cards Row - Perfectly squeezes to the exact width of the Heatmap Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Today's Completion Rate */}
            <div className="bg-[#162032] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center">
                  <Clock className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Today
                </span>
              </div>

              <div className="mt-3">
                <span className="text-xs text-slate-400 font-medium block">
                  Today's Completion
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-0.5">
                  {completionRate}%
                </div>
              </div>

              <div className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t border-white/[0.04]">
                <span className="text-slate-400 font-medium">
                  {completedCount} of {totalItemsCount} items
                </span>
                <span className="text-emerald-400 font-bold">
                  {totalItemsCount > 0 && completedCount === totalItemsCount ? 'Complete' : `${totalItemsCount - completedCount} left`}
                </span>
              </div>
            </div>

            {/* Card 2: Daily Habits */}
            <div className="bg-[#162032] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Routines
                </span>
              </div>

              <div className="mt-3">
                <span className="text-xs text-slate-400 font-medium block">
                  Daily Habits
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {habitsDoneCount}
                  </span>
                  <span className="text-slate-400 font-semibold text-base">
                    / {habitsTodayTotalCount} Done
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${habitsTodayTotalCount > 0 ? Math.round((habitsDoneCount / habitsTodayTotalCount) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 mt-2 block font-medium">
                  {habitsTodayTotalCount > 0 ? `${Math.round((habitsDoneCount / habitsTodayTotalCount) * 100)}% consistency rate today` : 'No routines scheduled'}
                </span>
              </div>
            </div>

            {/* Card 3: Tasks Left */}
            <div className="bg-[#162032] border border-white/[0.06] hover:border-white/[0.1] rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Pending
                </span>
              </div>

              <div className="mt-3">
                <span className="text-xs text-slate-400 font-medium block">Tasks Left</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {pendingTasksCount}
                  </span>
                  <span className="text-amber-400 font-bold text-base sm:text-lg">
                    Pending
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-white/[0.04]">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{highPriorityPendingCount} High Priority</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                    <span>{normalPriorityPendingCount} Normal</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {pendingTasksCount === 0 ? 'All caught up!' : `${pendingTasksCount} item${pendingTasksCount === 1 ? '' : 's'} remaining`}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Heatmap Matrix - Spans full 8 columns aligned with the 3 cards */}
          <HeatmapMatrix
            streakDays={(useTaskiyeStore.getState().baseStreakDays ?? 0) + (completedCount > 0 ? 1 : 0)}
            totalCompletedHabits={completedCount}
            todayCompletedCount={completedCount}
            todayTotalCount={totalItemsCount || 0}
          />
        </div>

        {/* Right Column (4 cols): Quick Action at top + Active Goals */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Widget 1: QUICK ACTION */}
          <div className="bg-[#162032] border border-white/[0.06] rounded-2xl p-4 sm:p-6 transition-all hover:border-white/[0.1]">
            {/* Header with Task Indicator or Editing Indicator */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase">
                  {editingTask ? 'Edit Task' : 'Quick Action'}
                </h3>
                {editingTask ? (
                  <span className="bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Editing
                  </span>
                ) : (
                  <span className="bg-amber-400/10 border border-amber-400/25 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">
                    Task
                  </span>
                )}
              </div>

              {editingTask && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-400 hover:text-amber-300 font-medium transition-colors cursor-pointer underline"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Quick Form */}
            <form onSubmit={handleAddItem} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                  Title
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Review Q3 Roadmap"
                  className="w-full bg-[#101827] border border-white/10 hover:border-white/20 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition-all"
                />
              </div>

              {/* 2-Column Selects: Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#101827] border border-white/10 hover:border-white/20 focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="Focus / Work">⚡ Focus / Work</option>
                    <option value="Health / Routine">🌿 Health / Routine</option>
                    <option value="Mind / Reading">🧠 Mind / Reading</option>
                    <option value="Personal Goal">🚀 Personal Goal</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
                    className="w-full bg-[#101827] border border-white/10 hover:border-white/20 focus:border-amber-400 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="w-full bg-[#FACC15] hover:bg-[#EAB308] text-slate-950 font-extrabold text-sm py-3 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 mt-2 cursor-pointer"
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
          <div className="bg-[#162032] border border-white/[0.06] rounded-2xl p-4 sm:p-6 transition-all hover:border-white/[0.1]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase">
                  Active Routines
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {habitsList.filter((h) => !h.isArchived).length} {habitsList.filter((h) => !h.isArchived).length === 1 ? 'Target' : 'Targets'}
                </span>
              </div>

              <Link
                to="/habits"
                className="text-amber-400 hover:text-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Manage
              </Link>
            </div>

            {/* List of Active Habits / Goals */}
            <div className="relative">
              {habitsList.filter((h) => !h.isArchived).length === 0 ? (
                <div className="py-7 px-3 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">No active targets</span>
                  <span className="text-[11px] text-slate-400 max-w-[200px]">
                    Add recurring habits or routines to track your consistency
                  </span>
                  <Link
                    to="/habits"
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold underline mt-1"
                  >
                    + Create Routine
                  </Link>
                </div>
              ) : (
                <>
                  <CustomScrollArea maxHeight="195px" className="flex flex-col gap-3.5">
                    {habitsList
                      .filter((h) => !h.isArchived)
                      .map((habit: any) => {
                        const habitId = habit._id || habit.id;
                        const isDoneToday = checklistItems.some(
                          (it) => it.isHabitInstance && (it.habitId === habitId || it.title.toLowerCase().trim() === habit.title?.toLowerCase().trim()) && it.isCompleted
                        );
                        const streak = habit.streakDays ?? 0;
                        const targetCompletions = 7;
                        const progressPercent = Math.min(100, Math.round(((habit.totalCompletions ?? (isDoneToday ? 1 : 0)) % targetCompletions) / targetCompletions * 100)) || (isDoneToday ? 100 : 0);

                        return (
                          <div
                            key={habitId}
                            className="bg-[#111A2E] border border-white/[0.05] rounded-xl p-3.5 flex flex-col gap-2 shrink-0"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-sm font-semibold text-slate-100 truncate max-w-[170px]">
                                  {habit.title}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-amber-400">
                                {streak > 0 ? `${streak}d streak` : isDoneToday ? 'Done' : 'Pending'}
                              </span>
                            </div>

                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#FACC15] rounded-full transition-all duration-300"
                                style={{ width: `${isDoneToday ? 100 : progressPercent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                              <span>{habit.category || 'Routine'}</span>
                              <span>{isDoneToday ? 'Done today' : 'Scheduled today'}</span>
                            </div>
                          </div>
                        );
                      })}
                  </CustomScrollArea>

                  {/* Bottom Fade Mask with Scroll Indicator */}
                  {habitsList.filter((h) => !h.isArchived).length > 2 && (
                    <div className="pointer-events-none absolute -bottom-1 left-0 right-0 h-10 bg-gradient-to-t from-[#162032] via-[#162032]/85 to-transparent flex items-end justify-center pb-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-amber-400/90 font-bold tracking-wide">
                        <ChevronDown className="w-3 h-3 animate-bounce" />
                        <span>Scroll for more</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Quarterly Pace Footer */}
            <div className="flex items-center justify-between text-xs border-t border-white/[0.04] mt-4 pt-3">
              <span className="text-slate-400 font-medium">Daily cadence:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span>{habitsTodayTotalCount > 0 ? `${habitsDoneCount}/${habitsTodayTotalCount} Routines` : '0/0 Routines'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Full-Width Section: Today's Focus & Routine Checklist
          - Spans 100% of container width filling both sides perfectly
      */}
      <div className="w-full">
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
  );
};

export default Dashboard;
