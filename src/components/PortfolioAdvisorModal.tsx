import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Bot,
  Sparkles,
  PieChart,
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  FileText
} from "lucide-react";
import Markdown from "react-markdown";
import { Position, Stock } from "../types";
import { fetchPortfolioDiagnostic } from "../utils/stockApi";

interface PortfolioAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  positions: Position[];
  stocks: Stock[];
  customApiKey?: string;
  isUpRed?: boolean;
}

export const PortfolioAdvisorModal: React.FC<PortfolioAdvisorModalProps> = ({
  isOpen,
  onClose,
  positions,
  stocks,
  customApiKey,
  isUpRed = false
}) => {
  const [loading, setLoading] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Sector calculation
  const totalCost = positions.reduce((acc, p) => acc + p.buyPrice * p.quantity, 0);
  const totalValue = positions.reduce((acc, p) => acc + p.currentPrice * p.quantity, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const isProfit = totalPnL >= 0;

  // Group by sector
  const sectorMap: Record<string, { value: number; cost: number; pnl: number; count: number; symbols: string[] }> = {};
  
  const STOCK_SECTORS: Record<string, string> = {
    AAPL: "消费电子与核心科技",
    NVDA: "半导体与AI算力硬件",
    TSLA: "智能汽车与清洁能源",
    MSFT: "企业级软件与云计算",
    GOOGL: "互联网与数字广告",
    AMZN: "电子商务与云计算",
    META: "社交网络与AI赋能",
    AMD: "半导体芯片与硬件",
    "700.HK": "互联网科技与文娱",
    "9988.HK": "电子商务与阿里云",
    "3690.HK": "本地生活与即时零售",
    "600519.SS": "高端白酒与核心消费",
    "601318.SS": "综合金融与保险大健康",
    "300750.SZ": "动力电池与储能系统",
    "002594.SZ": "新能源汽车与电池",
    "600036.SS": "商业银行与财富管理"
  };

  positions.forEach((p) => {
    const sector = STOCK_SECTORS[p.symbol.toUpperCase()] || "多元综合赛道";
    const posVal = p.currentPrice * p.quantity;
    const posCost = p.buyPrice * p.quantity;
    if (!sectorMap[sector]) {
      sectorMap[sector] = { value: 0, cost: 0, pnl: 0, count: 0, symbols: [] };
    }
    sectorMap[sector].value += posVal;
    sectorMap[sector].cost += posCost;
    sectorMap[sector].pnl += posVal - posCost;
    sectorMap[sector].count += 1;
    sectorMap[sector].symbols.push(p.symbol);
  });

  const sectorList = Object.entries(sectorMap).map(([name, data]) => ({
    name,
    ...data,
    weight: totalValue > 0 ? (data.value / totalValue) * 100 : 0
  })).sort((a, b) => b.weight - a.weight);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await fetchPortfolioDiagnostic({
        positions,
        stocks,
        thinkingMode,
        customApiKey
      });
      setDiagnosticReport(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostic();
    }
  }, [isOpen, thinkingMode]);

  const handleCopy = () => {
    if (!diagnosticReport) return;
    navigator.clipboard.writeText(diagnosticReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      id="portfolio-advisor-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-theme-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-theme-border flex items-center justify-between bg-theme-panel shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-theme-text-heading">
                  AI 持仓与板块综合诊断顾问
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Portfolio & Sector Advisory
                </span>
              </div>
              <p className="text-xs text-theme-text-muted mt-0.5">
                结合宏观利率周期、7x24 动态舆情与持仓集中度，为您提供专业的个股点位与调仓研判
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setThinkingMode(!thinkingMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                thinkingMode
                  ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                  : "bg-theme-panel hover:bg-theme-bg-hover text-theme-text-muted border-theme-border"
              }`}
              title="切换至 Gemini 深度思考推理模式"
            >
              <BrainCircuit size={14} className={thinkingMode ? "text-purple-400 animate-pulse" : ""} />
              <span className="hidden sm:inline">深度思考</span>
            </button>

            <button
              onClick={runDiagnostic}
              disabled={loading}
              className="p-2 rounded-xl bg-theme-panel hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-heading border border-theme-border transition-colors cursor-pointer"
              title="重新生成诊断研报"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-indigo-400" : ""} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TOP METRICS & SECTOR EXPOSURE BAR */}
        <div className="p-4 sm:p-5 bg-theme-panel/40 border-b border-theme-border shrink-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-theme-panel border border-theme-border">
              <span className="text-[10px] text-theme-text-muted font-bold uppercase">账户总持仓市值</span>
              <p className="text-base sm:text-lg font-black font-mono text-theme-text-heading mt-0.5">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-theme-panel border border-theme-border">
              <span className="text-[10px] text-theme-text-muted font-bold uppercase">总持仓本金成本</span>
              <p className="text-base sm:text-lg font-black font-mono text-theme-text-muted mt-0.5">
                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-theme-panel border border-theme-border">
              <span className="text-[10px] text-theme-text-muted font-bold uppercase">累计浮动盈亏</span>
              <div className={`flex items-baseline gap-1.5 mt-0.5 font-mono ${
                isProfit
                  ? isUpRed ? "text-rose-500" : "text-emerald-400"
                  : isUpRed ? "text-emerald-400" : "text-rose-500"
              }`}>
                <span className="text-base sm:text-lg font-black">
                  {isProfit ? "+" : ""}${totalPnL.toFixed(2)}
                </span>
                <span className="text-xs font-bold">
                  ({isProfit ? "+" : ""}{totalPnLPercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-theme-panel border border-theme-border">
              <span className="text-[10px] text-theme-text-muted font-bold uppercase">持仓股票 / 板块数</span>
              <p className="text-base sm:text-lg font-black font-mono text-indigo-400 mt-0.5">
                {positions.length} 只标的 / {sectorList.length} 个行业
              </p>
            </div>
          </div>

          {/* Sector Exposure Heat Chips */}
          {sectorList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-theme-text-muted flex items-center gap-1.5">
                  <PieChart size={13} className="text-indigo-400" />
                  <span>当前持仓板块分布与风险暴露权重：</span>
                </span>
                <span className="text-[10px] text-theme-text-muted">
                  最大权重赛道：<b className="text-indigo-400">{sectorList[0]?.name} ({sectorList[0]?.weight.toFixed(1)}%)</b>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {sectorList.map((sec, idx) => {
                  const isSecProf = sec.pnl >= 0;
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-theme-panel border border-theme-border flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-theme-text-heading truncate">{sec.name}</div>
                        <div className="text-[10px] text-theme-text-muted font-mono truncate">
                          [{sec.symbols.join(", ")}] · {sec.count} 标的
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="font-black text-indigo-400">{sec.weight.toFixed(1)}%</div>
                        <div className={`text-[10px] font-bold ${
                          isSecProf
                            ? isUpRed ? "text-rose-500" : "text-emerald-400"
                            : isUpRed ? "text-emerald-400" : "text-rose-500"
                        }`}>
                          {isSecProf ? "+" : ""}${sec.pnl.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* MODAL BODY / MARKDOWN REPORT */}
        <div className="flex-1 p-5 sm:p-7 overflow-y-auto space-y-6 scrollbar-thin">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Bot size={24} className="absolute inset-0 m-auto text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-theme-text-heading">
                  AI 量化与持仓风控大脑正在深度推演中...
                </h3>
                <p className="text-xs text-theme-text-muted mt-1 max-w-md">
                  正在实时解析您的各板块持仓均价、日内成交量能、7x24 动态舆情与宏观利率风险敞口
                </p>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-theme-text-primary text-sm leading-relaxed space-y-4">
              <Markdown>{diagnosticReport}</Markdown>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-theme-border bg-theme-panel/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-theme-text-muted">
            <Sparkles size={14} className="text-indigo-400" />
            <span>智能风控提示：建议依据关键点位执行阶梯式止盈与止损，切忌追涨杀跌。</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              disabled={loading || !diagnosticReport}
              className="px-4 py-2 rounded-xl bg-theme-panel hover:bg-theme-bg-hover border border-theme-border text-xs font-bold text-theme-text-primary transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "已复制研报" : "复制诊断报告"}</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
