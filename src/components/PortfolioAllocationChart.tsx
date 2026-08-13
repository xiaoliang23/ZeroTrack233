import React, { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Position, Stock } from "../types";
import { PieChart as PieChartIcon } from "lucide-react";

interface PortfolioAllocationChartProps {
  positions: Position[];
  stocks: Stock[];
  onSelect: (symbol: string) => void;
  activeSymbol: string;
  isUpRed: boolean;
}

const PALETTE = [
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f97316", // orange
  "#a855f7", // purple
  "#64748b"  // slate
];

export default React.memo(function PortfolioAllocationChart({
  positions,
  stocks,
  onSelect,
  activeSymbol,
  isUpRed
}: PortfolioAllocationChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stockMap = useMemo(() => {
    const map = new Map<string, Stock>();
    stocks.forEach(s => map.set(s.symbol, s));
    return map;
  }, [stocks]);

  const { chartData, totalValue } = useMemo(() => {
    let sumValue = 0;
    let sumPnL = 0;

    const data = positions.map((p, idx) => {
      const stock = stockMap.get(p.symbol);
      const name = stock?.name || p.symbol;
      const currentPrice = stock?.currentPrice ?? (p.quantity > 0 ? p.currentValue / p.quantity : p.buyPrice);
      const mktValue = p.quantity * currentPrice;
      const pnl = (currentPrice - p.buyPrice) * p.quantity;
      const pnlPct = p.buyPrice > 0 ? ((currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0;

      sumValue += mktValue;
      sumPnL += pnl;

      return {
        symbol: p.symbol,
        name,
        quantity: p.quantity,
        buyPrice: p.buyPrice,
        currentPrice,
        marketValue: mktValue,
        pnl,
        pnlPct,
        color: PALETTE[idx % PALETTE.length]
      };
    }).sort((a, b) => b.marketValue - a.marketValue);

    const formattedData = data.map(item => ({
      ...item,
      weight: sumValue > 0 ? (item.marketValue / sumValue) * 100 : 0
    }));

    return { chartData: formattedData, totalValue: sumValue, totalPnL: sumPnL };
  }, [positions, stockMap]);

  if (positions.length === 0 || totalValue <= 0) {
    return null;
  }

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <section className="bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-5 sm:p-7 md:p-8 shadow-xl transition-all">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5 border-b border-theme-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <PieChartIcon size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-xl text-theme-text-heading flex items-center gap-2">
              <span>持仓市值占比与盈亏分布</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {positions.length} 标的资产
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-theme-text-muted mt-0.5">
              透视投资组合的资产权重、仓位集中度及各标的浮动盈亏贡献
            </p>
          </div>
        </div>

        {/* Top Summary Stats */}
        <div className="flex items-center gap-4 sm:gap-6 font-mono">
          <div className="text-right bg-theme-panel/60 px-4 py-2 rounded-2xl border border-theme-border/80">
            <span className="text-[11px] text-theme-text-muted block font-sans">总持仓市值</span>
            <span className="font-extrabold text-theme-text-primary text-base sm:text-xl">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
        {/* Left: Donut Chart Section */}
        <div className="lg:col-span-5 h-72 sm:h-88 md:h-96 relative flex items-center justify-center bg-theme-panel/30 rounded-2xl border border-theme-border/40 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="marketValue"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="88%"
                paddingAngle={3}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={(_, index) => {
                  if (chartData[index]) onSelect(chartData[index].symbol);
                }}
                className="cursor-pointer outline-none"
              >
                {chartData.map((entry, index) => {
                  const isSelected = activeSymbol === entry.symbol;
                  const isHovered = activeIndex === index;
                  return (
                    <Cell
                      key={`cell-${entry.symbol}`}
                      fill={entry.color}
                      stroke={isSelected ? "#ffffff" : "transparent"}
                      strokeWidth={isSelected ? 3 : 0}
                      opacity={activeIndex === null || isHovered ? 1 : 0.35}
                      style={{ transition: "all 0.25s ease-out" }}
                    />
                  );
                })}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPositive = data.pnl >= 0;
                    return (
                      <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white text-xs space-y-2 font-sans z-50 min-w-52">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                          <span className="font-extrabold text-indigo-300 font-mono text-sm">{data.symbol}</span>
                          <span className="text-xs text-slate-400 truncate max-w-[130px]">{data.name}</span>
                        </div>
                        <div className="flex justify-between text-xs gap-4">
                          <span className="text-slate-400">持仓数量:</span>
                          <span className="font-mono font-bold">{data.quantity.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs gap-4">
                          <span className="text-slate-400">市值占比:</span>
                          <span className="font-mono font-bold text-indigo-400">{data.weight.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-xs gap-4">
                          <span className="text-slate-400">持仓总市值:</span>
                          <span className="font-mono font-bold">${data.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs gap-4">
                          <span className="text-slate-400">浮动盈亏:</span>
                          <span className={`font-mono font-bold ${
                            isPositive
                              ? isUpRed ? "text-red-400" : "text-emerald-400"
                              : isUpRed ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {isPositive ? "+" : ""}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isPositive ? "+" : ""}{data.pnlPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
            {activeItem ? (
              <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }}>
                <span className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-widest block mb-0.5">
                  {activeItem.symbol}
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-theme-text-heading block">
                  {activeItem.weight.toFixed(1)}%
                </span>
                <span className={`text-xs font-mono font-bold mt-1 inline-block px-2 py-0.5 rounded-md ${
                  activeItem.pnl >= 0
                    ? isUpRed ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                    : isUpRed ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                }`}>
                  {activeItem.pnl >= 0 ? "+" : ""}${activeItem.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </motion.div>
            ) : (
              <div>
                <span className="text-xs text-theme-text-muted uppercase tracking-widest block font-bold mb-1">
                  组合标的
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono text-theme-text-heading block">
                  {positions.length}
                </span>
                <span className="text-[11px] text-theme-text-muted mt-1 block">
                  悬浮图表查看各资产细节
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Allocation Breakdown List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-2 flex items-center justify-between px-1">
            <span>持仓资产权重明细</span>
            <span>市值 (权重) / 浮动盈亏</span>
          </div>

          <div className="space-y-2.5 max-h-80 sm:max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {chartData.map((item, idx) => {
              const isSelected = activeSymbol === item.symbol;
              const isHovered = activeIndex === idx;
              const isPositive = item.pnl >= 0;

              return (
                <div
                  key={item.symbol}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => onSelect(item.symbol)}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs sm:text-sm ${
                    isSelected
                      ? "bg-indigo-500/15 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30"
                      : isHovered
                      ? "bg-theme-panel/90 border-theme-border"
                      : "bg-theme-panel/40 border-theme-border/50 hover:border-theme-border"
                  }`}
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-2 ring-white/10"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold font-mono text-theme-text-heading text-sm sm:text-base">
                          {item.symbol}
                        </span>
                        <span className="text-xs text-theme-text-muted truncate max-w-[140px]">
                          {item.name}
                        </span>
                      </div>
                      {/* Weight progress bar */}
                      <div className="w-full bg-slate-700/20 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(2, item.weight))}%`,
                            backgroundColor: item.color
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right values */}
                  <div className="text-right shrink-0 font-mono">
                    <div className="font-bold text-theme-text-primary text-xs sm:text-sm">
                      ${item.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-semibold text-indigo-400 ml-1.5">
                        ({item.weight.toFixed(1)}%)
                      </span>
                    </div>
                    <div className={`text-xs font-extrabold mt-0.5 ${
                      isPositive
                        ? isUpRed ? "text-red-500" : "text-emerald-500"
                        : isUpRed ? "text-emerald-500" : "text-red-500"
                    }`}>
                      {isPositive ? "+" : ""}${item.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isPositive ? "+" : ""}{item.pnlPct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});
