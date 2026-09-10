import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GuestTask {
  id: string;
  title: string;
  date: string; // ISO format or YYYY-MM-DD
  isCompleted: boolean;
  isHabitInstance: boolean;
  habitId?: string | null;
  sortOrder: number;
  createdAt: string;
  category?: string;
  priority?: 'normal' | 'high';
  timeTag?: string;
}

export interface GuestHabit {
  id: string;
  title: string;
  category: string;
  frequency: string;
  timeOfDay?: string;
  targetUnit?: string;
  streakDays: number;
  totalCompletions: number;
  consistencyRate: number;
  activeDays: number[]; // 0: Mon, 1: Tue, ..., 6: Sun
  warnings?: number; // 0, 1, 2
  lastCompletedDate?: string | null; // YYYY-MM-DD
  isArchived: boolean;
  archivedAt?: string;
  lastStreak?: number;
  createdAt: string;
}

/**
 * Calculates current streak and warning buffer (0, 1, 2, or reset to 0)
 * based on missed scheduled days since lastCompletedDate.
 */
export function evaluateHabitStreakAndWarnings(
  habit: {
    isArchived?: boolean;
    streakDays?: number;
    warnings?: number;
    lastCompletedDate?: string | null;
    activeDays?: number[];
  },
  todayStr: string
): { streakDays: number; warnings: number } {
  if (habit.isArchived) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: habit.warnings ?? 0,
    };
  }

  if (!habit.lastCompletedDate) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: habit.warnings ?? 0,
    };
  }

  if (habit.lastCompletedDate === todayStr) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 0,
    };
  }

  const lastDate = new Date(habit.lastCompletedDate + 'T00:00:00Z');
  const today = new Date(todayStr + 'T00:00:00Z');

  if (isNaN(lastDate.getTime()) || isNaN(today.getTime()) || lastDate >= today) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: habit.warnings ?? 0,
    };
  }

  const activeDays: number[] =
    Array.isArray(habit.activeDays) && habit.activeDays.length > 0
      ? habit.activeDays
      : [0, 1, 2, 3, 4, 5, 6];

  let missedCount = 0;
  const cursor = new Date(lastDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor < today) {
    const jsDay = cursor.getUTCDay();
    const monBased = (jsDay + 6) % 7; // Mon: 0 ... Sun: 6
    if (activeDays.includes(monBased)) {
      missedCount++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (missedCount === 0) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 0,
    };
  } else if (missedCount === 1) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 1, // Warning 1: Streak frozen
    };
  } else if (missedCount === 2) {
    return {
      streakDays: habit.streakDays ?? 0,
      warnings: 2, // Warning 2: Streak frozen
    };
  } else {
    // 3 or more consecutive missed days: reset streak to 0
    return {
      streakDays: 0,
      warnings: 0,
    };
  }
}

export type AuthModalTriggerReason =
  | 'item_limit_reached'
  | 'delete_forbidden'
  | 'save_global_habits'
  | 'manual'
  | null;

export const GUEST_ITEM_LIMIT = 100;

