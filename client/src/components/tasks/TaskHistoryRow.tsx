import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Check,
  X,
  RotateCcw,
  Pencil,
  Trash2,
  ChevronDown,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { playCelebrationChime } from '../../hooks/usePushNotifications';
import { getCategoryBadgeStyle, normalizeCategory } from '../../constants/categories';

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
  if (!isWriting) {
    return <span className={className}>{text}</span>;
  }
  return <ActiveTypewriterTitle text={text} onFinish={onFinish} className={className} />;
};

export interface HistoryTask {
  id: string;
  title: string;
  isCompleted: boolean;
  category: string;
  priority?: 'normal' | 'high';
  timeTag?: string | null;
  isHabitInstance?: boolean;
  habitId?: unknown;
  status: 'completed' | 'pending' | 'missed';
  date: string;
  createdAt: string;
}

interface TaskHistoryRowProps {
  task: HistoryTask;
  isTomorrow?: boolean;
  isToday?: boolean;
  isExpanded?: boolean;
  isCreating?: boolean;
  isHighlighted?: boolean;
  isSwipingOut?: boolean;
  onCreationAnimationComplete?: (id: string) => void;
  onToggleExpand?: () => void;
  onToggle: (id: string, isCompleted: boolean) => void;
  onEdit: (task: HistoryTask) => void;
  onDelete: (task: HistoryTask) => void;
  onOpenReschedule: (task: HistoryTask) => void;
  onQuickReschedule?: (id: string, targetDate: 'today' | 'tomorrow') => void;
}

