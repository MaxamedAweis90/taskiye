import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Plus,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { TaskHistoryRow, HistoryTask } from './TaskHistoryRow';

interface TaskHistoryUpcomingSectionProps {
  upcomingTasks: HistoryTask[];
  expandedTaskId?: string | null;
  creatingTaskId?: string | null;
  highlightedTaskId?: string | null;
  swipingOutTaskId?: string | null;
  onCreationAnimationComplete?: (id: string) => void;
  onToggleExpand?: (id: string) => void;
  onToggle: (id: string, isCompleted: boolean) => void;
  onEdit: (task: HistoryTask) => void;
  onDelete: (task: HistoryTask) => void;
  onOpenReschedule: (task: HistoryTask) => void;
  onAddTask?: () => void;
}

/**
 * TaskHistoryUpcomingSection:
 * Expandable / collapsible section displayed at the very top of Task History
 * displaying all tasks scheduled for tomorrow or specific future dates.
 */
export const TaskHistoryUpcomingSection: React.FC<TaskHistoryUpcomingSectionProps> = ({
  upcomingTasks,
  expandedTaskId,
  creatingTaskId,
  highlightedTaskId,
  swipingOutTaskId,
  onCreationAnimationComplete,
  onToggleExpand,
  onToggle,
  onEdit,
  onDelete,
  onOpenReschedule,
  onAddTask,
}) => {
  // Store user collapsed preference in localStorage, defaulting to open when upcoming tasks exist
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('taskiye_upcoming_section_open');
      if (stored !== null) return stored === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('taskiye_upcoming_section_open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // If a task inside this upcoming section is highlighted or being created, ensure section is open
  useEffect(() => {
    const targetId = highlightedTaskId || creatingTaskId;
    if (targetId && upcomingTasks.some((t) => t.id === targetId)) {
      setIsOpen(true);
    }
  }, [highlightedTaskId, creatingTaskId, upcomingTasks]);

  const totalCount = upcomingTasks.length;
  const completedCount = upcomingTasks.filter((t) => t.isCompleted).length;

  // Unique upcoming dates for summary preview pills
  const previewDates = useMemo(() => {
    const dates = Array.from(new Set(upcomingTasks.map((t) => t.date))).slice(0, 3);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dates.map((dStr) => {
      try {
        const [y, m, d] = dStr.slice(0, 10).split('-').map(Number);
        const target = new Date(y, m - 1, d);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return 'Tomorrow';
        return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return dStr;
      }
    });
  }, [upcomingTasks]);

  return (
    <div className="w-full rounded-2xl md:rounded-3xl border border-amber-500/25 dark:border-amber-400/20 bg-gradient-to-r from-amber-500/[0.04] via-slate-50/50 to-amber-500/[0.02] dark:from-amber-400/[0.05] dark:via-[#10192D] dark:to-[#0B132B] shadow-sm overflow-hidden transition-all duration-200">
      {/* Clickable Header Bar */}
      <div
        onClick={toggleOpen}
        className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-amber-500/[0.03] dark:hover:bg-white/[0.02] transition-colors select-none"
      >
        {/* Left Side: Icon, Title & Badges */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                Upcoming Tasks
              </span>

              {/* Total Count Badge */}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
              </span>

              {/* Completed count if any */}
              {completedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hidden sm:inline-flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>{completedCount} done</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                Tasks scheduled for tomorrow and specific future dates
              </span>

              {/* Preview Dates Pills when collapsed */}
              {!isOpen && previewDates.length > 0 && (
                <div className="hidden md:flex items-center gap-1 shrink-0">
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  {previewDates.map((d, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action & Expand/Collapse Toggle */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Schedule a new upcoming task"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Task</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleOpen}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={isOpen ? 'Collapse upcoming tasks' : 'Expand upcoming tasks'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {/* Expandable Content Area */}
      {isOpen && (
        <div className="border-t border-amber-500/15 dark:border-amber-400/10 p-3 sm:p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {upcomingTasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {upcomingTasks.map((task) => (
                <TaskHistoryRow
                  key={task.id}
                  task={task}
                  isExpanded={expandedTaskId === task.id}
                  isCreating={creatingTaskId === task.id}
                  isHighlighted={highlightedTaskId === task.id}
                  isSwipingOut={swipingOutTaskId === task.id}
                  onCreationAnimationComplete={onCreationAnimationComplete}
                  onToggleExpand={() => onToggleExpand?.(task.id)}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onOpenReschedule={onOpenReschedule}
                  showDateBadge={true}
                  canReorder={false}
                />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="py-6 px-4 text-center flex flex-col items-center justify-center gap-2.5 rounded-xl bg-white/60 dark:bg-white/[0.02] border border-dashed border-amber-500/20 dark:border-white/10">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No upcoming tasks scheduled
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                Plan ahead by scheduling tasks for tomorrow or any specific future date.
              </p>
              {onAddTask && (
                <button
                  type="button"
                  onClick={onAddTask}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule First Upcoming Task</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
