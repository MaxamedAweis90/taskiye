import React from 'react';
import { CheckSquare, Filter, Calendar, AlertCircle, Archive } from 'lucide-react';

export const Tasks: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Tasks
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            Manage daily actions, backlog items, and prioritize workflows
          </p>
        </div>
      </div>

      {/* Placeholder Filtering Section */}
      <div className="bg-[#152033] border border-white/[0.06] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>Task Filters (Coming Soon)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-lg bg-[#0E1726] border border-white/10 text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date Range
            </span>
            <span className="px-3 py-1 rounded-lg bg-[#0E1726] border border-white/10 text-slate-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Priority
            </span>
            <span className="px-3 py-1 rounded-lg bg-[#0E1726] border border-white/10 text-slate-400 flex items-center gap-1.5">
              <Archive className="w-3.5 h-3.5" /> Backlog & Completed
            </span>
          </div>
        </div>

        {/* Placeholder Content Area */}
        <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Dedicated Task Management Hub</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Standalone task workspace with date-based filtering, priority queues, backlog management, and completed item archives.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
