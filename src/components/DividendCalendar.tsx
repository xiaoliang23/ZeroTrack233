import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3 from 'd3-hierarchy';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  Grid, 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Filter, 
  Coins, 
  Info,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { Position, Stock } from '../types';

export interface DividendEvent {
  id: string;
  symbol: string;
  name: string;
  exDate: string; // YYYY-MM-DD
  payDate: string; // YYYY-MM-DD
  amountPerShare: number;
  totalAmount: number;
  shares: number;
  status: 'paid' | 'upcoming' | 'estimated';
  yieldPercent: number;
  frequency: 'quarterly' | 'semi-annual' | 'annual';
  quarterLabel: string;
}

interface DividendCalendarProps {
  positions: Position[];
  stocks?: Stock[];
  activeSymbol?: string;
  onSelectStock?: (symbol: string) => void;
  isUpRed?: boolean;
}

// Typical dividend profiles for major stocks (annual yield & payout months)
const KNOWN_DIVIDEND_PROFILES: Record<string, { yield: number; months: number[]; perShare: number; freq: 'quarterly' | 'semi-annual' | 'annual' }> = {
  'VZ': { yield: 6.5, months: [1, 4, 7, 10], perShare: 0.665, freq: 'quarterly' },
  'AAPL': { yield: 0.55, months: [2, 5, 8, 11], perShare: 0.25, freq: 'quarterly' },
  'MSFT': { yield: 0.72, months: [3, 6, 9, 12], perShare: 0.75, freq: 'quarterly' },
  'KO': { yield: 3.1, months: [4, 7, 10, 12], perShare: 0.485, freq: 'quarterly' },
  'JNJ': { yield: 3.05, months: [3, 6, 9, 12], perShare: 1.24, freq: 'quarterly' },
  'JPM': { yield: 2.35, months: [1, 4, 7, 10], perShare: 1.15, freq: 'quarterly' },
  'WMT': { yield: 1.28, months: [1, 4, 6, 9], perShare: 0.2075, freq: 'quarterly' },
  'PG': { yield: 2.38, months: [2, 5, 8, 11], perShare: 1.0065, freq: 'quarterly' },
  'XOM': { yield: 3.25, months: [3, 6, 9, 12], perShare: 0.95, freq: 'quarterly' },
  'CVX': { yield: 4.15, months: [3, 6, 9, 12], perShare: 1.63, freq: 'quarterly' },
  '0700.HK': { yield: 0.95, months: [5], perShare: 3.40, freq: 'annual' },
  '9988.HK': { yield: 1.35, months: [7], perShare: 1.00, freq: 'annual' },
  '600519.SH': { yield: 1.85, months: [6], perShare: 30.88, freq: 'annual' },
  'NVDA': { yield: 0.08, months: [3, 6, 9, 12], perShare: 0.01, freq: 'quarterly' },
  'TSLA': { yield: 0, months: [], perShare: 0, freq: 'quarterly' },
  'AMZN': { yield: 0, months: [], perShare: 0, freq: 'quarterly' },
  'GOOGL': { yield: 0.45, months: [3, 6, 9, 12], perShare: 0.20, freq: 'quarterly' },
  'META': { yield: 0.35, months: [3, 6, 9, 12], perShare: 0.50, freq: 'quarterly' },
};

/**
 * Intelligent parser that extracts and extrapolates dividend payment events
 * from position `dividends` field and stock properties.
 */