export const DEFAULT_INITIAL_TASKS: GuestTask[] = [
  {
    id: 'guest_task_sample_1',
    title: '45m Morning Deep Focus',
    date: new Date().toISOString(),
    isCompleted: true,
    isHabitInstance: true,
    habitId: 'guest_habit_sample_1',
    sortOrder: 0,
    category: 'Health',
    timeTag: '08:00 AM',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_task_sample_2',
    title: '2L Hydration & Electrolytes',
    date: new Date().toISOString(),
    isCompleted: true,
    isHabitInstance: true,
    habitId: 'guest_habit_sample_2',
    sortOrder: 1,
    category: 'Routine',
    timeTag: 'Continuous',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_task_sample_3',
    title: 'Review Product Design Tokens & System',
    date: new Date().toISOString(),
    isCompleted: false,
    isHabitInstance: false,
    sortOrder: 2,
    priority: 'high',
    category: 'Work',
    timeTag: 'Est. 45m',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_task_sample_4',
    title: 'Read 20 Pages of Non-Fiction',
    date: new Date().toISOString(),
    isCompleted: false,
    isHabitInstance: true,
    habitId: 'guest_habit_sample_4',
    sortOrder: 3,
    category: 'Mind',
    timeTag: '30 min',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_task_sample_5',
    title: 'Evening 10m Mindfulness Breathing',
    date: new Date().toISOString(),
    isCompleted: false,
    isHabitInstance: true,
    habitId: 'guest_habit_sample_5',
    sortOrder: 4,
    category: 'Health',
    timeTag: '10 min',
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_INITIAL_HABITS: GuestHabit[] = [
  {
    id: 'guest_habit_sample_1',
    title: '45m Morning Deep Focus',
    category: 'Health & Focus',
    frequency: 'Daily',
    timeOfDay: 'Morning (08:00 AM)',
    targetUnit: 'sessions',
    streakDays: 14,
    totalCompletions: 142,
    consistencyRate: 92.4,
    activeDays: [0, 1, 2, 3, 4],
    warnings: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_sample_2',
    title: '2L Hydration & Electrolytes',
    category: 'Routine',
    frequency: 'Daily',
    timeOfDay: 'Continuous',
    targetUnit: 'logs',
    streakDays: 28,
    totalCompletions: 210,
    consistencyRate: 98.0,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    warnings: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_sample_3',
    title: 'Review Product Design System',
    category: 'Work',
    frequency: 'Weekdays',
    timeOfDay: 'Afternoon',
    targetUnit: 'checks',
    streakDays: 8,
    totalCompletions: 54,
    consistencyRate: 85.0,
    activeDays: [0, 1, 2, 4],
    warnings: 1, // 1 warning: Streak at risk!
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_sample_4',
    title: 'Read 20 Pages of Non-Fiction',
    category: 'Mind',
    frequency: 'Daily',
    timeOfDay: 'Evening',
    targetUnit: 'days',
    streakDays: 19,
    totalCompletions: 88,
    consistencyRate: 88.6,
    activeDays: [0, 1, 3, 4, 5],
    warnings: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_sample_5',
    title: 'Evening 10m Mindfulness Breathing',
    category: 'Health',
    frequency: 'Daily',
    timeOfDay: 'Night (21:30)',
    targetUnit: 'sessions',
    streakDays: 12,
    totalCompletions: 95,
    consistencyRate: 91.2,
    activeDays: [0, 1, 2, 3, 5],
    warnings: 2, // 2 warnings: Final notice before reset!
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_sample_6',
    title: 'Post-Dinner 20m Brisk Walk',
    category: 'Health',
    frequency: 'Everyday',
    timeOfDay: 'Evening',
    targetUnit: 'walks',
    streakDays: 6,
    totalCompletions: 42,
    consistencyRate: 79.5,
    activeDays: [0, 1, 3, 4],
    warnings: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_archived_1',
    title: 'Morning Cold Shower Challenge',
    category: 'Health',
    frequency: 'Daily',
    timeOfDay: 'Morning',
    targetUnit: 'days',
    streakDays: 0,
    totalCompletions: 34,
    consistencyRate: 78.0,
    activeDays: [],
    isArchived: true,
    archivedAt: 'Archived 12 days ago',
    lastStreak: 21,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'guest_habit_archived_2',
    title: 'French Language Practice',
    category: 'Mind',
    frequency: 'Daily',
    timeOfDay: 'Evening',
    targetUnit: 'lessons',
    streakDays: 0,
    totalCompletions: 22,
    consistencyRate: 65.0,
    activeDays: [],
    isArchived: true,
    archivedAt: 'Archived 1 month ago',
    lastStreak: 15,
    createdAt: new Date().toISOString(),
  },
];

interface TaskiyeState {
  // Guest Storage Data
  tasks: GuestTask[];
  habits: GuestHabit[];
  dismissedHabitToday?: Record<string, string>;

  // Global Auth Modal State
  isAuthModalOpen: boolean;
  authModalTriggerReason: AuthModalTriggerReason;

  // Modal Actions
  openAuthModal: (reason?: AuthModalTriggerReason) => void;
  closeAuthModal: () => void;

  // Guest Task Actions
  addGuestTask: (task: {
    id?: string;
    title: string;
    date?: string;
    isCompleted?: boolean;
    isHabitInstance?: boolean;
    habitId?: string | null;
    sortOrder?: number;
    category?: string;
    priority?: 'normal' | 'high';
    timeTag?: string;
  }) => boolean;
  toggleGuestTask: (id: string) => void;
  reorderGuestTasks: (items: Array<{ id: string; sortOrder: number }>) => void;
  updateGuestTask: (id: string, updates: Partial<GuestTask>) => void;
  removeGuestTask: (id: string) => void;
  deleteGuestTask: (id: string) => boolean;

  // Guest Habit Actions
  addGuestHabit: (habit: Partial<GuestHabit>) => boolean;
  updateGuestHabit: (id: string, updates: Partial<GuestHabit>) => void;
  archiveGuestHabit: (id: string) => void;
  restoreGuestHabit: (id: string) => void;
  toggleArchiveGuestHabit: (id: string) => void;
  deleteGuestHabit: (id: string) => boolean;
  reorderGuestHabits: (habits: GuestHabit[]) => void;
  toggleHabitCompletion: (habitId: string, isCompleted?: boolean) => void;

  // Synchronization
  syncHabitsToTodayTasks: () => void;

  // Bulk Operations
  clearGuestData: () => void;
  getGuestItemCount: () => number;
}

export const useTaskiyeStore = create<TaskiyeState>()(
  persist(
    (set, get) => ({
      tasks: DEFAULT_INITIAL_TASKS,
      habits: DEFAULT_INITIAL_HABITS,
      isAuthModalOpen: false,
      authModalTriggerReason: null,

      openAuthModal: (reason = 'manual') => {
        set({ isAuthModalOpen: true, authModalTriggerReason: reason });
      },

      closeAuthModal: () => {
        set({ isAuthModalOpen: false, authModalTriggerReason: null });
      },

      getGuestItemCount: () => {
        const { tasks, habits } = get();
        return tasks.length + habits.length;
      },

      addGuestTask: (taskInput) => {
        const currentTotal = get().getGuestItemCount();

        // Check 100-item hard limit counter for guest additions
        if (currentTotal >= GUEST_ITEM_LIMIT) {
          get().openAuthModal('item_limit_reached');
          return false;
        }

        const dateStr = taskInput.date || new Date().toISOString();
        const todayStr = dateStr.slice(0, 10);
        const calculatedSortOrder =
          taskInput.sortOrder ??
          get().tasks.filter((t) => t.date.startsWith(todayStr)).length;

        const newTaskId =
          taskInput.id || `guest_task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const newTask: GuestTask = {
          id: newTaskId,
          title: taskInput.title.trim(),
          date: dateStr,
          isCompleted: Boolean(taskInput.isCompleted),
          isHabitInstance: Boolean(taskInput.isHabitInstance),
          habitId: taskInput.habitId ?? null,
          sortOrder: calculatedSortOrder,
          category: taskInput.category || 'Work',
          priority: taskInput.priority || 'normal',
          timeTag: taskInput.timeTag || '',
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          let updatedHabits = state.habits;
          // If completing a habit instance, increment habit completion & streak, clear warnings
          if (newTask.isHabitInstance && newTask.isCompleted) {
            updatedHabits = state.habits.map((habit) => {
              const matchesId = newTask.habitId && habit.id === newTask.habitId;
              const matchesTitle =
                habit.title &&
                newTask.title &&
                habit.title.toLowerCase().trim() === newTask.title.toLowerCase().trim();

              if (!matchesId && !matchesTitle) return habit;

              return {
                ...habit,
                totalCompletions: (habit.totalCompletions || 0) + 1,
                streakDays: (habit.streakDays || 0) + 1,
                warnings: 0,
                lastCompletedDate: todayStr,
                isArchived: false, // Never archive
              };
            });
          }

          return {
            tasks: [...state.tasks, newTask],
            habits: updatedHabits,
          };
        });

        return true;
      },

      toggleGuestTask: (id: string) => {
        const state = get();
        const targetTask = state.tasks.find((t) => t.id === id);
        if (!targetTask) return;

        const nextCompleted = !targetTask.isCompleted;
        const todayStr = new Date().toISOString().slice(0, 10);

        // 1. Update task completion status
        const updatedTasks = state.tasks.map((task) =>
          task.id === id ? { ...task, isCompleted: nextCompleted } : task
        );

        // 2. If it's a habit instance, update habit in Habit Manager (+1 session, streak, clear warnings)
        let updatedHabits = state.habits;
        if (targetTask.isHabitInstance) {
          updatedHabits = state.habits.map((habit) => {
            const matchesId = targetTask.habitId && habit.id === targetTask.habitId;
            const matchesTitle =
              habit.title &&
              targetTask.title &&
              habit.title.toLowerCase().trim() === targetTask.title.toLowerCase().trim();

            if (!matchesId && !matchesTitle) return habit;

            if (nextCompleted) {
              // Checking off: +1 completion, +1 streak, clear warnings
              return {
                ...habit,
                totalCompletions: (habit.totalCompletions || 0) + 1,
                streakDays: (habit.streakDays || 0) + 1,
                warnings: 0,
                lastCompletedDate: todayStr,
                isArchived: false, // Ensure checking off NEVER archives!
              };
            } else {
              // Unchecking: -1 completion, -1 streak (floor at 0)
              return {
                ...habit,
                totalCompletions: Math.max(0, (habit.totalCompletions || 0) - 1),
                streakDays: Math.max(0, (habit.streakDays || 0) - 1),
                lastCompletedDate: null,
                isArchived: false,
              };
            }
          });
        }

        set({
          tasks: updatedTasks,
          habits: updatedHabits,
        });
      },

      toggleHabitCompletion: (habitId: string, isCompleted?: boolean) => {
        const state = get();
        const habit = state.habits.find((h) => h.id === habitId);
        if (!habit) return;

        const todayStr = new Date().toISOString().slice(0, 10);
        const willBeCompleted =
          typeof isCompleted === 'boolean'
            ? isCompleted
            : habit.lastCompletedDate !== todayStr;

        const updatedHabits = state.habits.map((h) => {
          if (h.id !== habitId) return h;
          if (willBeCompleted) {
            return {
              ...h,
              totalCompletions: (h.totalCompletions || 0) + 1,
              streakDays: (h.streakDays || 0) + 1,
              warnings: 0,
              lastCompletedDate: todayStr,
              isArchived: false,
            };
          } else {
            return {
              ...h,
              totalCompletions: Math.max(0, (h.totalCompletions || 0) - 1),
              streakDays: Math.max(0, (h.streakDays || 0) - 1),
              lastCompletedDate: null,
              isArchived: false,
            };
          }
        });

        // Also update any matching task for today
        const updatedTasks = state.tasks.map((t) => {
          const matches =
            t.habitId === habitId ||
            (t.isHabitInstance && t.title.toLowerCase().trim() === habit.title.toLowerCase().trim());
          return matches ? { ...t, isCompleted: willBeCompleted } : t;
        });

        set({
          habits: updatedHabits,
          tasks: updatedTasks,
        });
      },

      reorderGuestTasks: (items) => {
        set((state) => {
          const sortMap = new Map(items.map((i) => [i.id, i.sortOrder]));
          return {
            tasks: state.tasks.map((t) =>
              sortMap.has(t.id) ? { ...t, sortOrder: sortMap.get(t.id)! } : t
            ),
          };
        });
      },

      updateGuestTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }));
      },

      removeGuestTask: (id) => {
        const target = get().tasks.find((t) => t.id === id);
        const todayStr = new Date().toISOString().slice(0, 10);
        set((state) => {
          const newTasks = state.tasks.filter((task) => task.id !== id);
          const dismissed = { ...(state.dismissedHabitToday || {}) };
          if (target?.habitId) {
            dismissed[target.habitId] = todayStr;
          }
          if (target?.isHabitInstance && target.title) {
            dismissed[target.title.toLowerCase()] = todayStr;
          }
          return {
            tasks: newTasks,
            dismissedHabitToday: dismissed,
          };
        });
      },

      deleteGuestTask: (id: string) => {
        get().removeGuestTask(id);
        return true;
      },

      syncHabitsToTodayTasks: () => {
        const state = get();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const jsDay = now.getDay();
        const monBasedDay = (jsDay + 6) % 7; // Mon: 0, Tue: 1, ..., Sun: 6

        const dismissed = state.dismissedHabitToday || {};

        // A habit is due today if:
        // 1. Not archived
        // 2. Not explicitly dismissed for today
        // 3. Current day matches activeDays configured in habit screen (Mon:0 .. Sun:6)
        const isHabitDueToday = (h: GuestHabit): boolean => {
          if (h.isArchived) return false;
          if (
            dismissed[h.id] === todayStr ||
            (h.title && dismissed[h.title.toLowerCase().trim()] === todayStr)
          ) {
            return false;
          }

          // Active days array from habit screen takes absolute highest priority
          if (Array.isArray(h.activeDays) && h.activeDays.length > 0) {
            return h.activeDays.includes(monBasedDay);
          }

          const freq = (h.frequency || '').toLowerCase();
          if (freq.includes('weekday')) {
            return monBasedDay >= 0 && monBasedDay <= 4;
          }
          if (freq.includes('weekend')) {
            return monBasedDay === 5 || monBasedDay === 6;
          }
          return true; // default Daily / Everyday
        };

        // Evaluate streaks & warnings for all active habits with dirty check
        let habitsChanged = false;
        const evaluatedHabits = state.habits.map((h) => {
          if (h.isArchived) return h;
          const { streakDays, warnings } = evaluateHabitStreakAndWarnings(h, todayStr);
          if (h.streakDays !== streakDays || h.warnings !== warnings) {
            habitsChanged = true;
            return { ...h, streakDays, warnings };
          }
          return h;
        });

        const activeDueHabits = evaluatedHabits.filter(isHabitDueToday);

        // Find habits that exist in library but are NOT due today or are archived
        const notDueHabitIds = new Set(
          evaluatedHabits.filter((h) => !isHabitDueToday(h)).map((h) => h.id)
        );
        const notDueHabitTitles = new Set(
          evaluatedHabits
            .filter((h) => !isHabitDueToday(h))
            .map((h) => (h.title || '').toLowerCase().trim())
        );

        // Prune any uncompleted habit instance that is NOT assigned to today
        let updatedTasks = state.tasks.filter((task) => {
          if (task.isHabitInstance && !task.isCompleted) {
            const isNotDue =
              (task.habitId && notDueHabitIds.has(task.habitId)) ||
              (task.title && notDueHabitTitles.has(task.title.toLowerCase().trim()));
            if (isNotDue) {
              return false;
            }
          }
          return true;
        });

        // For each active habit due today, ensure a task instance exists
        activeDueHabits.forEach((habit) => {
          const existingIndex = updatedTasks.findIndex(
            (t) =>
              (t.habitId && t.habitId === habit.id) ||
              (t.isHabitInstance &&
                t.title.toLowerCase().trim() === habit.title.toLowerCase().trim())
          );

          if (existingIndex >= 0) {
            const existing = updatedTasks[existingIndex];
            const isDifferentDay = existing.date && !existing.date.startsWith(todayStr);

            // Update habit details on existing task
            updatedTasks[existingIndex] = {
              ...existing,
              title: habit.title,
              category: habit.category || 'Routine',
              timeTag: habit.timeOfDay || existing.timeTag,
              habitId: habit.id,
              isHabitInstance: true,
              date: isDifferentDay ? new Date().toISOString() : existing.date,
              isCompleted: isDifferentDay ? false : existing.isCompleted,
            };
          } else {
            // Inject new habit task at the top (sortOrder: -1)
            const newTask: GuestTask = {
              id: `guest_task_habit_${habit.id}_${todayStr}`,
              title: habit.title,
              date: new Date().toISOString(),
              isCompleted: false,
              isHabitInstance: true,
              habitId: habit.id,
              sortOrder: -1,
              category: habit.category || 'Routine',
              priority: 'normal',
              timeTag: habit.timeOfDay || 'Continuous',
              createdAt: new Date().toISOString(),
            };
            updatedTasks = [newTask, ...updatedTasks];
          }
        });

        // Check if tasks actually changed compared to state.tasks
        let tasksChanged = updatedTasks.length !== state.tasks.length;
        if (!tasksChanged) {
          for (let i = 0; i < updatedTasks.length; i++) {
            const u = updatedTasks[i];
            const s = state.tasks[i];
            if (
              u.id !== s.id ||
              u.title !== s.title ||
              u.isCompleted !== s.isCompleted ||
              u.isHabitInstance !== s.isHabitInstance ||
              u.habitId !== s.habitId ||
              u.category !== s.category ||
              u.timeTag !== s.timeTag ||
              u.date !== s.date
            ) {
              tasksChanged = true;
              break;
            }
          }
        }

        // Only commit state and notify subscribers if an actual change occurred
        if (habitsChanged || tasksChanged) {
          set({
            habits: habitsChanged ? evaluatedHabits : state.habits,
            tasks: tasksChanged ? updatedTasks : state.tasks,
          });
        }
      },

      addGuestHabit: (habitInput) => {
        const currentTotal = get().getGuestItemCount();

        if (currentTotal >= GUEST_ITEM_LIMIT) {
          get().openAuthModal('item_limit_reached');
          return false;
        }

        const newHabit: GuestHabit = {
          id: habitInput.id || `guest_habit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: habitInput.title?.trim() || 'New Habit',
          category: habitInput.category || 'Routine',
          frequency: habitInput.frequency?.trim() || 'Daily',
          timeOfDay: habitInput.timeOfDay || 'Morning (08:00 AM)',
          targetUnit: habitInput.targetUnit || 'sessions',
          streakDays: habitInput.streakDays ?? 0,
          totalCompletions: habitInput.totalCompletions ?? 0,
          consistencyRate: habitInput.consistencyRate ?? 100,
          activeDays: habitInput.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
          isArchived: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const dismissed = { ...(state.dismissedHabitToday || {}) };
          delete dismissed[newHabit.id];
          if (newHabit.title) {
            delete dismissed[newHabit.title.toLowerCase().trim()];
          }

          return {
            habits: [newHabit, ...state.habits],
            dismissedHabitToday: dismissed,
          };
        });

        get().syncHabitsToTodayTasks();
        return true;
      },

      updateGuestHabit: (id, updates) => {
        set((state) => {
          const target = state.habits.find((h) => h.id === id);
          const dismissed = { ...(state.dismissedHabitToday || {}) };
          delete dismissed[id];
          if (target?.title) {
            delete dismissed[target.title.toLowerCase().trim()];
          }
          if (updates.title) {
            delete dismissed[updates.title.toLowerCase().trim()];
          }

          return {
            habits: state.habits.map((habit) =>
              habit.id === id ? { ...habit, ...updates } : habit
            ),
            dismissedHabitToday: dismissed,
          };
        });
        get().syncHabitsToTodayTasks();
      },

      archiveGuestHabit: (id) => {
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id
              ? {
                  ...habit,
                  isArchived: true,
                  archivedAt: 'Archived recently',
                  lastStreak: habit.streakDays,
                }
              : habit
          ),
        }));
        get().syncHabitsToTodayTasks();
      },

      restoreGuestHabit: (id) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id
              ? {
                  ...habit,
                  isArchived: false,
                  archivedAt: undefined,
                  streakDays:
                    habit.lastStreak !== undefined && habit.lastStreak > 0
                      ? habit.lastStreak
                      : habit.streakDays,
                  warnings: 0,
                  lastCompletedDate:
                    habit.streakDays > 0 || (habit.lastStreak && habit.lastStreak > 0)
                      ? yesterdayStr
                      : habit.lastCompletedDate,
                }
              : habit
          ),
        }));
        get().syncHabitsToTodayTasks();
      },

      toggleArchiveGuestHabit: (id: string) => {
        const habit = get().habits.find((h) => h.id === id);
        if (habit?.isArchived) {
          get().restoreGuestHabit(id);
        } else {
          get().archiveGuestHabit(id);
        }
      },

      reorderGuestHabits: (habits: GuestHabit[]) => {
        set({ habits });
      },

      deleteGuestHabit: (id: string) => {
        set((state) => {
          const target = state.habits.find((h) => h.id === id);
          return {
            habits: state.habits.filter((h) => h.id !== id),
            tasks: state.tasks.filter(
              (t) =>
                t.habitId !== id &&
                !(target?.title && t.isHabitInstance && t.title.toLowerCase().trim() === target.title.toLowerCase().trim())
            ),
          };
        });
        get().syncHabitsToTodayTasks();
        return true;
      },

      clearGuestData: () => {
        set({ tasks: [], habits: [] });
      },
    }),
    {
      name: 'taskiye-guest-storage',
      // Persist only tasks and habits, keeping modal state ephemeral
      partialize: (state) => ({
        tasks: state.tasks,
        habits: state.habits,
        dismissedHabitToday: state.dismissedHabitToday,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (!state.tasks || state.tasks.length === 0)) {
          state.tasks = DEFAULT_INITIAL_TASKS;
        }
        if (state && (!state.habits || state.habits.length === 0)) {
          state.habits = DEFAULT_INITIAL_HABITS;
        }
        state?.syncHabitsToTodayTasks();
      },
    }
  )
);
