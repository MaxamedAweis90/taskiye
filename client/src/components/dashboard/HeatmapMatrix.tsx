import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface HeatmapCell {
  date: string;
  dayOfWeek: number; // 0: Mon, 1: Tue, ..., 6: Sun
  weekIndex: number;
  intensity: 0 | 1 | 2 | 3;
  completedCount: number;
  totalCount: number;
  isToday?: boolean;
}

interface HeatmapMatrixProps {
  streakDays?: number;
  totalCompletedHabits?: number;
}

// Pre-generate a visually faithful 18-week dataset matching the reference wireframe
const generate18WeeksData = (): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  const today = new Date();

  // Pattern weights matching the rich activity heatmap shown in layout_overview_screen.png
  // Columns 0 to 17 (18 weeks), rows 0 to 6 (Mon to Sun)
  const patternSeed: (0 | 1 | 2 | 3)[][] = [
    // Mon:
    [0, 3, 3, 2, 3, 0, 0, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 0],
    // Tue:
    [0, 3, 3, 0, 3, 0, 0, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 0],
    // Wed:
    [3, 3, 1, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0],
    // Thu:
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 0], // May cell (col 17, row 3/4) is today
    // Fri:
    [1, 0, 3, 3, 0, 3, 3, 0, 3, 1, 0, 3, 3, 2, 3, 3, 0, 0],
    // Sat:
    [3, 3, 0, 3, 0, 3, 3, 3, 3, 3, 0, 3, 1, 0, 3, 3, 3, 0],
    // Sun:
    [3, 0, 0, 0, 0, 0, 3, 0, 2, 0, 0, 3, 0, 0, 3, 1, 0, 0],
  ];

  for (let week = 0; week < 18; week++) {
    for (let day = 0; day < 7; day++) {
      const daysAgo = (17 - week) * 7 + (6 - day);
      const cellDate = new Date(today);
      cellDate.setDate(today.getDate() - daysAgo);

      const intensity = patternSeed[day]?.[week] ?? 0;
      const isToday = week === 17 && day === 3;

      let completed = 0;
      const total = 5;
      if (intensity === 3) completed = 5;
      else if (intensity === 2) completed = 3;
      else if (intensity === 1) completed = 1;
      else completed = 0;

      cells.push({
        date: cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dayOfWeek: day,
        weekIndex: week,
        intensity,
        completedCount: completed,
        totalCount: total,
        isToday,
      });
    }
  }

  return cells;
};

export const HeatmapMatrix: React.FC<HeatmapMatrixProps> = ({
  streakDays = 14,
  totalCompletedHabits = 418,
}) => {
  const [cells] = useState<HeatmapCell[]>(generate18WeeksData);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const getIntensityClass = (intensity: number, isToday?: boolean) => {
    if (isToday) {
      return 'bg-[#FACC15] border-2 border-amber-300 ring-2 ring-amber-400/40 shadow-[0_0_12px_rgba(250,204,21,0.6)]';
    }
    switch (intensity) {
      case 3:
        return 'bg-[#FACC15] hover:ring-2 hover:ring-amber-300';
      case 2:
        return 'bg-[#CA8A04] hover:ring-2 hover:ring-amber-500';
      case 1:
        return 'bg-[#715814] hover:ring-2 hover:ring-amber-600';
      case 0:
      default:
        return 'bg-[#1E2638] hover:bg-[#283248]';
    }
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-[#162032] border border-white/[0.06] rounded-2xl p-5 sm:p-6 transition-all hover:border-white/[0.1] relative flex flex-col justify-between">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase">
              Activity Heatmap Matrix
            </h3>
            <p className="text-xs text-slate-400 font-normal">
              {totalCompletedHabits} habits completed in the last 18 weeks
            </p>
          </div>
        </div>

        {/* Right Stats & Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-slate-300 font-medium">
            Streak: <span className="text-amber-400 font-bold">{streakDays}d</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <span className="text-[11px]">Less</span>
            <div className="w-3 h-3 rounded-[3px] bg-[#1E2638]" title="0% - 10%" />
            <div className="w-3 h-3 rounded-[3px] bg-[#715814]" title="11% - 50%" />
            <div className="w-3 h-3 rounded-[3px] bg-[#CA8A04]" title="51% - 99%" />
            <div className="w-3 h-3 rounded-[3px] bg-[#FACC15]" title="100%" />
            <span className="text-[11px]">More</span>
          </div>
        </div>
      </div>

      {/* Months Timeline Header */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[38px_repeat(18,1fr)] gap-2 mb-2 text-[11px] text-slate-400 font-medium text-center">
            <span />
            <span className="col-span-4 text-left pl-1">Jan</span>
            <span className="col-span-4 text-left pl-1">Feb</span>
            <span className="col-span-4 text-left pl-1">Mar</span>
            <span className="col-span-4 text-left pl-1">Apr</span>
            <span className="col-span-2 text-left pl-1">May</span>
          </div>

          {/* 7 Days Grid with Weekday Labels */}
          <div className="grid grid-cols-[38px_repeat(18,1fr)] gap-2">
            {/* Weekday Row Labels */}
            <div className="flex flex-col justify-between py-1 text-[11px] text-slate-400 font-semibold select-none">
              {dayLabels.map((day, idx) => (
                <div key={idx} className="h-6 sm:h-7 flex items-center leading-none">
                  {day}
                </div>
              ))}
            </div>

            {/* 18 Columns of 7 Days */}
            {Array.from({ length: 18 }).map((_, weekIndex) => {
              const weekCells = cells.filter((c) => c.weekIndex === weekIndex);
              return (
                <div key={weekIndex} className="flex flex-col gap-2">
                  {weekCells.map((cell, dayIndex) => (
                    <div
                      key={dayIndex}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`h-6 sm:h-7 rounded-[5px] transition-all duration-150 cursor-pointer ${getIntensityClass(
                        cell.intensity,
                        cell.isToday
                      )}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hover Info Tooltip Bar */}
      <div className="mt-3 min-h-[20px] flex items-center justify-between text-[11px] text-slate-400 border-t border-white/[0.04] pt-2.5 px-1">
        {hoveredCell ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">{hoveredCell.date}:</span>
            <span className="text-amber-400 font-medium">
              {hoveredCell.completedCount} of {hoveredCell.totalCount} completed (
              {hoveredCell.intensity === 3
                ? '100%'
                : hoveredCell.intensity === 2
                ? '60%'
                : hoveredCell.intensity === 1
                ? '20%'
                : '0%'}
              )
            </span>
            {hoveredCell.isToday && (
              <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                Today
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400">Hover over any day to see completion details</span>
        )}
        <span className="text-slate-400 hidden sm:inline">126 days logged</span>
      </div>
    </div>
  );
};
