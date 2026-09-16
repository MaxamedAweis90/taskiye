import React from 'react';

interface TaskHistorySkeletonProps {
  isLoadingMore?: boolean;
  moreDaysCount?: number;
  currentMonthLabel?: string;
}

export const TaskHistorySkeleton: React.FC<TaskHistorySkeletonProps> = ({
  isLoadingMore = false,
  moreDaysCount = 14,
  currentMonthLabel = 'earlier dates',
}) => {
  if (isLoadingMore) {
    return (
      <div className="py-6 flex flex-col items-center justify-center gap-2 select-none animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-[#FACC15] animate-ping" />
          <span>
            Loading historical logs from {currentMonthLabel}...
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500 font-normal">
            {moreDaysCount} more days
          </span>
        </div>
        <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full animate-pulse select-none">
      {[1, 2, 3].map((sectionIdx) => (
        <div key={sectionIdx} className="flex flex-col gap-3">
          {/* Day Section Header Skeleton */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-24 h-4 rounded-md bg-slate-800/80" />
              <div className="w-3 h-3 rounded-full bg-slate-800/50" />
              <div className="w-32 h-4 rounded-md bg-slate-800/60" />
            </div>
            <div className="w-28 h-5 rounded-full bg-slate-800/60" />
          </div>

          {/* Task Rows Skeleton */}
          {[1, 2].map((rowIdx) => (
            <div
              key={rowIdx}
              className="p-4 rounded-2xl bg-[#10192D]/70 border border-white/[0.05] flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-5 h-5 rounded-lg bg-slate-800" />
                <div className="w-48 sm:w-64 h-4 rounded-md bg-slate-800" />
                <div className="w-20 h-4 rounded-full bg-slate-800/60 hidden sm:block" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-4 rounded-md bg-slate-800/50 hidden md:block" />
                <div className="w-20 h-5 rounded-full bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
