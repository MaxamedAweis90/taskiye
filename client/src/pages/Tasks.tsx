import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth-client';
import { useTaskiyeStore, GuestTask } from '../store/useTaskiyeStore';
import { TaskHistoryHeader } from '../components/tasks/TaskHistoryHeader';
import { TaskHistoryDaySection, HistoryDayBucket } from '../components/tasks/TaskHistoryDaySection';
import { HistoryTask } from '../components/tasks/TaskHistoryRow';
import { TaskRescheduleModal } from '../components/tasks/TaskRescheduleModal';
import { TaskEditCreateModal } from '../components/tasks/TaskEditCreateModal';
import { TaskHistorySkeleton } from '../components/tasks/TaskHistorySkeleton';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { normalizeCategory } from '../constants/categories';

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
    setTodayChecklistCompletedCount,
  } = useTaskiyeStore();

  // Filter and Toolbar State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Modals State
  const [rescheduleTask, setRescheduleTask] = useState<HistoryTask | null>(null);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [editCreateTask, setEditCreateTask] = useState<HistoryTask | null>(null);
  const [isEditCreateOpen, setIsEditCreateOpen] = useState(false);
  const [defaultCreateDate, setDefaultCreateDate] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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
    const tasks = (guestTasks || []).filter((t: GuestTask) => !t.isHabitInstance && !t.habitId);

    // Group tasks by date
    const map = new Map<string, GuestTask[]>();
    tasks.forEach((t: GuestTask) => {
      const d = (t.date || todayStr).slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    });

    // Ensure Tomorrow and Today buckets always exist
    if (!map.has(tomorrowStr)) map.set(tomorrowStr, []);
    if (!map.has(todayStr)) map.set(todayStr, []);

    // Sort dates in descending order
    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

    const dayBuckets: HistoryDayBucket[] = sortedDates.map((dateStr) => {
      const dateObj = new Date(dateStr + 'T12:00:00.000Z');
      const isTomorrow = dateStr === tomorrowStr;
      const isToday = dateStr === todayStr;
      const isYesterday = dateStr === yesterdayStr;

      let label = isTomorrow
        ? 'TOMORROW'
        : isToday
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

      const dayTasksRaw = map.get(dateStr) || [];
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
        isTomorrow,
        isToday,
        isYesterday,
        tasks: filteredTasks,
        totalCount,
        completedCount,
        completionPercentage,
      };
    });

    return {
      days: dayBuckets,
      totalLoggedCount: tasks.length,
      hasMore: false,
      nextCursorDate: null,
    };
  }, [isAuthenticated, guestTasks, today, todayStr, tomorrowStr, hideCompleted, selectedCategory, searchQuery]);

  // Unified State & Skeletons
  const days: HistoryDayBucket[] = isAuthenticated ? historyData?.days || [] : guestHistoryData?.days || [];
  const totalLoggedCount: number = isAuthenticated
    ? historyData?.totalLoggedCount ?? 0
    : guestHistoryData?.totalLoggedCount ?? 0;
  const hasMore: boolean = isAuthenticated ? Boolean(historyData?.hasMore) : false;
  const isLoadingInitial: boolean = isAuthenticated ? isHistoryLoading && !historyData : false;

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
      queryClient.setQueryData(['tasks', todayStr], (oldTasks: any[] | undefined) => {
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

          // Optimistically append to target day bucket in UI cache
          queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
            if (!old) return old;
            return {
              ...old,
              days: old.days.map((day) => {
                if (day.date === targetDateStr) {
                  const updated = [mappedTask, ...day.tasks];
                  return {
                    ...day,
                    tasks: updated,
                    totalCount: day.totalCount + 1,
                    completionPercentage: Math.round(
                      (day.completedCount / (day.totalCount + 1)) * 100
                    ),
                  };
                }
                return day;
              }),
            };
          });

          // If scheduled for today, optimistically append to Dashboard cache
          if (targetDateStr === todayStr) {
            queryClient.setQueryData(['tasks', todayStr], (oldTasks: any[] | undefined) => {
              if (!oldTasks) return oldTasks;
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
                ...oldTasks,
              ];
            });
          }

          // Invalidate tasks queries so Dashboard & other views stay dynamically in sync
          queryClient.invalidateQueries({ queryKey: ['tasks'] });

          showToast(
            'Task Rescheduled! 🎯',
            `"${rescheduleTask.title}" has been cloned and scheduled for ${
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
        'Task Rescheduled! 🎯',
        `"${rescheduleTask.title}" scheduled for ${
          targetDate === 'today' ? 'Today' : targetDate === 'tomorrow' ? 'Tomorrow' : targetDateStr
        }.`,
        'success'
      );
    }
  };

  /**
   * Delete Task Handler (Sends to Trash with instant recovery & global cache sync)
   */
  const handleDeleteTask = (id: string) => {
    let deletedTitle = 'Task';
    days.forEach((d) => {
      const found = d.tasks.find((t) => t.id === id);
      if (found) deletedTitle = found.title;
    });

    if (isAuthenticated) {
      // 1. Optimistically update history cache
      queryClient.setQueryData(historyQueryKey, (old: typeof historyData) => {
        if (!old) return old;
        return {
          ...old,
          days: old.days.map((d) => {
            const filtered = d.tasks.filter((t) => t.id !== id);
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
        };
      });

      // 2. Optimistically remove from Dashboard cache
      queryClient.setQueryData(['tasks', todayStr], (oldTasks: any[] | undefined) => {
        if (!oldTasks) return oldTasks;
        return oldTasks.filter((t) => t._id !== id);
      });

      // 3. Invalidate tasks queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch((err) => {
        console.error('Failed to soft-delete task:', err);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });
    } else {
      deleteGuestTask(id);
    }

    showToast('Moved to Trash', `"${deletedTitle}" moved to 30-day trash.`, 'info', {
      label: 'Undo',
      onClick: async () => {
        if (isAuthenticated) {
          try {
            await fetch(`/api/tasks/${id}/restore`, {
              method: 'POST',
              credentials: 'include',
            });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          } catch (err) {
            console.error('Failed to restore task:', err);
          }
        }
        markTaskRestored(id);
      },
    });
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
          queryClient.setQueryData(['tasks', todayStr], (oldTasks: any[] | undefined) => {
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
      if (isAuthenticated) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: taskData.title,
            date: taskData.date,
            category: taskData.category,
            priority: taskData.priority,
            timeTag: taskData.timeTag,
            isCompleted: false,
          }),
        });
        const json = await res.json();
        const createdTask = json?.data;

        // If created for today, optimistically append to Dashboard cache
        if (taskData.date === todayStr && createdTask) {
          queryClient.setQueryData(['tasks', todayStr], (oldTasks: any[] | undefined) => {
            if (!oldTasks) return oldTasks;
            return [createdTask, ...oldTasks];
          });
        }

        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        addGuestTask({
          id: `guest_task_${Date.now()}`,
          title: taskData.title,
          date: taskData.date,
          isCompleted: false,
          isHabitInstance: false,
          sortOrder: 0,
          category: normalizeCategory(taskData.category),
          priority: taskData.priority,
          timeTag: taskData.timeTag,
        });
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

      {/* 2. Chronological Day Sections */}
      {isLoadingInitial ? (
        <TaskHistorySkeleton />
      ) : days.length > 0 ? (
        <div className="flex flex-col gap-6 w-full">
          {days.map((day) => (
            <TaskHistoryDaySection
              key={day.date}
              day={day}
              onToggle={handleToggleTask}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteTask}
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
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#10192D] border border-white/[0.08]">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No tasks match your filters</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Try adjusting your search criteria, category filters, or add a new scheduled task.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All Categories');
              setHideCompleted(false);
            }}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/20 transition-all cursor-pointer"
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
    </div>
  );
};

export default Tasks;
