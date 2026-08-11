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
    <div className="bg-theme-card border border-theme-border rounded-xl md:rounded-2xl p-3.5 sm:p-5 shadow-md mb-4 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-theme-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <PieChartIcon size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-theme-text-heading flex items-center gap-2">
              持仓市值占比与盈亏分布
            </h3>
            <p className="text-[10px] sm:text-[11px] text-theme-text-muted">
              按实时持仓市值权重计算投资组合资产分配
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="text-right">
            <span className="text-[10px] text-theme-text-muted block font-sans">总持仓市值</span>
            <span className="font-bold text-theme-text-primary text-sm sm:text-base">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: Donut Chart */}
        <div className="lg:col-span-5 h-52 sm:h-60 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="marketValue"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="86%"
                paddingAngle={2}
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
                      strokeWidth={isSelected ? 2 : 0}
                      opacity={activeIndex === null || isHovered ? 1 : 0.4}
                      style={{ transition: "all 0.2s" }}
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
                      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-white text-xs space-y-1.5 font-sans z-50">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                          <span className="font-bold text-indigo-300 font-mono">{data.symbol}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{data.name}</span>
                        </div>
                        <div className="flex justify-between text-[11px] gap-4">
                          <span className="text-slate-400">市值占比:</span>
                          <span className="font-mono font-bold">{data.weight.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-[11px] gap-4">
                          <span className="text-slate-400">最新市值:</span>
                          <span className="font-mono font-bold">${data.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px] gap-4">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {activeItem ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <span className="text-[10px] text-theme-text-muted font-mono uppercase tracking-wider block">{activeItem.symbol} 占比</span>
                <span className="text-lg font-bold font-mono text-theme-text-heading block">
                  {activeItem.weight.toFixed(1)}%
                </span>
                <span className={`text-[10px] font-mono font-bold ${
                  activeItem.pnl >= 0
                    ? isUpRed ? "text-red-500" : "text-emerald-500"
                    : isUpRed ? "text-emerald-500" : "text-red-500"
                }`}>
                  {activeItem.pnl >= 0 ? "+" : ""}${activeItem.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </motion.div>
            ) : (
              <div>
                <span className="text-[10px] text-theme-text-muted uppercase tracking-wider block font-medium">持仓标的数</span>
                <span className="text-xl font-bold font-mono text-theme-text-heading block">
                  {positions.length}
                </span>
                <span className="text-[9px] text-theme-text-muted block">悬浮或点击看各占比</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Allocation Breakdown List */}
        <div className="lg:col-span-7 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-theme-text-muted mb-1 flex items-center justify-between">
            <span>资产分布与浮动盈亏列表</span>
            <span>市值 (占比) / 盈亏</span>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
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
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    isSelected
                      ? "bg-indigo-500/10 border-indigo-500/50 shadow-xs"
                      : isHovered
                      ? "bg-theme-panel/80 border-theme-border"
                      : "bg-theme-panel/30 border-transparent hover:border-theme-border/60"
                  }`}
                >
                  {/* Left info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold font-mono text-theme-text-heading text-xs">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] text-theme-text-muted truncate hidden sm:inline">
                          {item.name}
                        </span>
                      </div>
                      {/* Weight progress bar */}
                      <div className="w-full bg-slate-700/20 rounded-full h-1 mt-1 overflow-hidden">
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
                    <div className="font-bold text-theme-text-primary text-xs">
                      ${item.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-[10px] text-theme-text-muted ml-1 font-normal">
                        ({item.weight.toFixed(1)}%)
                      </span>
                    </div>
                    <div className={`text-[10px] font-bold ${
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
    </div>
  );
});