export const TaskHistoryRow: React.FC<TaskHistoryRowProps> = ({
  task,
  isTomorrow = false,
  isToday = false,
  isExpanded: isExpandedProp,
  isCreating = false,
  isHighlighted = false,
  isSwipingOut = false,
  onCreationAnimationComplete,
  onToggleExpand,
  onToggle,
  onEdit,
  onDelete,
  onOpenReschedule,
  onQuickReschedule: _onQuickReschedule,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = typeof isExpandedProp === 'boolean' ? isExpandedProp : internalExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const [showPastTooltip, setShowPastTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isMissed = task.status === 'missed';
  const isCompleted = task.isCompleted;
  const isPast = !isToday && !isTomorrow;

  const categoryName = normalizeCategory(task.category);
  const categoryStyle = getCategoryBadgeStyle(categoryName);

  const formattedPastDate = useMemo(() => {
    try {
      const d = new Date(task.date + 'T12:00:00Z');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return task.date;
    }
  }, [task.date]);

  // Click outside listener to dismiss tooltip
  useEffect(() => {
    if (!showPastTooltip) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowPastTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, [showPastTooltip]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If task is in the past: DO NOT mutate or toggle! Show tooltip instead
    if (isPast) {
      setShowPastTooltip(true);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = setTimeout(() => {
        setShowPastTooltip(false);
      }, 4500);
      return;
    }

    const nextCompleted = !task.isCompleted;
    if (nextCompleted) {
      playCelebrationChime();
    }
    onToggle(task.id, nextCompleted);
  };

  return (
    <div
      id={`task-history-item-${task.id}`}
      className={`rounded-2xl border transition-all duration-300 overflow-visible select-none ${
        isSwipingOut
          ? 'animate-task-swipe-left z-20 pointer-events-none'
          : isCreating
          ? 'bg-[#111A2E] border border-amber-400/80 shadow-[0_0_22px_rgba(250,204,21,0.28)] scale-[1.01]'
          : isHighlighted
          ? 'bg-[#111A2E] border border-amber-400/50 shadow-[0_0_15px_rgba(250,204,21,0.2)]'
          : isMissed
          ? 'bg-[#15101E]/90 border-rose-500/30 hover:border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.06)]'
          : isCompleted
          ? 'bg-[#0E1528]/80 border-white/[0.05] hover:border-white/[0.1]'
          : 'bg-[#10192D] border-white/[0.08] hover:border-white/[0.15] shadow-sm'
      }`}
    >
      {/* Main Row */}
      <div
        onClick={handleToggleExpand}
        className="px-3.5 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 cursor-pointer group"
      >
        {/* Left: Checkbox + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Checkbox Wrapper with Tooltip */}
          <div className="relative shrink-0" ref={tooltipRef}>
            <button
              type="button"
              onClick={handleCheckboxClick}
              title={
                isPast
                  ? `Task already ${isMissed ? 'missed' : 'completed'} on ${formattedPastDate}`
                  : `Mark "${task.title}" as ${isCompleted ? 'incomplete' : 'complete'}`
              }
              aria-label={
                isPast
                  ? `Task already ${isMissed ? 'missed' : 'completed'} on ${formattedPastDate}`
                  : `Mark "${task.title}" as ${isCompleted ? 'incomplete' : 'complete'}`
              }
              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-150 shrink-0 ${
                isCompleted
                  ? 'bg-[#FACC15] border-amber-400 text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.4)]'
                  : isMissed
                  ? 'border-rose-500/50 hover:border-rose-400 bg-rose-500/10 text-rose-400'
                  : 'border-white/20 hover:border-amber-400/80 bg-white/[0.02]'
              } ${isPast ? 'cursor-help' : 'cursor-pointer'}`}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : isMissed ? (
                <X className="w-3 h-3 stroke-[2.5] opacity-80" />
              ) : null}
            </button>

            {/* Past Task Tooltip Popover */}
            {isPast && showPastTooltip && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full left-0 mb-2.5 z-50 min-w-[210px] max-w-[280px] p-3 rounded-xl bg-[#141E33] border border-white/20 shadow-2xl shadow-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-auto"
              >
                <div className="flex items-start gap-2">
                  {isMissed ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <p className="text-xs text-slate-200 leading-snug font-medium">
                      {isMissed ? (
                        <>
                          This task already <span className="text-rose-400 font-bold">missed</span> on{' '}
                          <span className="font-semibold text-white">{formattedPastDate}</span>.
                        </>
                      ) : (
                        <>
                          This task already <span className="text-emerald-400 font-bold">completed</span> on{' '}
                          <span className="font-semibold text-white">{formattedPastDate}</span>.
                        </>
                      )}
                    </p>
                    {isMissed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPastTooltip(false);
                          onOpenReschedule(task);
                        }}
                        className="mt-0.5 self-start px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-300 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                      >
                        <RotateCcw className="w-3 h-3 stroke-[2.5]" />
                        <span>Reschedule</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPastTooltip(false);
                    }}
                    className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {/* Tooltip pointer triangle */}
                <div className="absolute top-full left-2.5 -mt-[1px] w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-[#141E33]" />
              </div>
            )}
          </div>

          {/* Title and Category */}
          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
            <TypewriterTitle
              text={task.title}
              isWriting={Boolean(isCreating)}
              onFinish={() => onCreationAnimationComplete?.(task.id)}
              className={`text-sm truncate select-none transition-colors ${
                isCompleted
                  ? 'line-through text-slate-400 font-normal'
                  : isMissed
                  ? 'text-slate-100 font-semibold'
                  : 'text-slate-100 font-medium'
              }`}
            />

            {/* Category Badge */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline-block ${categoryStyle.badgeClass}`}
            >
              {categoryName}
            </span>

            {/* Priority Badge */}
            {task.priority === 'high' && !isCompleted && (
              <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded shrink-0">
                HIGH
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Time, Status Badge, Reschedule Action, & Chevron */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Scheduled Time Tag */}
          {task.timeTag && (
            <span className="text-xs text-slate-400 font-medium hidden md:inline-block">
              {task.timeTag}
            </span>
          )}

          {/* Status Badge */}
          {isCompleted ? (
            <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Completed
            </span>
          ) : isMissed ? (
            <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Missed
            </span>
          ) : (
            <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
              Pending
            </span>
          )}

          {/* Quick Reschedule Action (Rendered prominently for Missed tasks) */}
          {isMissed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReschedule(task);
              }}
              title="Reschedule to upcoming plan"
              className="px-2.5 py-1 rounded-xl text-xs font-bold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-[0_0_12px_rgba(250,204,21,0.12)]"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.5]" />
              <span className="hidden sm:inline">Reschedule</span>
            </button>
          )}

          {/* Expand Chevron */}
          <div className="p-1 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0">
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180 text-amber-400' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06] bg-[#0A1020]/90 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Task Details & Scheduling:
            </span>
            <p className="text-sm font-semibold text-white leading-relaxed break-words select-text">
              {task.title}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full border ${categoryStyle.badgeClass}`}>
              {categoryStyle.icon} {categoryName}
            </span>
            {task.priority === 'high' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                🚨 High Priority
              </span>
            )}
            {task.timeTag && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{task.timeTag}</span>
              </span>
            )}
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{task.date}</span>
            </span>
          </div>

          {/* Drawer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
            {!isCompleted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReschedule(task);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Reschedule Plan</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task);
              }}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Trash</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
