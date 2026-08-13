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
    <section className="bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-5 sm:p-7 md:p-8 shadow-xl transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b border-theme-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Activity size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-xl text-theme-text-heading flex items-center gap-2">
              <span>组合总市值历史增长曲线</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {timeframe} 趋势
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-theme-text-muted mt-0.5">
              全景回顾组合资产在各时间维度的成长轨迹、本金基线与收益波动
            </p>
          </div>
        </div>

        {/* Timeframe & Mode Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switch */}
          <div className="bg-theme-panel border border-theme-border/80 p-1 rounded-2xl flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode("value")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                viewMode === "value"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              总市值 ($)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("return")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                viewMode === "return"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              累计收益率 (%)
            </button>
          </div>

          {/* Timeframe Tabs */}
          <div className="bg-theme-panel border border-theme-border/80 p-1 rounded-2xl flex items-center text-xs">
            {(["1M", "3M", "6M", "1Y", "ALL"] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs transition cursor-pointer ${
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {/* Card 1: Current Portfolio Value */}
        <div className="p-4 sm:p-5 rounded-2xl bg-theme-panel/50 border border-theme-border/80 shadow-xs">
          <span className="text-xs text-theme-text-muted font-bold tracking-wider uppercase block mb-1.5">
            当前总市值
          </span>
          <span className="text-base sm:text-2xl font-black font-mono text-theme-text-heading block">
            ${stats.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-theme-text-muted font-mono mt-1 block">
            本金投入: ${stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Card 2: Period Net Change */}
        <div className="p-4 sm:p-5 rounded-2xl bg-theme-panel/50 border border-theme-border/80 shadow-xs">
          <span className="text-xs text-theme-text-muted font-bold tracking-wider uppercase block mb-1.5">
            区间净变动 ({timeframe})
          </span>
          <div className={`text-base sm:text-2xl font-black font-mono flex items-center gap-1 ${
            isPeriodPositive
              ? isUpRed ? "text-red-500" : "text-emerald-500"
              : isUpRed ? "text-emerald-500" : "text-red-500"
          }`}>
            {isPeriodPositive ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
            <span>
              {isPeriodPositive ? "+" : ""}${stats.periodChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className={`text-xs font-mono font-bold mt-1 block ${
            isPeriodPositive
              ? isUpRed ? "text-red-400" : "text-emerald-400"
              : isUpRed ? "text-emerald-400" : "text-red-400"
          }`}>
            ({isPeriodPositive ? "+" : ""}{stats.periodChangePct.toFixed(2)}%)
          </span>
        </div>

        {/* Card 3: Peak Value */}
        <div className="p-4 sm:p-5 rounded-2xl bg-theme-panel/50 border border-theme-border/80 shadow-xs">
          <span className="text-xs text-theme-text-muted font-bold tracking-wider uppercase block mb-1.5">
            区间峰值市值
          </span>
          <span className="text-base sm:text-2xl font-black font-mono text-theme-text-primary block">
            ${stats.maxVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block font-semibold">
            最高高点纪录
          </span>
        </div>

        {/* Card 4: Lowest Value */}
        <div className="p-4 sm:p-5 rounded-2xl bg-theme-panel/50 border border-theme-border/80 shadow-xs">
          <span className="text-xs text-theme-text-muted font-bold tracking-wider uppercase block mb-1.5">
            区间低谷市值
          </span>
          <span className="text-base sm:text-2xl font-black font-mono text-theme-text-primary block">
            ${stats.minVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-theme-text-muted font-mono mt-1 block">
            支撑位底线
          </span>
        </div>
      </div>

      {/* Main Area Chart */}
      <div className="h-80 sm:h-96 md:h-[420px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              domain={["auto", "auto"]}
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
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
                    <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white text-xs space-y-2 font-sans z-50 min-w-56">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400 font-mono text-xs">
                        <span className="font-bold text-white">{item.fullDate}</span>
                        <span className="text-[11px] uppercase bg-slate-800 px-2 py-0.5 rounded-md text-indigo-300 font-bold">{timeframe} 节点</span>
                      </div>
                      <div className="flex justify-between text-xs gap-4">
                        <span className="text-slate-400">组合总市值:</span>
                        <span className="font-mono font-extrabold text-white text-sm">
                          ${item.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs gap-4">
                        <span className="text-slate-400">本金成本:</span>
                        <span className="font-mono text-slate-300">
                          ${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs gap-4">
                        <span className="text-slate-400">累计浮动盈亏:</span>
                        <span className={`font-mono font-bold ${
                          isPnLPos
                            ? isUpRed ? "text-red-400" : "text-emerald-400"
                            : isUpRed ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {isPnLPos ? "+" : ""}${item.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs gap-4">
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
                  value: "本金成本线",
                  fill: "#94a3b8",
                  fontSize: 11,
                  position: "insideTopLeft"
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={viewMode === "value" ? "totalValue" : "returnPct"}
              stroke={strokeColor}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
});
