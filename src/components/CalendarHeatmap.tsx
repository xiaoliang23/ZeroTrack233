import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DailyPnL {
  date: string; // YYYY-MM-DD
  pnl: number;
}

interface CalendarHeatmapProps {
  data: DailyPnL[];
  isUpRed: boolean;
}

export default React.memo(function CalendarHeatmap({ data, isUpRed }: CalendarHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; pnl: number; x: number; y: number } | null>(null);

  const { grid, maxAbsPnl, months, stats } = useMemo(() => {
    if (!data || data.length === 0) return { grid: [], maxAbsPnl: 0, months: [], stats: null };

    let max = 0;
    let winDays = 0;
    let lossDays = 0;
    let flatDays = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let totalPnLSum = 0;

    data.forEach(d => {
      const abs = Math.abs(d.pnl);
      if (abs > max) max = abs;
      totalPnLSum += d.pnl;

      if (d.pnl > 0) {
        winDays++;
        if (d.pnl > maxWin) maxWin = d.pnl;
      } else if (d.pnl < 0) {
        lossDays++;
        if (d.pnl < maxLoss) maxLoss = d.pnl;
      } else {
        flatDays++;
      }
    });

    if (max === 0) max = 1;

    const totalActiveDays = winDays + lossDays + flatDays;
    const winRate = totalActiveDays > 0 ? ((winDays / (winDays + lossDays || 1)) * 100) : 0;

    // Group into weeks (columns)
    const weeks: { date: string; pnl: number | null }[][] = [];
    let currentWeek: { date: string; pnl: number | null }[] = [];
    
    // Sort data chronologically
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
    
    // Pad the first week to start on the correct day of week (0 = Sunday)
    if (sortedData.length > 0) {
      const firstDate = new Date(sortedData[0].date.includes('T') ? sortedData[0].date : sortedData[0].date + 'T00:00:00');
      const dayOfWeek = firstDate.getDay();
      for (let i = 0; i < dayOfWeek; i++) {
        currentWeek.push({ date: '', pnl: null });
      }
    }

    const monthLabels: { label: string; index: number }[] = [];
    let lastMonth = -1;

    sortedData.forEach((d) => {
      const dateObj = new Date(d.date.includes('T') ? d.date : d.date + 'T00:00:00');
      const month = dateObj.getMonth();
      
      if (month !== lastMonth && currentWeek.length > 0) {
        const currentWeekIndex = weeks.length;
        if (monthLabels.length === 0 || currentWeekIndex - monthLabels[monthLabels.length - 1].index > 3) {
          const monthName = dateObj.toLocaleString('zh-CN', { month: 'short' });
          monthLabels.push({ label: monthName, index: currentWeekIndex });
          lastMonth = month;
        }
      }

      currentWeek.push({ date: d.date, pnl: d.pnl });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', pnl: null });
      }
      weeks.push(currentWeek);
    }

    return { 
      grid: weeks, 
      maxAbsPnl: max, 
      months: monthLabels,
      stats: {
        totalActiveDays,
        winDays,
        lossDays,
        flatDays,
        winRate,
        maxWin,
        maxLoss,
        totalPnLSum
      }
    };
  }, [data]);

  const getColor = (pnl: number | null) => {
    if (pnl === null) return 'bg-theme-bg-hover/20 border border-transparent'; // empty padding day
    if (pnl === 0) return 'bg-slate-700/30 border border-slate-600/20'; // no change

    const isPositive = pnl > 0;
    const intensity = Math.min(Math.max(Math.abs(pnl) / maxAbsPnl, 0.25), 1);

    const useRed = (isPositive && isUpRed) || (!isPositive && !isUpRed);

    if (useRed) {
      if (intensity > 0.8) return 'bg-red-500 shadow-sm shadow-red-500/20';
      if (intensity > 0.5) return 'bg-red-500/80';
      if (intensity > 0.3) return 'bg-red-500/60';
      return 'bg-red-500/40';
    } else {
      if (intensity > 0.8) return 'bg-emerald-500 shadow-sm shadow-emerald-500/20';
      if (intensity > 0.5) return 'bg-emerald-500/80';
      if (intensity > 0.3) return 'bg-emerald-500/60';
      return 'bg-emerald-500/40';
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, day: { date: string; pnl: number | null }) => {
    if (day.pnl === null || !day.date) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setHoveredDay({
      date: day.date,
      pnl: day.pnl,
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  if (!grid || grid.length === 0) return null;

  const winColorClass = isUpRed ? 'text-red-500' : 'text-emerald-500';
  const lossColorClass = isUpRed ? 'text-emerald-500' : 'text-red-500';

  return (
    <div className="w-full relative py-2 flex flex-col gap-4">
      {/* Performance Summary Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 p-3 bg-theme-panel/70 border border-theme-border/60 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-theme-text-muted font-medium">累计记录交易日</span>
            <span className="text-sm font-bold font-mono text-theme-text-heading">{stats.totalActiveDays} 天</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-theme-text-muted font-medium">盈利 / 亏损天数</span>
            <span className="text-sm font-bold font-mono text-theme-text-primary">
              <span className={winColorClass}>{stats.winDays}盈</span> / <span className={lossColorClass}>{stats.lossDays}亏</span>
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-theme-text-muted font-medium">日度胜率</span>
            <span className="text-sm font-bold font-mono text-indigo-400">
              {stats.winRate.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-theme-text-muted font-medium">单日最大盈利</span>
            <span className={`text-sm font-bold font-mono ${winColorClass}`}>
              +${stats.maxWin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col col-span-2 sm:col-span-1">
            <span className="text-[10px] text-theme-text-muted font-medium">单日最大回撤</span>
            <span className={`text-sm font-bold font-mono ${lossColorClass}`}>
              {stats.maxLoss === 0 ? '$0.00' : `-$${Math.abs(stats.maxLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>
      )}

      {/* Main Heatmap Area */}
      <div className="overflow-x-auto scrollbar-thin pb-2 pt-1 px-1">
        <div className="min-w-[700px]">
          {/* Month Header */}
          <div className="flex text-[11px] font-semibold text-theme-text-muted mb-2">
            <div className="w-8 shrink-0"></div>
            <div className="flex-1 relative h-5">
              {months.map((m, i) => (
                <div 
                  key={i} 
                  className="absolute whitespace-nowrap text-theme-text-secondary"
                  style={{ left: `calc(${(m.index / grid.length) * 100}%)` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>
          
          {/* Grid + Day labels */}
          <div className="flex gap-2 items-center">
            {/* Day of Week Labels */}
            <div className="flex flex-col justify-between text-[11px] font-medium text-theme-text-muted pr-1 shrink-0 h-[150px] sm:h-[168px] py-0.5">
              <span>周日</span>
              <span>周二</span>
              <span>周四</span>
              <span>周六</span>
            </div>
            
            {/* Heatmap Columns */}
            <div className="flex-1">
              <div className="flex gap-1.5 sm:gap-2 h-[150px] sm:h-[168px]">
                {grid.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col justify-between h-full shrink-0">
                    {week.map((day, dayIndex) => {
                      const colorClass = getColor(day.pnl);
                      const isHoverable = day.pnl !== null;
                      return (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 rounded-[3px] transition-all duration-150 ${colorClass} ${
                            isHoverable ? 'hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 hover:ring-offset-theme-card cursor-pointer hover:scale-125 z-10' : ''
                          }`}
                          onMouseEnter={(e) => handleMouseEnter(e, day)}
                          onMouseLeave={handleMouseLeave}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tooltip */}
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full pb-2"
            style={{ left: hoveredDay.x, top: hoveredDay.y }}
          >
            <div className="bg-theme-card border border-theme-border shadow-2xl rounded-xl px-3.5 py-2.5 text-xs backdrop-blur-md flex flex-col gap-1 min-w-[130px]">
              <div className="text-theme-text-muted font-mono text-[11px] flex justify-between items-center border-b border-theme-border-muted pb-1 mb-0.5">
                <span>{hoveredDay.date}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-theme-panel">
                  {hoveredDay.pnl > 0 ? '盈利' : hoveredDay.pnl < 0 ? '亏损' : '平盘'}
                </span>
              </div>
              <div className={`font-bold font-mono text-sm ${hoveredDay.pnl > 0 ? winColorClass : (hoveredDay.pnl < 0 ? lossColorClass : 'text-theme-text-primary')}`}>
                {hoveredDay.pnl >= 0 ? '+' : ''}${hoveredDay.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-theme-text-muted border-t border-theme-border-muted/60 pt-3 mt-1">
        <span className="text-[11px]">💡 提示: 颜色深浅代表当日盈亏金额强度</span>
        <div className="flex items-center gap-2 text-[11px]">
          <span>亏损深</span>
          <div className="flex gap-1 items-center">
            <div className={`w-3.5 h-3.5 rounded-[3px] ${isUpRed ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
            <div className={`w-3.5 h-3.5 rounded-[3px] ${isUpRed ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}></div>
            <div className={`w-3.5 h-3.5 rounded-[3px] ${isUpRed ? 'bg-emerald-500/40' : 'bg-red-500/40'}`}></div>
            <div className="w-3.5 h-3.5 rounded-[3px] bg-slate-700/40 border border-slate-600/30"></div>
            <div className={`w-3.5 h-3.5 rounded-[3px] ${isUpRed ? 'bg-red-500/40' : 'bg-emerald-500/40'}`}></div>
            <div className={`w-3.5 h-3.5 rounded-[3px] ${isUpRed ? 'bg-red-500/70' : 'bg-emerald-500/70'}`}></div>
            <div className={`w-3.5 h-3.5 rounded-[3px] ${isUpRed ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
          </div>
          <span>盈利深</span>
        </div>
      </div>
    </div>
  );
});