function parsePositionDividends(positions: Position[], referenceDate: Date = new Date()): DividendEvent[] {
  const events: DividendEvent[] = [];
  const currentYear = referenceDate.getFullYear();
  const todayStr = referenceDate.toISOString().split('T')[0];

  positions.forEach((pos) => {
    if (!pos.quantity || pos.quantity <= 0) return;

    const rawDiv = typeof pos.dividends === 'number' ? pos.dividends : parseFloat(String(pos.dividends || 0)) || 0;
    const profile = KNOWN_DIVIDEND_PROFILES[pos.symbol] || {
      yield: rawDiv > 0 && pos.currentValue > 0 ? (rawDiv / pos.currentValue) * 100 : 1.5,
      months: [3, 6, 9, 12],
      perShare: rawDiv > 0 ? rawDiv / pos.quantity : (pos.currentPrice * 0.015) / 4,
      freq: 'quarterly' as const
    };

    // Calculate per-share payout
    let perShare = profile.perShare;
    if (rawDiv > 0 && pos.quantity > 0) {
      // If user explicitly recorded historical dividends, normalize perShare to reflect reality
      const estimatedPaidQuarters = profile.freq === 'annual' ? 1 : 2;
      perShare = Math.max(0.01, Number((rawDiv / (pos.quantity * estimatedPaidQuarters)).toFixed(4)));
    }

    const months = profile.months.length > 0 ? profile.months : [3, 6, 9, 12];
    const yieldPct = profile.yield > 0 ? profile.yield : Number(((perShare * months.length) / (pos.currentPrice || 1) * 100).toFixed(2));

    // Generate events for current year (and early next year for calendar preview)
    const years = [currentYear - 1, currentYear, currentYear + 1];

    years.forEach((yr) => {
      months.forEach((mo, mIdx) => {
        // Ex-dividend date: typically 10th-15th of the month
        const exDay = ((pos.symbol.charCodeAt(0) * 3 + mIdx * 7) % 8) + 8;
        // Payment date: typically 12-16 days after ex-date
        const payDay = Math.min(28, exDay + 14);

        const exDateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(exDay).padStart(2, '0')}`;
        const payDateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(payDay).padStart(2, '0')}`;

        const isPast = payDateStr < todayStr;
        const totalAmount = Number((perShare * pos.quantity).toFixed(2));

        // Skip events from previous year if they are outside a 12-month window
        const diffMonths = (yr - currentYear) * 12 + (mo - (referenceDate.getMonth() + 1));
        if (diffMonths < -8 || diffMonths > 6) return;

        let status: 'paid' | 'upcoming' | 'estimated' = isPast ? 'paid' : 'upcoming';
        if (!isPast && diffMonths > 3) status = 'estimated';

        events.push({
          id: `${pos.symbol}-${yr}-${mo}-${exDay}`,
          symbol: pos.symbol,
          name: pos.name,
          exDate: exDateStr,
          payDate: payDateStr,
          amountPerShare: perShare,
          totalAmount: totalAmount > 0 ? totalAmount : Number((rawDiv > 0 ? rawDiv : 5).toFixed(2)),
          shares: pos.quantity,
          status,
          yieldPercent: yieldPct,
          frequency: profile.freq,
          quarterLabel: `${yr} Q${Math.ceil(mo / 3)}`
        });
      });
    });
  });

  return events.sort((a, b) => a.payDate.localeCompare(b.payDate));
}

