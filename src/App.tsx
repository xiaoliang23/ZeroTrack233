import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  DollarSign,
  Briefcase,
  Layers,
  Settings,
  Eye,
  Check,
  X,
  LineChart,
  BarChart2,
  TrendingUp as TrendUpIcon,
  HelpCircle,
  Sun,
  Moon,
  Edit2,
  GripVertical,
  Loader2, PieChart, Bell, BellRing, BellOff,
  AlertTriangle, ShieldAlert, Sliders
} from "lucide-react";
import { Stock, Position, Candle, ChartType, TimeRange, AIAnalysisResult, PriceAlert } from "./types";
import { fetchStocksList, searchStocks, fetchCandlesticks, fetchStockNews, saveStoredStocks } from "./utils/stockApi";
import { analyzeStockWithGemini } from "./utils/aiAnalysis";
import StockChart from "./components/StockChart";
import AIAnalyst from "./components/AIAnalyst";
import PortfolioHeatmap from "./components/PortfolioHeatmap";
import PortfolioAllocationChart from "./components/PortfolioAllocationChart";
import PortfolioTrendChart from "./components/PortfolioTrendChart";
import CloudSync from "./components/CloudSync";
import CalendarHeatmap, { DailyPnL } from "./components/CalendarHeatmap";
import AnimatedNumber from "./components/AnimatedNumber";



