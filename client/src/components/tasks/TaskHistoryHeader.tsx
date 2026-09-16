import React from 'react';
import { Search, Plus, ChevronDown, CheckSquare } from 'lucide-react';
import { CATEGORY_OPTIONS_WITH_ALL } from '../../constants/categories';

interface TaskHistoryHeaderProps {
  totalLoggedCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  hideCompleted: boolean;
  onToggleHideCompleted: () => void;
  onNewTaskClick: () => void;
}

const CATEGORIES = CATEGORY_OPTIONS_WITH_ALL;

export const TaskHistoryHeader: React.FC<TaskHistoryHeaderProps> = ({
  totalLoggedCount,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  hideCompleted,
  onToggleHideCompleted,
  onNewTaskClick,
}) => {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Task History
          </h1>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#152033] border border-white/[0.08] text-xs font-bold text-slate-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#FACC15] animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
            <span>{totalLoggedCount.toLocaleString()} Tasks Logged</span>
          </div>
        </div>

        {/* Action Button: + New Task */}
        <button
          type="button"
          onClick={onNewTaskClick}
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-[#10192D] border border-white/[0.08]">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter tasks by title or tag..."
            className="w-full bg-[#152033] border border-white/[0.08] hover:border-white/[0.15] focus:border-amber-400 rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
          />
        </div>

        {/* Right Controls: Category Dropdown & Hide Completed Toggle */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Category Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="appearance-none bg-[#152033] border border-white/[0.08] hover:border-white/[0.2] focus:border-amber-400 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-[#0F172A] text-slate-200">
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none stroke-[2.5]" />
          </div>

          {/* Hide Completed Toggle */}
          <button
            type="button"
            onClick={onToggleHideCompleted}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              hideCompleted
                ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 shadow-[0_0_12px_rgba(250,204,21,0.15)]'
                : 'bg-[#152033] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.2]'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Hide Completed</span>
          </button>
        </div>
      </div>
    </div>
  );
};
