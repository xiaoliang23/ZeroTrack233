import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from "recharts";
import { motion } from "framer-motion";
import { Position, Stock } from "../types";
import { TrendingUp, TrendingDown, Activity, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Layers } from "lucide-react";

interface PortfolioTrendChartProps {
  positions: Position[];
  stocks: Stock[];
  isUpRed: boolean;
}

type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

// Helper to generate a deterministic pseudo-random series for a stock symbol
function getStockPriceHistory(stock: Stock, days: number): number[] {
  const current = stock.currentPrice;
  const base = stock.basePrice || current * 0.9;
  const history: number[] = new Array(days);
  history[days - 1] = current;

  // Simple seed based on symbol character codes
  let seed = 0;
  for (let i = 0; i < stock.symbol.length; i++) {
    seed += stock.symbol.charCodeAt(i);
  }

  // Pseudo random generator
  const pseudoRandom = (idx: number) => {
    const x = Math.sin(seed + idx * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  // Walk backwards from current price
  let prevPrice = current;
  for (let i = days - 2; i >= 0; i--) {
    const rand = pseudoRandom(i);
    // Typical daily volatility ~ 0.8% to 1.8%
    const changePct = (rand - 0.485) * 0.024;
    // Drift slightly towards base price as we go further back
    const factor = 1 - changePct;
    let price = prevPrice * factor;
    // Bound price between 0.35x and 2.5x base price
    if (price < base * 0.35) price = base * 0.35;
    if (price > base * 2.5) price = base * 2.5;
    history[i] = price;
    prevPrice = price;
  }

  return history;
}

export default React.memo(function PortfolioTrendChart({
  positions,
  stocks,
  isUpRed
}: PortfolioTrendChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("3M");
  const [viewMode, setViewMode] = useState<"value" | "return">("value");

  const stockMap = useMemo(() => {
    const map = new Map<string, Stock>();
    stocks.forEach((s) => map.set(s.symbol, s));
    return map;
  }, [stocks]);

  // Determine number of historical days based on selected timeframe
  const timeframeDays = useMemo(() => {
    switch (timeframe) {
      case "1M":
        return 30;
      case "3M":
        return 90;
      case "6M":
        return 180;
      case "1Y":
        return 365;
      case "ALL":
        return 500;
      default:
        return 90;
    }
  }, [timeframe]);

  // Generate historical daily portfolio series
  const { chartData, stats } = useMemo(() => {
    if (positions.length === 0) {
      return { chartData: [], stats: null };
    }

    const days = timeframeDays;
    const now = new Date();

    // Map each position to its historical daily prices
    const positionHistories = positions.map((p) => {
      const stock = stockMap.get(p.symbol) || {
        symbol: p.symbol,
        name: p.name,
        basePrice: p.buyPrice,
        currentPrice: p.currentPrice,
        prevClose: p.buyPrice,
        high: p.currentPrice,
        low: p.buyPrice,
        volume: 0
      };
      return {
        position: p,
        prices: getStockPriceHistory(stock, days)
      };
    });

    const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
    const totalDividends = positions.reduce((sum, p) => sum + (p.dividends || 0), 0);

    const data: {
      date: string;
      fullDate: string;
      totalValue: number;
      totalCost: number;
      netPnL: number;
      returnPct: number;
    }[] = [];

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - (days - 1 - i));
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      const fullDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let dayValue = 0;
      positionHistories.forEach(({ position, prices }) => {
        const price = prices[i] ?? position.currentPrice;
        dayValue += position.quantity * price;
      });

      if (dayValue < minVal) minVal = dayValue;
      if (dayValue > maxVal) maxVal = dayValue;

      const netPnL = dayValue - totalCost + totalDividends;
      const returnPct = totalCost > 0 ? (netPnL / totalCost) * 100 : 0;

      data.push({
        date: dateStr,
        fullDate: fullDateStr,
        totalValue: Math.round(dayValue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        netPnL: Math.round(netPnL * 100) / 100,
        returnPct: Math.round(returnPct * 100) / 100
      });
    }

    const startVal = data[0]?.totalValue || 0;
    const endVal = data[data.length - 1]?.totalValue || 0;
    const periodChange = endVal - startVal;
    const periodChangePct = startVal > 0 ? (periodChange / startVal) * 100 : 0;

    return {
      chartData: data,
      stats: {
        currentValue: endVal,
        startValue: startVal,
        totalCost,
        periodChange,
        periodChangePct,
        minVal,
        maxVal
      }
    };
  }, [positions, stockMap, timeframeDays]);

  if (positions.length === 0 || !stats) {
    return null;
  }

  const isPeriodPositive = stats.periodChange >= 0;
  const themeUpColor = isUpRed ? "#ef4444" : "#10b981"; // Red if isUpRed else Green
  const themeDownColor = isUpRed ? "#10b981" : "#ef4444";
  const strokeColor = isPeriodPositive ? themeUpColor : themeDownColor;
  const gradientId = isPeriodPositive ? "portfolioTrendGradUp" : "portfolioTrendGradDown";

  return (
    <div className="bg-theme-card border border-theme-border rounded-xl md:rounded-2xl p-3.5 sm:p-5 shadow-md mb-4 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-theme-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-theme-text-heading flex items-center gap-2">
              组合总市值历史增长曲线
            </h3>
            <p className="text-[10px] sm:text-[11px] text-theme-text-muted">
              回顾持仓资产的长期成长轨迹与盈亏波动趋势
            </p>
          </div>
        </div>

        {/* Timeframe & Mode Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch */}
          <div className="bg-theme-panel border border-theme-border p-0.5 rounded-xl flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode("value")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                viewMode === "value"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              总市值 ($)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("return")}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                viewMode === "return"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              累计收益率 (%)
            </button>
          </div>

          {/* Timeframe Tabs */}
          <div className="bg-theme-panel border border-theme-border p-0.5 rounded-xl flex items-center text-xs">
            {(["1M", "3M", "6M", "1Y", "ALL"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded-lg font-mono font-bold text-[11px] transition cursor-pointer ${
                  timeframe === tf
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-xs"
                    : "text-theme-text-muted hover:text-theme-text-primary"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Card 1: Current Portfolio Value */}
        <div className="p-3 rounded-xl bg-theme-panel/50 border border-theme-border">
          <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider block mb-1">
            当前总市值
          </span>
          <span className="text-sm sm:text-lg font-bold font-mono text-theme-text-heading block">
            ${stats.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Card 2: Period Net Change */}
        <div className="p-3 rounded-xl bg-theme-panel/50 border border-theme-border">
          <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider block mb-1">
            区间净变动 ({timeframe})
          </span>
          <div className={`text-sm sm:text-lg font-bold font-mono flex items-center gap-1 ${
            isPeriodPositive
              ? isUpRed ? "text-red-500" : "text-emerald-500"
              : isUpRed ? "text-emerald-500" : "text-red-500"
          }`}>
            {isPeriodPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span>
              {isPeriodPositive ? "+" : ""}${stats.periodChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className={`text-[10px] font-mono ${
            isPeriodPositive
              ? isUpRed ? "text-red-400" : "text-emerald-400"
              : isUpRed ? "text-emerald-400" : "text-red-400"
          }`}>
            ({isPeriodPositive ? "+" : ""}{stats.periodChangePct.toFixed(2)}%)
          </span>
        </div>

        {/* Card 3: Peak Value */}
        <div className="p-3 rounded-xl bg-theme-panel/50 border border-theme-border">
          <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider block mb-1">
            区间峰值市值
          </span>
          <span className="text-sm sm:text-lg font-bold font-mono text-theme-text-primary block">
            ${stats.maxVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Card 4: Lowest Value */}
        <div className="p-3 rounded-xl bg-theme-panel/50 border border-theme-border">
          <span className="text-[10px] text-theme-text-muted uppercase font-bold tracking-wider block mb-1">
            区间低谷市值
          </span>
          <span className="text-sm sm:text-lg font-bold font-mono text-theme-text-primary block">
            ${stats.minVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Main Area Chart */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={25}
            />
            <YAxis
              domain={["auto", "auto"]}
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickFormatter={(val) =>
                viewMode === "value"
                  ? `$${(val / 1000).toFixed(1)}k`
                  : `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  const isPnLPos = item.netPnL >= 0;

                  return (
                    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-white text-xs space-y-1.5 font-sans z-50 min-w-44">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-slate-400 font-mono text-[11px]">
                        <span>{item.fullDate}</span>
                        <span className="text-[10px] uppercase">{timeframe} 节点</span>
                      </div>
                      <div className="flex justify-between text-[11px] gap-4">
                        <span className="text-slate-400">总市值:</span>
                        <span className="font-mono font-bold text-white">
                          ${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] gap-4">
                        <span className="text-slate-400">本金成本:</span>
                        <span className="font-mono text-slate-300">
                          ${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] gap-4">
                        <span className="text-slate-400">累计浮动盈亏:</span>
                        <span className={`font-mono font-bold ${
                          isPnLPos
                            ? isUpRed ? "text-red-400" : "text-emerald-400"
                            : isUpRed ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {isPnLPos ? "+" : ""}${item.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] gap-4">
                        <span className="text-slate-400">组合收益率:</span>
                        <span className={`font-mono font-bold ${
                          isPnLPos
                            ? isUpRed ? "text-red-400" : "text-emerald-400"
                            : isUpRed ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {isPnLPos ? "+" : ""}{item.returnPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {viewMode === "value" && (
              <ReferenceLine
                y={stats.totalCost}
                stroke="#64748b"
                strokeDasharray="4 4"
                label={{
                  value: "成本基线",
                  fill: "#94a3b8",
                  fontSize: 10,
                  position: "insideTopLeft"
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={viewMode === "value" ? "totalValue" : "returnPct"}
              stroke={strokeColor}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