export default React.memo(function DividendCalendar({
  positions,
  stocks = [],
  activeSymbol = '',
  onSelectStock,
  isUpRed = true
}: DividendCalendarProps) {
  // Current view date (starts at current month: Sept/Oct 2026)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'heatmap' | 'matrix'>('calendar');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'upcoming'>('all');
  const [filterActiveSymbol, setFilterActiveSymbol] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: DividendEvent[] } | null>(null);

  // Parse all dividend events from positions
  const allEvents = useMemo(() => {
    return parsePositionDividends(positions, currentDate);
  }, [positions, currentDate]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (filterActiveSymbol && activeSymbol && ev.symbol !== activeSymbol) return false;
      if (statusFilter === 'paid' && ev.status !== 'paid') return false;
      if (statusFilter === 'upcoming' && ev.status === 'paid') return false;
      return true;
    });
  }, [allEvents, statusFilter, filterActiveSymbol, activeSymbol]);

  // Key Portfolio Dividend Metrics
  const metrics = useMemo(() => {
    const totalRecordedDividends = positions.reduce((sum, p) => sum + (p.dividends || 0), 0);
    const totalPortfolioValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    // Sum of all projected upcoming annual dividends
    const annualProjectedDividends = positions.reduce((sum, p) => {
      const profile = KNOWN_DIVIDEND_PROFILES[p.symbol];
      if (profile && profile.perShare > 0) {
        return sum + (profile.perShare * profile.months.length * p.quantity);
      }
      if (p.dividends && p.dividends > 0) {
        return sum + (p.dividends * 2); // estimated annual run rate
      }
      return sum + (p.currentValue * 0.015);
    }, 0);

    const portfolioDividendYield = totalPortfolioValue > 0 
      ? (annualProjectedDividends / totalPortfolioValue) * 100 
      : 0;

    // This month's dividends
    const yr = currentDate.getFullYear();
    const mo = currentDate.getMonth() + 1;
    const moPrefix = `${yr}-${String(mo).padStart(2, '0')}`;
    
    const thisMonthEvents = allEvents.filter(e => e.payDate.startsWith(moPrefix));
    const thisMonthTotal = thisMonthEvents.reduce((sum, e) => sum + e.totalAmount, 0);

    // Next upcoming dividend event
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingEvents = allEvents.filter(e => e.payDate >= todayStr && e.status !== 'paid');
    const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

    return {
      totalRecordedDividends,
      annualProjectedDividends,
      portfolioDividendYield,
      thisMonthTotal,
      thisMonthCount: thisMonthEvents.length,
      nextEvent
    };
  }, [positions, allEvents, currentDate]);

  // Calendar Grid computation for current Month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    // First day of current month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday...

    // Total days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Previous month filler days
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      date: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: DividendEvent[];
      totalPayout: number;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Pad leading days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      const dayEvs = filteredEvents.filter(e => e.payDate === dateStr || e.exDate === dateStr);
      days.push({
        date: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: dayEvs,
        totalPayout: dayEvs.reduce((sum, e) => sum + e.totalAmount, 0)
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvs = filteredEvents.filter(e => e.payDate === dateStr || e.exDate === dateStr);
      
      days.push({
        date: dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: dayEvs,
        totalPayout: dayEvs.reduce((sum, e) => sum + e.totalAmount, 0)
      });
    }

    // Trailing days from next month to complete standard 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear = month === 11 ? year + 1 : year;

    for (let day = 1; day <= remainingCells; day++) {
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvs = filteredEvents.filter(e => e.payDate === dateStr || e.exDate === dateStr);
      
      days.push({
        date: dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: dayEvs,
        totalPayout: dayEvs.reduce((sum, e) => sum + e.totalAmount, 0)
      });
    }

    // Calculate maximum daily payout for heat intensity scaling
    const maxDayPayout = Math.max(1, ...days.map(d => d.totalPayout));

    return { days, maxDayPayout };
  }, [currentDate, filteredEvents]);

  // Integrated Treemap Data (using PortfolioHeatmap logic)
  const treemapLeaves = useMemo(() => {
    // Generate tree data with size = annual dividend amount, color = dividend yield
    const dividendPositions = positions.map((p) => {
      const evs = allEvents.filter(e => e.symbol === p.symbol);
      const recordedDiv = p.dividends || 0;
      const annualDiv = evs.reduce((sum, e) => sum + e.totalAmount, 0) || (recordedDiv > 0 ? recordedDiv * 2 : 10);
      const yieldPct = p.currentValue > 0 ? (annualDiv / p.currentValue) * 100 : 1.5;

      return {
        ...p,
        annualDividend: annualDiv,
        dividendYield: Number(yieldPct.toFixed(2)),
        value: Math.max(annualDiv, 1)
      };
    }).filter(d => d.value > 0);

    if (dividendPositions.length === 0) return [];

    const rootData = {
      name: "Dividends",
      children: dividendPositions
    };

    const rootNode = d3.hierarchy<any>(rootData).sum((d: any) => d.value);
    d3.treemap()
      .size([1000, 600])
      .paddingInner(4)
      .paddingOuter(4)
      .round(false)
      (rootNode);

    return rootNode.leaves();
  }, [positions, allEvents]);

  // 12-Month Matrix Data (Jan - Dec)
  const matrixData = useMemo(() => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const rows = positions.map((pos) => {
      const monthValues = months.map((m) => {
        const prefix = `${year}-${String(m).padStart(2, '0')}`;
        const evs = allEvents.filter(e => e.symbol === pos.symbol && e.payDate.startsWith(prefix));
        const total = evs.reduce((sum, e) => sum + e.totalAmount, 0);
        return {
          month: m,
          amount: total,
          events: evs
        };
      });

      const totalAnnual = monthValues.reduce((sum, mv) => sum + mv.amount, 0);
      return {
        symbol: pos.symbol,
        name: pos.name,
        months: monthValues,
        totalAnnual
      };
    });

    const maxMonthVal = Math.max(1, ...rows.flatMap(r => r.months.map(m => m.amount)));

    return { rows, maxMonthVal };
  }, [positions, allEvents, currentDate]);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDayEvents(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDayEvents(null);
  };

  const handleTodayMonth = () => {
    setCurrentDate(new Date());
    setSelectedDayEvents(null);
  };

  const monthYearLabel = useMemo(() => {
    return currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  }, [currentDate]);

  return (
    <div className="bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col shadow-md md:shadow-xl transition-all">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-theme-border-muted gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-2xs">
            <Coins size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-theme-text-heading flex items-center gap-2">
                <span>股息日历与派息热力全景</span>
                <span className="text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Dividend Radar
                </span>
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-theme-text-muted mt-0.5 flex items-center gap-2">
              <span>解析持仓股息数据 • 月度派息时间表与热力图分布联动</span>
            </p>
          </div>
        </div>

        {/* View Switcher & Month Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Calendar, Treemap Heatmap, Matrix */}
          <div className="flex items-center bg-theme-panel p-1 rounded-xl border border-theme-border shadow-2xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-hover'
              }`}
            >
              <CalendarIcon size={13} />
              <span>月度日历</span>
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'heatmap'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-hover'
              }`}
            >
              <Layers size={13} />
              <span>派息热力图</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-bg-hover'
              }`}
            >
              <Grid size={13} />
              <span>年度矩阵</span>
            </button>
          </div>

          {/* Month Navigator (for Calendar & Matrix) */}
          {viewMode !== 'heatmap' && (
            <div className="flex items-center bg-theme-panel px-1.5 py-1 rounded-xl border border-theme-border">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover transition cursor-pointer"
                title="上个月"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold font-mono px-2 text-theme-text-heading min-w-[84px] text-center">
                {monthYearLabel}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded-lg text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover transition cursor-pointer"
                title="下个月"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={handleTodayMonth}
                className="ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-theme-bg-hover text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
              >
                本月
              </button>
            </div>
          )}

          {/* Filter by Active Stock */}
          {activeSymbol && (
            <button
              onClick={() => setFilterActiveSymbol(!filterActiveSymbol)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                filterActiveSymbol
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 ring-1 ring-indigo-500/30'
                  : 'bg-theme-panel border-theme-border text-theme-text-muted hover:text-theme-text-primary'
              }`}
              title={`仅查看 ${activeSymbol} 股息`}
            >
              <Filter size={12} />
              <span>仅看 {activeSymbol}</span>
            </button>
          )}
        </div>
      </div>

      {/* Bento Stats Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 my-4">
        {/* Metric 1: Annual Projected Dividends */}
        <div className="p-3 bg-theme-panel/70 rounded-xl sm:rounded-2xl border border-theme-border-muted flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-theme-text-muted font-medium mb-1">
            <span>年度预计股息</span>
            <DollarSign size={13} className="text-emerald-400" />
          </div>
          <div className="text-base sm:text-xl font-bold font-mono text-emerald-400">
            ${metrics.annualProjectedDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-theme-text-muted mt-1">
            综合股息率: <span className="font-mono font-bold text-theme-text-primary">{metrics.portfolioDividendYield.toFixed(2)}%</span>
          </div>
        </div>

        {/* Metric 2: Total Recorded Dividends */}
        <div className="p-3 bg-theme-panel/70 rounded-xl sm:rounded-2xl border border-theme-border-muted flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-theme-text-muted font-medium mb-1">
            <span>已累计到账</span>
            <CheckCircle2 size={13} className="text-indigo-400" />
          </div>
          <div className="text-base sm:text-xl font-bold font-mono text-theme-text-heading">
            ${metrics.totalRecordedDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-theme-text-muted mt-1">
            记录于持仓数据中
          </div>
        </div>

        {/* Metric 3: This Month Total */}
        <div className="p-3 bg-theme-panel/70 rounded-xl sm:rounded-2xl border border-theme-border-muted flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-theme-text-muted font-medium mb-1">
            <span>本月派息总额</span>
            <CalendarDays size={13} className="text-amber-400" />
          </div>
          <div className="text-base sm:text-xl font-bold font-mono text-amber-400">
            ${metrics.thisMonthTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-theme-text-muted mt-1">
            共 <span className="font-mono font-bold text-theme-text-primary">{metrics.thisMonthCount}</span> 笔派息事项
          </div>
        </div>

        {/* Metric 4: Next Event */}
        <div className="p-3 bg-theme-panel/70 rounded-xl sm:rounded-2xl border border-theme-border-muted flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-theme-text-muted font-medium mb-1">
            <span>最近一笔待发</span>
            <Clock size={13} className="text-indigo-400" />
          </div>
          {metrics.nextEvent ? (
            <div>
              <div className="text-xs sm:text-sm font-bold text-theme-text-primary truncate flex items-center gap-1">
                <span className="font-mono text-indigo-400">{metrics.nextEvent.symbol}</span>
                <span>+${metrics.nextEvent.totalAmount.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-theme-text-muted mt-1 font-mono">
                派发日: {metrics.nextEvent.payDate}
              </div>
            </div>
          ) : (
            <div className="text-xs text-theme-text-muted">暂无近期待派发事项</div>
          )}
        </div>
      </div>

      {/* MAIN VIEW AREA */}
      <div className="mt-2 min-h-[360px]">
        {/* VIEW 1: MONTHLY CALENDAR VIEW */}
        {viewMode === 'calendar' && (
          <div className="flex flex-col gap-3">
            {/* Filter Pills */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-theme-text-muted font-semibold">状态筛选:</span>
                {(['all', 'paid', 'upcoming'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-theme-bg-active text-indigo-400 border border-indigo-500/30'
                        : 'text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover'
                    }`}
                  >
                    {st === 'all' ? '全部事项' : st === 'paid' ? '已到账 (Paid)' : '待派发 (Upcoming)'}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-3 text-[10px] text-theme-text-muted">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>已派息入账</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span>待派发现金</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>除息登记日</span>
                </div>
              </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="border border-theme-border-muted rounded-xl sm:rounded-2xl overflow-hidden bg-theme-panel/30">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-theme-border-muted bg-theme-panel/80 text-center font-bold text-[11px] text-theme-text-muted py-2">
                <span>周日</span>
                <span>周一</span>
                <span>周二</span>
                <span>周三</span>
                <span>周四</span>
                <span>周五</span>
                <span>周六</span>
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-theme-border-muted/60 bg-theme-card">
                {calendarData.days.map((day, idx) => {
                  const hasEvents = day.events.length > 0;
                  const intensity = Math.min(1, Math.max(0.15, day.totalPayout / calendarData.maxDayPayout));
                  const isSelected = selectedDayEvents?.date === day.date;

                  return (
                    <div
                      key={day.date + '-' + idx}
                      onClick={() => {
                        if (hasEvents) {
                          setSelectedDayEvents({ date: day.date, events: day.events });
                        } else {
                          setSelectedDayEvents(null);
                        }
                      }}
                      className={`min-h-[72px] sm:min-h-[88px] p-1 sm:p-1.5 flex flex-col justify-between transition-all duration-200 relative group ${
                        !day.isCurrentMonth ? 'opacity-35 bg-theme-panel/10' : ''
                      } ${
                        day.isToday ? 'ring-1 ring-inset ring-indigo-500/80 bg-indigo-500/5' : ''
                      } ${
                        isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-500/10 z-10' : ''
                      } ${
                        hasEvents ? 'cursor-pointer hover:bg-indigo-500/10' : 'hover:bg-theme-bg-hover/30'
                      }`}
                      style={
                        hasEvents && day.isCurrentMonth
                          ? {
                              backgroundColor: `rgba(99, 102, 241, ${intensity * 0.12})`
                            }
                          : undefined
                      }
                    >
                      {/* Day Number and Total Payout Badge */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] sm:text-xs font-mono font-bold rounded-md px-1.5 py-0.2 ${
                            day.isToday
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : day.isCurrentMonth
                              ? 'text-theme-text-primary'
                              : 'text-theme-text-muted'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {hasEvents && (
                          <span className="font-mono text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded">
                            +${day.totalPayout.toFixed(0)}
                          </span>
                        )}
                      </div>

                      {/* Event Chips */}
                      <div className="flex flex-col gap-0.5 sm:gap-1 mt-1 overflow-hidden">
                        {day.events.slice(0, 2).map((ev) => {
                          const isExDate = ev.exDate === day.date && ev.payDate !== day.date;
                          const isPaid = ev.status === 'paid';
                          const isHighlighted = activeSymbol === ev.symbol;

                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectStock) onSelectStock(ev.symbol);
                                setSelectedDayEvents({ date: day.date, events: day.events });
                              }}
                              className={`truncate px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold flex items-center justify-between transition-all border ${
                                isHighlighted
                                  ? 'ring-1 ring-white shadow-sm'
                                  : ''
                              } ${
                                isExDate
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                  : isPaid
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                              }`}
                              title={`${ev.symbol} - ${ev.name} | ${isExDate ? '除息日' : '派息日'}: $${ev.totalAmount}`}
                            >
                              <span className="font-bold truncate">{ev.symbol}</span>
                              <span className="font-mono shrink-0 ml-0.5">${ev.totalAmount.toFixed(0)}</span>
                            </div>
                          );
                        })}

                        {day.events.length > 2 && (
                          <span className="text-[8px] sm:text-[9px] text-theme-text-muted font-bold pl-0.5">
                            +{day.events.length - 2} 更多
                          </span>
                        )}
                      </div>

                      {/* Heatmap density bar indicator at cell bottom */}
                      {hasEvents && (
                        <div
                          className="h-0.5 rounded-full mt-1 bg-gradient-to-r from-indigo-500 to-emerald-400"
                          style={{ width: `${Math.min(100, intensity * 100)}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Event Inspection Drawer */}
            <AnimatePresence>
              {selectedDayEvents && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-theme-panel border border-indigo-500/40 shadow-lg relative"
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-theme-border-muted">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-indigo-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-theme-text-heading">
                        {selectedDayEvents.date} 派息详情 ({selectedDayEvents.events.length} 笔)
                      </h4>
                    </div>
                    <button
                      onClick={() => setSelectedDayEvents(null)}
                      className="text-theme-text-muted hover:text-theme-text-primary text-xs p-1 rounded-md"
                    >
                      ✕ 关闭
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {selectedDayEvents.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl bg-theme-card border border-theme-border flex flex-col justify-between hover:border-indigo-500/40 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-theme-text-heading font-mono">
                              {ev.symbol}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              ev.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                            }`}>
                              {ev.status === 'paid' ? '已派发' : '待到账'}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-sm text-emerald-400">
                            +${ev.totalAmount.toFixed(2)}
                          </span>
                        </div>

                        <div className="text-[10px] text-theme-text-muted mt-1.5 space-y-0.5 font-mono">
                          <div className="flex justify-between">
                            <span>持股数量:</span>
                            <span className="text-theme-text-primary">{ev.shares} 股</span>
                          </div>
                          <div className="flex justify-between">
                            <span>每股派息:</span>
                            <span className="text-theme-text-primary">${ev.amountPerShare.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>年化股息率:</span>
                            <span className="text-indigo-400 font-bold">{ev.yieldPercent}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>除息日:</span>
                            <span>{ev.exDate}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => onSelectStock && onSelectStock(ev.symbol)}
                          className="mt-2 w-full py-1 rounded-lg bg-theme-bg-hover hover:bg-indigo-500/15 text-indigo-400 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>查看标的行情</span>
                          <ArrowUpRight size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* VIEW 2: DIVIDEND HEATMAP TREEMAP (Integrating PortfolioHeatmap Logic) */}
        {viewMode === 'heatmap' && (
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-theme-text-muted">
              <span className="text-[11px] font-medium">
                股息树状热力图：区块面积 = 年化预期股息 • 颜色亮度 = 股息率强度（基于 PortfolioHeatmap 架构）
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span>低股息率</span>
                <div className="w-16 h-2 rounded-full bg-gradient-to-r from-slate-600 via-indigo-600 to-emerald-500" />
                <span>高股息率 (≥4%)</span>
              </div>
            </div>

            {treemapLeaves.length === 0 ? (
              <div className="w-full h-64 flex items-center justify-center text-xs text-theme-text-muted">
                暂无持仓股息数据
              </div>
            ) : (
              <div className="w-full h-72 sm:h-80 relative bg-theme-panel/40 backdrop-blur-sm rounded-2xl overflow-hidden p-1 border border-theme-border-muted">
                {treemapLeaves.map((leafNode, idx) => {
                  const leaf = leafNode as any;
                  const data = leaf.data;
                  const width = (leaf.x1 - leaf.x0) / 10;
                  const height = (leaf.y1 - leaf.y0) / 6;

                  // Color gradient according to dividend yield
                  const yld = data.dividendYield || 0;
                  let tileColor = '#4f46e5'; // default indigo
                  if (yld > 5.0) tileColor = '#059669'; // strong green
                  else if (yld > 3.0) tileColor = '#10b981'; // medium green
                  else if (yld > 1.5) tileColor = '#6366f1'; // vibrant indigo
                  else if (yld > 0.5) tileColor = '#4338ca'; // deep indigo
                  else tileColor = '#334155'; // low/no dividend slate

                  const isActive = activeSymbol === data.symbol;

                  return (
                    <motion.div
                      key={data.symbol}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, delay: idx * 0.02 }}
                      onClick={() => onSelectStock && onSelectStock(data.symbol)}
                      className={`absolute flex flex-col justify-center items-center cursor-pointer transition-all duration-300 p-2 text-center overflow-hidden ${
                        isActive
                          ? 'z-10 ring-2 ring-white ring-offset-2 ring-offset-slate-900 rounded-xl shadow-lg scale-[1.01]'
                          : 'hover:brightness-110 hover:z-10 hover:scale-[1.005] rounded-lg'
                      }`}
                      style={{
                        left: `${leaf.x0 / 10}%`,
                        top: `${leaf.y0 / 6}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                        backgroundColor: tileColor,
                        border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {height > 14 && width > 10 && (
                        <div className="flex flex-col items-center justify-center w-full h-full text-white">
                          <span className="font-bold font-mono tracking-wider text-xs sm:text-sm drop-shadow-md">
                            {data.symbol}
                          </span>
                          <span className="font-mono text-[10px] sm:text-xs font-semibold opacity-90 mt-0.5">
                            ${data.annualDividend.toFixed(1)}/年
                          </span>
                          {height > 25 && width > 15 && (
                            <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 mt-1 rounded bg-black/25 backdrop-blur-xs font-mono font-bold">
                              收益率 {data.dividendYield}%
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: 12-MONTH MATRIX HEATMAP */}
        {viewMode === 'matrix' && (
          <div className="w-full flex flex-col gap-3 overflow-x-auto scrollbar-thin">
            <div className="text-[11px] text-theme-text-muted font-medium mb-1">
              持仓标的全年 12 个月派息热力矩阵（行 = 标的，列 = 月份，单元格颜色深浅 = 该月派息金额）
            </div>

            <table className="w-full text-xs text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-theme-border-muted text-theme-text-muted font-mono text-[10px]">
                  <th className="py-2 px-2 text-left font-bold">标的代码</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="py-2 px-1 text-center font-bold">
                      {i + 1}月
                    </th>
                  ))}
                  <th className="py-2 px-2 text-right font-bold">年度合计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border-muted/40 font-mono">
                {matrixData.rows.map((row) => {
                  const isRowActive = activeSymbol === row.symbol;

                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => onSelectStock && onSelectStock(row.symbol)}
                      className={`hover:bg-theme-bg-hover transition-colors cursor-pointer ${
                        isRowActive ? 'bg-indigo-500/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2 font-bold text-theme-text-heading flex items-center gap-1.5">
                        <span>{row.symbol}</span>
                        {isRowActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </td>

                      {row.months.map((m) => {
                        const hasVal = m.amount > 0;
                        const intensity = hasVal ? Math.min(1, Math.max(0.2, m.amount / matrixData.maxMonthVal)) : 0;

                        return (
                          <td key={m.month} className="p-1 text-center">
                            {hasVal ? (
                              <div
                                className="w-full py-1.5 rounded-md text-[10px] font-bold text-white transition-transform hover:scale-105 shadow-2xs"
                                style={{
                                  backgroundColor: `rgba(16, 185, 129, ${0.4 + intensity * 0.6})`
                                }}
                                title={`${row.symbol} ${m.month}月派息: $${m.amount.toFixed(2)}`}
                              >
                                ${m.amount.toFixed(0)}
                              </div>
                            ) : (
                              <div className="w-full py-1.5 text-[9px] text-theme-text-muted/30">
                                -
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-2 text-right font-bold text-emerald-400">
                        ${row.totalAnnual.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});
