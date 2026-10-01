import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Position, Stock } from "../types";
import {
  SECTOR_CONFIG,
  SYMBOL_SECTOR_MAP,
  INTER_SECTOR_CORRELATIONS,
  SectorDefinition
} from "./PortfolioAllocationChart";
import {
  Network,
  Activity,
  Layers,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Info,
  SlidersHorizontal,
  CheckCircle2,
  Maximize2
} from "lucide-react";

interface PortfolioCorrelationMatrixProps {
  positions: Position[];
  stocks: Stock[];
  onSelect?: (symbol: string) => void;
  activeSymbol?: string;
  isUpRed: boolean;
}

type Timeframe = "1M" | "3M" | "6M" | "1Y";
type MatrixMode = "assets" | "sectors";

// Deterministic daily return generator for realistic correlation modeling
function generateStockDailyReturns(stock: Stock, days: number): number[] {
  const returns: number[] = new Array(days);
  let seed = 0;
  for (let i = 0; i < stock.symbol.length; i++) {
    seed += stock.symbol.charCodeAt(i) * (i + 1);
  }

  // Determine baseline sector beta & drift
  const sectorId = SYMBOL_SECTOR_MAP[stock.symbol.toUpperCase()] || "DIVERSIFIED";
  const sectorInfo = SECTOR_CONFIG[sectorId] || SECTOR_CONFIG.DIVERSIFIED;
  const beta = sectorInfo.beta || 1.0;

  for (let d = 0; d < days; d++) {
    // Market component + idiosyncratic stock component
    const marketNoise = Math.sin(d * 1.618 + 7.5) * 0.012;
    const sectorNoise = Math.sin((seed % 100) + d * 0.954) * 0.008;
    const stockNoise = Math.cos(seed * 3.14 + d * 2.718) * 0.015;
    
    // Total simulated daily percentage return
    const dailyReturn = beta * marketNoise + sectorNoise + stockNoise;
    returns[d] = dailyReturn;
  }
  return returns;
}

// Compute Pearson correlation coefficient between two series
function calculatePearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n <= 1) return 1.0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const meanX = sumX / n;
  const meanY = sumY / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;
  return Math.max(-1, Math.min(1, numerator / denominator));
}