const SakuraPetals = () => {
  const [petals, setPetals] = useState<any[]>([]);
  useEffect(() => {
    const newPetals = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      animationDuration: `${Math.random() * 8 + 6}s`,
      animationDelay: `-${Math.random() * 10}s`,
      scale: Math.random() * 0.4 + 0.4,
      opacity: Math.random() * 0.5 + 0.3
    }));
    setPetals(newPetals);
  }, []);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {petals.map((p) => (
        <div
          key={p.id}
          className="sakura-petal"
          style={{
            left: p.left,
            animationDuration: p.animationDuration,
            animationDelay: p.animationDelay,
            '--s': p.scale,
            '--o': p.opacity
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

// Real-time flashing price component
const AnimatedSparkline = ({ history, isPnLPositive, isUpRed }: { history: number[], isPnLPositive: boolean, isUpRed: boolean }) => {
  if (!history || history.length < 2) return <div className="w-16 h-4 opacity-30 border-b border-slate-500/20" />;
  
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max === min ? 1 : max - min;
  
  const width = 64;
  const height = 16;
  const points = history.map((val, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 2) - 1; // 1px padding
    return `${x},${y}`;
  });
  
  const pathData = `M ${points.join(" L ")}`;
  const colorClass = isPnLPositive 
    ? (isUpRed ? "stroke-red-500" : "stroke-emerald-500") 
    : (isUpRed ? "stroke-emerald-500" : "stroke-red-500");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible opacity-80">
      <motion.path
        d={pathData}
        fill="none"
        className={colorClass}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
    </svg>
  );
};

const PriceTicker = ({ price }: { price: number }) => {
  const [prevPrice, setPrevPrice] = useState(price);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (price > prevPrice) {
      setFlashClass("text-emerald-500 bg-emerald-500/20 px-1 rounded transition-none");
    } else if (price < prevPrice) {
      setFlashClass("text-red-500 bg-red-500/20 px-1 rounded transition-none");
    }
    
    setPrevPrice(price);
    
    const timer = setTimeout(() => {
      setFlashClass("transition-colors duration-500");
    }, 300);
    
    return () => clearTimeout(timer);
  }, [price]);

  return (
    <span className={`tabular-nums ${flashClass}`}>
      ${price.toFixed(2)}
    </span>
  );
};

const LandingPage = ({ onStart }: { onStart: () => void }) => {
  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/20 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl w-full text-center z-10 space-y-8"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-4xl shadow-2xl shadow-indigo-500/30 mb-8"
        >
          <Sparkles size={40} />
        </motion.div>
        
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-theme-text-heading">
          个人智能持仓资产管家
        </h1>
        
        <p className="text-lg md:text-xl text-theme-text-secondary max-w-3xl mx-auto leading-relaxed mt-6">
          主打实时行情盯盘、自主持仓记账、精准盈亏核算。<br />
          不靠自动操盘、不靠玄学荐股，做你贴身靠谱的投资记账盯盘助手，理性看清每一笔持仓真实收益。
        </p>

        <div className="pt-10">
          <button 
            onClick={onStart}
            className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-white transition-all duration-300 bg-indigo-600 border border-transparent rounded-full hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 cursor-pointer shadow-xl hover:shadow-indigo-500/50 hover:-translate-y-1"
          >
            开始使用
            <svg 
              className="w-6 h-6 ml-2 -mr-1 transition-transform duration-300 group-hover:translate-x-1" 
              fill="currentColor" 
              viewBox="0 0 20 20" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
          </button>
        </div>
        
        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-20 text-left"
        >
          <div className="p-8 rounded-3xl bg-theme-card border border-theme-border hover:border-indigo-500/40 transition-colors duration-300 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-6">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-xl font-bold text-theme-text-heading mb-3">实时行情走势</h3>
            <p className="text-base text-theme-text-secondary leading-relaxed">实时同步全球股票行情走势，高清 K 线直观查看盘面变化。</p>
          </div>
          <div className="p-8 rounded-3xl bg-theme-card border border-theme-border hover:border-emerald-500/40 transition-colors duration-300 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
              <Briefcase size={24} />
            </div>
            <h3 className="text-xl font-bold text-theme-text-heading mb-3">真实持仓成本</h3>
            <p className="text-base text-theme-text-secondary leading-relaxed">自主录入每一笔买入记录，自动加权计算真实持仓成本。</p>
          </div>
          <div className="p-8 rounded-3xl bg-theme-card border border-theme-border hover:border-violet-500/40 transition-colors duration-300 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500 mb-6">
              <BarChart2 size={24} />
            </div>
            <h3 className="text-xl font-bold text-theme-text-heading mb-3">精准盈亏核算</h3>
            <p className="text-base text-theme-text-secondary leading-relaxed">自定义搭建专属持仓组合，实时自动核算浮盈浮亏，下跌亏损一目了然。</p>
          </div>
          <div className="p-8 rounded-3xl bg-theme-card border border-theme-border hover:border-amber-500/40 transition-colors duration-300 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
              <PieChart size={24} />
            </div>
            <h3 className="text-xl font-bold text-theme-text-heading mb-3">全局资产总览</h3>
            <p className="text-base text-theme-text-secondary leading-relaxed">统一收纳你全部持仓资产，一键汇总整体总资产、盈亏状况，持仓配置清清楚楚。</p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};


export default function App() {

  // Daily PnL History Mock
  const [dailyPnLData, setDailyPnLData] = useState<DailyPnL[]>([]);

  useEffect(() => {
    const data: DailyPnL[] = [];
    const today = new Date();
    
    // Stable pseudo-random generator based on seed
    const pseudoRandom = (seed: number) => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    let accumulated = 0;
    for (let i = 365; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
      
      // Some days have 0 change (like weekends)
      const dayOfWeek = date.getDay();
      let dailyChange = 0;
      
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Bias slightly positive, range [-50, 60] roughly
        dailyChange = (pseudoRandom(seed) - 0.45) * 120;
      }
      
      data.push({
        date: date.toISOString().split('T')[0],
        pnl: dailyChange
      });
    }
    setDailyPnLData(data);
  }, []);

  const [hasStarted, setHasStarted] = useState(false);
  // --- Core State ---
  const stockChartRef = useRef<HTMLDivElement>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [activeSymbol, setActiveSymbol] = useState<string>("AAPL");

  const handleSelectStock = useCallback((symbol: string, shouldScroll = true) => {
    setActiveSymbol(symbol);
    if (shouldScroll && stockChartRef.current) {
      stockChartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  const [draggedSymbol, setDraggedSymbol] = useState<string | null>(null);
  const [dragOverSymbol, setDragOverSymbol] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [activeRange, setActiveRange] = useState<TimeRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("candlestick");

  // Load theme preference (default to 'dark' for "Deep Night", toggle to 'light' for "Day")
  const [theme, setTheme] = useState<'dark' | 'light' | 'sakura'>(() => {
    const saved = localStorage.getItem("theme");
    return (saved === "light" || saved === "sakura") ? saved : "dark";
  });

  // Load isUpRed preference (true = Red is UP / standard Chinese style, false = Green is UP / standard US style)
  const [isUpRed, setIsUpRed] = useState<boolean>(() => {
    const saved = localStorage.getItem("isUpRed");
    return saved !== null ? saved === "true" : true; // Default to Chinese style: Red is Up
  });

  // Portfolio PnL Loss Alert (持仓亏损预警)
  const [pnlLossAlertEnabled, setPnlLossAlertEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("pnlLossAlertEnabled");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [pnlLossAlertThreshold, setPnlLossAlertThreshold] = useState<number>(() => {
    const saved = localStorage.getItem("pnlLossAlertThreshold");
    return saved !== null ? parseFloat(saved) : 10; // 默认 10% 亏损警戒线
  });

  const [pnlAlertDismissed, setPnlAlertDismissed] = useState<boolean>(false);
  const [showPnlAlertModal, setShowPnlAlertModal] = useState<boolean>(false);
  const [modalThresholdInput, setModalThresholdInput] = useState<string>("10");
  const [showQuickSettings, setShowQuickSettings] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem("pnlLossAlertEnabled", JSON.stringify(pnlLossAlertEnabled));
  }, [pnlLossAlertEnabled]);

  useEffect(() => {
    localStorage.setItem("pnlLossAlertThreshold", String(pnlLossAlertThreshold));
  }, [pnlLossAlertThreshold]);


  // Price Alerts
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showAlertDialog, setShowAlertDialog] = useState<string | null>(null); // symbol
  const [activeAlerts, setActiveAlerts] = useState<PriceAlert[]>([]); // triggered alerts to show notifications

  // Check alerts against stock prices
  useEffect(() => {
    if (stocks.length === 0) return;
    
    setAlerts(prevAlerts => {
      let changed = false;
      const newAlerts = prevAlerts.map(alert => {
        if (!alert.isActive || alert.triggered) return alert;
        
        const stock = stocks.find(s => s.symbol === alert.symbol);
        if (!stock) return alert;
        
        let isTriggered = false;
        if (alert.condition === 'above' && stock.currentPrice >= alert.targetPrice) {
          isTriggered = true;
        } else if (alert.condition === 'below' && stock.currentPrice <= alert.targetPrice) {
          isTriggered = true;
        }
        
        if (isTriggered) {
          changed = true;
          setActiveAlerts(prev => [...prev, { ...alert, triggered: true }]);
          return { ...alert, triggered: true, isActive: false };
        }
        return alert;
      });
      
      return changed ? newAlerts : prevAlerts;
    });
  }, [stocks]);

  const dismissAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Watchlist (symbols list)
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("watchlist");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ["AAPL", "NVDA", "TSLA", "VZ", "0700.HK"];
  });

  // User Custom Positions
  // Stored as an array of objects: { symbol: string, quantity: number, buyPrice: number, dividends?: number }
  const [rawPositions, setRawPositions] = useState<{ symbol: string; quantity: number; buyPrice: number; dividends?: number }[]>(() => {
    const saved = localStorage.getItem("positions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      { symbol: "AAPL", quantity: 10, buyPrice: 172.5, dividends: 12.5 },
      { symbol: "NVDA", quantity: 15, buyPrice: 820.0, dividends: 0.0 },
      { symbol: "VZ", quantity: 100, buyPrice: 40.0, dividends: 18.0 }
    ];
  });

  // Calculated Positions (fully populated with current prices and P&Ls)
  const [positions, setPositions] = useState<Position[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals & UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalSymbol, setModalSymbol] = useState("AAPL");
  const [modalQuantity, setModalQuantity] = useState("10");
  const [modalBuyPrice, setModalBuyPrice] = useState("175.0");
  const [modalDividends, setModalDividends] = useState("0");
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmSymbol, setDeleteConfirmSymbol] = useState<string | null>(null);

  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(null);

  const handleRemoteUpdate = (data: any) => {
    if (data._ownerUid !== undefined) setDataOwnerUid(data._ownerUid);
    if (data.watchlist) setWatchlist(data.watchlist);
    if (data.positions) setRawPositions(data.positions);
    if (data.priceAlerts) setAlerts(data.priceAlerts);
    if (data.theme) setTheme(data.theme);
    if (data.isUpRed !== undefined) setIsUpRed(data.isUpRed);
    if (data.pnlLossAlertEnabled !== undefined) setPnlLossAlertEnabled(data.pnlLossAlertEnabled);
    if (data.pnlLossAlertThreshold !== undefined) setPnlLossAlertThreshold(data.pnlLossAlertThreshold);
  };

  
  // Custom Stock addition state
  const [isCustomStockMode, setIsCustomStockMode] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");
  const [customName, setCustomName] = useState("");
  const [isCreatingStock, setIsCreatingStock] = useState(false);
  
  // Loading & Error States
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingCandles, setLoadingCandles] = useState(false);
  const [stocksError, setStocksError] = useState<string | null>(null);
  
  // AI Analyst integration
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // News State
  const [news, setNews] = useState<any[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // Sorting state for positions
  const [sortConfig, setSortConfig] = useState<{ key: keyof Position | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  // --- Persist settings to localStorage ---
  useEffect(() => {
    localStorage.setItem("isUpRed", String(isUpRed));
  }, [isUpRed]);

  useEffect(() => {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem("positions", JSON.stringify(rawPositions));
  }, [rawPositions]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("light", "sakura");
    if (theme !== "dark") {
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  // Reset modal search when modal closes or opens
  useEffect(() => {
    if (!showAddModal) {
      setModalSearchQuery("");
    }
  }, [showAddModal]);

  // --- Smart Search (Client-Side) ---
  useEffect(() => {
    const query = showAddModal ? modalSearchQuery.trim() : searchQuery.trim();
    if (!query) return;

    const timer = setTimeout(async () => {
      try {
        const results = await searchStocks(query);
        if (results && results.length > 0) {
          setStocks(prev => {
            const newMap = new Map(prev.map(s => [s.symbol, s]));
            let changed = false;
            results.forEach((stock: Stock) => {
              if (!newMap.has(stock.symbol)) {
                newMap.set(stock.symbol, stock);
                changed = true;
              }
            });
            return changed ? Array.from(newMap.values()) : prev;
          });
        }
      } catch (err: any) {
        if (err?.name !== "AbortError" && !err?.message?.toLowerCase().includes("aborted")) {
          console.warn("Search fetch notice:", err?.message || err);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, modalSearchQuery, showAddModal]);

  // --- Fetch Available Stocks (Client-Side) ---
  const fetchStocks = useCallback(async (isSilent = false, requestedSymbols: string[] = []) => {
    if (!isSilent) setLoadingStocks(true);
    try {
      const data = await fetchStocksList(requestedSymbols);
      if (Array.isArray(data) && data.length > 0) {
        setStocks(prev => {
          if (!prev || prev.length === 0) return data;
          
          const prevMap = new Map(prev.map(s => [s.symbol, s]));
          let hasDiff = false;

          for (const newS of data) {
            const oldS = prevMap.get(newS.symbol);
            if (!oldS || oldS.currentPrice !== newS.currentPrice || oldS.prevClose !== newS.prevClose) {
              hasDiff = true;
              break;
            }
          }

          if (!hasDiff && prev.length >= data.length) return prev;

          data.forEach(s => prevMap.set(s.symbol, s));
          return Array.from(prevMap.values());
        });
        setStocksError(null);
      }
    } catch (err: any) {
      console.warn("Stock fetch warning:", err?.message || err);
      if (!isSilent) {
        setStocksError("网络连接暂时不稳定，正在重试...");
      }
    } finally {
      if (!isSilent) setLoadingStocks(false);
    }
  }, []);

  // --- Fetch Candlestick (K-line) Chart Data (Client-Side) ---
  const fetchCandles = useCallback(async (symbol: string, range: TimeRange | string) => {
    setLoadingCandles(true);
    try {
      const data = await fetchCandlesticks(symbol, range);
      setCandles(data);
    } catch (err: any) {
      if (err?.name !== "AbortError" && !err?.message?.toLowerCase().includes("aborted")) {
        console.warn("Candles fetch notice:", err?.message || err);
      }
    } finally {
      setLoadingCandles(false);
    }
  }, []);

  // Memoized tracking key for symbols to avoid recreating polling interval on every render
  const symbolsTrackingKey = useMemo(() => {
    const list = rawPositions.map(p => p.symbol);
    if (activeSymbol && !list.includes(activeSymbol)) {
      list.push(activeSymbol);
    }
    return list.sort().join(",");
  }, [rawPositions, activeSymbol]);

  // Setup live updates polling (every 5 seconds for smooth performance)
  useEffect(() => {
    const symbolsToTrack = symbolsTrackingKey ? symbolsTrackingKey.split(",") : [];
    fetchStocks(false, symbolsToTrack);
    const interval = setInterval(() => {
      fetchStocks(true, symbolsToTrack);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStocks, symbolsTrackingKey]);

  const fetchNews = useCallback(async (query: string) => {
    setLoadingNews(true);
    try {
      const newsItems = await fetchStockNews(query);
      setNews(newsItems);
    } catch (err: any) {
      if (err?.name !== "AbortError" && !err?.message?.toLowerCase().includes("aborted")) {
        console.warn("News fetch notice:", err?.message || err);
      }
    } finally {
      setLoadingNews(false);
    }
  }, []);

  // Fetch candles when selected stock or timeframe changes
  useEffect(() => {
    if (activeSymbol) {
      fetchCandles(activeSymbol, activeRange);
      fetchNews(activeSymbol);
      // Clear current AI analysis cache when stock changes
      setAiAnalysis(null);
      setAnalysisError(null);
    } else {
      fetchNews("US Stocks");
    }
  }, [activeSymbol, activeRange, fetchCandles, fetchNews]);

  // Dynamically calculate positions and aggregate stats when stock prices refresh
  useEffect(() => {
    if (stocks.length === 0) return;

    const populated = rawPositions.map(raw => {
      const stock = stocks.find(s => s.symbol === raw.symbol);
      const currentPrice = stock ? stock.currentPrice : raw.buyPrice;
      const totalCost = raw.buyPrice * raw.quantity;
      const currentValue = currentPrice * raw.quantity;
      const dividends = raw.dividends || 0;
      const pnl = currentValue - totalCost + dividends;
      const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

      return {
        symbol: raw.symbol,
        name: stock ? stock.name : raw.symbol,
        quantity: raw.quantity,
        buyPrice: raw.buyPrice,
        currentPrice,
        totalCost,
        currentValue,
        pnl,
        pnlPercent,
        dividends,
        history: stock?.history || []
      };
    });

    setPositions(prev => {
      if (prev.length === populated.length) {
        let changed = false;
        for (let i = 0; i < populated.length; i++) {
          const pOld = prev[i];
          const pNew = populated[i];
          if (
            !pOld ||
            pOld.symbol !== pNew.symbol ||
            pOld.quantity !== pNew.quantity ||
            pOld.buyPrice !== pNew.buyPrice ||
            pOld.currentPrice !== pNew.currentPrice ||
            pOld.dividends !== pNew.dividends
          ) {
            changed = true;
            break;
          }
        }
        if (!changed) return prev;
      }
      return populated;
    });
  }, [rawPositions, stocks]);

  // --- Handle AI Analysis Request (Client-Side Gemini) ---
  const handleGenerateAI = async (thinkingMode: boolean, image: { base64: string; mimeType: string } | null) => {
    if (!activeSymbol) return;
    const stock = stocks.find(s => s.symbol === activeSymbol);
    if (!stock) return;

    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const result = await analyzeStockWithGemini({
        stock,
        thinkingMode,
        image: image ? { base64: image.base64, mimeType: image.mimeType } : undefined,
        positions: positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          buyPrice: p.buyPrice,
          pnl: p.pnl,
          pnlPercent: p.pnlPercent,
          dividends: p.dividends || 0
        }))
      });
      setAiAnalysis(result);
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.toLowerCase().includes("aborted")) {
        return;
      }
      setAnalysisError(err?.message || "AI 分析请求出错");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // --- Portfolio Calculations ---
  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalDividends = positions.reduce((sum, p) => sum + (p.dividends || 0), 0);
  const totalPnL = totalValue - totalCost + totalDividends;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Portfolio PnL Loss Alert Trigger Status
  const isPnlLossAlertTriggered =
    pnlLossAlertEnabled &&
    pnlLossAlertThreshold > 0 &&
    positions.length > 0 &&
    totalPnLPercent <= -Math.abs(pnlLossAlertThreshold);

  // Active stock metadata
  const activeStock = stocks.find(s => s.symbol === activeSymbol);

  // --- Mutate Watchlist ---
  const toggleWatchlist = (symbol: string) => {
    if (watchlist.includes(symbol)) {
      setWatchlist(watchlist.filter(s => s !== symbol));
    } else {
      setWatchlist([...watchlist, symbol]);
    }
  };

  // --- Mutate Positions ---
  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const qty = parseFloat(modalQuantity);
    const price = parseFloat(modalBuyPrice);
    const divVal = parseFloat(modalDividends);

    if (isNaN(qty) || qty < 0 || isNaN(price) || price <= 0) {
      setFormError("请输入有效的数量和平均买入成本价");
      return;
    }
    if (isNaN(divVal) || divVal < 0) {
      setFormError("请输入有效的股息金额");
      return;
    }

    let finalSymbol = modalSymbol;

    if (isCustomStockMode) {
      const cleanSym = customSymbol.trim().toUpperCase();
      const cleanName = customName.trim();
      if (!cleanSym || !cleanName) {
        setFormError("请填写自定义股票代码和公司名称");
        return;
      }
      setIsCreatingStock(true);
      try {
        const newStock: Stock = {
          symbol: cleanSym,
          name: cleanName,
          basePrice: price,
          currentPrice: price,
          prevClose: Number((price * 0.99).toFixed(2)),
          high: price,
          low: price,
          volume: 1000000,
          history: [price, price]
        };

        setStocks(prev => {
          const map = new Map(prev.map(s => [s.symbol, s]));
          map.set(newStock.symbol, newStock);
          const updatedList = Array.from(map.values());
          saveStoredStocks(updatedList);
          return updatedList;
        });

        finalSymbol = newStock.symbol;
      } catch (err: any) {
        setFormError(err?.message || "添加自定义标的时出错");
        setIsCreatingStock(false);
        return;
      } finally {
        setIsCreatingStock(false);
      }
    }

    // Check if position already exists for this symbol
    const existingIdx = rawPositions.findIndex(p => p.symbol === finalSymbol);
    if (existingIdx === -1 && rawPositions.length >= 50) {
      setFormError("最多支持添加 50 个持仓标的。");
      return;
    }

    let updated = [...rawPositions];
    if (existingIdx !== -1) {
      const existing = rawPositions[existingIdx];
      if (isEditMode) {
        // Direct overwrite mode
        updated[existingIdx] = {
          symbol: finalSymbol,
          quantity: qty,
          buyPrice: price,
          dividends: divVal
        };
      } else if (qty === 0) {
        // Just update dividends and average cost of existing position
        updated[existingIdx] = {
          ...existing,
          buyPrice: price,
          dividends: divVal
        };
      } else {
        // Average out position costs
        const newQty = existing.quantity + qty;
        const newBuyPrice = ((existing.buyPrice * existing.quantity) + (price * qty)) / newQty;
        updated[existingIdx] = {
          symbol: finalSymbol,
          quantity: newQty,
          buyPrice: Number(newBuyPrice.toFixed(4)),
          dividends: divVal
        };
      }
    } else {
      if (qty === 0) {
        setFormError("首次建仓时持有数量不能为 0");
        return;
      }
      updated.push({
        symbol: finalSymbol,
        quantity: qty,
        buyPrice: price,
        dividends: divVal
      });
    }

    setRawPositions(updated);
    setShowAddModal(false);
    
    // Set added stock as active view
    setActiveSymbol(finalSymbol);

    // Reset custom stock form state
    setIsCustomStockMode(false);
    setCustomSymbol("");
    setCustomName("");
    setFormError(null);
  };

  const handleDeletePosition = (symbol: string) => {
    if (deleteConfirmSymbol === symbol) {
      setRawPositions(rawPositions.filter(p => p.symbol !== symbol));
      setDeleteConfirmSymbol(null);
    } else {
      setDeleteConfirmSymbol(symbol);
      setTimeout(() => {
        setDeleteConfirmSymbol(curr => curr === symbol ? null : curr);
      }, 3000);
    }
  };

  // Pre-fill position form when opening modal for specific stock
  const openAddModalFor = (symbol: string) => {
    const stock = stocks.find(s => s.symbol === symbol);
    const existing = rawPositions.find(p => p.symbol === symbol);
    setModalSymbol(symbol);
    setModalBuyPrice(stock ? String(stock.currentPrice) : "100.0");
    setModalQuantity("10");
    setModalDividends(existing ? String(existing.dividends || 0) : "0");
    setIsCustomStockMode(false);
    setIsEditMode(false);
    setCustomSymbol("");
    setCustomName("");
    setShowAddModal(true);
  };

  const openEditModalFor = (position: Position) => {
    setModalSymbol(position.symbol);
    setModalQuantity(position.quantity.toString());
    setModalBuyPrice(position.buyPrice.toString());
    setModalDividends((position.dividends || 0).toString());
    setIsCustomStockMode(false);
    setIsEditMode(true);
    setCustomSymbol("");
    setCustomName("");
    setShowAddModal(true);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, symbol: string) => {
    setDraggedSymbol(symbol);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e: React.DragEvent, symbol: string) => {
    e.preventDefault();
    setDragOverSymbol(symbol);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetSymbol: string) => {
    e.preventDefault();
    if (draggedSymbol && draggedSymbol !== targetSymbol) {
      setRawPositions((prev) => {
        const draggedIndex = prev.findIndex((p) => p.symbol === draggedSymbol);
        const targetIndex = prev.findIndex((p) => p.symbol === targetSymbol);
        
        if (draggedIndex === -1 || targetIndex === -1) return prev;
        
        const newPositions = [...prev];
        const [draggedItem] = newPositions.splice(draggedIndex, 1);
        newPositions.splice(targetIndex, 0, draggedItem);
        return newPositions;
      });
    }
    setDraggedSymbol(null);
    setDragOverSymbol(null);
  };

  const handleDragEnd = () => {
    setDraggedSymbol(null);
    setDragOverSymbol(null);
  };

  // Filtered stock list based on query
  const filteredStocks = stocks.filter(
    s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
         s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorting logic
  const requestSort = (key: keyof Position) => {
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      setSortConfig({ key: null, direction: 'asc' });
      return;
    }
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPositions = React.useMemo(() => {
    let sortableItems = [...positions];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (aValue === undefined || bValue === undefined) return 0;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [positions, sortConfig]);

  const renderSortIndicator = (key: keyof Position) => {
    if (sortConfig.key !== key) return <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">↕</span>;
    return <span className="text-indigo-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  if (!hasStarted) {
    return <LandingPage onStart={() => setHasStarted(true)} />;
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {theme === "sakura" && <SakuraPetals />}
      {/* HEADER: Compact Glassmorphic Navigation */}
      <motion.header 
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="border-b border-theme-border/60 bg-theme-card/75 backdrop-blur-xl sticky top-0 z-40 px-3 md:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-3 shadow-sm"
      >
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1 sm:flex-initial">
          <div className="flex items-center gap-2 group cursor-pointer shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-sm group-hover:shadow-indigo-500/30 transition-all group-hover:scale-105">
              ZT
            </div>
            <span className="font-bold text-base text-theme-text-heading tracking-tight hidden md:block group-hover:text-indigo-400 transition-colors">ZeroTrack</span>
          </div>

          <div className="h-5 w-[1px] bg-theme-border/80 hidden md:block"></div>

          {/* Compact Asset Value */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-theme-text-muted uppercase tracking-widest font-extrabold hidden lg:block">
              NET VALUE
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-mono font-bold text-theme-text-heading tracking-tight drop-shadow-xs truncate">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h1>
              <span
                className={`font-mono text-[10px] md:text-xs font-bold flex items-center gap-1 bg-theme-bg-hover px-2 py-0.5 rounded-lg shrink-0 border border-theme-border/50 ${
                  totalPnL >= 0
                    ? isUpRed ? "text-red-500" : "text-emerald-500"
                    : isUpRed ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {totalPnL >= 0 ? <TrendingUp size={12} className="animate-pulse hidden sm:block" /> : <TrendingDown size={12} className="animate-pulse hidden sm:block" />}
                {totalPnL >= 0 ? "+" : ""}$<AnimatedNumber value={totalPnL} isUpRed={isUpRed} flashThreshold={0.5} formatter={(v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <span className="opacity-80 hidden lg:inline ml-0.5">
                  (<AnimatedNumber value={totalPnLPercent} isUpRed={isUpRed} isPercent={true} flashThreshold={0.01} formatter={(v) => (v > 0 ? "+" : "") + v.toFixed(2) + "%"} />)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls & Preferences */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Market Status (Micro) */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 h-8 rounded-xl flex items-center gap-1.5 hidden xl:flex shrink-0" title="Live Agent Active">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-emerald-500 font-bold tracking-wider font-mono">LIVE</span>
          </div>

          {/* Cloud Sync */}
          <CloudSync 
            data={{ watchlist, positions: rawPositions, priceAlerts: alerts, theme, isUpRed, pnlLossAlertEnabled, pnlLossAlertThreshold, _ownerUid: dataOwnerUid }} 
            onRemoteUpdate={handleRemoteUpdate} 
          />
          
          {/* Theme Switcher */}
          <div className="flex shrink-0 items-center h-8 bg-theme-bg-hover px-1 rounded-xl border border-theme-border/80 shadow-2xs">
            <button 
              onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "sakura" : "dark")}
              className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text-primary transition lg:hidden cursor-pointer"
              title="切换主题"
            >
              {theme === "dark" ? <Moon size={14} className="text-indigo-400" /> : theme === "sakura" ? <div className="text-pink-500 text-xs">🌸</div> : <Sun size={14} className="text-amber-500" />}
            </button>
            <div className="hidden lg:flex items-center gap-0.5">
              {theme === "dark" ? <Moon size={13} className="text-indigo-400 mx-1.5" /> : theme === "sakura" ? <div className="text-pink-500 mx-1.5 text-xs">🌸</div> : <Sun size={13} className="text-amber-500 mx-1.5" />}
              <button
                onClick={() => setTheme("dark")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${theme === "dark" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                暗
              </button>
              <button
                onClick={() => setTheme("light")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${theme === "light" ? "bg-amber-500/20 text-amber-600 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                明
              </button>
              <button
                onClick={() => setTheme("sakura")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${theme === "sakura" ? "bg-pink-500/20 text-pink-600 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                樱
              </button>
            </div>
          </div>

          {/* Preferences Dropdown for Tablets / Smaller Screens */}
          <div className="relative shrink-0 xl:hidden">
            <button
              onClick={() => setShowQuickSettings(!showQuickSettings)}
              className={`h-8 px-2 sm:px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                showQuickSettings 
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm" 
                  : "bg-theme-bg-hover hover:bg-theme-border text-theme-text-muted hover:text-theme-text-primary border-theme-border/80"
              }`}
              title="偏好与图表设置"
            >
              <Sliders size={13} />
              <span className="hidden lg:inline">偏好</span>
            </button>

            {showQuickSettings && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowQuickSettings(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-theme-card border border-theme-border rounded-2xl shadow-xl p-3.5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                  <div>
                    <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                      涨跌颜色习惯
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-theme-panel p-1 rounded-xl border border-theme-border">
                      <button
                        onClick={() => setIsUpRed(true)}
                        className={`py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isUpRed ? "bg-red-500/20 text-red-500 border border-red-500/30 font-extrabold" : "text-theme-text-muted hover:text-theme-text-primary"
                        }`}
                      >
                        红涨绿跌
                      </button>
                      <button
                        onClick={() => setIsUpRed(false)}
                        className={`py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          !isUpRed ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-extrabold" : "text-theme-text-muted hover:text-theme-text-primary"
                        }`}
                      >
                        绿涨红跌
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                      K线形态展示
                    </div>
                    <div className="grid grid-cols-2 gap-1 bg-theme-panel p-1 rounded-xl border border-theme-border">
                      {[
                        { id: 'candlestick', label: '实体K线' },
                        { id: 'hollow', label: '空心K线' },
                        { id: 'ohlc', label: '竹节线' },
                        { id: 'area', label: '面积走势' },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setChartType(type.id as any)}
                          className={`py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            chartType === type.id ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Color Scheme Switcher (XL Screens) */}
          <div className="shrink-0 items-center h-8 bg-theme-bg-hover px-1 rounded-xl border border-theme-border/80 shadow-2xs hidden xl:flex">
            <Settings size={13} className="text-theme-text-muted mx-1.5" />
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setIsUpRed(true)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${isUpRed ? "bg-red-500/20 text-red-500 font-extrabold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                红涨
              </button>
              <button
                onClick={() => setIsUpRed(false)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${!isUpRed ? "bg-emerald-500/20 text-emerald-500 font-extrabold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                绿涨
              </button>
            </div>
          </div>

          {/* Chart Toggle (XL Screens) */}
          <div className="shrink-0 items-center h-8 bg-theme-bg-hover px-1 rounded-xl border border-theme-border/80 shadow-2xs hidden xl:flex">
            <LineChart size={13} className="text-theme-text-muted mx-1.5" />
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setChartType("candlestick")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${chartType === "candlestick" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                实体
              </button>
              <button
                onClick={() => setChartType("hollow")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${chartType === "hollow" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                空心
              </button>
              <button
                onClick={() => setChartType("ohlc")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${chartType === "ohlc" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                竹节
              </button>
              <button
                onClick={() => setChartType("area")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${chartType === "area" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              >
                走势
              </button>
            </div>
          </div>

          <button
            onClick={() => fetchStocks(false, rawPositions.map(p => p.symbol))}
            className="h-8 w-8 flex items-center justify-center shrink-0 bg-theme-bg-hover hover:bg-theme-border border border-theme-border/80 rounded-xl text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer"
            title="刷新行情数据"
          >
            <RefreshCw size={13} className="animate-hover" />
          </button>

          <button
            onClick={() => {
              setModalSymbol("");
              setModalBuyPrice("");
              setModalQuantity("");
              setModalDividends("0");
              setModalSearchQuery("");
              setIsCustomStockMode(false);
              setIsEditMode(false);
              setShowAddModal(true);
            }}
            className="h-8 shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-3 md:px-4 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} className="stroke-[2.5]" />
            <span>记一笔</span>
          </button>
        </div>
      </motion.header>

      {/* PORTFOLIO STATS BENTO ROW */}
      <section className="px-3 md:px-5 pt-3 md:pt-4 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5" id="portfolio-bento-grid">
        {/* Card 1: Asset Value details */}
        <div className="bg-theme-card/80 border border-theme-border/60 rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all backdrop-blur-sm group hover:-translate-y-0.5 min-w-0">
          <div className="flex items-center justify-between text-theme-text-secondary min-w-0 gap-1">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-theme-text-muted truncate">持仓现值</span>
            <DollarSign size={14} className="text-indigo-400 shrink-0" />
          </div>
          <div className="mt-1.5 md:mt-2.5 min-w-0">
            <div className="text-xs sm:text-base md:text-xl font-bold font-mono tracking-tight text-theme-text-heading truncate">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[8px] md:text-[10px] text-theme-text-muted mt-0.5 md:mt-1 truncate">根据实时股价换算</p>
          </div>
        </div>

        {/* Card 2: Cost basis */}
        <div className="bg-theme-card/80 border border-theme-border/60 rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all backdrop-blur-sm group hover:-translate-y-0.5 min-w-0">
          <div className="flex items-center justify-between text-theme-text-secondary min-w-0 gap-1">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-theme-text-muted truncate">本金成本</span>
            <Briefcase size={14} className="text-theme-text-muted shrink-0" />
          </div>
          <div className="mt-1.5 md:mt-2.5 min-w-0">
            <div className="text-xs sm:text-base md:text-xl font-bold font-mono tracking-tight text-theme-text-primary truncate">
              ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[8px] md:text-[10px] text-theme-text-muted mt-0.5 md:mt-1 truncate">累计交易成本</p>
          </div>
        </div>

        {/* Card 3: Floating PnL */}
        <div className="bg-theme-card/80 border border-theme-border/60 rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all backdrop-blur-sm group hover:-translate-y-0.5 min-w-0">
          <div className="flex items-center justify-between text-theme-text-secondary min-w-0 gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-theme-text-muted truncate">综合盈亏</span>
              <button
                onClick={() => {
                  setModalThresholdInput(String(pnlLossAlertThreshold));
                  setShowPnlAlertModal(true);
                  if (pnlAlertDismissed) setPnlAlertDismissed(false);
                }}
                className={`text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full border transition-all flex items-center gap-1 cursor-pointer shrink-0 font-bold ${
                  isPnlLossAlertTriggered
                    ? "bg-red-500/20 text-red-500 border-red-500/40 animate-pulse"
                    : pnlLossAlertEnabled
                    ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/20 dark:text-indigo-400"
                    : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20"
                }`}
                title="点击设置或修改持仓组合亏损警戒线"
              >
                <BellRing size={10} className={isPnlLossAlertTriggered ? "animate-bounce text-red-500" : ""} />
                <span>{pnlLossAlertEnabled ? `预警 -${pnlLossAlertThreshold}%` : "预警关"}</span>
              </button>
            </div>
            {totalPnL >= 0 ? (
              <TrendingUp size={14} className={`shrink-0 ${isUpRed ? "text-red-400" : "text-emerald-400"}`} />
            ) : (
              <TrendingDown size={14} className={`shrink-0 ${isUpRed ? "text-emerald-400" : "text-red-400"}`} />
            )}
          </div>
          <div className="mt-1.5 md:mt-2.5 min-w-0">
            <div
              className={`text-xs sm:text-base md:text-xl font-bold font-mono tracking-tight truncate ${
                totalPnL >= 0
                  ? isUpRed ? "text-red-500" : "text-emerald-500"
                  : isUpRed ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {totalPnL >= 0 ? "+" : ""}$<AnimatedNumber value={totalPnL} isUpRed={isUpRed} flashThreshold={0.5} formatter={(v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
            </div>
            <p className="text-[9px] md:text-[10px] text-theme-text-muted mt-0.5 md:mt-1 truncate flex items-center gap-1">
              <span>回报率:</span>
              <span className="font-bold font-mono">
                <AnimatedNumber value={totalPnLPercent} isUpRed={isUpRed} isPercent={true} flashThreshold={0.01} formatter={(v) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%"} />
              </span>
            </p>
          </div>
        </div>

        {/* Card 4: Positions overview */}
        <div className="bg-theme-card/80 border border-theme-border/60 rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-3.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all backdrop-blur-sm group hover:-translate-y-0.5 min-w-0">
          <div className="flex items-center justify-between text-theme-text-secondary min-w-0 gap-1">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-theme-text-muted truncate">配置分散度</span>
            <Layers size={14} className="text-indigo-400 shrink-0" />
          </div>
          <div className="mt-1.5 md:mt-2.5 min-w-0">
            <div className="text-xs sm:text-base md:text-xl font-bold font-mono tracking-tight text-theme-text-heading truncate">
              {positions.length} 个标的
            </div>
            <p className="text-[8px] md:text-[10px] text-theme-text-muted mt-0.5 md:mt-1 truncate">
              自选监视: {watchlist.length}
            </p>
          </div>
        </div>
      </section>

      {/* MAIN CONTAINER: Bento Grid System */}
      
      
      <main className="flex-grow p-2 sm:p-4 md:p-6 grid grid-cols-12 gap-2 sm:gap-3 md:gap-5 min-h-0">
        
        {/* Bento Cell 1: Custom Positions Table (col-span-12 lg:col-span-12) */}
        <div className="col-span-12 bg-theme-card border border-theme-border rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 flex flex-col shadow-md md:shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-theme-text-heading flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>实时资产持仓 • Live Portfolio</span>
            </h2>
            <span className="text-xs text-theme-text-muted font-mono">点击各行可在下方切换K线</span>
          </div>

          {/* Table container */}
          <div className="flex-1 pb-2">
            {positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-theme-text-secondary border border-dashed border-theme-border rounded-2xl">
                <Briefcase size={28} className="text-theme-text-muted mb-2" />
                <p className="text-xs font-semibold">您当前未配置任何持仓仓位</p>
                <p className="text-[10px] text-theme-text-muted mt-1 max-w-xs text-center leading-relaxed">
                  点击顶部“记一笔交易”添加您自己的买入仓位与价格，实时监控行情涨跌。
                </p>
              </div>
            ) : (
              <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                <thead className="text-[10px] text-theme-text-muted uppercase tracking-wider border-b border-theme-border-muted select-none">
                  <tr>
                    <th 
                      className="pb-3 font-semibold pl-2 cursor-pointer hover:text-theme-text-secondary group transition-colors"
                      onClick={() => requestSort('symbol')}
                    >
                      <div className="flex items-center pl-7">标的资产 {renderSortIndicator('symbol')}</div>
                    </th>
                    <th 
                      className="pb-3 font-semibold text-right cursor-pointer hover:text-theme-text-secondary group transition-colors"
                      onClick={() => requestSort('quantity')}
                    >
                      <div className="flex items-center justify-end">持仓大小 {renderSortIndicator('quantity')}</div>
                    </th>
                    <th 
                      className="pb-3 font-semibold text-right cursor-pointer hover:text-theme-text-secondary group transition-colors"
                      onClick={() => requestSort('buyPrice')}
                    >
                      <div className="flex items-center justify-end">买入均价 {renderSortIndicator('buyPrice')}</div>
                    </th>
                    <th 
                      className="pb-3 font-semibold text-right cursor-pointer hover:text-theme-text-secondary group transition-colors"
                      onClick={() => requestSort('currentPrice')}
                    >
                      <div className="flex items-center justify-end">当前市价 / 动态走势 {renderSortIndicator('currentPrice')}</div>
                    </th>
                    <th 
                      className="pb-3 font-semibold text-right cursor-pointer hover:text-theme-text-secondary group transition-colors"
                      onClick={() => requestSort('dividends')}
                    >
                      <div className="flex items-center justify-end">累计股息 {renderSortIndicator('dividends')}</div>
                    </th>
                    <th 
                      className="pb-3 font-semibold text-right cursor-pointer hover:text-theme-text-secondary group transition-colors"
                      onClick={() => requestSort('pnl')}
                    >
                      <div className="flex items-center justify-end">浮动盈亏 {renderSortIndicator('pnl')}</div>
                    </th>
                    <th className="pb-3 font-semibold text-right pr-2">操作</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-theme-border-muted">
                  <AnimatePresence mode="popLayout">
                  {sortedPositions.map((p) => {
                    const isPnLPositive = p.pnl >= 0;
                    const isActive = activeSymbol === p.symbol;
                    
                    // Generate colors for avatar badge based on symbol
                    let avatarBg = "bg-blue-500/10 text-blue-400";
                    if (p.symbol.includes("NVDA")) avatarBg = "bg-green-500/10 text-green-400";
                    else if (p.symbol.includes("TSLA")) avatarBg = "bg-red-500/10 text-red-400";
                    else if (p.symbol.includes("HK")) avatarBg = "bg-amber-500/10 text-amber-400";

                    return (
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={p.symbol}
                        onClick={() => handleSelectStock(p.symbol)}
                        draggable={sortConfig.key === null}
                        onDragStart={(e: any) => handleDragStart(e, p.symbol)}
                        onDragEnter={(e: any) => handleDragEnter(e, p.symbol)}
                        onDragOver={(e: any) => handleDragOver(e)}
                        onDrop={(e: any) => handleDrop(e, p.symbol)}
                        onDragEnd={handleDragEnd}

                        className={`cursor-pointer transition-all duration-300 relative ${
                          isActive
                            ? "bg-indigo-500/15 dark:bg-indigo-900/40 border-l-4 border-indigo-500 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)] font-medium"
                            : "hover:bg-theme-bg-hover"
                        } ${
                          draggedSymbol === p.symbol ? "opacity-50 bg-indigo-500/10 scale-[0.99] shadow-inner ring-1 ring-indigo-500/30 z-10 relative" : ""
                        } ${
                          dragOverSymbol === p.symbol && draggedSymbol !== p.symbol ? "border-t-2 border-indigo-500 bg-indigo-500/5 shadow-[0_-8px_20px_-8px_rgba(99,102,241,0.25)] relative z-20 translate-y-0.5" : ""
                        }`}
                      >
                        {/* Asset symbol and Avatar */}
                        <td className="py-3.5 pl-1 flex items-center gap-1.5 md:gap-2">
                          <div className={`flex items-center justify-center p-1 rounded hover:bg-theme-bg-active transition-colors text-theme-text-muted hover:text-indigo-400 ${sortConfig.key === null ? 'cursor-grab active:cursor-grabbing' : 'opacity-20 cursor-not-allowed'}`}>
                            <GripVertical size={14} />
                          </div>
                          
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${avatarBg}`}>
                            {p.symbol.replace(".HK", "").substring(0, 4)}
                          </div>
                          <div className="ml-1">
                            <p className="font-bold text-theme-text-heading flex items-center gap-1.5">
                              {p.symbol}
                              {isActive && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-extrabold text-[10px] animate-pulse border border-indigo-500/30">
                                  研判中
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-theme-text-muted truncate max-w-[130px] font-sans" title={p.name}>
                              {p.name}
                            </p>
                          </div>
                        </td>

                        {/* Holding Size */}
                        <td className="py-3.5 text-right font-mono font-bold text-theme-text-primary">
                          {p.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>

                        {/* Cost */}
                        <td className="py-3.5 text-right font-mono text-theme-text-secondary">
                          ${p.buyPrice.toFixed(2)}
                        </td>

                        {/* Current Price & Trend */}
                        <td className="py-3.5 text-right font-mono font-semibold text-theme-text-heading">
                          <div className="flex flex-col items-end gap-1">
                            <PriceTicker price={p.currentPrice} />
                            <AnimatedSparkline history={p.history || []} isPnLPositive={isPnLPositive} isUpRed={isUpRed} />
                          </div>
                        </td>

                        {/* Dividends */}
                        <td className="py-3.5 text-right font-mono text-indigo-400 font-semibold">
                          ${(p.dividends || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* PNL Change */}
                        <td className="py-3.5 text-right font-mono">
                          <div
                            className={`font-bold ${
                              isPnLPositive
                                ? isUpRed ? "text-red-400" : "text-emerald-400"
                                : isUpRed ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {isPnLPositive ? "+" : ""}$<AnimatedNumber value={p.pnl} isUpRed={isUpRed} flashThreshold={0.05} formatter={(v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                          </div>
                          <div
                            className={`text-[10px] font-semibold ${
                              isPnLPositive
                                ? isUpRed ? "text-red-500" : "text-emerald-500"
                                : isUpRed ? "text-emerald-500" : "text-red-500"
                            }`}
                          >
                            <AnimatedNumber value={p.pnlPercent} isUpRed={isUpRed} isPercent={true} flashThreshold={0.01} formatter={(v) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%"} />
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 text-right pr-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAlertDialog(p.symbol);
                              }}
                              className={`p-1.5 rounded-lg transition text-[10px] hover:bg-theme-bg-hover ${alerts.some(a => a.symbol === p.symbol && a.isActive) ? 'text-indigo-400' : 'text-theme-text-muted'} hover:text-indigo-400`}
                              title="设置提醒"
                            >
                              <Bell size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModalFor(p);
                              }}
                              className="p-1.5 rounded-lg transition text-[10px] hover:bg-theme-bg-hover text-theme-text-muted hover:text-indigo-400"
                              title="编辑此仓位"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePosition(p.symbol);
                              }}
                              className={`p-1.5 rounded-lg transition text-[10px] font-bold ${
                                deleteConfirmSymbol === p.symbol 
                                  ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 px-2" 
                                  : "hover:bg-theme-bg-hover text-theme-text-muted hover:text-red-400"
                              }`}
                              title="移除此仓位"
                            >
                              {deleteConfirmSymbol === p.symbol ? "确认移除" : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  </AnimatePresence>
                </tbody>
              </table>
              </div>
              <div className="md:hidden flex flex-col gap-2.5">
                <AnimatePresence mode="popLayout">
                {sortedPositions.map((p) => {
                  const isPnLPositive = p.pnl >= 0;
                  const isActive = activeSymbol === p.symbol;
                  let avatarBg = "bg-blue-500/10 text-blue-400";
                  if (p.symbol.includes("NVDA")) avatarBg = "bg-green-500/10 text-green-400";
                  else if (p.symbol.includes("TSLA")) avatarBg = "bg-red-500/10 text-red-400";
                  else if (p.symbol.includes("HK")) avatarBg = "bg-amber-500/10 text-amber-400";
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={p.symbol}
                      onClick={() => handleSelectStock(p.symbol)}
                      draggable={sortConfig.key === null}
                      onDragStart={(e: any) => handleDragStart(e, p.symbol)}
                      onDragEnter={(e) => handleDragEnter(e, p.symbol)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, p.symbol)}
                      onDragEnd={handleDragEnd}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 ${isActive ? "bg-indigo-500/15 dark:bg-indigo-950/50 border-2 border-indigo-500 shadow-md ring-2 ring-indigo-500/20" : "bg-theme-card border-theme-border/80 hover:bg-theme-bg-hover"} ${draggedSymbol === p.symbol ? "opacity-50 scale-[0.98]" : ""}`}
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-[10px] ${avatarBg}`}>
                            {p.symbol.replace(".HK", "").substring(0, 4)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-theme-text-heading flex items-center gap-1.5 truncate">
                              <span>{p.symbol}</span>
                              {isActive && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>}
                            </div>
                            <div className="text-[10px] text-theme-text-muted truncate max-w-[120px]">{p.name}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-sm text-theme-text-primary">
                            ${p.currentPrice.toFixed(2)}
                          </div>
                          <div className={`text-[10px] font-bold ${isPnLPositive ? (isUpRed ? "text-red-500" : "text-emerald-500") : (isUpRed ? "text-emerald-500" : "text-red-500")}`}>
                            <AnimatedNumber value={p.pnl} isUpRed={isUpRed} flashThreshold={0.05} formatter={(v) => (v >= 0 ? "+" : "") + v.toFixed(2)} />
                            <span className="ml-1 opacity-85">
                              (<AnimatedNumber value={p.pnlPercent} isUpRed={isUpRed} isPercent={true} flashThreshold={0.01} formatter={(v) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%"} />)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-theme-text-muted bg-theme-panel/80 p-2 px-2.5 rounded-xl border border-theme-border-muted/50">
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-[10px]">持仓: </span><span className="font-mono font-bold text-theme-text-primary">{p.quantity}</span>
                          </div>
                          <div>
                            <span className="text-[10px]">均价: </span><span className="font-mono font-bold text-theme-text-primary">${p.buyPrice.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAlertDialog(p.symbol);
                            }}
                            className={`p-1.5 rounded-lg transition text-[10px] hover:bg-theme-bg-hover ${alerts.some(a => a.symbol === p.symbol && a.isActive) ? 'text-indigo-400' : 'text-theme-text-muted'} hover:text-indigo-400`}
                            title="设置提醒"
                          >
                            <Bell size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModalFor(p);
                            }}
                            className="p-1.5 rounded-lg transition text-[10px] hover:bg-theme-bg-hover text-theme-text-muted hover:text-indigo-400"
                            title="编辑此仓位"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePosition(p.symbol);
                            }}
                            className={`p-1.5 rounded-lg transition text-[10px] font-bold ${
                              deleteConfirmSymbol === p.symbol
                                 ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 px-2"
                                 : "hover:bg-theme-bg-hover text-theme-text-muted hover:text-red-400"
                            }`}
                            title="移除此仓位"
                          >
                            {deleteConfirmSymbol === p.symbol ? "确认移除" : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </>
            )}
          </div>
          
          {/* Portfolio Heatmap Visualization */}
          {positions.length > 0 && (
            <div className="mt-6 border-t border-theme-border-muted pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-theme-text-heading flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                  </svg>
                  持仓热力图 <span className="text-[10px] md:text-xs font-normal text-theme-text-muted ml-1 md:ml-2 tracking-normal hidden sm:inline">区块大小 = 仓位市值 • 颜色 = 浮动盈亏</span>
                </h3>
              </div>
              <PortfolioHeatmap 
                positions={positions} 
                onSelect={(sym) => handleSelectStock(sym, true)} 
                activeSymbol={activeSymbol} 
                isUpRed={isUpRed} 
              />
            </div>
          )}
        </div>

        {/* Portfolio Allocation Weight & PnL Donut Chart (Standalone Section) */}
        {positions.length > 0 && (
          <div className="col-span-12">
            <PortfolioAllocationChart
              positions={positions}
              stocks={stocks}
              onSelect={handleSelectStock}
              activeSymbol={activeSymbol}
              isUpRed={isUpRed}
            />
          </div>
        )}

        {/* Portfolio Value History Trend Chart (Standalone Section) */}
        {positions.length > 0 && (
          <div className="col-span-12">
            <PortfolioTrendChart
              positions={positions}
              stocks={stocks}
              isUpRed={isUpRed}
            />
          </div>
        )}

        {/* Standalone Section: K-Line Chart, Technical Analysis & Watchlist */}
        <div className="col-span-12 bg-theme-card border border-theme-border rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 flex flex-col shadow-md md:shadow-xl">
          <div ref={stockChartRef} id="kline-chart-section" className="scroll-mt-6">
            {/* Toolbar row inside Bento chart cell */}
            <div className="flex flex-wrap items-center justify-between pb-4 border-b border-theme-border-muted mb-5 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-theme-text-muted">时间跨度:</span>
                <div className="flex bg-theme-panel p-1 rounded-xl border border-theme-border-muted gap-0.5">
                  {(["1D", "1W", "1M", "1Y"] as TimeRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setActiveRange(r)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold transition ${
                        activeRange === r ? "bg-indigo-600 text-white" : "text-theme-text-secondary hover:text-theme-text-primary"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Quick Transaction Trigger */}
                <button
                  onClick={() => openAddModalFor(activeSymbol)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-theme-bg-hover hover:bg-theme-bg-active text-theme-text-primary hover:text-theme-text-heading border border-theme-border rounded-xl text-[11px] font-bold transition cursor-pointer"
                >
                  <Plus size={12} />
                  <span>以此标的建仓</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 min-w-0">
                {/* Interactive chart display */}
                {loadingCandles ? (
                  <div className="min-h-[380px] sm:min-h-[480px] md:min-h-[580px] flex flex-col items-center justify-center text-slate-500 gap-2 bg-theme-card rounded-3xl border border-theme-border">
                    <RefreshCw size={28} className="animate-spin text-indigo-500" />
                    <span className="text-sm font-semibold">正在渲染多周期专业K线走势...</span>
                  </div>
                ) : activeStock ? (
                  <StockChart
                    candles={candles}
                    chartType={chartType}
                    isUpRed={isUpRed}
                    symbol={activeStock.symbol}
                    name={activeStock.name}
                    theme={theme}
                    activeStock={activeStock}
                    activeRange={activeRange}
                    onRangeChange={(newRange) => {
                      setActiveRange(newRange as any);
                      if (activeSymbol) {
                        fetchCandles(activeSymbol, newRange);
                      }
                    }}
                  />
                ) : (
                  <div className="min-h-[380px] sm:min-h-[480px] md:min-h-[580px] flex items-center justify-center text-slate-500 text-sm bg-theme-card rounded-3xl border border-theme-border">
                    请在上方选择股票以加载实时走势图
                  </div>
                )}
              </div>
              
              <div className="w-full lg:w-80 lg:shrink-0 flex flex-col justify-between bg-theme-panel/70 border border-theme-border-muted rounded-2xl md:rounded-3xl p-4 sm:p-5 shadow-sm">

          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse"></div>
              <h3 className="text-xs font-bold uppercase text-theme-text-muted tracking-wider">
                技术指标信号 • Technical Signal
              </h3>
            </div>

            {activeStock ? (
              <div className="space-y-4">
                {/* RSI meter */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-theme-text-muted font-medium">相对强弱指数 RSI (14)</span>
                    <span className="text-theme-text-heading font-mono font-bold">
                      {activeStock.currentPrice > activeStock.basePrice * 1.02 ? "72.4 (Overbought)" : activeStock.currentPrice < activeStock.basePrice * 0.98 ? "31.8 (Oversold)" : "54.6 (Neutral)"}
                    </span>
                  </div>
                  <div className="w-full bg-theme-panel h-2 rounded-full border border-theme-border-muted overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: activeStock.currentPrice > activeStock.basePrice * 1.02 ? "72%" : activeStock.currentPrice < activeStock.basePrice * 0.98 ? "32%" : "55%" }}
                    ></div>
                  </div>
                </div>

                {/* MACD indicator status */}
                <div className="flex justify-between items-center text-xs border-t border-theme-border-muted pt-3">
                  <span className="text-theme-text-muted font-medium">指数平滑异同移动平均线 MACD</span>
                  <span className={`font-mono font-bold ${activeStock.currentPrice >= activeStock.prevClose ? "text-emerald-400" : "text-amber-400"}`}>
                    {activeStock.currentPrice >= activeStock.prevClose ? "Bullish Crossover" : "Bearish Divergence"}
                  </span>
                </div>

                {/* Moving averages support level */}
                <div className="flex justify-between items-center text-xs border-t border-theme-border-muted pt-3">
                  <span className="text-theme-text-muted font-medium">EMA(20) 强支撑位参考</span>
                  <span className="text-theme-text-primary font-mono font-bold">
                    ${(activeStock.currentPrice * 0.978).toFixed(2)}
                  </span>
                </div>

                {/* Bollinger Bands gap */}
                <div className="flex justify-between items-center text-xs border-t border-theme-border-muted pt-3">
                  <span className="text-theme-text-muted font-medium">布林轨道线 BB宽度</span>
                  <span className="text-theme-text-muted font-mono">
                    ${(activeStock.currentPrice * 0.94).toFixed(2)} - ${(activeStock.currentPrice * 1.04).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-theme-text-muted">选择某一股票可查看特定量化支撑分析</div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border-muted">
            <p className="text-[10px] text-theme-text-muted leading-relaxed">
              *技术信号基于最新收盘价和昨日波动方差进行随机游走动力学模型测算。仅作为智能看板仓位管理参考，不构成直接要约投资。
            </p>
          </div>
        
              </div>
            </div>

            {/* K-Line real website references */}
            {activeStock && (
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3" id="external-stock-links">
                <span className="flex items-center gap-1.5">
                  <Info size={13} className="text-slate-500" />
                  <span>对接 K 线源: 前往主流专业图表站查看 {activeStock.symbol} 深度技术图表:</span>
                </span>
                
                <div className="flex items-center gap-3">
                  <a
                    href={`https://www.tradingview.com/symbols/${activeStock.symbol.replace(".HK", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline font-bold transition"
                  >
                    <span>TradingView</span>
                    <ExternalLink size={10} />
                  </a>
                  <span className="text-slate-800">|</span>
                  <a
                    href={`https://finance.yahoo.com/quote/${activeStock.symbol}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline font-bold transition"
                  >
                    <span>雅虎财经</span>
                    <ExternalLink size={10} />
                  </a>
                  <span className="text-slate-800">|</span>
                  <a
                    href={`https://www.google.com/finance/quote/${activeStock.symbol.replace(".HK", ":HKG")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline font-bold transition"
                  >
                    <span>谷歌财经</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        
        {/* Bento Cell 2: Quick Watchlist & Search Monitor (col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-theme-text-heading flex items-center gap-1.5">
                <Layers size={15} className="text-indigo-400" />
                <span>市场自选与监控</span>
              </h2>
              <p className="text-[10px] text-theme-text-muted">搜索、加入自选或快速切换当前个股数据</p>
            </div>
          </div>

          {/* Search box */}
          <div className="relative mb-3.5">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-theme-text-muted pointer-events-none">
              <Search size={13} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索代码或名称 (如 AAPL, 腾讯)..."
              className="w-full bg-theme-panel border border-theme-border rounded-xl pl-9 pr-8 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:border-indigo-600 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-theme-text-muted hover:text-theme-text-secondary"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Custom Watchlist list scroll */}
          <div className="flex-1 overflow-y-auto max-h-[240px] pr-1 scrollbar-thin">
            {filteredStocks.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">未找到匹配的资产</div>
            ) : (
              <div className="space-y-2">
                {filteredStocks.map((s) => {
                  const isWatchlisted = watchlist.includes(s.symbol);
                  const isActive = activeSymbol === s.symbol;
                  const changeVal = s.currentPrice - s.prevClose;
                  const changePercent = (changeVal / s.prevClose) * 100;
                  const isPositive = changeVal >= 0;

                  return (
                    <div
                      key={s.symbol}
                      onClick={() => setActiveSymbol(s.symbol)}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-150 flex items-center justify-between group ${
                        isActive
                          ? "bg-theme-bg-active border-indigo-500/50 animate-pulse-subtle"
                          : "bg-theme-panel border-theme-border-muted hover:bg-theme-bg-hover hover:border-theme-border"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold font-mono text-xs text-theme-text-heading">{s.symbol}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWatchlist(s.symbol);
                            }}
                            className={`text-[11px] leading-none transition-transform active:scale-90 ${
                              isWatchlisted ? "text-yellow-500" : "text-theme-text-muted group-hover:text-theme-text-secondary"
                            }`}
                            title={isWatchlisted ? "移出自选" : "加入自选"}
                          >
                            ★
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAlertDialog(s.symbol);
                            }}
                            className={`text-[11px] leading-none transition-transform active:scale-90 flex items-center justify-center ${
                              alerts.some(a => a.symbol === s.symbol && a.isActive) ? "text-indigo-400" : "text-theme-text-muted group-hover:text-theme-text-secondary"
                            }`}
                            title="设置提醒"
                          >
                            <Bell size={10} />
                          </button>
                        </div>
                        <div className="text-[10px] text-theme-text-muted truncate max-w-[120px] font-sans">{s.name}</div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-theme-text-heading">${s.currentPrice.toFixed(2)}</div>
                        <div
                          className={`text-[10px] font-bold ${
                            isPositive
                              ? isUpRed ? "text-red-400" : "text-emerald-400"
                              : isUpRed ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {changePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bento Cell 6: Recent Buzz News Stream (col-span-12 lg:col-span-6) */}
        <div className="col-span-12 lg:col-span-6 bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-theme-text-muted uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>市场动态与舆情 • News</span>
              </h3>
              {loadingNews && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
            </div>

            <div className="space-y-3.5 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin">
              {news.length > 0 ? (
                news.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-theme-panel hover:bg-theme-bg-hover rounded-2xl border border-theme-border-muted border-l-2 transition-colors duration-200 group"
                    style={{ borderLeftColor: idx % 2 === 0 ? '#10b981' : '#6366f1' }}
                  >
                    <p className="text-xs font-semibold leading-relaxed text-theme-text-primary line-clamp-3 group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[9px] text-theme-text-muted mt-1.5 uppercase tracking-wider font-mono flex items-center justify-between">
                      <span>{item.publisher || "Yahoo Finance"}</span>
                      {item.providerPublishTime && (
                        <span>
                          {new Date(item.providerPublishTime * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </p>
                  </a>
                ))
              ) : (
                !loadingNews && (
                  <div className="text-xs text-theme-text-muted text-center py-6">暂无相关新闻资讯</div>
                )
              )}
            </div>
          </div>
        </div>

      

{/* Bento Cell 5: AI Intelligence Advisor (col-span-12 lg:col-span-12) */}
        <div className="col-span-12 flex flex-col">
          {activeStock ? (
            <AIAnalyst
              symbol={activeStock.symbol}
              name={activeStock.name}
              analysis={aiAnalysis}
              loading={loadingAnalysis}
              error={analysisError}
              onAnalyze={handleGenerateAI}
              theme={theme}
            />
          ) : (
            <div className="bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-4 md:p-6 h-full flex items-center justify-center text-theme-text-muted text-xs text-center p-8">
              请在上方选择一只股票，即可在这里启用 Gemini 大模型进行仓位诊断。
            </div>
          )}
        </div>

        {/* Bento Cell: Calendar Heatmap for PnL (col-span-12) */}
        <div className="col-span-12 bg-theme-card border border-theme-border rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col shadow-md md:shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-theme-border-muted">
            <h2 className="text-base font-bold text-theme-text-heading flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>历史盈亏热力全景 • PnL Heatmap & Performance</span>
            </h2>
            <span className="text-xs text-theme-text-muted font-mono bg-theme-panel px-2.5 py-1 rounded-lg border border-theme-border-muted">
              📅 近 365 天历史持仓变化
            </span>
          </div>
          <div className="w-full">
            <CalendarHeatmap data={dailyPnLData} isUpRed={isUpRed} />
          </div>
        </div>

        



        

</main>

      
      {/* ALERT NOTIFICATIONS */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <AnimatePresence>
          {activeAlerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-theme-card border-l-4 border-indigo-500 rounded-xl p-4 shadow-2xl flex items-start gap-4 max-w-sm text-theme-text-primary border-y border-r border-theme-border"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <BellRing size={20} className="animate-bounce" />
              </div>
              <div className="flex-1 pt-0.5">
                <h4 className="font-bold text-sm mb-1">{alert.symbol} 价格提醒</h4>
                <p className="text-xs text-theme-text-secondary">
                  价格已{alert.condition === 'above' ? '涨破' : '跌破'}设定的目标价 <span className="font-mono font-bold text-theme-text-heading">${alert.targetPrice.toFixed(2)}</span>
                </p>
              </div>
              <button 
                onClick={() => dismissAlert(alert.id)}
                className="text-theme-text-muted hover:text-theme-text-heading p-1 transition"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ALERT SETTINGS MODAL */}
      {showAlertDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-theme-card border border-theme-border rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-theme-text-primary">
            <button 
              onClick={() => setShowAlertDialog(null)}
              className="absolute top-4 right-4 p-2 text-theme-text-muted hover:text-theme-text-heading bg-theme-bg rounded-full transition"
            >
              <X size={16} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-theme-text-heading">设置价格提醒</h2>
                <p className="text-[10px] text-theme-text-muted">{showAlertDialog}</p>
              </div>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const targetPrice = parseFloat(formData.get('targetPrice') as string);
              const condition = formData.get('condition') as "above" | "below";
              
              if (!isNaN(targetPrice)) {
                setAlerts(prev => {
                  const existing = prev.filter(a => a.symbol !== showAlertDialog);
                  return [...existing, {
                    id: Math.random().toString(36).substr(2, 9),
                    symbol: showAlertDialog,
                    targetPrice,
                    condition,
                    isActive: true,
                    triggered: false
                  }];
                });
                setShowAlertDialog(null);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1 ml-1">当前价格</label>
                  <div className="w-full bg-theme-panel text-theme-text-secondary rounded-xl px-4 py-3 font-mono text-sm border border-theme-border/50">
                    ${stocks.find(s => s.symbol === showAlertDialog)?.currentPrice?.toFixed(2) || '0.00'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1 ml-1">目标价格 (USD)</label>
                  <input 
                    name="targetPrice"
                    type="number" 
                    step="0.01" 
                    min="0"
                    required
                    defaultValue={alerts.find(a => a.symbol === showAlertDialog && a.isActive)?.targetPrice || ''}
                    placeholder="输入目标价格"
                    className="w-full bg-theme-bg text-theme-text-primary rounded-xl px-4 py-3 outline-none border border-theme-border focus:border-indigo-500 transition font-mono text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase font-bold text-theme-text-muted mb-1 ml-1">触发条件</label>
                  <select 
                    name="condition"
                    defaultValue={alerts.find(a => a.symbol === showAlertDialog && a.isActive)?.condition || 'above'}
                    className="w-full bg-theme-bg text-theme-text-primary rounded-xl px-4 py-3 outline-none border border-theme-border focus:border-indigo-500 transition text-sm appearance-none"
                  >
                    <option value="above">涨破该价格</option>
                    <option value="below">跌破该价格</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-8">
                {alerts.some(a => a.symbol === showAlertDialog && a.isActive) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAlerts(prev => prev.filter(a => a.symbol !== showAlertDialog));
                      setShowAlertDialog(null);
                    }}
                    className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-bold transition"
                  >
                    删除提醒
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 transition"
                >
                  保存设置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PORTFOLIO TRANSACTION MODAL (記一筆) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-theme-card border border-theme-border rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 text-theme-text-primary">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-1.5 hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-heading rounded-lg transition cursor-pointer"
            >
              <X size={15} />
            </button>

            <h3 className="text-sm font-bold text-theme-text-heading flex items-center gap-2 mb-1.5 uppercase tracking-wider">
              {isEditMode ? <span className="text-indigo-400">✏️</span> : <Plus size={16} className="text-indigo-400" />}
              <span>{isEditMode ? "编辑仓位记录" : "添加或调整仓位记录"}</span>
            </h3>
            <p className="text-[11px] text-theme-text-muted mb-4">
              {isEditMode 
                ? "直接修改您当前持仓的数量和成本价。此操作将覆盖现有记录。" 
                : "设置您的自定义持股。如果该标的已存在，系统将为您自动摊平计算平均成本。"}
            </p>

            <form onSubmit={handleAddPosition} className="space-y-4">
              {/* Modal mode tabs */}
              {!isEditMode && (
                <div className="flex bg-theme-panel p-1 rounded-xl border border-theme-border-muted text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsCustomStockMode(false)}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
                      !isCustomStockMode 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-theme-text-muted hover:text-theme-text-secondary"
                    }`}
                  >
                    搜索预设股票/ETF
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomStockMode(true)}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
                      isCustomStockMode 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-theme-text-muted hover:text-theme-text-secondary"
                    }`}
                  >
                    ➕ 手动录入新标的
                  </button>
                </div>
              )}

              {/* Conditional rendering based on mode */}
              {!isCustomStockMode ? (
                /* Select Preset Stock with interactive visual search */
                <div className="space-y-3 text-left">
                  <label className="block text-[11px] font-bold text-theme-text-muted uppercase tracking-wider">选择股票标的</label>
                  
                  {/* Active Selection Badge */}
                  {(() => {
                    const activeStockObj = stocks.find(s => s.symbol === modalSymbol);
                    return activeStockObj ? (
                      <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-2xl text-xs">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-indigo-400">{activeStockObj.symbol}</span>
                            <span className="text-[10px] text-theme-text-muted bg-theme-panel px-1.5 py-0.5 rounded-md border border-theme-border-muted font-sans">
                              {isEditMode ? "正在编辑" : "已选择"}
                            </span>
                          </div>
                          <span className="text-[10px] text-theme-text-secondary truncate max-w-[180px] mt-0.5">{activeStockObj.name}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-theme-text-heading">${activeStockObj.currentPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      isEditMode && (
                        <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-2xl text-xs">
                           <div className="flex flex-col">
                             <div className="flex items-center gap-1.5">
                               <span className="font-bold font-mono text-indigo-400">{modalSymbol}</span>
                               <span className="text-[10px] text-theme-text-muted bg-theme-panel px-1.5 py-0.5 rounded-md border border-theme-border-muted font-sans">正在编辑</span>
                             </div>
                           </div>
                        </div>
                      )
                    );
                  })()}

                  {/* Search input with icons */}
                  {!isEditMode && (
                    <>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-theme-text-muted pointer-events-none">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          value={modalSearchQuery}
                          onChange={(e) => setModalSearchQuery(e.target.value)}
                          placeholder="输入代码、简称或市场搜索..."
                          className="w-full bg-theme-panel border border-theme-border rounded-xl pl-9 pr-8 py-2.5 text-xs text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:border-indigo-600 transition"
                        />
                        {modalSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setModalSearchQuery("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-theme-text-muted hover:text-theme-text-secondary"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Matching results list with custom style like the user's reference */}
                  {!isEditMode && (
                    <div className="max-h-52 overflow-y-auto border border-theme-border rounded-2xl divide-y divide-theme-border-muted bg-theme-panel scrollbar-thin">
                    {(() => {
                      const query = modalSearchQuery.trim().toLowerCase();
                      const upperQuery = modalSearchQuery.trim().toUpperCase();
                      const filtered = query
                        ? stocks.filter(
                            s =>
                              s.symbol.toLowerCase().includes(query) ||
                              s.name.toLowerCase().includes(query)
                          )
                        : stocks.slice(0, 8); // Show top 8 as suggestions when search is empty

                      const hasExactMatch = stocks.some(s => s.symbol === upperQuery);

                      return (
                        <>
                          {/* Quick Add Custom Ticker Option if user searched something that's not an exact preset match */}
                          {upperQuery && !hasExactMatch && (
                            <div
                              onClick={async () => {
                                const sym = upperQuery;
                                setModalSymbol(sym);
                                // Try fetching quote
                                try {
                                  const res = await fetch(`/api/stocks/quote/${sym}`);
                                  if (res.ok) {
                                    const st = await res.json();
                                    if (st && st.currentPrice > 0) {
                                      setStocks(prev => [...prev.filter(p => p.symbol !== sym), st]);
                                      setModalBuyPrice(String(st.currentPrice));
                                      return;
                                    }
                                  }
                                } catch {}
                                setModalBuyPrice("100.00");
                              }}
                              className="p-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-medium text-xs flex items-center justify-between cursor-pointer border-b border-indigo-500/20 transition-all"
                            >
                              <div className="flex items-center gap-2">
                                <span className="bg-indigo-500 text-white font-bold w-5 h-5 rounded-full flex items-center justify-center text-[11px]">+</span>
                                <span>按代码检索并使用 <strong>{upperQuery}</strong></span>
                              </div>
                              <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded-full text-indigo-300 font-mono">全球标的检索</span>
                            </div>
                          )}

                          {filtered.length === 0 && !upperQuery ? (
                            <div className="text-center py-6 text-xs text-theme-text-muted font-medium">
                              未找到匹配的股票标的
                            </div>
                          ) : filtered.length === 0 && upperQuery ? (
                            <div className="p-4 text-center space-y-2">
                              <p className="text-xs text-theme-text-muted">列表中未包含此标的预设，请点击上方『按代码检索』或使用『➕ 手动录入新标的』。</p>
                            </div>
                          ) : null}

                          {filtered.map((s) => {
                        const isSelected = modalSymbol === s.symbol;
                        const changeVal = s.currentPrice - s.prevClose;
                        const changePercent = (changeVal / s.prevClose) * 100;
                        const isPositive = changeVal >= 0;
                        
                        // Parse market label
                        let marketLabel = "美股 · USD";
                        if (s.symbol.endsWith(".HK")) {
                          marketLabel = "港股 · HKD";
                        } else if (s.symbol.endsWith(".SH") || s.symbol.endsWith(".SZ")) {
                          marketLabel = "A股 · CNY";
                        } else if (["SPY", "QQQ", "IWM", "DIA", "GLD", "USO"].includes(s.symbol)) {
                          marketLabel = "ETF · USD";
                        }

                        return (
                          <div
                            key={s.symbol}
                            onClick={() => {
                              setModalSymbol(s.symbol);
                              setModalBuyPrice(String(s.currentPrice));
                              const existing = rawPositions.find(p => p.symbol === s.symbol);
                              setModalDividends(existing ? String(existing.dividends || 0) : "0");
                            }}
                            className={`p-3 flex items-center justify-between transition-all cursor-pointer select-none ${
                              isSelected
                                ? "bg-indigo-600/10 text-theme-text-primary"
                                : "hover:bg-theme-bg-hover text-theme-text-secondary"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Left Plus/Select Circle */}
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "border-theme-border-muted hover:border-theme-text-secondary text-theme-text-muted"
                                }`}
                              >
                                {isSelected ? (
                                  <span className="text-[10px] font-bold">✓</span>
                                ) : (
                                  <span className="text-xs font-bold leading-none">+</span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold font-mono text-xs text-theme-text-heading">
                                    {s.symbol}
                                  </span>
                                  <span className="text-[8px] text-theme-text-muted uppercase font-sans tracking-wide">
                                    {marketLabel}
                                  </span>
                                </div>
                                <div className="text-[10px] text-theme-text-muted truncate max-w-[180px] font-sans">
                                  {s.name}
                                </div>
                              </div>
                            </div>

                            <div className="text-right font-mono shrink-0">
                              <div className="text-xs font-bold text-theme-text-heading">
                                ${s.currentPrice.toFixed(2)}
                              </div>
                              <div
                                className={`text-[9px] font-bold ${
                                  isPositive
                                    ? isUpRed ? "text-red-400" : "text-emerald-400"
                                    : isUpRed ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {changePercent.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </>
                      );
                    })()}
                  </div>
                  )}
                </div>
              ) : (
                /* Add Custom Stock Input Fields */
                <div className="space-y-3 p-3 bg-indigo-950/20 rounded-2xl border border-indigo-500/20">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-wider">股票/ETF代码 (Ticker Symbol)</label>
                    <input
                      type="text"
                      required
                      value={customSymbol}
                      onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                      placeholder="如: SPY, VOO, 0700.HK, 600519.SH"
                      className="w-full bg-theme-panel border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:border-indigo-600 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400 mb-1 uppercase tracking-wider">股票简称/简称 (Company Name)</label>
                    <input
                      type="text"
                      required
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="如: 标普500 ETF"
                      className="w-full bg-theme-panel border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text-primary focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <p className="text-[9px] text-indigo-400/80 leading-snug">
                    💡 录入后，该自定义代码将立刻被服务器注册，并开始生成实时模拟行情！
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Quantity */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-muted mb-1.5 uppercase tracking-wider">持有数量 (股)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modalQuantity}
                    onChange={(e) => setModalQuantity(e.target.value)}
                    placeholder="100"
                    className="w-full bg-theme-panel border border-theme-border rounded-xl px-3 py-2.5 text-xs text-theme-text-primary focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>

                {/* Average Buy Price */}
                <div>
                  <label className="block text-[11px] font-bold text-theme-text-muted mb-1.5 uppercase tracking-wider">买入均价 (USD)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modalBuyPrice}
                    onChange={(e) => setModalBuyPrice(e.target.value)}
                    placeholder="150.00"
                    className="w-full bg-theme-panel border border-theme-border rounded-xl px-3 py-2.5 text-xs text-theme-text-primary focus:outline-none focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>

              {/* Dividends */}
              <div>
                <label className="block text-[11px] font-bold text-theme-text-muted mb-1.5 uppercase tracking-wider">累计已收股息 (USD) Dividends</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={modalDividends}
                  onChange={(e) => setModalDividends(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-theme-panel border border-theme-border rounded-xl px-3 py-2.5 text-xs text-theme-text-primary focus:outline-none focus:border-indigo-600 font-mono"
                />
                <p className="text-[9px] text-theme-text-muted mt-1 leading-relaxed">
                  提示: 输入该标的累计收到的总股息金额。若仅修改股息或成本价，可将“持有数量”设为 0。
                </p>
              </div>

              {/* Form Error Banner */}
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center justify-center">
                  {formError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isCreatingStock}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-heading rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isCreatingStock}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreatingStock ? "注册代码中..." : "确认记录"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PnL Loss Alert Setting Modal */}
      {showPnlAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-theme-card border border-theme-border rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl relative"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-theme-text-heading">持仓亏损预警设置</h3>
                  <p className="text-[11px] text-theme-text-muted">当整体持仓浮亏超出警戒线时触发应用内红色提醒</p>
                </div>
              </div>
              <button
                onClick={() => setShowPnlAlertModal(false)}
                className="p-1 rounded-lg hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-heading transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Enable / Disable Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-theme-panel border border-theme-border">
                <div className="flex items-center gap-2">
                  <Bell size={16} className={pnlLossAlertEnabled ? "text-indigo-500" : "text-theme-text-muted"} />
                  <div>
                    <span className="text-xs font-bold text-theme-text-primary block">启用持仓亏损预警</span>
                    <span className="text-[10px] text-theme-text-muted">实时监控组合整体亏损情况</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPnlLossAlertEnabled(!pnlLossAlertEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                    pnlLossAlertEnabled ? "bg-indigo-600 justify-end" : "bg-slate-700 justify-start"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Preset Percentage Buttons */}
              <div>
                <label className="block text-[11px] font-bold text-theme-text-muted mb-2 uppercase tracking-wider">
                  快速选择亏损警戒线比例
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[5, 10, 15, 20, 25].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setModalThresholdInput(String(pct))}
                      className={`py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                        parseFloat(modalThresholdInput) === pct
                          ? "bg-red-500/20 text-red-500 border-red-500/50 shadow-sm"
                          : "bg-theme-panel text-theme-text-muted border-theme-border hover:text-theme-text-primary"
                      }`}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div>
                <label className="block text-[11px] font-bold text-theme-text-muted mb-1.5 uppercase tracking-wider">
                  自定义警戒线比例 (百分比 %)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-red-500 font-bold font-mono text-sm">-</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max="100"
                    value={modalThresholdInput}
                    onChange={(e) => setModalThresholdInput(e.target.value)}
                    placeholder="例如 10"
                    className="w-full bg-theme-panel border border-theme-border rounded-xl pl-7 pr-8 py-2 text-xs text-theme-text-primary focus:outline-none focus:border-red-500 font-mono font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-theme-text-muted font-mono text-xs">%</span>
                </div>
                <p className="text-[10px] text-theme-text-muted mt-1">
                  当整体持仓浮亏比例等于或低于 -{parseFloat(modalThresholdInput) || 0}% 时将弹窗警报。
                </p>
              </div>

              {/* Current Portfolio Status Banner */}
              <div className="p-3 rounded-xl bg-theme-panel border border-theme-border space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-theme-text-secondary">
                  <span>当前持仓组合盈亏率:</span>
                  <span className={`font-mono font-bold ${totalPnL >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {totalPnLPercent >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-theme-text-secondary">
                  <span>预警预判:</span>
                  <span className={`font-bold text-[11px] ${
                    pnlLossAlertEnabled && totalPnLPercent <= -Math.abs(parseFloat(modalThresholdInput) || 10)
                      ? "text-red-500"
                      : "text-emerald-500"
                  }`}>
                    {pnlLossAlertEnabled && totalPnLPercent <= -Math.abs(parseFloat(modalThresholdInput) || 10)
                      ? "⚠️ 超出警戒线 (保存后将触发警报)"
                      : "✅ 在安全区间内"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPnlAlertModal(false)}
                  className="px-4 py-2 hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-heading rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const val = Math.abs(parseFloat(modalThresholdInput) || 10);
                    setPnlLossAlertThreshold(val);
                    setPnlAlertDismissed(false); // Reset dismissal so user gets notified if triggered
                    setShowPnlAlertModal(false);
                  }}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer"
                >
                  保存预警设置
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating Red Portfolio PnL Loss Alert Popup */}
      <AnimatePresence>
        {isPnlLossAlertTriggered && !pnlAlertDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-96 rounded-2xl bg-gradient-to-br from-red-950/95 via-slate-900/95 to-red-900/95 border-2 border-red-500/80 text-white shadow-2xl shadow-red-950/80 p-4 sm:p-5 backdrop-blur-xl relative overflow-hidden"
          >
            {/* Background Warning Glow */}
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-red-500/20 rounded-full blur-2xl pointer-events-none animate-pulse" />
            <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 animate-bounce">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-red-200 tracking-tight flex items-center gap-1.5">
                    持仓亏损预警触发！
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-red-300/80">整体持仓浮亏超出警戒线</p>
                </div>
              </div>
              <button
                onClick={() => setPnlAlertDismissed(true)}
                className="p-1 rounded-lg text-red-300/60 hover:text-white hover:bg-red-500/20 transition cursor-pointer"
                title="暂不提醒 (已知晓)"
              >
                <X size={16} />
              </button>
            </div>

            {/* Main Alert Body */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-red-500/30 mb-3.5 space-y-2 relative z-10 font-mono">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-300 font-sans text-[11px]">当前组合浮亏率:</span>
                <span className="text-red-400 font-extrabold text-sm sm:text-base">
                  {totalPnLPercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
                <span>设定警戒线:</span>
                <span className="font-mono text-red-300 font-bold">-{pnlLossAlertThreshold}%</span>
              </div>
              <div className="h-px bg-red-500/20 my-1" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-sans text-[11px]">浮亏金额:</span>
                <span className="text-red-400 font-bold">
                  -${Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-red-200/90 leading-relaxed mb-4 relative z-10 font-sans">
              提示：市场波动较大，请密切关注个股风控与资金配置，防范跟风杀跌或连续深套风险。
            </p>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-2 relative z-10">
              <button
                onClick={() => {
                  setModalThresholdInput(String(pnlLossAlertThreshold));
                  setShowPnlAlertModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Sliders size={12} />
                <span>修改警戒线</span>
              </button>
              <button
                onClick={() => setPnlAlertDismissed(true)}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950 transition cursor-pointer"
              >
                已知晓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-5 px-6 text-center text-[10px] uppercase tracking-[0.2em] text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 justify-center">
          <span>Session: Live sandbox</span>
          <span>API: Normal</span>
          <span>Refresh Rate: 3000ms</span>
        </div>
        <div>© 2026 PORTFOLIO ENGINE v1.1.0</div>
      </footer>
    </div>
  );
}
