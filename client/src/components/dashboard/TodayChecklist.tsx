import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  GripVertical,
  Plus,
  Filter as FilterIcon,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Repeat,
  Sparkles,
} from 'lucide-react';

import { useTaskiyeStore } from '../../store/useTaskiyeStore';

export interface ChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
  category: string;
  priority?: 'normal' | 'high';
  timeTag?: string;
  isHabitInstance?: boolean;
  habitId?: string | null;
  streakDays?: number;
  warnings?: number;
}

interface TodayChecklistProps {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  onReorder?: (items: ChecklistItem[]) => void;
  onQuickTaskClick?: () => void;
  onEdit?: (item: ChecklistItem) => void;
  onDelete?: (id: string) => void;
  updatingTaskId?: string | null;
  creatingTaskId?: string | null;
  highlightedTaskId?: string | null;
  onCreationAnimationComplete?: (id: string) => void;
}

interface TypewriterTitleProps {
  text: string;
  isWriting: boolean;
  onFinish?: () => void;
  className?: string;
}

const ActiveTypewriterTitle: React.FC<{
  text: string;
  onFinish?: () => void;
  className?: string;
}> = ({ text, onFinish, className }) => {
  const [displayedText, setDisplayedText] = useState('');
  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;

  React.useEffect(() => {
    let index = 0;
    const intervalMs = Math.max(16, Math.min(32, Math.floor(650 / (text.length || 1))));

    const timer = setInterval(() => {
      index++;
      setDisplayedText(text.slice(0, index));

      if (index >= text.length) {
        clearInterval(timer);
        setTimeout(() => {
          onFinishRef.current?.();
        }, 350);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <span className={className}>
      {displayedText}
      <span className="inline-block w-1.5 h-3.5 bg-[#FACC15] ml-1 translate-y-[2px] animate-pulse rounded-sm" />
    </span>
  );
};

const TypewriterTitle: React.FC<TypewriterTitleProps> = ({
  text,
  isWriting,
  onFinish,
  className,
}) => {
  // Pure static render with 0 effects and 0 state when not writing
  if (!isWriting) {
    return <span className={className}>{text}</span>;
  }

  return <ActiveTypewriterTitle text={text} onFinish={onFinish} className={className} />;
};

export const TodayChecklist: React.FC<TodayChecklistProps> = ({
  items,
  onToggle,
  onReorder,
  onQuickTaskClick,
  onEdit,
  onDelete,
  updatingTaskId,
  creatingTaskId,
  highlightedTaskId,
  onCreationAnimationComplete,
}) => {
  const { setTodayChecklistCompletedCount } = useTaskiyeStore();
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ChecklistItem | null>(null);
  const [swipingOutTaskId, setSwipingOutTaskId] = useState<string | null>(null);

  // Drag to reorder state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Maintain local order so user drag-and-drop instantly updates the UI
  const [localItems, setLocalItems] = useState<ChecklistItem[]>(items);

  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Local optimistic toggle state for instant 0ms checkbox feedback
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});

  // Synchronize optimistic state when items update from parent or store (guarded to avoid redundant setState)
  React.useEffect(() => {
    setOptimisticOverrides((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      items.forEach((item) => {
        if (next[item.id] !== undefined && next[item.id] === item.isCompleted) {
          delete next[item.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [items]);

  // Auto-scroll to newly created task smoothly with retries
  React.useEffect(() => {
    if (!creatingTaskId) return;

    if (document.activeElement instanceof HTMLElement && document.activeElement.tagName !== 'BODY') {
      document.activeElement.blur();
    }

    let isCancelled = false;

    const performScroll = (attempts = 0) => {
      if (isCancelled) return;
      const el = document.getElementById(`task-item-${creatingTaskId}`);
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
        setTimeout(() => performScroll(attempts + 1), 40);
      }
    };

    performScroll(0);

    return () => {
      isCancelled = true;
    };
  }, [creatingTaskId]);

  const isItemCompleted = (item: ChecklistItem) =>
    optimisticOverrides[item.id] !== undefined
      ? optimisticOverrides[item.id]
      : item.isCompleted;

  const handleToggle = (id: string) => {
    const item = items.find((i) => i.id === id);
    const currentlyCompleted =
      optimisticOverrides[id] !== undefined
        ? optimisticOverrides[id]
        : item?.isCompleted ?? false;
    const nextCompleted = !currentlyCompleted;

    // Flip immediately in UI
    setOptimisticOverrides((prev) => ({
      ...prev,
      [id]: nextCompleted,
    }));

    onToggle(id);
  };

  const completedCount = items.filter((i) => isItemCompleted(i)).length;
  const totalCount = items.length;

  // Keep store's todayChecklistCompletedCount strictly in sync with actual completed items
  React.useEffect(() => {
    setTodayChecklistCompletedCount(completedCount);
  }, [completedCount, setTodayChecklistCompletedCount]);

  // Drag and drop handlers for reordering items
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverItemId !== id) {
      setDragOverItemId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const fromIndex = localItems.findIndex((i) => i.id === draggedItemId);
    const toIndex = localItems.findIndex((i) => i.id === targetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const reordered = [...localItems];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, removed);
      setLocalItems(reordered);
      onReorder?.(reordered);
    }

    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const filteredItems = localItems.filter((item) => {
    const completed = isItemCompleted(item);
    if (filterMode === 'active') return !completed;
    if (filterMode === 'completed') return completed;
    return true;
  });

  const getCategoryBadgeClass = (category?: string) => {
    const lower = (category || '').toLowerCase();
    if (lower.includes('health') || lower.includes('fitness')) {
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
    }
    if (lower.includes('routine')) {
      return 'bg-teal-500/15 border-teal-500/30 text-teal-300';
    }
    if (lower.includes('work') || lower.includes('focus')) {
      return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
    }
    if (lower.includes('mind') || lower.includes('reading')) {
      return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
    }
    return 'bg-slate-700/40 border-slate-600/40 text-slate-300';
  };

  return (
    <div
      id="today-checklist-container"
      className="bg-[#162032] border border-white/[0.06] rounded-2xl p-4 sm:p-6 transition-all hover:border-white/[0.1]"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase">
            Today's Focus & Routine
          </h3>
          <span className="bg-[#1C263A] border border-amber-400/30 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {completedCount} / {totalCount} Complete
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 text-xs relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors font-medium cursor-pointer"
            >
              <FilterIcon className="w-3.5 h-3.5" />
              <span>Filter</span>
              {filterMode !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              )}
            </button>

            {/* Filter Flyout */}
            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-2 w-32 bg-[#1E293B] border border-white/[0.1] rounded-xl p-1.5 shadow-2xl z-30 flex flex-col gap-1">
                {(['all', 'active', 'completed'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setFilterMode(mode);
                      setShowFilterMenu(false);
                    }}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg capitalize transition-colors ${
                      filterMode === mode
                        ? 'bg-amber-400/20 text-amber-300 font-bold'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {mode} items
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-slate-600 select-none">•</span>

          <button
            type="button"
            onClick={onQuickTaskClick}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Quick Task</span>
          </button>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="flex flex-col gap-2.5 overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No items in this view. Use the Quick Action widget to add one!
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCreating = creatingTaskId === item.id;
            const isUpdating = updatingTaskId === item.id;
            const isHighlighted = highlightedTaskId === item.id;
            const isCompleted = isItemCompleted(item);

            const isHabit = Boolean(item.isHabitInstance);
            const isSwipingOut = swipingOutTaskId === item.id;
            const isDragging = draggedItemId === item.id;
            const isDragOver = dragOverItemId === item.id;

            return (
              <div
                key={item.id}
                id={`task-item-${item.id}`}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                className={`group rounded-xl p-3 sm:px-4 flex items-center justify-between gap-3 transition-all duration-200 relative overflow-hidden ${
                  isDragging
                    ? 'opacity-40 scale-[0.98] border-dashed border-amber-400/80 bg-[#162238]'
                    : isDragOver
                    ? 'border-2 border-amber-400 bg-amber-400/10 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                    : isSwipingOut
                    ? 'animate-task-swipe-left z-20'
                    : isCompleted
                    ? 'opacity-85'
                    : ''
                } ${
                  isCreating
                    ? 'bg-[#111A2E] border border-amber-400/80 shadow-[0_0_22px_rgba(250,204,21,0.28)] scale-[1.01]'
                    : isUpdating
                    ? 'blur-[2px] opacity-40 scale-[0.99] border border-amber-400/40 pointer-events-none'
                    : isHighlighted
                    ? 'bg-[#111A2E] border border-amber-400/50 shadow-[0_0_14px_rgba(250,204,21,0.15)]'
                    : isHabit
                    ? 'bg-[#121a30] hover:bg-[#16223e] border border-violet-500/25 hover:border-violet-500/40 shadow-[0_2px_12px_rgba(139,92,246,0.06)]'
                    : 'bg-[#111A2E] hover:bg-[#15223C] border border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {/* Left Accent Indicator Bar (Clean, flush, zero corner distortion) */}
                <div
                  className={`absolute left-0 top-0 bottom-0 rounded-l-xl transition-all duration-300 ${
                    isHabit
                      ? 'w-1 bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]'
                      : item.priority === 'high'
                      ? 'w-1 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                      : isCreating
                      ? 'w-1.5 bg-amber-400 shadow-[0_0_12px_rgba(250,204,21,0.7)]'
                      : isHighlighted
                      ? 'w-1.5 bg-amber-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]'
                      : 'w-1 bg-amber-400/80'
                  }`}
                />

                {/* Creation luminous gradient tint overlay */}
                {isCreating && (
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/[0.07] via-amber-400/[0.02] to-transparent pointer-events-none" />
                )}
                {/* Loading overlay when updating */}
                {isUpdating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px] rounded-xl z-10 pointer-events-none">
                    <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                  </div>
                )}

                {/* Left: Drag Handle, Checkbox, Type Badge & Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="text-slate-600 group-hover:text-amber-400 cursor-grab active:cursor-grabbing transition-colors shrink-0 p-1 -ml-1 rounded hover:bg-white/[0.04]"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Distinct Checkbox: Circular for Habits, Squircle for Tasks */}
                  {isCreating ? (
                    <div className="w-6 h-6 rounded-lg border border-amber-400/60 bg-amber-400/20 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                  ) : isHabit ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id)}
                      title={isCompleted ? 'Mark habit as pending today' : 'Mark habit as completed today'}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-100 cursor-pointer ${
                        isCompleted
                          ? 'bg-gradient-to-tr from-violet-500 to-indigo-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)] scale-100'
                          : 'border-2 border-violet-400/50 hover:border-violet-400 bg-violet-500/5 hover:bg-violet-500/15'
                      }`}
                    >
                      {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(item.id)}
                      title={isCompleted ? 'Mark task as incomplete' : 'Mark task as complete'}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-75 cursor-pointer ${
                        isCompleted
                          ? 'bg-[#FACC15] text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.45)]'
                          : item.priority === 'high'
                          ? 'border border-amber-400/50 hover:border-amber-400 bg-transparent'
                          : 'border border-slate-600 hover:border-amber-400/70 bg-transparent'
                      }`}
                    >
                      {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                  )}

                  {/* Type Badge: Habit vs Task */}
                  {isHabit ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 border border-violet-500/30 text-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.12)]">
                        <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                        Habit
                      </span>

                      {typeof item.streakDays === 'number' && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"
                          title={`Active Streak: ${item.streakDays} days`}
                        >
                          <span>🔥</span>
                          <span>{item.streakDays}d</span>
                        </span>
                      )}

                      {!isCompleted && item.warnings === 1 && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 rounded-full animate-pulse"
                          title="Missed 1 day! Streak is frozen. Complete today to clear warning."
                        >
                          <span>⚠️</span>
                          <span>Streak at risk</span>
                        </span>
                      )}

                      {!isCompleted && item.warnings === 2 && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-full animate-pulse"
                          title="Missed 2 days! Final notice before streak resets to 0. Complete today to save streak!"
                        >
                          <span>🚨</span>
                          <span>Reset imminent</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-300 shrink-0">
                      Task
                    </span>
                  )}

                  {/* Title with Typewriter and High Priority Badge */}
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <TypewriterTitle
                      text={item.title}
                      isWriting={isCreating}
                      onFinish={() => onCreationAnimationComplete?.(item.id)}
                      className={`text-sm cursor-pointer select-none truncate transition-colors duration-75 ${
                        isCompleted
                          ? 'line-through text-slate-400 font-normal'
                          : isCreating
                          ? 'text-amber-200 font-bold'
                          : isHabit
                          ? 'text-slate-100 font-semibold'
                          : 'text-slate-100 font-medium'
                      }`}
                    />

                    {isCreating && (
                      <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse shrink-0">
                        Writing...
                      </span>
                    )}

                    {item.priority === 'high' && !isCompleted && !isCreating && (
                      <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        HIGH
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Category Badge, Time Tag, and Actions */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getCategoryBadgeClass(
                      item.category
                    )}`}
                  >
                    {item.category}
                  </span>

                  {item.timeTag && (
                    <span className="text-xs text-slate-400 font-medium min-w-[55px] text-right hidden xs:inline-block">
                      {item.timeTag}
                    </span>
                  )}

                  {/* Actions: Habits link to Habit Manager and cannot be deleted/edited here; Tasks have edit & delete buttons */}
                  {isHabit ? (
                    <div className="flex items-center border-l border-white/[0.08] pl-1.5 sm:pl-2">
                      <Link
                        to="/habits"
                        title="Habits are managed in the Habit Manager. Click to view or edit in Habit Manager."
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 border border-white/[0.05] hover:border-violet-500/30 transition-all cursor-pointer group/habit"
                      >
                        <Repeat className="w-3 h-3 text-violet-400 group-hover/habit:rotate-180 transition-transform duration-300" />
                        <span className="hidden sm:inline">Habit Manager</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 border-l border-white/[0.08] pl-1.5 sm:pl-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(item);
                        }}
                        title="Edit task"
                        aria-label={`Edit ${item.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(item);
                        }}
                        title="Remove task"
                        aria-label={`Remove ${item.title}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
        })
      )}
    </div>

      {/* Remove Confirmation Modal ("Are you sure?") */}
      {itemToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setItemToDelete(null)}
        >
          <div
            className="bg-[#162032] border border-white/10 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setItemToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warning Icon & Heading */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white leading-tight">
                  Are you sure?
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Are you sure you want to remove this task?
                </p>
              </div>
            </div>

            {/* Target Item Preview */}
            <div className="bg-[#101827] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 truncate">
              <span className="text-slate-400 mr-1.5">Task:</span>
              <span className="font-semibold text-slate-100">{itemToDelete.title}</span>
            </div>

            {/* Actions: Cancel & Remove */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = itemToDelete.id;
                  setItemToDelete(null);
                  setSwipingOutTaskId(targetId);

                  setTimeout(() => {
                    onDelete?.(targetId);
                    setSwipingOutTaskId((curr) => (curr === targetId ? null : curr));
                  }, 380);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.35)] hover:shadow-[0_0_20px_rgba(225,29,72,0.5)] transition-all cursor-pointer"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