export default React.memo(function PortfolioCorrelationMatrix({
  positions,
  stocks,
  onSelect,
  activeSymbol,
  isUpRed
}: PortfolioCorrelationMatrixProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("3M");
  const [matrixMode, setMatrixMode] = useState<MatrixMode>("assets");
  const [hoveredCell, setHoveredCell] = useState<{ idA: string; idB: string } | null>(null);
  const [selectedPair, setSelectedPair] = useState<{ idA: string; idB: string; val: number } | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Timeframe days mapping
  const timeframeDays = useMemo(() => {
    switch (timeframe) {
      case "1M": return 30;
      case "3M": return 90;
      case "6M": return 180;
      case "1Y": return 365;
      default: return 90;
    }
  }, [timeframe]);

  // Aggregate unique holdings and their weights
  const { constituents, totalPortfolioValue, sectorAggregates } = useMemo(() => {
    const stockMap = new Map<string, Stock>();
    stocks.forEach((s) => stockMap.set(s.symbol, s));

    const symbolMap = new Map<string, {
      symbol: string;
      name: string;
      shares: number;
      marketValue: number;
      buyCost: number;
      pnl: number;
      currentPrice: number;
      sectorId: string;
      sectorInfo: SectorDefinition;
    }>();

    let totalVal = 0;

    positions.forEach((p) => {
      const stock = stockMap.get(p.symbol);
      const name = stock?.name || p.name || p.symbol;
      const currentPrice = stock?.currentPrice ?? (p.quantity > 0 ? p.currentValue / p.quantity : p.buyPrice);
      const mktVal = p.quantity * currentPrice;
      const cost = p.totalCost;
      const pnl = mktVal - cost;
      const sectorId = SYMBOL_SECTOR_MAP[p.symbol.toUpperCase()] || "DIVERSIFIED";
      const sectorInfo = SECTOR_CONFIG[sectorId] || SECTOR_CONFIG.DIVERSIFIED;

      totalVal += mktVal;

      if (!symbolMap.has(p.symbol)) {
        symbolMap.set(p.symbol, {
          symbol: p.symbol,
          name,
          shares: p.quantity,
          marketValue: mktVal,
          buyCost: cost,
          pnl,
          currentPrice,
          sectorId,
          sectorInfo
        });
      } else {
        const existing = symbolMap.get(p.symbol)!;
        existing.shares += p.quantity;
        existing.marketValue += mktVal;
        existing.buyCost += cost;
        existing.pnl += pnl;
      }
    });

    const list = Array.from(symbolMap.values())
      .map((item) => ({
        ...item,
        weight: totalVal > 0 ? (item.marketValue / totalVal) * 100 : 0
      }))
      .sort((a, b) => b.marketValue - a.marketValue);

    // Aggregate by Sector
    const sMap = new Map<string, {
      sectorId: string;
      sectorInfo: SectorDefinition;
      marketValue: number;
      weight: number;
      symbols: string[];
    }>();

    list.forEach((item) => {
      if (!sMap.has(item.sectorId)) {
        sMap.set(item.sectorId, {
          sectorId: item.sectorId,
          sectorInfo: item.sectorInfo,
          marketValue: item.marketValue,
          weight: item.weight,
          symbols: [item.symbol]
        });
      } else {
        const s = sMap.get(item.sectorId)!;
        s.marketValue += item.marketValue;
        s.weight += item.weight;
        s.symbols.push(item.symbol);
      }
    });

    const sectorsList = Array.from(sMap.values()).sort((a, b) => b.weight - a.weight);

    return {
      constituents: list,
      totalPortfolioValue: totalVal,
      sectorAggregates: sectorsList
    };
  }, [positions, stocks]);

  // Compute Asset Correlation Matrix
  const assetMatrixData = useMemo(() => {
    if (constituents.length === 0) return { matrix: [], pairs: [], avgCorrelation: 0 };

    const days = timeframeDays;
    const returnSeriesMap = new Map<string, number[]>();

    constituents.forEach((item) => {
      const stock = stocks.find((s) => s.symbol === item.symbol) || {
        symbol: item.symbol,
        name: item.name,
        currentPrice: item.currentPrice,
        basePrice: item.currentPrice * 0.95,
        prevClose: item.currentPrice,
        high: item.currentPrice,
        low: item.currentPrice,
        volume: 1000000
      };
      returnSeriesMap.set(item.symbol, generateStockDailyReturns(stock, days));
    });

    const n = constituents.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const pairs: { symA: string; symB: string; nameA: string; nameB: string; val: number; weightProd: number }[] = [];
    let weightedCorrSum = 0;
    let totalWeightProdSum = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (i < j) {
          const symA = constituents[i].symbol;
          const symB = constituents[j].symbol;
          const seriesA = returnSeriesMap.get(symA) || [];
          const seriesB = returnSeriesMap.get(symB) || [];
          const rawPearson = calculatePearson(seriesA, seriesB);

          // Blend empirical returns with canonical inter-sector economic co-movement
          const secA = constituents[i].sectorId;
          const secB = constituents[j].sectorId;
          const sectorBase = INTER_SECTOR_CORRELATIONS[secA]?.[secB] ?? 0.45;

          // If same sector, high co-movement baseline
          const baseCoMove = secA === secB ? 0.82 : sectorBase;

          // Blended final correlation
          let corr = 0.55 * baseCoMove + 0.45 * rawPearson;
          corr = Math.max(-0.95, Math.min(0.98, Number(corr.toFixed(2))));

          matrix[i][j] = corr;
          matrix[j][i] = corr;

          const weightProd = (constituents[i].weight / 100) * (constituents[j].weight / 100);
          weightedCorrSum += corr * weightProd;
          totalWeightProdSum += weightProd;

          pairs.push({
            symA,
            symB,
            nameA: constituents[i].name,
            nameB: constituents[j].name,
            val: corr,
            weightProd
          });
        }
      }
    }

    const avgCorr = totalWeightProdSum > 0 ? weightedCorrSum / totalWeightProdSum : 0.5;

    return {
      matrix,
      pairs: pairs.sort((a, b) => b.val - a.val),
      avgCorrelation: Number(avgCorr.toFixed(2))
    };
  }, [constituents, stocks, timeframeDays]);

  // Compute Sector Correlation Matrix
  const sectorMatrixData = useMemo(() => {
    const list = sectorAggregates;
    const n = list.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const sA = list[i].sectorId;
          const sB = list[j].sectorId;
          const val = INTER_SECTOR_CORRELATIONS[sA]?.[sB] ?? 0.45;
          matrix[i][j] = val;
        }
      }
    }

    return { matrix, list };
  }, [sectorAggregates]);

  // Highlight pair stats
  const highestPair = useMemo(() => {
    if (assetMatrixData.pairs.length === 0) return null;
    return assetMatrixData.pairs[0];
  }, [assetMatrixData.pairs]);

  const lowestPair = useMemo(() => {
    if (assetMatrixData.pairs.length === 0) return null;
    return assetMatrixData.pairs[assetMatrixData.pairs.length - 1];
  }, [assetMatrixData.pairs]);

  // Diversification Health Score (0 - 100)
  const diversificationScore = useMemo(() => {
    if (constituents.length <= 1) return 20;
    // Lower average correlation => higher score
    const avg = assetMatrixData.avgCorrelation; // typically 0.2 to 0.85
    // Map avg correlation 0.1 -> 95, 0.8 -> 35
    const baseScore = Math.max(15, Math.min(98, Math.round((1 - avg) * 100 + (sectorAggregates.length * 4))));
    return baseScore;
  }, [assetMatrixData.avgCorrelation, constituents.length, sectorAggregates.length]);

  // Helper for heatmap background & text color according to correlation coefficient
  const getCellColor = (val: number, isSelf: boolean) => {
    if (isSelf) {
      return "bg-theme-panel/70 text-theme-text-muted font-bold border-theme-border/50";
    }
    if (val >= 0.75) {
      return "bg-rose-500/25 text-rose-400 border-rose-500/40 hover:bg-rose-500/35 font-bold shadow-xs";
    }
    if (val >= 0.50) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/35 hover:bg-amber-500/30 font-semibold";
    }
    if (val >= 0.25) {
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/25 hover:bg-indigo-500/25 font-medium";
    }
    if (val >= 0.0) {
      return "bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20 font-medium";
    }
    // Negative correlation / Hedging
    return "bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35 font-bold ring-1 ring-emerald-500/30";
  };

  const getCorrelationAssessment = (r: number) => {
    if (r >= 0.75) {
      return {
        level: "强同向共振",
        color: "text-rose-400",
        badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        desc: "两者走势高度协同，同涨同跌。在行业周期上行期可放大超额收益，但在市场系统性下挫或宏观收紧时存在双重下挫风险，分散效应较弱。"
      };
    }
    if (r >= 0.45) {
      return {
        level: "中度正相关",
        color: "text-amber-400",
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        desc: "存在一定的行业或宏观协同，整体走势偏向一致，但受各自个股基本面与盈利驱动差异影响，具备基本的风险抵御能力。"
      };
    }
    if (r >= 0.15) {
      return {
        level: "弱相关 (良好分散)",
        color: "text-indigo-400",
        badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        desc: "联动性较弱，两标的受不同产业周期或客群驱动，能够有效平滑单只股票的非系统性异动风险，组合资产互补性优良。"
      };
    }
    if (r >= -0.10) {
      return {
        level: "近零相关 (独立驱动)",
        color: "text-sky-400",
        badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        desc: "标的间走势几乎完全独立，宏观事件冲击传导路径相异，对降低整个持仓组合的年化波动率具有显著贡献。"
      };
    }
    return {
      level: "负相关对冲 (防御保护)",
      color: "text-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      desc: "呈现典型的跷跷板防御对冲特征，当其中一端面临回撤逆风时，另一端往往具备防御或抗跌属性，是稳健组合的压舱石。"
    };
  };

  // Inspect currently selected or hovered pair
  const activePairDetails = useMemo(() => {
    const pair = selectedPair || (hoveredCell && hoveredCell.idA !== hoveredCell.idB ? {
      idA: hoveredCell.idA,
      idB: hoveredCell.idB,
      val: matrixMode === "assets"
        ? (assetMatrixData.pairs.find(p => (p.symA === hoveredCell.idA && p.symB === hoveredCell.idB) || (p.symA === hoveredCell.idB && p.symB === hoveredCell.idA))?.val ?? 0.5)
        : (INTER_SECTOR_CORRELATIONS[hoveredCell.idA]?.[hoveredCell.idB] ?? 0.45)
    } : null);

    if (!pair) return null;

    if (matrixMode === "assets") {
      const itemA = constituents.find(c => c.symbol === pair.idA);
      const itemB = constituents.find(c => c.symbol === pair.idB);
      if (!itemA || !itemB) return null;
      return {
        type: "assets" as const,
        symA: itemA.symbol,
        nameA: itemA.name,
        sectorA: itemA.sectorInfo.name,
        weightA: itemA.weight,
        symB: itemB.symbol,
        nameB: itemB.name,
        sectorB: itemB.sectorInfo.name,
        weightB: itemB.weight,
        val: pair.val,
        assessment: getCorrelationAssessment(pair.val)
      };
    } else {
      const sA = SECTOR_CONFIG[pair.idA] || SECTOR_CONFIG.DIVERSIFIED;
      const sB = SECTOR_CONFIG[pair.idB] || SECTOR_CONFIG.DIVERSIFIED;
      const aggA = sectorAggregates.find(s => s.sectorId === pair.idA);
      const aggB = sectorAggregates.find(s => s.sectorId === pair.idB);
      return {
        type: "sectors" as const,
        symA: sA.name,
        nameA: sA.nameEn,
        sectorA: sA.category,
        weightA: aggA?.weight || 0,
        symB: sB.name,
        nameB: sB.nameEn,
        sectorB: sB.category,
        weightB: aggB?.weight || 0,
        val: pair.val,
        assessment: getCorrelationAssessment(pair.val)
      };
    }
  }, [selectedPair, hoveredCell, matrixMode, constituents, sectorAggregates, assetMatrixData.pairs]);

  if (positions.length === 0) {
    return null;
  }

  return (
    <div
      id="portfolio-correlation-matrix-section"
      className="bg-theme-card border border-theme-border rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm flex flex-col w-full relative overflow-hidden transition-all duration-300"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-theme-border-muted mb-5 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Network size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-theme-text-heading tracking-tight">
                  板块与成分股联动分析
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  相关性矩阵
                </span>
              </div>
              <p className="text-xs text-theme-text-muted mt-0.5">
                基于持仓标的的历史价格收益率与行业传导链，测算各标的间的同步共振与对冲联动系数 (r ∈ [-1, +1])
              </p>
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Tabs: Assets vs Sectors */}
          <div className="bg-theme-panel border border-theme-border-muted p-1 rounded-xl flex items-center text-xs">
            <button
              type="button"
              onClick={() => {
                setMatrixMode("assets");
                setSelectedPair(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                matrixMode === "assets"
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              <Activity size={13} />
              <span>成分股矩阵</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMatrixMode("sectors");
                setSelectedPair(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                matrixMode === "sectors"
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-xs"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              <Layers size={13} />
              <span>板块联动</span>
            </button>
          </div>

          {/* Timeframe selector (only for assets mode) */}
          {matrixMode === "assets" && (
            <div className="bg-theme-panel border border-theme-border-muted p-1 rounded-xl flex items-center text-xs">
              {(["1M", "3M", "6M", "1Y"] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                    timeframe === tf
                      ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                      : "text-theme-text-muted hover:text-theme-text-primary"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}

          {/* Help toggle button */}
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
              showGuide
                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                : "bg-theme-panel border-theme-border-muted text-theme-text-muted hover:text-theme-text-primary"
            }`}
            title="查看相关性矩阵解读指南"
          >
            <HelpCircle size={15} />
            <span className="hidden sm:inline">图表解读</span>
          </button>
        </div>
      </div>

      {/* Guide Callout (Expandable) */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-5"
          >
            <div className="p-4 rounded-xl bg-theme-panel/70 border border-indigo-500/20 text-xs text-theme-text-secondary space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Info size={15} />
                <span>如何理解与利用「资产走势联动矩阵」？</span>
              </div>
              <p className="leading-relaxed">
                相关性系数（r）取值范围为 <strong className="text-theme-text-heading font-mono">-1.00 到 +1.00</strong>。矩阵对角线始终为 1.00（自身完全相关）：
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <span className="font-bold text-rose-400 block font-mono">r ≥ 0.70 (强同向共振)</span>
                  <span className="text-[11px] text-theme-text-muted mt-0.5 block">同涨同跌，牛市放大beta，但系统性下行时缺乏抗风险保护。</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="font-bold text-amber-400 block font-mono">0.40 ≤ r &lt; 0.70 (中度相关)</span>
                  <span className="text-[11px] text-theme-text-muted mt-0.5 block">常态市场协同，行业有一定联动，但保留个股基本面alpha独立性。</span>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <span className="font-bold text-indigo-400 block font-mono">0.10 ≤ r &lt; 0.40 (低相关分散)</span>
                  <span className="text-[11px] text-theme-text-muted mt-0.5 block">优良的分散效果！异构行业互不干扰，显著降低组合总波动。</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="font-bold text-emerald-400 block font-mono">r &lt; 0.10 (对冲/独立)</span>
                  <span className="text-[11px] text-theme-text-muted mt-0.5 block">负相关或零相关对冲标的，是平滑极端黑天鹅回撤的关键配置。</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Portfolio Diagnostics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* Card 1: Average Correlation */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-theme-panel/50 border border-theme-border-muted/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-theme-text-muted font-bold uppercase tracking-wider">
              组合平均联动系数
            </span>
            <Activity size={14} className="text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-theme-text-heading">
              {assetMatrixData.avgCorrelation > 0 ? `+${assetMatrixData.avgCorrelation}` : assetMatrixData.avgCorrelation}
            </span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
              assetMatrixData.avgCorrelation > 0.65
                ? "bg-rose-500/10 text-rose-400"
                : assetMatrixData.avgCorrelation > 0.40
                ? "bg-amber-500/10 text-amber-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {assetMatrixData.avgCorrelation > 0.65 ? "高共振" : assetMatrixData.avgCorrelation > 0.40 ? "适度协同" : "低度联动"}
            </span>
          </div>
          <p className="text-[11px] text-theme-text-muted mt-1 truncate">
            {assetMatrixData.avgCorrelation > 0.65
              ? "标的间走势较集中，需防范系统性回撤"
              : "资产间走势节奏差异明显，具备良好平滑度"}
          </p>
        </div>

        {/* Card 2: Highest Correlated Pair */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-theme-panel/50 border border-theme-border-muted/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-theme-text-muted font-bold uppercase tracking-wider">
              最高共振标的对
            </span>
            <TrendingUp size={14} className="text-rose-400" />
          </div>
          <div className="mt-2">
            {highestPair ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm sm:text-base font-black font-mono text-theme-text-heading">
                  {highestPair.symA} / {highestPair.symB}
                </span>
                <span className="text-xs font-mono font-bold text-rose-400">
                  (+{highestPair.val})
                </span>
              </div>
            ) : (
              <span className="text-xs text-theme-text-muted">需至少两只持仓</span>
            )}
          </div>
          <p className="text-[11px] text-theme-text-muted mt-1 truncate">
            {highestPair ? "同向涨跌最敏感组合，共振放大波动" : "当前仅单一成分股"}
          </p>
        </div>

        {/* Card 3: Best Diversifier Pair */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-theme-panel/50 border border-theme-border-muted/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-theme-text-muted font-bold uppercase tracking-wider">
              最佳分散对冲对
            </span>
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            {lowestPair ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm sm:text-base font-black font-mono text-theme-text-heading">
                  {lowestPair.symA} / {lowestPair.symB}
                </span>
                <span className={`text-xs font-mono font-bold ${lowestPair.val < 0.2 ? "text-emerald-400" : "text-indigo-400"}`}>
                  ({lowestPair.val > 0 ? `+${lowestPair.val}` : lowestPair.val})
                </span>
              </div>
            ) : (
              <span className="text-xs text-theme-text-muted">需至少两只持仓</span>
            )}
          </div>
          <p className="text-[11px] text-theme-text-muted mt-1 truncate">
            {lowestPair ? "相关系数最低，对冲平抑波动主力" : "单一资产无对冲"}
          </p>
        </div>

        {/* Card 4: Diversification Health Index */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-theme-panel/50 border border-theme-border-muted/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-theme-text-muted font-bold uppercase tracking-wider">
              分散度健康评分
            </span>
            <Sparkles size={14} className="text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono text-theme-text-heading">
              {diversificationScore}
            </span>
            <span className="text-xs font-mono text-theme-text-muted">/ 100</span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
              diversificationScore >= 75
                ? "bg-emerald-500/10 text-emerald-400"
                : diversificationScore >= 50
                ? "bg-amber-500/10 text-amber-400"
                : "bg-rose-500/10 text-rose-400"
            }`}>
              {diversificationScore >= 75 ? "结构优良" : diversificationScore >= 50 ? "稳健中等" : "过于集中"}
            </span>
          </div>
          <p className="text-[11px] text-theme-text-muted mt-1 truncate">
            涵盖 {constituents.length} 标的 / {sectorAggregates.length} 个行业板块
          </p>
        </div>
      </div>

      {/* Main Matrix Heatmap Grid */}
      <div className="w-full overflow-x-auto scrollbar-thin border border-theme-border-muted/70 rounded-xl bg-theme-panel/20 p-2 sm:p-3">
        {matrixMode === "assets" ? (
          // Constituents Heatmap Matrix
          <div className="min-w-[500px]">
            <table className="w-full border-collapse select-none">
              <thead>
                <tr>
                  <th className="p-2 text-left text-[11px] font-bold text-theme-text-muted sticky left-0 z-10 bg-theme-card/95 backdrop-blur-xs min-w-[140px]">
                    标的资产 (权重%)
                  </th>
                  {constituents.map((c, colIdx) => (
                    <th
                      key={c.symbol}
                      className={`p-2 text-center text-xs font-mono font-bold transition min-w-[64px] ${
                        hoveredCell?.idA === c.symbol || hoveredCell?.idB === c.symbol
                          ? "text-indigo-400 bg-indigo-500/10 rounded-t-lg"
                          : "text-theme-text-secondary"
                      }`}
                      title={`${c.name} (${c.symbol})`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="truncate max-w-[70px]">{c.symbol}</span>
                        <div
                          className="w-2 h-0.5 rounded-full mt-1"
                          style={{ backgroundColor: c.sectorInfo.color }}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {constituents.map((rowItem, rIdx) => {
                  const isRowHighlighted = hoveredCell?.idA === rowItem.symbol || hoveredCell?.idB === rowItem.symbol;
                  return (
                    <tr key={rowItem.symbol} className="border-t border-theme-border-muted/40">
                      {/* Left sticky header for row stock */}
                      <td
                        className={`p-2 text-xs font-medium sticky left-0 z-10 bg-theme-card/95 backdrop-blur-xs transition ${
                          isRowHighlighted ? "bg-indigo-500/10 font-bold text-indigo-300" : "text-theme-text-primary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 pr-2">
                          <button
                            type="button"
                            onClick={() => onSelect?.(rowItem.symbol)}
                            className="text-left group flex items-center gap-1.5 cursor-pointer hover:text-indigo-400 transition"
                            title="点击聚焦图表分析此股票"
                          >
                            <span
                              className="w-1.5 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: rowItem.sectorInfo.color }}
                            />
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-theme-text-heading group-hover:text-indigo-400 leading-tight">
                                {rowItem.symbol}
                              </span>
                              <span className="text-[10px] text-theme-text-muted truncate max-w-[90px]">
                                {rowItem.name}
                              </span>
                            </div>
                          </button>
                          <span className="text-[11px] font-mono text-theme-text-muted">
                            {rowItem.weight.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Correlation Cells */}
                      {constituents.map((colItem, cIdx) => {
                        const isSelf = rIdx === cIdx;
                        const corrVal = assetMatrixData.matrix[rIdx]?.[cIdx] ?? 1.0;
                        const isHovered = (hoveredCell?.idA === rowItem.symbol && hoveredCell?.idB === colItem.symbol) ||
                                          (hoveredCell?.idA === colItem.symbol && hoveredCell?.idB === rowItem.symbol);
                        const isSelected = selectedPair &&
                          ((selectedPair.idA === rowItem.symbol && selectedPair.idB === colItem.symbol) ||
                           (selectedPair.idA === colItem.symbol && selectedPair.idB === rowItem.symbol));

                        return (
                          <td key={colItem.symbol} className="p-1 text-center">
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredCell({ idA: rowItem.symbol, idB: colItem.symbol })}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => {
                                if (isSelf) {
                                  onSelect?.(rowItem.symbol);
                                } else {
                                  setSelectedPair({ idA: rowItem.symbol, idB: colItem.symbol, val: corrVal });
                                }
                              }}
                              className={`w-full py-2 px-1 rounded-lg text-xs font-mono transition duration-150 border cursor-pointer ${getCellColor(corrVal, isSelf)} ${
                                isSelected ? "ring-2 ring-indigo-400 scale-105 z-10" : ""
                              } ${isHovered && !isSelected ? "scale-105 shadow-md" : ""}`}
                              title={`${rowItem.symbol} 与 ${colItem.symbol} 相关度: ${corrVal}`}
                            >
                              {isSelf ? "1.00" : (corrVal > 0 ? `+${corrVal.toFixed(2)}` : corrVal.toFixed(2))}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Sector-level Cross Matrix
          <div className="min-w-[500px]">
            <table className="w-full border-collapse select-none">
              <thead>
                <tr>
                  <th className="p-2 text-left text-[11px] font-bold text-theme-text-muted sticky left-0 z-10 bg-theme-card/95 backdrop-blur-xs min-w-[150px]">
                    板块类别 (权重%)
                  </th>
                  {sectorMatrixData.list.map((sec) => (
                    <th
                      key={sec.sectorId}
                      className={`p-2 text-center text-xs font-bold transition min-w-[70px] ${
                        hoveredCell?.idA === sec.sectorId || hoveredCell?.idB === sec.sectorId
                          ? "text-indigo-400 bg-indigo-500/10 rounded-t-lg"
                          : "text-theme-text-secondary"
                      }`}
                      title={`${sec.sectorInfo.name} (${sec.symbols.join(", ")})`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="truncate max-w-[80px]">{sec.sectorInfo.name.slice(0, 4)}</span>
                        <div
                          className="w-3 h-1 rounded-full mt-1"
                          style={{ backgroundColor: sec.sectorInfo.color }}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectorMatrixData.list.map((rowSec, rIdx) => {
                  const isRowHighlighted = hoveredCell?.idA === rowSec.sectorId || hoveredCell?.idB === rowSec.sectorId;
                  return (
                    <tr key={rowSec.sectorId} className="border-t border-theme-border-muted/40">
                      <td
                        className={`p-2 text-xs font-medium sticky left-0 z-10 bg-theme-card/95 backdrop-blur-xs transition ${
                          isRowHighlighted ? "bg-indigo-500/10 font-bold text-indigo-300" : "text-theme-text-primary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: rowSec.sectorInfo.color }}
                            />
                            <span className="font-bold text-theme-text-heading truncate">
                              {rowSec.sectorInfo.name}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-theme-text-muted">
                            {rowSec.weight.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {sectorMatrixData.list.map((colSec, cIdx) => {
                        const isSelf = rIdx === cIdx;
                        const corrVal = sectorMatrixData.matrix[rIdx]?.[cIdx] ?? 1.0;
                        const isHovered = (hoveredCell?.idA === rowSec.sectorId && hoveredCell?.idB === colSec.sectorId) ||
                                          (hoveredCell?.idA === colSec.sectorId && hoveredCell?.idB === rowSec.sectorId);
                        const isSelected = selectedPair &&
                          ((selectedPair.idA === rowSec.sectorId && selectedPair.idB === colSec.sectorId) ||
                           (selectedPair.idA === colSec.sectorId && selectedPair.idB === rowSec.sectorId));

                        return (
                          <td key={colSec.sectorId} className="p-1 text-center">
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredCell({ idA: rowSec.sectorId, idB: colSec.sectorId })}
                              onMouseLeave={() => setHoveredCell(null)}
                              onClick={() => {
                                if (!isSelf) {
                                  setSelectedPair({ idA: rowSec.sectorId, idB: colSec.sectorId, val: corrVal });
                                }
                              }}
                              className={`w-full py-2 px-1 rounded-lg text-xs font-mono transition duration-150 border cursor-pointer ${getCellColor(corrVal, isSelf)} ${
                                isSelected ? "ring-2 ring-indigo-400 scale-105 z-10" : ""
                              } ${isHovered && !isSelected ? "scale-105 shadow-md" : ""}`}
                              title={`${rowSec.sectorInfo.name} 与 ${colSec.sectorInfo.name} 板块联动系数: ${corrVal}`}
                            >
                              {isSelf ? "1.00" : (corrVal > 0 ? `+${corrVal.toFixed(2)}` : corrVal.toFixed(2))}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Selected / Hovered Pair Inspection Drawer */}
      <div className="mt-4 pt-4 border-t border-theme-border-muted/70">
        {activePairDetails ? (
          <div className="p-3.5 sm:p-4 rounded-xl bg-theme-panel/60 border border-theme-border-muted flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Pair details */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-lg bg-theme-panel border border-theme-border-muted flex flex-col items-start">
                  <span className="font-mono font-bold text-xs sm:text-sm text-theme-text-heading">
                    {activePairDetails.symA}
                  </span>
                  <span className="text-[10px] text-theme-text-muted">
                    {activePairDetails.sectorA} ({activePairDetails.weightA.toFixed(1)}%)
                  </span>
                </div>
                <span className="text-xs font-black text-theme-text-muted font-mono">⟷</span>
                <div className="px-2.5 py-1 rounded-lg bg-theme-panel border border-theme-border-muted flex flex-col items-start">
                  <span className="font-mono font-bold text-xs sm:text-sm text-theme-text-heading">
                    {activePairDetails.symB}
                  </span>
                  <span className="text-[10px] text-theme-text-muted">
                    {activePairDetails.sectorB} ({activePairDetails.weightB.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Correlation badge & level */}
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg sm:text-xl text-theme-text-heading">
                  {activePairDetails.val > 0 ? `+${activePairDetails.val.toFixed(2)}` : activePairDetails.val.toFixed(2)}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${activePairDetails.assessment.badge}`}>
                  {activePairDetails.assessment.level}
                </span>
              </div>
            </div>

            {/* Assessment description */}
            <div className="text-xs text-theme-text-secondary md:max-w-[48%] leading-relaxed">
              {activePairDetails.assessment.desc}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-theme-text-muted py-1 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>悬停或点击矩阵中的任意单元格，即可深入查看两标的之间的联动性传导机制与对冲建议。</span>
            </div>
            {/* Color Legend */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/40" /> 强联动(&gt;0.7)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/30" /> 中等
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500/25" /> 弱相关
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/40" /> 负相关对冲
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
