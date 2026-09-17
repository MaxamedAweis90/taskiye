import React, { useState } from 'react';
import { X, Calendar, ArrowRight, Clock, Sparkles } from 'lucide-react';

interface TaskRescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskDate?: string;
  onReschedule: (targetDate: 'today' | 'tomorrow' | string) => Promise<void>;
}

export const TaskRescheduleModal: React.FC<TaskRescheduleModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  taskDate,
  onReschedule,
}) => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const isTaskToday = Boolean(taskDate && taskDate.slice(0, 10) === todayStr);
  const isTaskTomorrow = Boolean(taskDate && taskDate.slice(0, 10) === tomorrowStr);

  const [selectedOption, setSelectedOption] = useState<'today' | 'tomorrow' | 'custom'>(() => {
    if (taskDate && taskDate.slice(0, 10) === tomorrowStr) return 'today';
    return 'tomorrow';
  });
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 2);
    return d.toISOString().slice(0, 10);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selectedOption when task context changes
  React.useEffect(() => {
    if (isTaskToday && selectedOption === 'today') {
      setSelectedOption('tomorrow');
    } else if (isTaskTomorrow && selectedOption === 'tomorrow') {
      setSelectedOption('today');
    }
  }, [isTaskToday, isTaskTomorrow, selectedOption]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      if (selectedOption === 'today') {
        await onReschedule('today');
      } else if (selectedOption === 'tomorrow') {
        await onReschedule('tomorrow');
      } else {
        await onReschedule(customDate);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-amber-400/30 rounded-3xl p-5 sm:p-6 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(250,204,21,0.15)] flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reschedule Task</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Forward or adjust to an upcoming daily plan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Task Preview Card */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#152033] border border-slate-200 dark:border-white/[0.06] flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed break-words">
            "{taskTitle}"
          </p>
        </div>

        {/* Option Selection */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Choose Target Schedule:</span>

          {/* Option 1: Tomorrow (Only available if task is not already tomorrow) */}
          {!isTaskTomorrow && (
            <div
              onClick={() => setSelectedOption('tomorrow')}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedOption === 'tomorrow'
                  ? 'bg-amber-500/10 dark:bg-amber-400/10 border-amber-500 dark:border-amber-400 text-amber-900 dark:text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)] dark:shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                  : 'bg-slate-50 dark:bg-[#152033] border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedOption === 'tomorrow'
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-500 dark:bg-amber-400'
                      : 'border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {selectedOption === 'tomorrow' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-950" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold">Tomorrow (Recommended)</span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    {tomorrow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 dark:border-amber-400/30">
                Next Cadence
              </span>
            </div>
          )}

          {/* Option 2: Today (Only available for missed/past tasks, not if already scheduled for today) */}
          {!isTaskToday && (
            <div
              onClick={() => setSelectedOption('today')}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedOption === 'today'
                  ? 'bg-amber-500/10 dark:bg-amber-400/10 border-amber-500 dark:border-amber-400 text-amber-900 dark:text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)] dark:shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                  : 'bg-slate-50 dark:bg-[#152033] border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedOption === 'today'
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-500 dark:bg-amber-400'
                      : 'border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {selectedOption === 'today' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-950" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold">Today {isTaskTomorrow && '(Bring Forward)'}</span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">Add to today's active checklist</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20 dark:border-sky-500/30">
                {isTaskTomorrow ? 'Earlier' : 'Immediate'}
              </span>
            </div>
          )}

          {/* Option 3: Custom Date */}
          <div
            onClick={() => setSelectedOption('custom')}
            className={`p-3 rounded-xl border flex flex-col gap-2.5 cursor-pointer transition-all ${
              selectedOption === 'custom'
                ? 'bg-amber-500/10 dark:bg-amber-400/10 border-amber-500 dark:border-amber-400 text-amber-900 dark:text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)] dark:shadow-[0_0_15px_rgba(250,204,21,0.15)]'
                : 'bg-slate-50 dark:bg-[#152033] border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedOption === 'custom'
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-500 dark:bg-amber-400'
                      : 'border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {selectedOption === 'custom' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-950" />
                  )}
                </div>
                <span className="text-xs font-bold">Specific Future Date</span>
              </div>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {selectedOption === 'custom' && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/[0.08]" onClick={(e) => e.stopPropagation()}>
                <input
                  type="date"
                  min={todayStr}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0F172A] border border-amber-500/50 dark:border-amber-400/50 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-300 dark:bg-[#FACC15] dark:hover:bg-[#EAB308] shadow-[0_0_15px_rgba(250,204,21,0.25)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
