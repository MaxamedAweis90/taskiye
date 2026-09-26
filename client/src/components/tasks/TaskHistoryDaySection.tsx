import React from 'react';
import { CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { TaskHistoryRow, HistoryTask } from './TaskHistoryRow';

export interface HistoryDayBucket {
  date: string;
  label: string;
  formattedDate: string;
  isTomorrow: boolean;
  isToday: boolean;
  isYesterday: boolean;
  tasks: HistoryTask[];
  totalCount: number;
  completedCount: number;
  completionPercentage: number;
}

interface TaskHistoryDaySectionProps {
  day: HistoryDayBucket;
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
  onQuickReschedule: (id: string, targetDate: 'today' | 'tomorrow') => void;
  onAddTaskForDay?: (date: string) => void;
  onReorderTask?: (
    dateStr: string,
    sourceTaskId: string,
    targetOrDirection: string | 'up' | 'down'
  ) => void;
}

export const TaskHistoryDaySection: React.FC<TaskHistoryDaySectionProps> = ({
  day,
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
  onQuickReschedule,
  onAddTaskForDay,
  onReorderTask,
}) => {
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = React.useState<string | null>(null);

  // Desktop HTML5 drag & drop handlers (strictly intra-day scoped)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== id) {
      setDragOverTaskId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedTaskId && draggedTaskId !== targetId) {
      onReorderTask?.(day.date, draggedTaskId, targetId);
    }
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  // Cross-Platform Mobile Touch Drag Handlers
  const touchTaskDragRef = React.useRef<{ sourceId: string | null; targetId: string | null }>({
    sourceId: null,
    targetId: null,
  });

  const handleTouchStart = (_e: React.TouchEvent, id: string) => {
    touchTaskDragRef.current = { sourceId: id, targetId: null };
    setDraggedTaskId(id);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchTaskDragRef.current.sourceId) return;
    const touch = e.touches[0];
    if (!touch) return;

    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetEl) return;

    const row = targetEl.closest<HTMLElement>(`[data-day-date="${day.date}"][data-task-history-id]`);
    if (row) {
      const targetId = row.getAttribute('data-task-history-id');
      if (targetId && targetId !== touchTaskDragRef.current.sourceId) {
        touchTaskDragRef.current.targetId = targetId;
        setDragOverTaskId(targetId);
      }
    }
  };

  const handleTouchEnd = () => {
    const { sourceId, targetId } = touchTaskDragRef.current;
    if (sourceId && targetId && sourceId !== targetId) {
      onReorderTask?.(day.date, sourceId, targetId);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(15);
        } catch {}
      }
    }
    touchTaskDragRef.current = { sourceId: null, targetId: null };
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const hasMissed = day.tasks.some((t) => t.status === 'missed');
  const isAllCompleted = day.totalCount > 0 && day.completedCount === day.totalCount;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Day Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 pb-1">
        {/* Left: Label & Date */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              day.isToday
                ? 'text-amber-600 dark:text-amber-400'
                : day.isTomorrow
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {day.label}
          </span>

          <span className="text-slate-400 dark:text-slate-500 text-xs">•</span>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {day.formattedDate}
          </span>

          {/* Special Context Badges */}
          {day.isTomorrow && (
            <span className="bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
              Upcoming
            </span>
          )}

          {day.isToday && (
            <span className="bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20 dark:border-amber-400/30 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" />
              <span>Active</span>
            </span>
          )}

          {hasMissed && (
            <span className="bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-500 dark:text-rose-400" />
              <span>Missed Task</span>
            </span>
          )}
        </div>

        {/* Right: Metrics / Ratio Badge */}
        <div className="flex items-center gap-2">
          {day.isTomorrow ? (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {day.totalCount} Scheduled
            </span>
          ) : isAllCompleted ? (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                {day.completedCount} / {day.totalCount} Completed (100%)
              </span>
            </span>
          ) : day.totalCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {day.completedCount} / {day.totalCount} Complete
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-400/30">
                {day.completionPercentage}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">
              No tasks scheduled
            </span>
          )}

          {/* Quick Add for Tomorrow / Today */}
          {(day.isTomorrow || day.isToday) && onAddTaskForDay && (
            <button
              type="button"
              onClick={() => onAddTaskForDay(day.date)}
              title={`Add task for ${day.isTomorrow ? 'Tomorrow' : 'Today'}`}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-400/10 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Task Rows List */}
      <div className="flex flex-col gap-2">
        {day.tasks.length > 0 ? (
          day.tasks.map((task, index) => (
            <TaskHistoryRow
              key={task.id}
              task={task}
              dayDate={day.date}
              isTomorrow={day.isTomorrow}
              isToday={day.isToday}
              isExpanded={expandedTaskId === task.id}
              isCreating={creatingTaskId === task.id}
              isHighlighted={highlightedTaskId === task.id}
              isSwipingOut={swipingOutTaskId === task.id}
              isFirstInDay={index === 0}
              isLastInDay={index === day.tasks.length - 1}
              canReorder={day.tasks.length > 1 && Boolean(onReorderTask)}
              isDragging={draggedTaskId === task.id}
              isDragOver={dragOverTaskId === task.id}
              onDragStart={(e) => handleDragStart(e, task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDrop={(e) => handleDrop(e, task.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, task.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMoveUp={() => onReorderTask?.(day.date, task.id, 'up')}
              onMoveDown={() => onReorderTask?.(day.date, task.id, 'down')}
              onCreationAnimationComplete={onCreationAnimationComplete}
              onToggleExpand={() => onToggleExpand?.(task.id)}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenReschedule={onOpenReschedule}
              onQuickReschedule={onQuickReschedule}
            />
          ))
        ) : (
          <div className="py-4 px-5 rounded-2xl bg-slate-50/50 dark:bg-[#10192D]/40 border border-dashed border-slate-200 dark:border-white/[0.06] text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <span>No tasks logged for this day.</span>
            {(day.isTomorrow || day.isToday) && onAddTaskForDay && (
              <button
                type="button"
                onClick={() => onAddTaskForDay(day.date)}
                className="text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                + Schedule one now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
