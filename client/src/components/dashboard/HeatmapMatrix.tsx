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
  todayCompletedCount?: number;
  todayTotalCount?: number;
}

type HeatmapTimeFilter = '7d' | 'month' | 'year';

// Generate dynamic calendar weeks based on selected filter
const generateDynamicHeatmapData = (
  filter: HeatmapTimeFilter,
  todayCompleted: number,
  todayTotal: number
): { cells: HeatmapCell[]; weekCount: number; subtitle: string; daysLogged: number } => {
  const cells: HeatmapCell[] = [];
  const now = new Date();
  const currentJsDay = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const currentMonDay = (currentJsDay + 6) % 7; // Mon: 0, ..., Sun: 6

  // Determine weekCount based on filter
  // '7d': 1 week (the current 7 days)
  // 'month': 5 weeks (~35 days covering the last month)
  // 'year': 18 weeks (standard high-density matrix overview)
  const weekCount = filter === '7d' ? 1 : filter === 'month' ? 5 : 18;

  // Find the Monday of (weekCount - 1) weeks ago
  const startMonday = new Date(now);
  startMonday.setDate(now.getDate() - currentMonDay - (weekCount - 1) * 7);
  startMonday.setHours(0, 0, 0, 0);

  let totalCompletedLogged = 0;

  for (let week = 0; week < weekCount; week++) {
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(startMonday);
      cellDate.setDate(startMonday.getDate() + week * 7 + day);

      const isFuture = cellDate > now && cellDate.toDateString() !== now.toDateString();
      const isToday = cellDate.toDateString() === now.toDateString();

      let intensity: 0 | 1 | 2 | 3 = 0;
      let completed = 0;
      const total = todayTotal || 5;

      if (isToday) {
        completed = todayCompleted;
        if (total > 0 && todayCompleted >= total) intensity = 3;
        else if (todayCompleted >= 3) intensity = 2;
        else if (todayCompleted > 0) intensity = 1;
        else intensity = 0;
      } else {
        // Real tracking: past and future days start clean (no fake seeded data)
        intensity = 0;
        completed = 0;
      }

      totalCompletedLogged += completed;

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

  const subtitle =
    filter === '7d'
      ? `${totalCompletedLogged} habits completed in the last 7 days`
      : filter === 'month'
      ? `${totalCompletedLogged} habits completed in the last 30 days`
      : `${totalCompletedLogged} habits completed in the past year`;

  const daysLogged = weekCount * 7;

  return { cells, weekCount, subtitle, daysLogged };
};

export const HeatmapMatrix: React.FC<HeatmapMatrixProps> = ({
  streakDays = 0,
  todayCompletedCount = 0,
  todayTotalCount = 0,
}) => {
  const [timeFilter, setTimeFilter] = useState<HeatmapTimeFilter>('year');
  const { cells, weekCount, subtitle, daysLogged } = React.useMemo(
    () => generateDynamicHeatmapData(timeFilter, todayCompletedCount, todayTotalCount),
    [timeFilter, todayCompletedCount, todayTotalCount]
  );
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const getIntensityClass = (intensity: number, isToday?: boolean) => {
    if (isToday) {
      return intensity > 0
        ? 'bg-[#FACC15] border-2 border-amber-300 ring-2 ring-amber-400/40 shadow-[0_0_12px_rgba(250,204,21,0.6)]'
        : 'bg-[#1E2638] border-2 border-amber-400/80 ring-1 ring-amber-400/30';
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
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right Filter Pills, Stats & Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Filter Pills: Last 7 Days, Month, Year */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#0A101D] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setTimeFilter('7d')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                timeFilter === '7d'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                timeFilter === 'month'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('year')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                timeFilter === 'year'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Year
            </button>
          </div>

          <div className="text-slate-300 font-medium">
            Streak: <span className="text-amber-400 font-bold">{streakDays}d</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 font-medium">
            <span className="text-[11px]">Less</span>
            <div className="w-3 h-3 rounded-[3px] bg-[#1E2638]" title="0% - 10%" />
            <div className="w-3 h-3 rounded-[3px] bg-[#715814]" title="11% - 50%" />
            <div className="w-3 h-3 rounded-[3px] bg-[#CA8A04]" title="51% - 99%" />
            <div className="w-3 h-3 rounded-[3px] bg-[#FACC15]" title="100%" />
            <span className="text-[11px]">More</span>
          </div>
        </div>
      </div>

      {/* 7 Days Grid with Weekday Labels */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <div className={weekCount === 1 ? 'max-w-[240px]' : weekCount === 5 ? 'max-w-[380px]' : 'min-w-[560px]'}>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `38px repeat(${weekCount}, minmax(0, 1fr))`,
            }}
          >
            {/* Weekday Row Labels */}
            <div className="flex flex-col justify-between py-1 text-[11px] text-slate-400 font-semibold select-none">
              {dayLabels.map((day, idx) => (
                <div key={idx} className="h-6 sm:h-7 flex items-center leading-none">
                  {day}
                </div>
              ))}
            </div>

            {/* Columns of 7 Days */}
            {Array.from({ length: weekCount }).map((_, weekIndex) => {
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
        <span className="text-slate-400 hidden sm:inline">{daysLogged} days logged</span>
      </div>
    </div>
  );
};
