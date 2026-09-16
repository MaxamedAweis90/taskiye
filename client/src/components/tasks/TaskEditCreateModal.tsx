import React, { useState, useEffect } from 'react';
import { X, Calendar, Sparkles, Check, Clock } from 'lucide-react';
import { HistoryTask } from './TaskHistoryRow';

import { APP_CATEGORIES, normalizeCategory, getCategoryBadgeStyle } from '../../constants/categories';

interface TaskEditCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: HistoryTask | null;
  defaultDate?: string;
  onSave: (taskData: {
    id?: string;
    title: string;
    date: string;
    category: string;
    priority: 'normal' | 'high';
    timeTag?: string;
  }) => Promise<void>;
}

const CATEGORIES = APP_CATEGORIES;

export const TaskEditCreateModal: React.FC<TaskEditCreateModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultDate,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<string>('Work');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [timeTag, setTimeTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDate(taskToEdit.date || todayStr);
      setCategory(normalizeCategory(taskToEdit.category));
      setPriority(taskToEdit.priority || 'normal');
      setTimeTag(taskToEdit.timeTag || '');
    } else {
      setTitle('');
      setDate(defaultDate || todayStr);
      setCategory('Work');
      setPriority('normal');
      setTimeTag('');
    }
  }, [isOpen, taskToEdit, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await onSave({
        id: taskToEdit?.id,
        title: trimmed,
        date: date || new Date().toISOString().slice(0, 10),
        category,
        priority,
        timeTag: timeTag.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0F172A] border border-amber-400/30 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(250,204,21,0.15)] flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {taskToEdit ? 'Edit Task' : 'Create Task'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {taskToEdit ? 'Modify scheduled parameters and details' : 'Schedule a focus item or priority'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Title Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300">Task Title</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Architecture Strategy Review"
              className="w-full bg-[#152033] border border-white/[0.1] hover:border-white/[0.2] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Scheduled Date</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#152033] border border-white/[0.1] hover:border-white/[0.2] focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-semibold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Time Tag (Optional)</span>
              </label>
              <input
                type="text"
                value={timeTag}
                onChange={(e) => setTimeTag(e.target.value)}
                placeholder="e.g. 09:30 AM or Continuous"
                className="w-full bg-[#152033] border border-white/[0.1] hover:border-white/[0.2] focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Category & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#152033] border border-white/[0.1] hover:border-white/[0.2] focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
              >
                {CATEGORIES.map((c) => {
                  const style = getCategoryBadgeStyle(c);
                  return (
                    <option key={c} value={c} className="bg-[#0F172A] text-slate-200">
                      {style.icon} {c}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">Priority</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    priority === 'normal'
                      ? 'bg-slate-800 border-white/20 text-white'
                      : 'bg-[#152033] border-white/[0.06] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('high')}
                  className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    priority === 'high'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                      : 'bg-[#152033] border-white/[0.06] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🚨 High
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 rounded-xl text-xs font-extrabold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] shadow-[0_0_15px_rgba(250,204,21,0.3)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isSubmitting ? 'Saving...' : taskToEdit ? 'Save Changes' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
