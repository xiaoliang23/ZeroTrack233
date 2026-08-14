import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Building2,
  PieChart,
  Compass,
  Newspaper,
  Calendar,
  ExternalLink,
  Search,
  Loader2,
  DollarSign,
  Briefcase,
  Layers,
  BarChart3,
  ShieldCheck,
  Zap,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Bot,
  Sparkles,
  BrainCircuit,
  Copy,
  Check
} from "lucide-react";
import Markdown from "react-markdown";
import { Stock, CompanyFinancials, Superinvestor, MacroMarketData, NewsItem } from "../types";
import {
  fetchCompanyFinancials,
  fetchSuperinvestors,
  fetchMacroMarketData,
  fetchCategorizedNews,
  fetchSentimentAnalysis
} from "../utils/stockApi";

interface MarketIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStock?: Stock | null;
  allStocks?: Stock[];
  isUpRed?: boolean;
}

type TabType = "financials" | "superinvestors" | "macro" | "news";

export const MarketIntelligenceModal: React.FC<MarketIntelligenceModalProps> = ({
  isOpen,
  onClose,
  initialStock,
  allStocks = [],
  isUpRed = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("financials");
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    initialStock?.symbol || (allStocks[0]?.symbol || "AAPL")
  );

  // Financials State
  const [financials, setFinancials] = useState<CompanyFinancials | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [financialSearch, setFinancialSearch] = useState("");

  // Superinvestors State
  const [superinvestors, setSuperinvestors] = useState<Superinvestor[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>("buffett");
  const [loadingInvestors, setLoadingInvestors] = useState(false);

  // Macro State
  const [macroData, setMacroData] = useState<MacroMarketData | null>(null);
  const [loadingMacro, setLoadingMacro] = useState(false);

  // News State
  const [newsCategory, setNewsCategory] = useState<string>("ALL");
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [activeArticle, setActiveArticle] = useState<NewsItem | null>(null);

  // AI Dynamic Sentiment State
  const [sentimentAnalysis, setSentimentAnalysis] = useState<string>("");
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [copiedSentiment, setCopiedSentiment] = useState(false);
  const [analyzedArticleId, setAnalyzedArticleId] = useState<string | null>(null);

  const handleAnalyzeArticleSentiment = async (article: NewsItem) => {
    setLoadingSentiment(true);
    setAnalyzedArticleId(article.id || article.title);
    try {
      const res = await fetchSentimentAnalysis({
        newsItem: article,
        symbol: selectedSymbol
      });
      setSentimentAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSentiment(false);
    }
  };

  const handleCopySentiment = () => {
    if (!sentimentAnalysis) return;
    navigator.clipboard.writeText(sentimentAnalysis);
    setCopiedSentiment(true);
    setTimeout(() => setCopiedSentiment(false), 2000);
  };

  // Update selected symbol if initialStock changes
  useEffect(() => {
    if (initialStock?.symbol) {
      setSelectedSymbol(initialStock.symbol);
    }
  }, [initialStock]);

  // Load Financials when selected symbol changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadFin = async () => {
      setLoadingFinancials(true);
      try {
        const data = await fetchCompanyFinancials(selectedSymbol);
        if (isMounted) setFinancials(data);
      } catch (err) {
        console.warn("Financials fetch error:", err);
      } finally {
        if (isMounted) setLoadingFinancials(false);
      }
    };
    loadFin();
    return () => {
      isMounted = false;
    };
  }, [selectedSymbol, isOpen]);

  // Load Superinvestors
  useEffect(() => {
    if (!isOpen || superinvestors.length > 0) return;
    let isMounted = true;
    const loadWhales = async () => {
      setLoadingInvestors(true);
      try {
        const data = await fetchSuperinvestors();
        if (isMounted && data && data.length > 0) {
          setSuperinvestors(data);
          if (!selectedInvestorId && data[0]?.id) {
            setSelectedInvestorId(data[0].id);
          }
        }
      } catch (err) {
        console.warn("Superinvestor fetch error:", err);
      } finally {
        if (isMounted) setLoadingInvestors(false);
      }
    };
    loadWhales();
    return () => {
      isMounted = false;
    };
  }, [isOpen, superinvestors.length, selectedInvestorId]);

  // Load Macro Data
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadMacro = async () => {
      setLoadingMacro(true);
      try {
        const data = await fetchMacroMarketData();
        if (isMounted) setMacroData(data);
      } catch (err) {
        console.warn("Macro fetch error:", err);
      } finally {
        if (isMounted) setLoadingMacro(false);
      }
    };
    loadMacro();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Load News when category changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadNews = async () => {
      setLoadingNews(true);
      try {
        const data = await fetchCategorizedNews(newsCategory);
        if (isMounted) setNewsList(data);
      } catch (err) {
        console.warn("News fetch error:", err);
      } finally {
        if (isMounted) setLoadingNews(false);
      }
    };
    loadNews();
    return () => {
      isMounted = false;
    };
  }, [newsCategory, isOpen]);

  if (!isOpen) return null;

  const currentInvestor = superinvestors.find((i) => i.id === selectedInvestorId) || superinvestors[0];

  const filteredSymbolList = allStocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(financialSearch.toLowerCase()) ||
      s.name.toLowerCase().includes(financialSearch.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-theme-card border border-theme-border rounded-3xl w-full max-w-5xl h-[90vh] max-h-[860px] overflow-hidden flex flex-col shadow-2xl relative text-theme-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-theme-border bg-theme-panel/80 backdrop-blur-sm gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 flex items-center justify-center shrink-0">
              <Compass size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-theme-text-heading tracking-tight">
                  全维投研与市场情报中心
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Pro Intelligence
                </span>
              </div>
              <p className="text-[11px] text-theme-text-muted mt-0.5">
                实时财报基本面 • 华尔街机构持仓 • 宏观量化罗盘 • 7x24 全球情报
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Live Macro Quick Pill */}
            {macroData?.fearAndGreed && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-theme-panel border border-theme-border text-xs font-mono">
                <Flame size={13} className="text-amber-500 animate-pulse" />
                <span className="text-theme-text-muted text-[11px]">恐贪指数:</span>
                <span className="font-bold text-amber-500">{macroData.fearAndGreed.score}</span>
                <span className="text-[10px] text-theme-text-muted">({macroData.fearAndGreed.rating})</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover transition-colors cursor-pointer"
              title="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center px-4 sm:px-6 border-b border-theme-border bg-theme-panel/40 overflow-x-auto scrollbar-none gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("financials")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "financials"
                ? "border-indigo-500 text-indigo-400 font-black"
                : "border-transparent text-theme-text-muted hover:text-theme-text-primary"
            }`}
          >
            <BarChart3 size={15} />
            <span>核心财报与估值雷达</span>
          </button>

          <button
            onClick={() => setActiveTab("superinvestors")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "superinvestors"
                ? "border-indigo-500 text-indigo-400 font-black"
                : "border-transparent text-theme-text-muted hover:text-theme-text-primary"
            }`}
          >
            <Building2 size={15} />
            <span>顶级投资大佬持仓 (13F)</span>
          </button>

          <button
            onClick={() => setActiveTab("macro")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "macro"
                ? "border-indigo-500 text-indigo-400 font-black"
                : "border-transparent text-theme-text-muted hover:text-theme-text-primary"
            }`}
          >
            <Compass size={15} />
            <span>宏观罗盘与量化做市</span>
          </button>

          <button
            onClick={() => setActiveTab("news")}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === "news"
                ? "border-indigo-500 text-indigo-400 font-black"
                : "border-transparent text-theme-text-muted hover:text-theme-text-primary"
            }`}
          >
            <Newspaper size={15} />
            <span>7x24 全球情报研报流</span>
          </button>
        </div>

        {/* BODY CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
          {/* TAB 1: FINANCIALS & EARNINGS */}
          {activeTab === "financials" && (
            <div className="space-y-6 animate-fade-in">
              {/* Top Stock Selector Pill Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-theme-panel/70 p-3 rounded-2xl border border-theme-border">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                  <span className="text-[11px] font-bold text-theme-text-muted whitespace-nowrap uppercase tracking-wider pl-1">
                    快速切换标的:
                  </span>
                  {["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "700.HK", "600519.SS"].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => setSelectedSymbol(sym)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono transition-all shrink-0 cursor-pointer ${
                        selectedSymbol.toUpperCase() === sym
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-theme-card hover:bg-theme-bg-hover text-theme-text-primary border border-theme-border"
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {/* Custom Search in Financials */}
                <div className="relative min-w-[180px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                  <input
                    type="text"
                    value={financialSearch}
                    onChange={(e) => setFinancialSearch(e.target.value)}
                    placeholder="输入代码 (如 AMZN)..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && financialSearch.trim()) {
                        setSelectedSymbol(financialSearch.trim().toUpperCase());
                        setFinancialSearch("");
                      }
                    }}
                    className="w-full pl-8 pr-3 py-1.5 bg-theme-card border border-theme-border rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {loadingFinancials ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-xs text-theme-text-muted">正在加载 {selectedSymbol} 财务与基本面深度数据...</p>
                </div>
              ) : financials ? (
                <div className="space-y-6">
                  {/* Stock Header & Highlights */}
                  <div className="bg-gradient-to-r from-indigo-900/20 via-theme-panel to-theme-panel p-5 rounded-2xl border border-indigo-500/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-theme-text-heading font-mono">
                          {financials.symbol}
                        </span>
                        <span className="text-sm text-theme-text-muted font-bold font-sans">
                          {financials.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-mono font-bold">
                          市值: ${financials.marketCap}B
                        </span>
                      </div>
                      {financials.earningsCallHighlight && (
                        <p className="text-xs text-theme-text-primary/90 mt-2 leading-relaxed bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                          <span className="font-bold text-indigo-400 mr-1">📌 财报与业绩看点：</span>
                          {financials.earningsCallHighlight}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0 bg-theme-card/80 p-3 rounded-xl border border-theme-border">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-theme-text-muted uppercase font-bold">下次财报披露</p>
                          <p className="text-xs font-black text-theme-text-heading font-mono mt-0.5">
                            {financials.nextEarningsDate}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 10 Core Financial Metric Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">市盈率 (P/E TTM)</p>
                      <p className="text-lg font-black font-mono text-theme-text-heading mt-1">{financials.peRatio}x</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">远期PE: {financials.forwardPE}x</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">每股收益 (EPS TTM)</p>
                      <p className="text-lg font-black font-mono text-indigo-400 mt-1">${financials.epsTTM}</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">市净率 P/B: {financials.pbRatio}x</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">年度总营收 (TTM)</p>
                      <p className="text-lg font-black font-mono text-theme-text-heading mt-1">${financials.revenueTTM}B</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${financials.revenueGrowthYoY >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        同比增速: {financials.revenueGrowthYoY > 0 ? "+" : ""}{financials.revenueGrowthYoY}%
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">净利润 (Net Income)</p>
                      <p className="text-lg font-black font-mono text-emerald-400 mt-1">${financials.netIncomeTTM}B</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">净利率: {financials.netMargin}%</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">毛利率 (Gross Margin)</p>
                      <p className="text-lg font-black font-mono text-theme-text-heading mt-1">{financials.grossMargin}%</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">营业利润率: {financials.operatingMargin}%</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">自由现金流 (FCF)</p>
                      <p className="text-lg font-black font-mono text-indigo-400 mt-1">${financials.freeCashFlow}B</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">造血与分红底气充足</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">股息率 (Dividend Yield)</p>
                      <p className="text-lg font-black font-mono text-theme-text-heading mt-1">{financials.dividendYield}%</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">稳健现金分红</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">资产负债率 (Debt/Eq)</p>
                      <p className="text-lg font-black font-mono text-theme-text-heading mt-1">{financials.debtToEquity}</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">偿债与财务健康度</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">市销率 (P/S Ratio)</p>
                      <p className="text-lg font-black font-mono text-theme-text-heading mt-1">{financials.psRatio}x</p>
                      <p className="text-[10px] text-theme-text-muted mt-0.5">收入估值倍数</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-theme-panel border border-theme-border flex flex-col justify-between">
                      <p className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">官方研报通道</p>
                      <a
                        href={`https://finance.yahoo.com/quote/${financials.symbol}/financials`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between text-xs text-indigo-400 font-bold hover:underline cursor-pointer pt-2"
                      >
                        <span>查看完整三张表</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Quarterly History Table */}
                  <div className="bg-theme-panel rounded-2xl border border-theme-border p-4 sm:p-5">
                    <h3 className="text-xs font-black text-theme-text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Layers size={14} className="text-indigo-400" />
                      <span>过去 4 个季度单季财务数据与表现 (Quarterly Trend)</span>
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-theme-border/60 text-[10px] uppercase tracking-wider text-theme-text-muted">
                            <th className="pb-2.5 font-bold">财报季度</th>
                            <th className="pb-2.5 font-bold text-right">单季营收 (USD)</th>
                            <th className="pb-2.5 font-bold text-right">净利润 (USD)</th>
                            <th className="pb-2.5 font-bold text-right">每股收益 EPS</th>
                            <th className="pb-2.5 font-bold text-right">毛利率</th>
                            <th className="pb-2.5 font-bold text-right">经营现金流</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-border/40 font-mono">
                          {financials.quarterlyHistory.map((q, idx) => (
                            <tr key={idx} className="hover:bg-theme-bg-hover transition-colors">
                              <td className="py-3 font-bold text-theme-text-heading">{q.period}</td>
                              <td className="py-3 text-right font-black">${q.revenue}B</td>
                              <td className="py-3 text-right text-emerald-400 font-black">${q.netIncome}B</td>
                              <td className="py-3 text-right text-indigo-400 font-bold">${q.eps}</td>
                              <td className="py-3 text-right">{q.grossMargin}%</td>
                              <td className="py-3 text-right text-theme-text-muted">${q.operatingCashFlow}B</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: SUPERINVESTORS & 13F HOLDINGS */}
          {activeTab === "superinvestors" && (
            <div className="space-y-6 animate-fade-in">
              {/* Investor Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {superinvestors.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvestorId(inv.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                      selectedInvestorId === inv.id
                        ? "bg-indigo-600/15 border-indigo-500 shadow-md ring-1 ring-indigo-500/30"
                        : "bg-theme-panel border-theme-border hover:bg-theme-bg-hover"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-theme-border">
                      <img src={inv.avatar} alt={inv.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-theme-text-heading truncate">{inv.name.split(" ")[0]}</h4>
                      <p className="text-[10px] text-theme-text-muted truncate">{inv.fundName.split(" ")[0]}</p>
                    </div>
                  </div>
                ))}
              </div>

              {currentInvestor && (
                <div className="space-y-5">
                  {/* Fund Profile Card */}
                  <div className="bg-theme-panel p-5 rounded-2xl border border-theme-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-black text-theme-text-heading">
                          {currentInvestor.name}
                        </h3>
                        <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                          {currentInvestor.fundName}
                        </span>
                      </div>
                      <p className="text-xs text-theme-text-primary/90 leading-relaxed max-w-3xl">
                        <span className="font-bold text-indigo-400">💡 投资哲学与原则：</span> {currentInvestor.philosophy}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 bg-theme-card p-3 rounded-xl border border-theme-border shrink-0 font-mono">
                      <div>
                        <p className="text-[10px] text-theme-text-muted font-bold uppercase">美股市值规模</p>
                        <p className="text-base font-black text-theme-text-heading">${currentInvestor.portfolioValue}B</p>
                      </div>
                      <div className="h-8 w-px bg-theme-border" />
                      <div>
                        <p className="text-[10px] text-theme-text-muted font-bold uppercase">现金/短债储备</p>
                        <p className="text-base font-black text-amber-500">{currentInvestor.cashReservePercent}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent 13F Summary Banner */}
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 dark:text-indigo-200 leading-relaxed font-sans flex items-start gap-2.5">
                    <ShieldCheck size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-indigo-400 mb-0.5">
                        最新 SEC 13F 季度申报调仓解读 ({currentInvestor.filingDate})：
                      </div>
                      {currentInvestor.recentMoveSummary}
                    </div>
                  </div>

                  {/* Top Holdings Table */}
                  <div className="bg-theme-panel rounded-2xl border border-theme-border p-4 sm:p-5">
                    <h4 className="text-xs font-black text-theme-text-heading uppercase tracking-wider mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PieChart size={14} className="text-indigo-400" />
                        <span>核心重仓股透视明细 (Top Portfolio Holdings)</span>
                      </div>
                      <span className="text-[10px] text-theme-text-muted lowercase font-normal">
                        来源: SEC Form 13-F
                      </span>
                    </h4>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-theme-border/60 text-[10px] uppercase tracking-wider text-theme-text-muted">
                            <th className="pb-2.5 font-bold">标的代码</th>
                            <th className="pb-2.5 font-bold">公司名称</th>
                            <th className="pb-2.5 font-bold text-right">持仓权重</th>
                            <th className="pb-2.5 font-bold text-right">持股市值</th>
                            <th className="pb-2.5 font-bold text-right">持股股数</th>
                            <th className="pb-2.5 font-bold text-right">季度操作</th>
                            <th className="pb-2.5 font-bold text-right">变动幅度</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme-border/40 font-mono">
                          {currentInvestor.topHoldings.map((h, idx) => (
                            <tr key={idx} className="hover:bg-theme-bg-hover transition-colors">
                              <td className="py-3 font-bold text-theme-text-heading font-mono flex items-center gap-1.5">
                                <span>{h.symbol}</span>
                              </td>
                              <td className="py-3 text-theme-text-primary font-sans font-medium">{h.name}</td>
                              <td className="py-3 text-right font-black text-indigo-400">
                                {h.weight.toFixed(1)}%
                              </td>
                              <td className="py-3 text-right text-theme-text-heading font-black">
                                ${h.valueUsd >= 1 ? `${h.valueUsd.toFixed(2)}B` : `${(h.valueUsd * 1000).toFixed(0)}M`}
                              </td>
                              <td className="py-3 text-right text-theme-text-muted">{h.shares}M 股</td>
                              <td className="py-3 text-right">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                                    h.action === "BUY" || h.action === "ADD"
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                      : h.action === "REDUCE" || h.action === "SELL"
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                      : "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                                  }`}
                                >
                                  {h.action === "BUY"
                                    ? "新建仓"
                                    : h.action === "ADD"
                                    ? "增持"
                                    : h.action === "REDUCE"
                                    ? "减持"
                                    : "持平"}
                                </span>
                              </td>
                              <td className="py-3 text-right font-bold">
                                {h.changePercent ? (
                                  <span className={h.changePercent > 0 ? "text-emerald-400" : "text-rose-400"}>
                                    {h.changePercent > 0 ? `+${h.changePercent}%` : `${h.changePercent}%`}
                                  </span>
                                ) : (
                                  <span className="text-theme-text-muted">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MACRO COMPASS & QUANT DATA */}
          {activeTab === "macro" && (
            <div className="space-y-6 animate-fade-in">
              {loadingMacro ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-xs text-theme-text-muted">正在同步宏观量化做市与大盘指标...</p>
                </div>
              ) : macroData ? (
                <div className="space-y-6">
                  {/* Top Row: Fear & Greed + Market Breadth */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* CNN Fear & Greed Gauge Card (col-span-12 md:col-span-7) */}
                    <div className="md:col-span-7 bg-theme-panel p-5 rounded-2xl border border-theme-border flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flame size={18} className="text-amber-500" />
                          <h4 className="text-xs font-black text-theme-text-heading uppercase tracking-wider">
                            CNN 恐惧与贪婪指数 (Fear & Greed Index)
                          </h4>
                        </div>
                        <span className="text-[10px] text-theme-text-muted font-mono">实时情绪量化</span>
                      </div>

                      <div className="my-5 flex flex-col items-center justify-center">
                        <div className="text-4xl sm:text-5xl font-black font-mono text-amber-500 tracking-tight">
                          {macroData.fearAndGreed.score}
                        </div>
                        <div className="text-sm font-bold text-theme-text-heading mt-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          当前情绪：{macroData.fearAndGreed.rating}
                        </div>

                        {/* Progress Bar Barometer */}
                        <div className="w-full max-w-md mt-4 space-y-1.5">
                          <div className="h-3 w-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 relative overflow-hidden p-0.5">
                            <div
                              className="h-full w-2 bg-white rounded-full shadow-lg absolute top-0 transition-all duration-500"
                              style={{ left: `calc(${macroData.fearAndGreed.score}% - 4px)` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-theme-text-muted font-bold px-0.5">
                            <span>0 极度恐慌</span>
                            <span>50 中性</span>
                            <span>100 极度贪婪</span>
                          </div>
                        </div>
                      </div>

                      {/* Historical Comparatives */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-theme-border/60 text-center font-mono">
                        <div className="p-2 rounded-xl bg-theme-card">
                          <p className="text-[9px] text-theme-text-muted uppercase">昨日前收</p>
                          <p className="text-xs font-bold text-theme-text-heading mt-0.5">{macroData.fearAndGreed.previousClose}</p>
                        </div>
                        <div className="p-2 rounded-xl bg-theme-card">
                          <p className="text-[9px] text-theme-text-muted uppercase">一周前</p>
                          <p className="text-xs font-bold text-theme-text-heading mt-0.5">{macroData.fearAndGreed.oneWeekAgo}</p>
                        </div>
                        <div className="p-2 rounded-xl bg-theme-card">
                          <p className="text-[9px] text-theme-text-muted uppercase">一月前</p>
                          <p className="text-xs font-bold text-theme-text-heading mt-0.5">{macroData.fearAndGreed.oneMonthAgo}</p>
                        </div>
                      </div>
                    </div>

                    {/* Market Breadth Card (col-span-12 md:col-span-5) */}
                    <div className="md:col-span-5 bg-theme-panel p-5 rounded-2xl border border-theme-border flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <Zap size={18} className="text-indigo-400" />
                        <h4 className="text-xs font-black text-theme-text-heading uppercase tracking-wider">
                          大盘多空广度 (Market Breadth)
                        </h4>
                      </div>

                      <div className="space-y-3 my-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-theme-card border border-theme-border">
                          <span className="text-xs text-theme-text-muted font-bold">全市场上涨标的</span>
                          <span className="text-xs font-black font-mono text-emerald-400">
                            {macroData.marketBreadth.advancingCount} 家 (65%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-theme-card border border-theme-border">
                          <span className="text-xs text-theme-text-muted font-bold">全市场下跌标的</span>
                          <span className="text-xs font-black font-mono text-rose-400">
                            {macroData.marketBreadth.decliningCount} 家 (35%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-theme-card border border-theme-border">
                          <span className="text-xs text-theme-text-muted font-bold">创 52 周新高标的</span>
                          <span className="text-xs font-black font-mono text-indigo-400">
                            {macroData.marketBreadth.newHighs52W} 家
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-theme-text-muted text-center pt-2 border-t border-theme-border/60">
                        做市资金流整体保持净流入，多头攻击意愿健康
                      </p>
                    </div>
                  </div>

                  {/* 5 Core Macro Benchmark Cards */}
                  <div>
                    <h4 className="text-xs font-black text-theme-text-heading uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Compass size={14} className="text-indigo-400" />
                      <span>全球大类资产与宏观无风险锚点 (Global Macro Benchmarks)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {macroData.indicators.map((ind, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-theme-panel border border-theme-border flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-theme-text-muted uppercase truncate">{ind.name}</p>
                            <div className="flex items-baseline gap-2 mt-1.5">
                              <span className="text-lg font-black font-mono text-theme-text-heading">
                                {ind.value.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-theme-text-muted font-mono">{ind.unit}</span>
                            </div>
                            <div className={`flex items-center gap-1 text-[11px] font-bold font-mono mt-1 ${ind.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {ind.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              <span>{ind.change > 0 ? `+${ind.change}` : ind.change}</span>
                              <span>({ind.changePercent > 0 ? `+${ind.changePercent}%` : `${ind.changePercent}%`})</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-theme-text-muted mt-3 pt-2 border-t border-theme-border/50 leading-relaxed">
                            {ind.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* S&P 500 Sector Heatmap Grid */}
                  <div className="bg-theme-panel p-5 rounded-2xl border border-theme-border">
                    <h4 className="text-xs font-black text-theme-text-heading uppercase tracking-wider mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 size={14} className="text-indigo-400" />
                        <span>标普500各大板块强弱热力榜 (Sector Performance)</span>
                      </div>
                      <span className="text-[10px] text-theme-text-muted">日内涨跌 / 近1月涨跌</span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                      {macroData.sectors.map((sec, idx) => {
                        const isPos = sec.change1D >= 0;
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                              isPos
                                ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                                : "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-theme-text-heading">{sec.name}</span>
                                <span className={`text-xs font-mono font-black ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isPos ? "+" : ""}{sec.change1D.toFixed(2)}%
                                </span>
                              </div>
                              <p className="text-[10px] text-theme-text-muted mt-0.5 truncate">{sec.nameEn}</p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-theme-border/40 text-[10px] flex items-center justify-between font-mono">
                              <span className="text-theme-text-muted">领涨: {sec.topStock}</span>
                              <span className={sec.change1M >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                1M: {sec.change1M > 0 ? "+" : ""}{sec.change1M}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 4: 7x24 REAL-TIME NEWS & RESEARCH */}
          {activeTab === "news" && (
            <div className="space-y-5 animate-fade-in">
              {/* Category Filter Tabs & AI Radar Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {[
                    { id: "ALL", label: "全部快讯" },
                    { id: "EARNINGS", label: "📊 财报与业绩" },
                    { id: "SUPERINVESTOR", label: "🐋 机构与巨鲸" },
                    { id: "MACRO", label: "🧭 宏观与利率" },
                    { id: "QUANT", label: "⚡ 量化与做市" }
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setNewsCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        newsCategory === c.id
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-theme-panel hover:bg-theme-bg-hover text-theme-text-muted border border-theme-border"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    const topNews: NewsItem = newsList[0] || {
                      id: "top-radar",
                      title: "全球宏观市场流动性与科技板块动态",
                      summary: "美联储降息预期升温，AI半导体与消费电子板块资金持续活跃。",
                      publisher: "AI 金融智库",
                      providerPublishTime: Math.floor(Date.now() / 1000),
                      link: "https://finance.yahoo.com",
                      sentiment: "bullish"
                    };
                    setActiveArticle(topNews);
                    handleAnalyzeArticleSentiment(topNews);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
                >
                  <Bot size={14} className="text-indigo-400" />
                  <span>🤖 AI 舆情风向与板块传导总揽</span>
                </button>
              </div>

              {loadingNews ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-xs text-theme-text-muted">正在同步 7x24 全球财经情报流...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {newsList.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setActiveArticle(item);
                        setSentimentAnalysis("");
                      }}
                      className="p-4 bg-theme-panel hover:bg-theme-bg-hover rounded-2xl border border-theme-border border-l-4 transition-all duration-200 group cursor-pointer shadow-xs hover:shadow flex flex-col justify-between"
                      style={{
                        borderLeftColor:
                          item.sentiment === "bullish"
                            ? "#10b981"
                            : item.sentiment === "bearish"
                            ? "#ef4444"
                            : "#6366f1"
                      }}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold leading-relaxed text-theme-text-primary group-hover:text-indigo-400 transition-colors">
                            {item.title}
                          </h4>
                          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-bold group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                            研报全文
                          </span>
                        </div>

                        {item.summary && (
                          <p className="text-[11px] text-theme-text-muted mt-2 line-clamp-3 leading-relaxed">
                            {item.summary}
                          </p>
                        )}
                      </div>

                      <div className="text-[10px] text-theme-text-muted mt-3 pt-2.5 border-t border-theme-border/50 font-mono flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-theme-text-primary">{item.publisher}</span>
                          <span>•</span>
                          <span>
                            {item.providerPublishTime
                              ? new Date(item.providerPublishTime * 1000).toLocaleTimeString("zh-CN", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : "刚刚"}
                          </span>
                          {item.sentiment && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-sans ${
                                item.sentiment === "bullish"
                                  ? "bg-emerald-500/10 text-emerald-400 font-bold"
                                  : item.sentiment === "bearish"
                                  ? "bg-rose-500/10 text-rose-400 font-bold"
                                  : "bg-slate-500/10 text-slate-400"
                              }`}
                            >
                              {item.sentiment === "bullish" ? "利多" : item.sentiment === "bearish" ? "利空" : "中性"}
                            </span>
                          )}
                        </div>

                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                          title="源站查看"
                        >
                          <span>源站</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* IN-MODAL ARTICLE READER & AI SENTIMENT ANALYSIS */}
        <AnimatePresence>
          {activeArticle && (
            <div
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
              onClick={() => setActiveArticle(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-theme-card border border-theme-border rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-theme-border bg-theme-panel shrink-0">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      {activeArticle.publisher}
                    </span>
                    <p className="text-[11px] text-theme-text-muted mt-0.5">
                      发布时间：
                      {activeArticle.providerPublishTime
                        ? new Date(activeArticle.providerPublishTime * 1000).toLocaleString("zh-CN")
                        : "刚刚"}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveArticle(null)}
                    className="p-2 rounded-xl text-theme-text-muted hover:text-theme-text-heading hover:bg-theme-bg-hover transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-theme-text-primary leading-relaxed text-sm scrollbar-thin">
                  <h3 className="text-base sm:text-lg font-black text-theme-text-heading leading-snug">
                    {activeArticle.title}
                  </h3>

                  {activeArticle.summary && (
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 dark:text-indigo-200 leading-relaxed font-sans">
                      <span className="font-bold text-indigo-400 block mb-1 text-xs">📌 核心要闻提要：</span>
                      {activeArticle.summary}
                    </div>
                  )}

                  <div className="whitespace-pre-line text-theme-text-primary/90 text-sm leading-relaxed">
                    {activeArticle.fullContent || activeArticle.summary}
                  </div>

                  {/* AI SENTIMENT & TRANSMISSION ANALYSIS SECTION */}
                  <div className="pt-3 border-t border-theme-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                          <Bot size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-theme-text-heading">
                            AI 舆情深度推演与板块传导剖析
                          </h4>
                          <p className="text-[10px] text-theme-text-muted">
                            深度研判核心逻辑、波及行业、暗藏隐患与持仓操作启示
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAnalyzeArticleSentiment(activeArticle)}
                        disabled={loadingSentiment}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        {loadingSentiment ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>AI 正在研判中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>{sentimentAnalysis ? "重新分析" : "开始 AI 深度推演"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {sentimentAnalysis && (
                      <div className="p-4 rounded-2xl bg-theme-panel border border-theme-border text-xs leading-relaxed space-y-3 animate-fade-in relative">
                        <button
                          onClick={handleCopySentiment}
                          className="absolute top-3 right-3 p-1.5 rounded-lg bg-theme-card hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-heading border border-theme-border text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                          title="复制分析内容"
                        >
                          {copiedSentiment ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{copiedSentiment ? "已复制" : "复制"}</span>
                        </button>
                        <div className="prose prose-invert max-w-none text-theme-text-primary text-xs leading-relaxed">
                          <Markdown>{sentimentAnalysis}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-theme-border bg-theme-panel/60 flex items-center justify-between gap-3 shrink-0">
                  <span className="text-xs text-theme-text-muted">权威金融数据源</span>
                  <a
                    href={activeArticle.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-theme-panel hover:bg-theme-bg-hover text-theme-text-heading border border-theme-border rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>在源站中查看原文</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
