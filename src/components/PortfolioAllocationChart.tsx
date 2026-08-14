import React, { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Position, Stock } from "../types";
import {
  PieChart as PieChartIcon,
  Layers,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Info,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  SlidersHorizontal,
  HelpCircle
} from "lucide-react";

interface PortfolioAllocationChartProps {
  positions: Position[];
  stocks: Stock[];
  onSelect: (symbol: string) => void;
  activeSymbol: string;
  isUpRed: boolean;
}

export interface SectorDefinition {
  id: string;
  name: string;
  nameEn: string;
  category: "Growth" | "Defensive" | "Cyclical" | "Financial";
  color: string;
  beta: number;
  description: string;
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

export const SECTOR_CONFIG: Record<string, SectorDefinition> = {
  TECH_SEMI: {
    id: "TECH_SEMI",
    name: "半导体与AI算力",
    nameEn: "Semiconductors & AI",
    category: "Growth",
    color: "#6366f1",
    beta: 1.75,
    description: "GPU、AI加速芯片与计算硬件制造"
  },
  CONSUMER_TECH: {
    id: "CONSUMER_TECH",
    name: "消费电子与终端",
    nameEn: "Consumer Tech",
    category: "Growth",
    color: "#3b82f6",
    beta: 1.15,
    description: "智能手机、PC、智能穿戴及消费级硬件生态"
  },
  CLOUD_SOFTWARE: {
    id: "CLOUD_SOFTWARE",
    name: "企业级软件与云计算",
    nameEn: "Enterprise Cloud & SaaS",
    category: "Growth",
    color: "#8b5cf6",
    beta: 1.10,
    description: "云基础设施、数据库与企业级数字化解决方案"
  },
  INTERNET_MEDIA: {
    id: "INTERNET_MEDIA",
    name: "互联网平台与数字文娱",
    nameEn: "Internet & Digital Media",
    category: "Growth",
    color: "#06b6d4",
    beta: 1.25,
    description: "电商平台、社交网络、数字流媒体与搜索分发"
  },
  EV_CLEAN_ENERGY: {
    id: "EV_CLEAN_ENERGY",
    name: "智能电动汽车与储能",
    nameEn: "EVs & Clean Energy",
    category: "Growth",
    color: "#10b981",
    beta: 1.65,
    description: "新能源汽车整车、动力电池与智能出行"
  },
  FINANCIALS: {
    id: "FINANCIALS",
    name: "商业银行与综合金融",
    nameEn: "Financials & Banking",
    category: "Financial",
    color: "#f59e0b",
    beta: 0.75,
    description: "零售银行、财富管理、证券投行与多元保险"
  },
  CONSUMER_STAPLES: {
    id: "CONSUMER_STAPLES",
    name: "核心消费与必选消费",
    nameEn: "Consumer Staples",
    category: "Defensive",
    color: "#ec4899",
    beta: 0.65,
    description: "高端白酒、食品饮料与品牌消费品"
  },
  HEALTHCARE: {
    id: "HEALTHCARE",
    name: "生物医药与大健康",
    nameEn: "Healthcare & Biotech",
    category: "Defensive",
    color: "#14b8a6",
    beta: 0.70,
    description: "创新药研发、医疗器械与健康医疗服务"
  },
  INDUSTRIAL: {
    id: "INDUSTRIAL",
    name: "高端制造与工业链",
    nameEn: "Industrial & Manufacturing",
    category: "Cyclical",
    color: "#f97316",
    beta: 1.05,
    description: "精密装备制造、智能工业与高端电气"
  },
  DIVERSIFIED: {
    id: "DIVERSIFIED",
    name: "综合与跨界配置",
    nameEn: "Diversified Equities",
    category: "Cyclical",
    color: "#64748b",
    beta: 1.00,
    description: "多元化资产与跨界经营实体"
  }
};

// Symbol to Sector Mapping
const SYMBOL_SECTOR_MAP: Record<string, string> = {
  NVDA: "TECH_SEMI",
  AMD: "TECH_SEMI",
  TSM: "TECH_SEMI",
  INTC: "TECH_SEMI",
  AVGO: "TECH_SEMI",
  QCOM: "TECH_SEMI",
  AAPL: "CONSUMER_TECH",
  MSFT: "CLOUD_SOFTWARE",
  CRM: "CLOUD_SOFTWARE",
  ORCL: "CLOUD_SOFTWARE",
  ADBE: "CLOUD_SOFTWARE",
  SNOW: "CLOUD_SOFTWARE",
  GOOGL: "INTERNET_MEDIA",
  GOOG: "INTERNET_MEDIA",
  META: "INTERNET_MEDIA",
  AMZN: "INTERNET_MEDIA",
  "700.HK": "INTERNET_MEDIA",
  "9988.HK": "INTERNET_MEDIA",
  "3690.HK": "INTERNET_MEDIA",
  TSLA: "EV_CLEAN_ENERGY",
  "300750.SZ": "EV_CLEAN_ENERGY",
  "002594.SZ": "EV_CLEAN_ENERGY",
  RIVN: "EV_CLEAN_ENERGY",
  NIO: "EV_CLEAN_ENERGY",
  "600519.SS": "CONSUMER_STAPLES",
  WMT: "CONSUMER_STAPLES",
  KO: "CONSUMER_STAPLES",
  COST: "CONSUMER_STAPLES",
  "601318.SS": "FINANCIALS",
  "600036.SS": "FINANCIALS",
  JPM: "FINANCIALS",
  BAC: "FINANCIALS",
  GS: "FINANCIALS",
  MS: "FINANCIALS",
  LLY: "HEALTHCARE",
  NVO: "HEALTHCARE",
  PFE: "HEALTHCARE",
  JNJ: "HEALTHCARE"
};

// Inter-Sector Standard Correlation Coefficients Base Matrix
const INTER_SECTOR_CORRELATIONS: Record<string, Record<string, number>> = {
  TECH_SEMI: {
    TECH_SEMI: 1.00,
    CONSUMER_TECH: 0.78,
    CLOUD_SOFTWARE: 0.84,
    INTERNET_MEDIA: 0.76,
    EV_CLEAN_ENERGY: 0.69,
    FINANCIALS: 0.24,
    CONSUMER_STAPLES: 0.14,
    HEALTHCARE: 0.18,
    INDUSTRIAL: 0.52,
    DIVERSIFIED: 0.45
  },
  CONSUMER_TECH: {
    TECH_SEMI: 0.78,
    CONSUMER_TECH: 1.00,
    CLOUD_SOFTWARE: 0.75,
    INTERNET_MEDIA: 0.72,
    EV_CLEAN_ENERGY: 0.58,
    FINANCIALS: 0.32,
    CONSUMER_STAPLES: 0.28,
    HEALTHCARE: 0.22,
    INDUSTRIAL: 0.48,
    DIVERSIFIED: 0.46
  },
  CLOUD_SOFTWARE: {
    TECH_SEMI: 0.84,
    CONSUMER_TECH: 0.75,
    CLOUD_SOFTWARE: 1.00,
    INTERNET_MEDIA: 0.82,
    EV_CLEAN_ENERGY: 0.62,
    FINANCIALS: 0.28,
    CONSUMER_STAPLES: 0.16,
    HEALTHCARE: 0.25,
    INDUSTRIAL: 0.45,
    DIVERSIFIED: 0.42
  },
  INTERNET_MEDIA: {
    TECH_SEMI: 0.76,
    CONSUMER_TECH: 0.72,
    CLOUD_SOFTWARE: 0.82,
    INTERNET_MEDIA: 1.00,
    EV_CLEAN_ENERGY: 0.64,
    FINANCIALS: 0.30,
    CONSUMER_STAPLES: 0.22,
    HEALTHCARE: 0.20,
    INDUSTRIAL: 0.42,
    DIVERSIFIED: 0.44
  },
  EV_CLEAN_ENERGY: {
    TECH_SEMI: 0.69,
    CONSUMER_TECH: 0.58,
    CLOUD_SOFTWARE: 0.62,
    INTERNET_MEDIA: 0.64,
    EV_CLEAN_ENERGY: 1.00,
    FINANCIALS: 0.18,
    CONSUMER_STAPLES: 0.08,
    HEALTHCARE: 0.15,
    INDUSTRIAL: 0.62,
    DIVERSIFIED: 0.48
  },
  FINANCIALS: {
    TECH_SEMI: 0.24,
    CONSUMER_TECH: 0.32,
    CLOUD_SOFTWARE: 0.28,
    INTERNET_MEDIA: 0.30,
    EV_CLEAN_ENERGY: 0.18,
    FINANCIALS: 1.00,
    CONSUMER_STAPLES: 0.42,
    HEALTHCARE: 0.38,
    INDUSTRIAL: 0.64,
    DIVERSIFIED: 0.60
  },
  CONSUMER_STAPLES: {
    TECH_SEMI: 0.14,
    CONSUMER_TECH: 0.28,
    CLOUD_SOFTWARE: 0.16,
    INTERNET_MEDIA: 0.22,
    EV_CLEAN_ENERGY: 0.08,
    FINANCIALS: 0.42,
    CONSUMER_STAPLES: 1.00,
    HEALTHCARE: 0.52,
    INDUSTRIAL: 0.35,
    DIVERSIFIED: 0.50
  },
  HEALTHCARE: {
    TECH_SEMI: 0.18,
    CONSUMER_TECH: 0.22,
    CLOUD_SOFTWARE: 0.25,
    INTERNET_MEDIA: 0.20,
    EV_CLEAN_ENERGY: 0.15,
    FINANCIALS: 0.38,
    CONSUMER_STAPLES: 0.52,
    HEALTHCARE: 1.00,
    INDUSTRIAL: 0.30,
    DIVERSIFIED: 0.44
  },
  INDUSTRIAL: {
    TECH_SEMI: 0.52,
    CONSUMER_TECH: 0.48,
    CLOUD_SOFTWARE: 0.45,
    INTERNET_MEDIA: 0.42,
    EV_CLEAN_ENERGY: 0.62,
    FINANCIALS: 0.64,
    CONSUMER_STAPLES: 0.35,
    HEALTHCARE: 0.30,
    INDUSTRIAL: 1.00,
    DIVERSIFIED: 0.68
  },
  DIVERSIFIED: {
    TECH_SEMI: 0.45,
    CONSUMER_TECH: 0.46,
    CLOUD_SOFTWARE: 0.42,
    INTERNET_MEDIA: 0.44,
    EV_CLEAN_ENERGY: 0.48,
    FINANCIALS: 0.60,
    CONSUMER_STAPLES: 0.50,
    HEALTHCARE: 0.44,
    INDUSTRIAL: 0.68,
    DIVERSIFIED: 1.00
  }
};

export default React.memo(function PortfolioAllocationChart({
  positions,
  stocks,
  onSelect,
  activeSymbol,
  isUpRed
}: PortfolioAllocationChartProps) {
  // Navigation tab: 'assets' | 'sectors' | 'correlation' | 'concentration'
  const [viewMode, setViewMode] = useState<"assets" | "sectors" | "correlation" | "concentration">("assets");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  // Interactive cell hover for correlation matrix
  const [hoveredCorrelation, setHoveredCorrelation] = useState<{
    s1: SectorDefinition;
    s2: SectorDefinition;
    correlation: number;
  } | null>(null);

  const stockMap = useMemo(() => {
    const map = new Map<string, Stock>();
    stocks.forEach((s) => map.set(s.symbol, s));
    return map;
  }, [stocks]);

  // Process Asset & Sector Level Data
  const {
    chartData,
    totalValue,
    totalPnL,
    sectorList,
    sectorMap,
    hhiScore,
    concentrationRating,
    topSectorWeight,
    highCorrelationPairs
  } = useMemo(() => {
    let sumValue = 0;
    let sumPnL = 0;

    const data = positions.map((p, idx) => {
      const stock = stockMap.get(p.symbol);
      const name = stock?.name || p.symbol;
      const currentPrice = stock?.currentPrice ?? (p.quantity > 0 ? p.currentValue / p.quantity : p.buyPrice);
      const mktValue = p.quantity * currentPrice;
      const pnl = (currentPrice - p.buyPrice) * p.quantity;
      const pnlPct = p.buyPrice > 0 ? ((currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0;
      const sectorId = SYMBOL_SECTOR_MAP[p.symbol.toUpperCase()] || "DIVERSIFIED";
      const sectorInfo = SECTOR_CONFIG[sectorId] || SECTOR_CONFIG.DIVERSIFIED;

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
        sectorId,
        sectorInfo,
        color: PALETTE[idx % PALETTE.length]
      };
    }).sort((a, b) => b.marketValue - a.marketValue);

    const formattedData = data.map((item) => ({
      ...item,
      weight: sumValue > 0 ? (item.marketValue / sumValue) * 100 : 0
    }));

    // Aggregate by Sector
    const sMap: Record<
      string,
      {
        sectorInfo: SectorDefinition;
        marketValue: number;
        pnl: number;
        positions: typeof formattedData;
        weight: number;
      }
    > = {};

    formattedData.forEach((item) => {
      const sId = item.sectorId;
      if (!sMap[sId]) {
        sMap[sId] = {
          sectorInfo: item.sectorInfo,
          marketValue: 0,
          pnl: 0,
          positions: [],
          weight: 0
        };
      }
      sMap[sId].marketValue += item.marketValue;
      sMap[sId].pnl += item.pnl;
      sMap[sId].positions.push(item);
    });

    const sList = Object.entries(sMap)
      .map(([id, val]) => ({
        id,
        ...val,
        weight: sumValue > 0 ? (val.marketValue / sumValue) * 100 : 0
      }))
      .sort((a, b) => b.weight - a.weight);

    // Calculate Herfindahl-Hirschman Index (HHI) for Sector Concentration
    // HHI = Sum of (Weight_percentage)^2. Maximum = 10,000 (100^2)
    let hhi = 0;
    sList.forEach((s) => {
      hhi += s.weight * s.weight;
    });

    let rating: { level: "低度集中 (良好均衡)" | "中度集中 (适度分散)" | "高度集中 (预警风险)"; color: string; badge: string; desc: string } = {
      level: "低度集中 (良好均衡)",
      color: "text-emerald-400",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      desc: "持仓在不同行业间配置均衡，系统性行业单点风险较低。"
    };

    if (hhi > 3500 || (sList[0] && sList[0].weight > 55)) {
      rating = {
        level: "高度集中 (预警风险)",
        color: "text-rose-400",
        badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        desc: "资金过度扎堆于单一板块，行业黑天鹅事件或周期逆风将导致组合净值剧烈回撤。"
      };
    } else if (hhi > 1800 || (sList[0] && sList[0].weight > 35)) {
      rating = {
        level: "中度集中 (适度分散)",
        color: "text-amber-400",
        badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        desc: "存在核心主导行业，建议关注高相关板块在流动性收紧期的同步波动风险。"
      };
    }

    // Find high-correlation sector pairs in portfolio (> 0.70)
    const highPairs: Array<{
      secA: SectorDefinition;
      secB: SectorDefinition;
      corr: number;
      combinedWeight: number;
    }> = [];

    for (let i = 0; i < sList.length; i++) {
      for (let j = i + 1; j < sList.length; j++) {
        const idA = sList[i].id;
        const idB = sList[j].id;
        const corr = INTER_SECTOR_CORRELATIONS[idA]?.[idB] ?? 0.5;
        if (corr >= 0.70) {
          highPairs.push({
            secA: sList[i].sectorInfo,
            secB: sList[j].sectorInfo,
            corr,
            combinedWeight: sList[i].weight + sList[j].weight
          });
        }
      }
    }

    return {
      chartData: formattedData,
      totalValue: sumValue,
      totalPnL: sumPnL,
      sectorList: sList,
      sectorMap: sMap,
      hhiScore: Math.round(hhi),
      concentrationRating: rating,
      topSectorWeight: sList[0]?.weight || 0,
      highCorrelationPairs: highPairs
    };
  }, [positions, stockMap]);

  if (positions.length === 0 || totalValue <= 0) {
    return null;
  }

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null;

  // Correlation cell color generator
  const getCorrelationColor = (val: number) => {
    if (val >= 0.85) return "bg-rose-600/80 text-white font-black";
    if (val >= 0.70) return "bg-amber-600/70 text-amber-100 font-bold";
    if (val >= 0.50) return "bg-indigo-600/50 text-indigo-100 font-semibold";
    if (val >= 0.30) return "bg-blue-600/35 text-blue-200";
    if (val >= 0.15) return "bg-teal-600/30 text-teal-200";
    return "bg-emerald-600/35 text-emerald-200 font-bold"; // Negative or near zero (Best hedge)
  };

  const getCorrelationDescription = (val: number) => {
    if (val >= 0.80) return { label: "高度强正相关 (极易同涨同跌)", risk: "高集中度叠加风险", type: "high" };
    if (val >= 0.60) return { label: "中度正向联动 (趋势大致同步)", risk: "中等协同波动", type: "moderate" };
    if (val >= 0.30) return { label: "低度弱相关 (波动独立性较强)", risk: "良好分散效益", type: "low" };
    return { label: "非相关/对冲缓冲 (天然分散避震器)", risk: "极佳防御协同", type: "hedge" };
  };

  return (
    <section
      id="portfolio-allocation-analysis-section"
      className="bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-5 sm:p-7 md:p-8 shadow-xl transition-all relative overflow-hidden"
    >
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 pb-5 border-b border-theme-border">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
            <PieChartIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-extrabold text-base sm:text-xl text-theme-text-heading">
                持仓结构、行业集中度与相关性热力图
              </h3>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${concentrationRating.badge}`}>
                {concentrationRating.level}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-theme-text-muted mt-0.5">
              透视行业板块权重暴露、跨赛道联动相关系数 ($r$) 及组合分散化风险
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pill */}
        <div className="flex items-center gap-1.5 p-1 bg-theme-panel rounded-2xl border border-theme-border self-start lg:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setViewMode("assets")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              viewMode === "assets"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover"
            }`}
          >
            <PieChartIcon size={13} />
            <span>标的市值分布</span>
          </button>

          <button
            onClick={() => setViewMode("sectors")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              viewMode === "sectors"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover"
            }`}
          >
            <Layers size={13} />
            <span>行业板块聚合</span>
          </button>

          <button
            onClick={() => setViewMode("correlation")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              viewMode === "correlation"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                : "text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover"
            }`}
          >
            <Flame size={13} className="text-pink-400" />
            <span>相关性热力矩阵</span>
          </button>

          <button
            onClick={() => setViewMode("concentration")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              viewMode === "concentration"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover"
            }`}
          >
            <ShieldCheck size={13} />
            <span>集中度诊断 (HHI)</span>
          </button>
        </div>
      </div>

      {/* TOP KEY METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 rounded-2xl bg-theme-panel/70 border border-theme-border/80 flex flex-col justify-between">
          <span className="text-[11px] text-theme-text-muted font-bold uppercase">总持仓市值</span>
          <p className="text-base sm:text-lg font-black font-mono text-theme-text-heading mt-1">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-theme-text-muted font-mono mt-0.5">
            涵盖 {positions.length} 只标的 / {sectorList.length} 个行业
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-theme-panel/70 border border-theme-border/80 flex flex-col justify-between">
          <span className="text-[11px] text-theme-text-muted font-bold uppercase">最大行业暴露 (CR1)</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <p className="text-base sm:text-lg font-black font-mono text-indigo-400">
              {topSectorWeight.toFixed(1)}%
            </p>
            <span className="text-xs font-bold text-theme-text-heading truncate max-w-[100px]">
              {sectorList[0]?.sectorInfo.name}
            </span>
          </div>
          <span className={`text-[10px] font-bold ${topSectorWeight > 45 ? "text-rose-400" : "text-emerald-400"}`}>
            {topSectorWeight > 45 ? "⚠️ 权重偏高 (>45%)" : "✅ 处于安全区间"}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-theme-panel/70 border border-theme-border/80 flex flex-col justify-between">
          <span className="text-[11px] text-theme-text-muted font-bold uppercase">HHI 集中度指数</span>
          <p className={`text-base sm:text-lg font-black font-mono mt-1 ${concentrationRating.color}`}>
            {hhiScore} <span className="text-xs font-normal text-theme-text-muted">/ 10,000</span>
          </p>
          <span className="text-[10px] text-theme-text-muted mt-0.5">
            {hhiScore < 1800 ? "分散度良好" : hhiScore < 3500 ? "中度适中" : "高度集中预警"}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-theme-panel/70 border border-theme-border/80 flex flex-col justify-between">
          <span className="text-[11px] text-theme-text-muted font-bold uppercase">高相关赛道重叠对数</span>
          <p className="text-base sm:text-lg font-black font-mono text-pink-400 mt-1">
            {highCorrelationPairs.length} 组 <span className="text-xs font-normal text-theme-text-muted">(r ≥ 0.70)</span>
          </p>
          <span className="text-[10px] text-theme-text-muted mt-0.5">
            {highCorrelationPairs.length > 0 ? "需防范共振下挫" : "资产关联度较健康"}
          </span>
        </div>
      </div>

      {/* VIEW TAB 1: ASSET BREAKDOWN (ORIGINAL ENHANCED DONUT & LIST) */}
      {viewMode === "assets" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center animate-fade-in">
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
                <RechartsTooltip
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
                            <span className="text-slate-400">所属行业:</span>
                            <span className="font-bold text-indigo-400">{data.sectorInfo.name}</span>
                          </div>
                          <div className="flex justify-between text-xs gap-4">
                            <span className="text-slate-400">市值占比:</span>
                            <span className="font-mono font-bold text-indigo-400">{data.weight.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between text-xs gap-4">
                            <span className="text-slate-400">持仓总市值:</span>
                            <span className="font-mono font-bold">
                              ${data.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs gap-4">
                            <span className="text-slate-400">浮动盈亏:</span>
                            <span
                              className={`font-mono font-bold ${
                                isPositive
                                  ? isUpRed ? "text-red-400" : "text-emerald-400"
                                  : isUpRed ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
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
                  <span className="text-[10px] text-theme-text-muted font-bold block mt-0.5">
                    {activeItem.sectorInfo.name}
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
                    悬浮图表查看资产细节
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Allocation Breakdown List */}
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-2 flex items-center justify-between px-1">
              <span>持仓资产权重明细</span>
              <span>行业 / 市值 (权重)</span>
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
                          <span className="text-xs text-theme-text-muted truncate max-w-[120px]">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-theme-bg border border-theme-border text-theme-text-muted hidden sm:inline-block">
                            {item.sectorInfo.name}
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
                      <div
                        className={`text-xs font-extrabold mt-0.5 ${
                          isPositive
                            ? isUpRed ? "text-red-500" : "text-emerald-500"
                            : isUpRed ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {isPositive ? "+" : ""}${item.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isPositive ? "+" : ""}{item.pnlPct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: SECTOR AGGREGATION BREAKDOWN */}
      {viewMode === "sectors" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Sector Donut */}
            <div className="lg:col-span-5 h-72 sm:h-88 md:h-96 relative flex items-center justify-center bg-theme-panel/30 rounded-2xl border border-theme-border/40 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorList}
                    dataKey="marketValue"
                    nameKey="id"
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="88%"
                    paddingAngle={3}
                  >
                    {sectorList.map((entry) => (
                      <Cell
                        key={`sector-cell-${entry.id}`}
                        fill={entry.sectorInfo.color}
                        stroke="#ffffff"
                        strokeWidth={0}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white text-xs space-y-2 font-sans z-50 min-w-56">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                              <span className="font-extrabold text-indigo-300 text-sm">{data.sectorInfo.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                                Beta: {data.sectorInfo.beta}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs gap-4">
                              <span className="text-slate-400">板块市值占比:</span>
                              <span className="font-mono font-bold text-indigo-400">{data.weight.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between text-xs gap-4">
                              <span className="text-slate-400">板块总市值:</span>
                              <span className="font-mono font-bold">${data.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-xs gap-4">
                              <span className="text-slate-400">包含股票:</span>
                              <span className="font-mono font-bold text-slate-300">
                                {data.positions.map((p: any) => p.symbol).join(", ")}
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

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
                <span className="text-xs text-theme-text-muted uppercase tracking-widest block font-bold mb-1">
                  行业板块数
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono text-theme-text-heading block">
                  {sectorList.length}
                </span>
                <span className="text-[11px] text-theme-text-muted mt-1 block">
                  各行业资金权重分布
                </span>
              </div>
            </div>

            {/* Sector Cards Grid */}
            <div className="lg:col-span-7 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-theme-text-muted mb-2 flex items-center justify-between px-1">
                <span>行业板块持仓与波动敏感度 (Beta)</span>
                <span>市值 (权重)</span>
              </div>

              <div className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {sectorList.map((sec) => {
                  const isSecProfit = sec.pnl >= 0;
                  return (
                    <div
                      key={sec.id}
                      className="p-4 rounded-2xl bg-theme-panel/50 border border-theme-border hover:border-theme-border-hover transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: sec.sectorInfo.color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-theme-text-heading text-sm">
                                {sec.sectorInfo.name}
                              </h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-theme-bg border border-theme-border text-theme-text-muted">
                                Beta {sec.sectorInfo.beta}
                              </span>
                            </div>
                            <p className="text-[11px] text-theme-text-muted truncate mt-0.5">
                              {sec.sectorInfo.description}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <div className="font-black text-theme-text-heading text-sm">
                            ${sec.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-xs font-bold text-indigo-400 ml-1.5">
                              ({sec.weight.toFixed(1)}%)
                            </span>
                          </div>
                          <div
                            className={`text-xs font-bold mt-0.5 ${
                              isSecProfit
                                ? isUpRed ? "text-rose-500" : "text-emerald-400"
                                : isUpRed ? "text-emerald-400" : "text-rose-500"
                            }`}
                          >
                            {isSecProfit ? "+" : ""}${sec.pnl.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Chips of symbols in this sector */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-theme-border/40">
                        <span className="text-[10px] text-theme-text-muted font-mono">标的资产:</span>
                        {sec.positions.map((pos: any) => (
                          <button
                            key={pos.symbol}
                            onClick={() => onSelect(pos.symbol)}
                            className="px-2 py-0.5 rounded-md bg-theme-bg hover:bg-indigo-500/20 text-theme-text-primary hover:text-indigo-400 text-[10px] font-mono font-bold border border-theme-border transition-colors cursor-pointer"
                          >
                            {pos.symbol} ({pos.weight.toFixed(1)}%)
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 3: SECTOR CORRELATION HEATMAP MATRIX (🔥 NEW DATA VISUALIZATION) */}
      {viewMode === "correlation" && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Explanation Banner */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 shrink-0 mt-0.5">
                <Flame size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-theme-text-heading">
                  跨行业板块相关性热力矩阵 (Sector Correlation Matrix)
                </h4>
                <p className="text-xs text-theme-text-muted leading-relaxed max-w-3xl">
                  相关系数 ($r \in [-1.0, +1.0]$) 衡量不同板块之间的走势同步性。
                  <b className="text-rose-400"> 强正相关 ($r \ge 0.70$)</b> 意味着两板块易受宏观利率或流动性共振而同涨同跌；
                  <b className="text-emerald-400"> 低相关/弱相关 ($r \le 0.30$)</b> 能为投资组合提供天然的波动对冲与避震效应。
                </p>
              </div>
            </div>

            {/* Color Legend */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap text-[10px] font-bold">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-md bg-rose-600 inline-block" />
                <span>强相关 (≥0.8)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-md bg-amber-600 inline-block" />
                <span>中相关 (0.7)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block" />
                <span>一般 (0.5)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" />
                <span>避震/低相关 (≤0.3)</span>
              </div>
            </div>
          </div>

          {/* Interactive Matrix Grid */}
          <div className="bg-theme-panel/40 border border-theme-border rounded-2xl p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[620px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-[11px] font-bold text-theme-text-muted border-b border-theme-border">
                      行业板块 (权重)
                    </th>
                    {sectorList.map((col) => (
                      <th
                        key={col.id}
                        className="p-2 text-center text-[10px] sm:text-[11px] font-bold font-mono text-theme-text-heading border-b border-theme-border"
                      >
                        <div className="truncate max-w-[90px] mx-auto" title={col.sectorInfo.name}>
                          {col.sectorInfo.name}
                        </div>
                        <div className="text-[9px] text-indigo-400 font-normal">
                          {col.weight.toFixed(1)}%
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectorList.map((row) => (
                    <tr key={row.id} className="border-b border-theme-border/40 hover:bg-theme-bg-hover/40 transition-colors">
                      <td className="p-2.5 text-xs font-bold text-theme-text-heading whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.sectorInfo.color }}
                          />
                          <span className="truncate max-w-[120px]">{row.sectorInfo.name}</span>
                          <span className="text-[10px] text-theme-text-muted font-mono">
                            ({row.weight.toFixed(1)}%)
                          </span>
                        </div>
                      </td>

                      {sectorList.map((col) => {
                        const corr =
                          row.id === col.id
                            ? 1.0
                            : INTER_SECTOR_CORRELATIONS[row.id]?.[col.id] ??
                              INTER_SECTOR_CORRELATIONS[col.id]?.[row.id] ??
                              0.5;
                        const isSelf = row.id === col.id;
                        const cellColor = isSelf
                          ? "bg-slate-700/40 text-slate-400 font-mono"
                          : getCorrelationColor(corr);

                        return (
                          <td
                            key={col.id}
                            onMouseEnter={() =>
                              setHoveredCorrelation({
                                s1: row.sectorInfo,
                                s2: col.sectorInfo,
                                correlation: corr
                              })
                            }
                            onMouseLeave={() => setHoveredCorrelation(null)}
                            className="p-1.5 text-center"
                          >
                            <div
                              className={`py-2 px-1 rounded-xl text-[11px] font-mono transition-all duration-200 cursor-pointer shadow-2xs hover:scale-105 hover:ring-2 hover:ring-white/40 ${cellColor}`}
                            >
                              {corr.toFixed(2)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Hover Insight Box or High Correlation Alert */}
          <div className="p-4 sm:p-5 rounded-2xl bg-theme-panel border border-theme-border">
            {hoveredCorrelation ? (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-theme-text-heading">
                      【{hoveredCorrelation.s1.name}】 vs 【{hoveredCorrelation.s2.name}】
                    </span>
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
                      r = {hoveredCorrelation.correlation.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-theme-text-muted">
                    {getCorrelationDescription(hoveredCorrelation.correlation).label}
                  </span>
                </div>
                <p className="text-xs text-theme-text-muted leading-relaxed">
                  {hoveredCorrelation.correlation >= 0.75
                    ? `⚠️ 风险提示：两个板块同属于高 Beta 成长/周期赛道，在宏观通胀、降息预期波动或科技股抛售潮中，二者往往表现出高度同向波动，无法起到分散组合回撤的作用。`
                    : hoveredCorrelation.correlation <= 0.35
                    ? `🛡️ 防御价值：两板块逻辑分歧较大（如科技 vs 消费/金融），具备天然的跨周期对冲能力，是平滑投资组合 Sharpe 比率的理想搭配。`
                    : `⚖️ 适度关联：两板块在日常行情中走势相对独立，但在极端系统性风险爆发时仍有适度联动。`}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <Activity size={16} className="text-indigo-400" />
                  <span className="text-xs font-bold text-theme-text-heading">
                    移动鼠标悬浮在上方热力图单元格上，可即时查看任意两板块的联动系数与实战对冲分析
                  </span>
                </div>
                <span className="text-[11px] text-theme-text-muted font-mono">
                  高相关对数：{highCorrelationPairs.length} 组
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW TAB 4: CONCENTRATION & DIVERSIFICATION DIAGNOSTIC */}
      {viewMode === "concentration" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* HHI & Concentration Card */}
            <div className="p-5 rounded-2xl bg-theme-panel border border-theme-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className={concentrationRating.color} />
                  <h4 className="font-bold text-sm text-theme-text-heading">
                    赫芬达尔-赫希曼集中度指数 (HHI)
                  </h4>
                </div>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${concentrationRating.badge}`}>
                  {concentrationRating.level}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-theme-text-muted">当前组合 HHI 得分:</span>
                  <span className={`font-black text-sm ${concentrationRating.color}`}>{hhiScore} 点</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      hhiScore > 3500 ? "bg-rose-500" : hhiScore > 1800 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, (hhiScore / 7000) * 100))}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-theme-text-muted font-mono pt-1">
                  <span>0 (完全分散)</span>
                  <span>1,800 (适度集中阈值)</span>
                  <span>3,500 (过度集中红线)</span>
                  <span>10,000</span>
                </div>
              </div>

              <p className="text-xs text-theme-text-muted leading-relaxed">
                {concentrationRating.desc}
              </p>
            </div>

            {/* High Correlation Alert & Mitigation Recommendation */}
            <div className="p-5 rounded-2xl bg-theme-panel border border-theme-border space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h4 className="font-bold text-sm text-theme-text-heading">
                  AI 组合再平衡与对冲优化建议
                </h4>
              </div>

              {highCorrelationPairs.length > 0 ? (
                <div className="space-y-2.5 text-xs text-theme-text-muted">
                  <p className="leading-relaxed">
                    检测到您的组合在 <b className="text-theme-text-heading">{highCorrelationPairs[0].secA.name}</b> 与{" "}
                    <b className="text-theme-text-heading">{highCorrelationPairs[0].secB.name}</b> 之间存在高达{" "}
                    <span className="text-rose-400 font-mono font-bold">
                      {highCorrelationPairs[0].corr.toFixed(2)}
                    </span>{" "}
                    的正相关联动，两板块合计占比达{" "}
                    <span className="text-indigo-400 font-mono font-bold">
                      {highCorrelationPairs[0].combinedWeight.toFixed(1)}%
                    </span>
                    。
                  </p>
                  <div className="p-3 rounded-xl bg-theme-bg border border-theme-border space-y-1.5">
                    <div className="font-bold text-theme-text-heading flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>推荐优化对策：</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-theme-text-muted leading-normal">
                      <li>适度将部分盈利仓位再平衡至低相关资产（如高股息消费、核心金融或医疗健康）；</li>
                      <li>单一成长板块仓位上限建议严格控制在 35% 以内，预留 10%~15% 现金流以备回调加仓。</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-theme-text-muted">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 size={16} />
                    <span>组合分散度良好，未发现严重高相关扎堆风险！</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    您的持仓在各行业赛道间分布较为独立，对冲效益良好。继续保持纪律性网格调仓与移动止盈策略即可。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
