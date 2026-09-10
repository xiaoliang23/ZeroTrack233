import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "motion/react";
import { Candle, ChartType, Stock } from "../types";
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Settings, 
  X, 
  Layers, 
  Sliders, 
  RefreshCw, 
  MoveHorizontal, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Crosshair, 
  Hand, 
  SkipForward,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Activity,
  Magnet
} from "lucide-react";

interface StockChartProps {
  candles: Candle[];
  chartType: ChartType;
  isUpRed: boolean; // true = Red is UP, Green is DOWN. false = Green is UP, Red is DOWN.
  symbol: string;
  name: string;
  theme?: string;
  activeStock?: Stock;
  activeRange?: string;
  onRangeChange?: (range: "5M" | "60M" | "1D" | "1W" | "1M" | "1Y") => void;
}

// --- Technical Indicator Calculations ---

function calculateSMA(data: Candle[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

function calculateEMA(data: Candle[], period: number): (number | null)[] {
  const ema: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[j].close;
      }
      prevEma = sum / period;
      ema.push(prevEma);
    } else {
      prevEma = data[i].close * k + (prevEma as number) * (1 - k);
      ema.push(prevEma);
    }
  }
  return ema;
}

function calculateBOLL(data: Candle[], period = 20, multiplier = 2) {
  const bollUpper: (number | null)[] = [];
  const bollMid: (number | null)[] = [];
  const bollLower: (number | null)[] = [];

  const sma = calculateSMA(data, period);

  for (let i = 0; i < data.length; i++) {
    const mid = sma[i];
    if (mid === null) {
      bollUpper.push(null);
      bollMid.push(null);
      bollLower.push(null);
    } else {
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(data[i - j].close - mid, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      bollMid.push(mid);
      bollUpper.push(mid + multiplier * stdDev);
      bollLower.push(mid - multiplier * stdDev);
    }
  }

  return { upper: bollUpper, mid: bollMid, lower: bollLower };
}

function calculateBBI(data: Candle[], p1 = 3, p2 = 6, p3 = 12, p4 = 24): (number | null)[] {
  const ma1 = calculateSMA(data, p1);
  const ma2 = calculateSMA(data, p2);
  const ma3 = calculateSMA(data, p3);
  const ma4 = calculateSMA(data, p4);

  const bbi: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (ma1[i] !== null && ma2[i] !== null && ma3[i] !== null && ma4[i] !== null) {
      bbi.push(((ma1[i] as number) + (ma2[i] as number) + (ma3[i] as number) + (ma4[i] as number)) / 4);
    } else {
      bbi.push(null);
    }
  }
  return bbi;
}

function calculateMACD(data: Candle[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const emaShort = calculateEMA(data, shortPeriod);
  const emaLong = calculateEMA(data, longPeriod);
  const dif: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (emaShort[i] !== null && emaLong[i] !== null) {
      dif.push((emaShort[i] as number) - (emaLong[i] as number));
    } else {
      dif.push(null);
    }
  }

  const dea: (number | null)[] = [];
  const validDifs = dif.filter((v): v is number => v !== null);
  const kSignal = 2 / (signalPeriod + 1);
  let prevDea: number | null = null;
  let validIndex = 0;

  for (let i = 0; i < data.length; i++) {
    if (dif[i] === null) {
      dea.push(null);
    } else {
      if (validIndex < signalPeriod - 1) {
        dea.push(null);
      } else if (validIndex === signalPeriod - 1) {
        let sum = 0;
        for (let j = 0; j < signalPeriod; j++) {
          sum += validDifs[j];
        }
        prevDea = sum / signalPeriod;
        dea.push(prevDea);
      } else {
        prevDea = (dif[i] as number) * kSignal + (prevDea as number) * (1 - kSignal);
        dea.push(prevDea);
      }
      validIndex++;
    }
  }

  const macdBar: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (dif[i] !== null && dea[i] !== null) {
      macdBar.push(((dif[i] as number) - (dea[i] as number)) * 2);
    } else {
      macdBar.push(null);
    }
  }

  return { dif, dea, macdBar };
}

function calculateKDJ(data: Candle[], n = 9, m1 = 3, m2 = 3) {
  const kdj: { k: number | null; d: number | null; j: number | null }[] = [];
  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < data.length; i++) {
    if (i < n - 1) {
      kdj.push({ k: null, d: null, j: null });
      continue;
    }
    const subset = data.slice(i - n + 1, i + 1);
    const l_n = Math.min(...subset.map((c) => c.low));
    const h_n = Math.max(...subset.map((c) => c.high));

    const rsv = h_n === l_n ? 50 : ((data[i].close - l_n) / (h_n - l_n)) * 100;

    const k = ((m1 - 1) * prevK + rsv) / m1;
    const d = ((m2 - 1) * prevD + k) / m2;
    const j = 3 * k - 2 * d;

    prevK = k;
    prevD = d;

    kdj.push({ k, d, j });
  }
  return kdj;
}

function calculatePSY(data: Candle[], n = 12, m = 6) {
  const psy: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < n) {
      psy.push(null);
    } else {
      let upDays = 0;
      for (let j = 0; j < n; j++) {
        const c = data[i - j];
        const prevC = data[i - j - 1];
        if (prevC && c.close > prevC.close) {
          upDays++;
        }
      }
      psy.push((upDays / n) * 100);
    }
  }

  const maPsy: (number | null)[] = [];
  for (let i = 0; i < psy.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < m; j++) {
      if (i - j >= 0 && psy[i - j] !== null) {
        sum += psy[i - j] as number;
        count++;
      }
    }
    if (count === m) {
      maPsy.push(sum / m);
    } else {
      maPsy.push(null);
    }
  }

  return { psy, maPsy };
}

function calculateVolumeSMA(data: Candle[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].volume;
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

function StockChart({
  candles,
  chartType: externalChartType,
  isUpRed: externalIsUpRed,
  symbol,
  name,
  theme = "dark",
  activeStock,
  activeRange,
  onRangeChange
}: StockChartProps) {
  // Configurable Color Scheme
  const [isUpRed, setIsUpRed] = useState<boolean>(externalIsUpRed);
  const upColor = isUpRed ? "#EF4444" : "#10B981";
  const downColor = isUpRed ? "#10B981" : "#EF4444";

  // Chart type & timeframe
  const [localChartType, setLocalChartType] = useState<ChartType>(externalChartType);
  const [cycleType, setCycleType] = useState<"5M" | "60M" | "1D" | "1W" | "1M" | "1Y">("1D");

  useEffect(() => {
    setLocalChartType(externalChartType);
  }, [externalChartType]);

  useEffect(() => {
    setIsUpRed(externalIsUpRed);
  }, [externalIsUpRed]);

  useEffect(() => {
    if (activeRange) {
      setCycleType(activeRange as any);
    }
  }, [activeRange]);

  // Patch candles with live real-time price updates
  const effectiveCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const copy = [...candles];
    if (activeStock && activeStock.currentPrice > 0) {
      const lastIdx = copy.length - 1;
      const origLast = copy[lastIdx];
      const livePrice = activeStock.currentPrice;

      const newHigh = Math.max(origLast.high || livePrice, livePrice, activeStock.high || livePrice);
      const origLow = origLast.low > 0 ? origLast.low : livePrice;
      const stockLow = activeStock.low > 0 ? activeStock.low : livePrice;
      const newLow = Math.min(origLow, livePrice, stockLow);

      copy[lastIdx] = {
        ...origLast,
        close: livePrice,
        high: Number(newHigh.toFixed(2)),
        low: Number(newLow.toFixed(2)),
        volume: Math.max(origLast.volume || 0, activeStock.volume || 0),
      };
    }
    return copy;
  }, [candles, activeStock]);

  // RequestAnimationFrame Data Drawing Scheduler:
  // Buffers raw data updates from parent component and synchronizes SVG redraws
  // with browser animation frames (VSYNC), eliminating redraw jitter and frame drops.
  const [drawnCandles, setDrawnCandles] = useState<Candle[]>(() => effectiveCandles);
  const rafDrawId = useRef<number | null>(null);
  const pendingCandlesRef = useRef<Candle[]>(effectiveCandles);
  pendingCandlesRef.current = effectiveCandles;

  // Immediately synchronize when switching stock symbols to prevent stale flash
  const prevSymbolRef = useRef(symbol);
  if (prevSymbolRef.current !== symbol) {
    prevSymbolRef.current = symbol;
    if (drawnCandles !== effectiveCandles) {
      setDrawnCandles(effectiveCandles);
    }
  }

  // Schedule data drawing on next animation frame
  useEffect(() => {
    if (drawnCandles === effectiveCandles) return;

    if (rafDrawId.current === null) {
      rafDrawId.current = requestAnimationFrame(() => {
        setDrawnCandles(pendingCandlesRef.current);
        rafDrawId.current = null;
      });
    }

    return () => {
      if (rafDrawId.current !== null) {
        cancelAnimationFrame(rafDrawId.current);
        rafDrawId.current = null;
      }
    };
  }, [effectiveCandles, drawnCandles]);

  // Active dataset consumed by all indicator and SVG path computations
  const activeCandles = drawnCandles.length > 0 ? drawnCandles : effectiveCandles;

  // Indicators State & Parameters
  const [maParams, setMaParams] = useState({ p1: 5, p2: 10, p3: 20, p4: 50, p5: 200 });
  const [activeMAs, setActiveMAs] = useState({ ma1: true, ma2: true, ma3: true, ma4: false, ma5: false });

  const [bollParams, setBollParams] = useState({ n: 20, k: 2 });
  const [showBoll, setShowBoll] = useState(false);

  const [bbiParams, setBbiParams] = useState({ p1: 3, p2: 6, p3: 12, p4: 24 });
  const [showBBI, setShowBBI] = useState(false);

  const [psyParams, setPsyParams] = useState({ n: 12, m: 6 });
  const [showPSY, setShowPSY] = useState(false);

  const [kdjParams, setKdjParams] = useState({ n: 9, m1: 3, m2: 3 });
  const [showKDJ, setShowKDJ] = useState(false);

  const [volParams, setVolParams] = useState({ ma1: 5, ma2: 10 });
  const [showVolume, setShowVolume] = useState(true);

  const [macdParams, setMacdParams] = useState({ short: 12, long: 26, signal: 9 });
  const [showMACD, setShowMACD] = useState(false);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"MA" | "BOLL" | "PSY" | "KDJ" | "VOL" | "MACD" | "COLOR">("MA");

  // Mobile Touch Mode: "pan" (default dragging left/right) or "crosshair" (inspecting values)
  const [touchMode, setTouchMode] = useState<"pan" | "crosshair">("pan");

  // Crosshair Snap Mode: "ohlc" (magnetic snap to nearest OHLC candle level), "close" (snap to close price), or "free" (smooth cursor tracking)
  const [crosshairSnapMode, setCrosshairSnapMode] = useState<"ohlc" | "close" | "free">("ohlc");

  // Viewport zoom & pan
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  // Preserve previous viewport state before entering full screen
  const prevViewRef = useRef<{ visibleCount: number; startIndex: number } | null>(null);

  // Full-screen mode toggle: intelligently expands the SVG viewport ratio and visible candle count
  // to give users a broader, panoramic view of historical K-lines without leaving the page
  const toggleFullScreen = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (next) {
        // Entering full screen: save current view settings
        prevViewRef.current = { visibleCount, startIndex };
        // Adapt visible candle count to screen width so user gains a much wider perspective
        if (effectiveCandles.length > 0) {
          const screenW = typeof window !== "undefined" ? window.innerWidth : 1200;
          // Calculate an expansive candle density (~16px per candle slot in full screen)
          const wideCount = Math.min(effectiveCandles.length, Math.max(visibleCount, Math.round(screenW / 16)));
          setVisibleCount(wideCount);
          setStartIndex(Math.max(0, effectiveCandles.length - wideCount));
        }
      } else {
        // Exiting full screen: restore previous viewport if available
        if (prevViewRef.current) {
          setVisibleCount(prevViewRef.current.visibleCount);
          setStartIndex(prevViewRef.current.startIndex);
          prevViewRef.current = null;
        }
      }
      return next;
    });
  }, [visibleCount, startIndex, effectiveCandles.length]);

  // Listen for Escape key to exit full screen mode seamlessly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === "Esc") && isExpanded) {
        toggleFullScreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, toggleFullScreen]);

  // Lock background page scroll when in in-page full screen mode
  useEffect(() => {
    if (isExpanded) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isExpanded]);

  // Boundary Edge Glow & Bounce-Back Feedback State (两端越界发光与回弹反馈)
  const [overscrollX, setOverscrollX] = useState(0);
  const overscrollRef = useRef(0);
  const [edgeGlow, setEdgeGlow] = useState<"start" | "end" | null>(null);
  const edgeGlowTimeoutRef = useRef<number | null>(null);
  const bounceRafRef = useRef<number | null>(null);

  const bounceBackAnimation = useCallback(() => {
    if (bounceRafRef.current) cancelAnimationFrame(bounceRafRef.current);
    const step = () => {
      // Damped spring physics for smooth rubber-band return
      overscrollRef.current = overscrollRef.current * 0.68;
      if (Math.abs(overscrollRef.current) < 0.25) {
        overscrollRef.current = 0;
        setOverscrollX(0);
        bounceRafRef.current = null;
        if (edgeGlowTimeoutRef.current) clearTimeout(edgeGlowTimeoutRef.current);
        edgeGlowTimeoutRef.current = window.setTimeout(() => {
          setEdgeGlow(null);
        }, 280);
      } else {
        setOverscrollX(overscrollRef.current);
        bounceRafRef.current = requestAnimationFrame(step);
      }
    };
    bounceRafRef.current = requestAnimationFrame(step);
  }, []);

  const triggerEdgeFeedback = useCallback((edge: "start" | "end", kickOffset?: number) => {
    setEdgeGlow(edge);
    if (edgeGlowTimeoutRef.current) clearTimeout(edgeGlowTimeoutRef.current);

    if (kickOffset !== undefined) {
      if (bounceRafRef.current) cancelAnimationFrame(bounceRafRef.current);
      overscrollRef.current = kickOffset;
      setOverscrollX(kickOffset);
      bounceBackAnimation();
    } else {
      edgeGlowTimeoutRef.current = window.setTimeout(() => {
        if (!isDraggingRef.current) {
          setEdgeGlow(null);
        }
      }, 700);
    }
  }, [bounceBackAnimation]);

  // Container dimensions with RAF throttle
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 520 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafResizeId: number | null = null;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    updateSize();
    const observer = new ResizeObserver(() => {
      if (rafResizeId !== null) cancelAnimationFrame(rafResizeId);
      rafResizeId = requestAnimationFrame(() => {
        updateSize();
        rafResizeId = null;
      });
    });
    observer.observe(container);
    return () => {
      if (rafResizeId !== null) cancelAnimationFrame(rafResizeId);
      observer.disconnect();
    };
  }, [isExpanded]);

  // Sync visible window when candles update
  useEffect(() => {
    if (activeCandles && activeCandles.length > 0) {
      const initCount = Math.min(38, activeCandles.length);
      setVisibleCount(initCount);
      setStartIndex(activeCandles.length - initCount);
    }
  }, [activeCandles.length]);

  // Calculate Technical Indicators
  const fullMa1 = useMemo(() => calculateSMA(activeCandles, maParams.p1), [activeCandles, maParams.p1]);
  const fullMa2 = useMemo(() => calculateSMA(activeCandles, maParams.p2), [activeCandles, maParams.p2]);
  const fullMa3 = useMemo(() => calculateSMA(activeCandles, maParams.p3), [activeCandles, maParams.p3]);
  const fullMa4 = useMemo(() => calculateSMA(activeCandles, maParams.p4), [activeCandles, maParams.p4]);
  const fullMa5 = useMemo(() => calculateSMA(activeCandles, maParams.p5), [activeCandles, maParams.p5]);

  const fullBoll = useMemo(() => calculateBOLL(activeCandles, bollParams.n, bollParams.k), [activeCandles, bollParams]);
  const fullBBI = useMemo(() => calculateBBI(activeCandles, bbiParams.p1, bbiParams.p2, bbiParams.p3, bbiParams.p4), [activeCandles, bbiParams]);
  const fullMacd = useMemo(() => calculateMACD(activeCandles, macdParams.short, macdParams.long, macdParams.signal), [activeCandles, macdParams]);
  const fullKdj = useMemo(() => calculateKDJ(activeCandles, kdjParams.n, kdjParams.m1, kdjParams.m2), [activeCandles, kdjParams]);
  const fullPsy = useMemo(() => calculatePSY(activeCandles, psyParams.n, psyParams.m), [activeCandles, psyParams]);
  const fullVolMa1 = useMemo(() => calculateVolumeSMA(activeCandles, volParams.ma1), [activeCandles, volParams.ma1]);
  const fullVolMa2 = useMemo(() => calculateVolumeSMA(activeCandles, volParams.ma2), [activeCandles, volParams.ma2]);

  // Bounds & displayed slice
  const safeStartIndexFloat = Math.max(0, Math.min(startIndex, Math.max(0, activeCandles.length - 10)));
  const safeStartIndex = Math.floor(safeStartIndexFloat);
  const safeEndIndex = Math.min(activeCandles.length, safeStartIndex + visibleCount + 2);
  const displayedCandles = useMemo(() => activeCandles.slice(safeStartIndex, safeEndIndex), [activeCandles, safeStartIndex, safeEndIndex]);

  // Current active candle stats (hovered or latest)
  const activeCandleIndex = hoverIndex !== null ? hoverIndex : Math.max(0, safeEndIndex - 1);
  const fallbackCandle: Candle = { open: 0, close: 0, high: 0, low: 0, volume: 0, time: "" };
  const currentCandle: Candle = activeCandles[activeCandleIndex] || activeCandles[activeCandles.length - 1] || fallbackCandle;
  const currentChange = currentCandle.close - currentCandle.open;
  const currentChangePercent = currentCandle.open > 0 ? (currentChange / currentCandle.open) * 100 : 0;
  const isUp = currentCandle.close >= currentCandle.open;

  // Chart Layout Metrics: dynamically adapted to normal and full-screen viewports
  const rightMargin = isExpanded ? Math.max(76, Math.min(96, Math.floor(dimensions.width * 0.065))) : 72;
  const bottomMargin = isExpanded ? 30 : 26; // X-axis date area
  const chartWidth = Math.max(100, dimensions.width - rightMargin);
  const totalChartHeight = Math.max(200, dimensions.height - bottomMargin);

  // Sub-charts Layout: Volume is an independent, dedicated sub-chart area directly below the K-line main chart
  const otherSubCharts = [showPSY, showKDJ, showMACD].filter(Boolean);
  const otherSubCount = otherSubCharts.length;

  // Dedicated height for independent Volume sub-chart:
  // In full-screen mode, provides enhanced visual height with higher bounds so volume bars and volume MAs
  // have ample breathing room while preserving dominant vertical amplitude for the main candlestick chart.
  const volChartHeight = showVolume
    ? isExpanded
      ? otherSubCount > 0
        ? Math.min(130, Math.max(88, totalChartHeight * 0.17))
        : Math.min(160, Math.max(105, totalChartHeight * 0.22))
      : otherSubCount > 0
        ? Math.min(96, Math.max(68, totalChartHeight * 0.20))
        : Math.min(125, Math.max(82, totalChartHeight * 0.25))
    : 0;

  // Secondary sub-charts (PSY, KDJ, MACD) height when active:
  const otherSubChartHeight = otherSubCount > 0
    ? isExpanded
      ? Math.min(110, Math.max(70, (totalChartHeight * 0.22) / otherSubCount))
      : Math.min(85, Math.max(55, (totalChartHeight * 0.22) / otherSubCount))
    : 0;

  // Main K-line chart height: in full-screen mode enjoys dominant vertical proportion (typically 500px-750px+)
  const mainHeight = Math.max(140, totalChartHeight - volChartHeight - otherSubCount * otherSubChartHeight);

  // Unified Candle & Volume Color Synchronizer:
  // Guarantees 100% color synchronization between K-line candlesticks and Volume bars
  const getCandleColor = useCallback((c: Candle, idx: number) => {
    if (c.close > c.open) return upColor;
    if (c.close < c.open) return downColor;
    const origIdx = safeStartIndex + idx;
    const prev = origIdx > 0 ? activeCandles[origIdx - 1] : null;
    if (prev) {
      return c.close >= prev.close ? upColor : downColor;
    }
    return upColor;
  }, [upColor, downColor, safeStartIndex, activeCandles]);

  // Price Bounds Calculation with D3 linear scale
  const priceValues = useMemo(() => {
    if (displayedCandles.length === 0) return [100, 105];
    const highs = displayedCandles.map(c => c.high);
    const lows = displayedCandles.map(c => c.low);
    const arr = [...highs, ...lows];
    if (showBoll) {
      for (let i = safeStartIndex; i < safeEndIndex; i++) {
        if (fullBoll.upper[i]) arr.push(fullBoll.upper[i] as number);
        if (fullBoll.lower[i]) arr.push(fullBoll.lower[i] as number);
      }
    }
    return arr;
  }, [displayedCandles, showBoll, fullBoll, safeStartIndex, safeEndIndex]);

  const maxPrice = Math.max(...priceValues);
  const minPrice = Math.min(...priceValues);
  const priceRange = maxPrice - minPrice || 1;
  const paddedMax = maxPrice + priceRange * 0.03;
  const paddedMin = Math.max(0.01, minPrice - priceRange * 0.03);

  // D3 Scales
  const yScale = useMemo(() => {
    return d3.scaleLinear()
      .domain([paddedMin, paddedMax])
      .range([mainHeight, 0]);
  }, [paddedMin, paddedMax, mainHeight]);

  const yTicks = useMemo(() => {
    return yScale.ticks(5);
  }, [yScale]);

  // X Slot Sizing
  const baseCount = Math.min(activeCandles.length, visibleCount);
  const candleSlotWidth = chartWidth / (baseCount || 1);
  const offsetX = (safeStartIndexFloat - safeStartIndex) * candleSlotWidth;

  const getCenterX = useCallback((idx: number) => {
    return idx * candleSlotWidth - offsetX + overscrollX + candleSlotWidth / 2;
  }, [candleSlotWidth, offsetX, overscrollX]);

  // High & Low Candles in View
  const { highestCandle, lowestCandle } = useMemo(() => {
    let highVal = -Infinity;
    let highIdx = -1;
    let lowVal = Infinity;
    let lowIdx = -1;

    displayedCandles.forEach((c, idx) => {
      if (c.high > highVal) {
        highVal = c.high;
        highIdx = idx;
      }
      if (c.low < lowVal) {
        lowVal = c.low;
        lowIdx = idx;
      }
    });

    return {
      highestCandle: highIdx >= 0 ? { price: highVal, idx: highIdx, x: getCenterX(highIdx), y: yScale(highVal) } : null,
      lowestCandle: lowIdx >= 0 ? { price: lowVal, idx: lowIdx, x: getCenterX(lowIdx), y: yScale(lowVal) } : null,
    };
  }, [displayedCandles, getCenterX, yScale]);

  // Candlestick Geometry calculation with guaranteed slot spacing (Prevents overlap)
  // barWidth is strictly capped at 72% of slot width, ensuring at least 28% gap between adjacent candles!
  const candleBarWidth = Math.max(2, Math.min(26, candleSlotWidth * 0.72));

  // Area Path Generators with D3
  const areaPath = useMemo(() => {
    if (localChartType !== "area" || displayedCandles.length === 0) return "";
    const areaGen = d3.area<Candle>()
      .x((_, idx) => getCenterX(idx))
      .y0(mainHeight)
      .y1((d) => yScale(d.close))
      .curve(d3.curveMonotoneX);
    return areaGen(displayedCandles) || "";
  }, [localChartType, displayedCandles, getCenterX, yScale, mainHeight]);

  const areaLinePath = useMemo(() => {
    if (localChartType !== "area" || displayedCandles.length === 0) return "";
    const lineGen = d3.line<Candle>()
      .x((_, idx) => getCenterX(idx))
      .y((d) => yScale(d.close))
      .curve(d3.curveMonotoneX);
    return lineGen(displayedCandles) || "";
  }, [localChartType, displayedCandles, getCenterX, yScale]);

  // Indicator Line Path Generator using D3
  const generateIndicatorPath = useCallback((lineData: (number | null)[]) => {
    const points: { val: number; idx: number }[] = [];
    for (let i = 0; i < displayedCandles.length; i++) {
      const origIdx = safeStartIndex + i;
      const val = lineData[origIdx];
      if (val !== null && val !== undefined && !isNaN(val)) {
        points.push({ val, idx: i });
      }
    }
    const lineGen = d3.line<{ val: number; idx: number }>()
      .defined(d => d.val !== null && !isNaN(d.val))
      .x(d => getCenterX(d.idx))
      .y(d => yScale(d.val))
      .curve(d3.curveLinear);
    return lineGen(points) || "";
  }, [displayedCandles.length, safeStartIndex, getCenterX, yScale]);

  // Volume scale & calculations for independent Volume sub-chart
  const maxVolume = useMemo(() => {
    const vols = displayedCandles.map(c => c.volume || 0);
    return Math.max(...vols, 1);
  }, [displayedCandles]);

  const volYScale = useMemo(() => {
    return d3.scaleLinear()
      .domain([0, maxVolume])
      .range([volChartHeight - 6, 20]);
  }, [maxVolume, volChartHeight]);

  // Volume MA Lines with D3
  const generateVolMAPath = useCallback((volMaData: (number | null)[], volTop: number) => {
    if (!showVolume || volChartHeight <= 0) return "";
    const points: { val: number; idx: number }[] = [];
    for (let i = 0; i < displayedCandles.length; i++) {
      const origIdx = safeStartIndex + i;
      const val = volMaData[origIdx];
      if (val !== null && val !== undefined && !isNaN(val)) {
        points.push({ val, idx: i });
      }
    }
    const lineGen = d3.line<{ val: number; idx: number }>()
      .defined(d => d.val !== null && !isNaN(d.val))
      .x(d => getCenterX(d.idx))
      .y(d => volTop + volYScale(d.val))
      .curve(d3.curveLinear);
    return lineGen(points) || "";
  }, [showVolume, volChartHeight, displayedCandles.length, safeStartIndex, getCenterX, volYScale]);

  // Mouse & Touch Drag / Hover Handlers with requestAnimationFrame
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastPointerX = useRef(0);
  const touchPinchDist = useRef<number | null>(null);

  // RequestAnimationFrame scheduler for pointer and crosshair updates
  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const rafPointerRef = useRef<number | null>(null);

  const processPointerMove = useCallback(() => {
    rafPointerRef.current = null;
    if (!pendingPointerRef.current) return;
    const { clientX, clientY } = pendingPointerRef.current;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // 1. Crosshair & Candlestick Inspection (按住滑动实时追踪准星线与价格数据)
    if (mouseX >= 0 && mouseX <= chartWidth && mouseY >= 0 && mouseY <= totalChartHeight) {
      const slotW = chartWidth / (baseCount || 1);
      const offset = (safeStartIndexFloat - safeStartIndex) * slotW;
      const effectiveX = mouseX - overscrollRef.current;
      const idxInDisplayed = Math.floor((effectiveX + offset) / slotW);
      const targetIndex = safeStartIndex + idxInDisplayed;

      if (targetIndex >= 0 && targetIndex < activeCandles.length) {
        setHoverIndex(targetIndex);
        setHoverY(mouseY);
      }
    } else if (!isDraggingRef.current) {
      setHoverIndex(null);
      setHoverY(null);
    }

    // 2. Drag-to-pan continuous view transformation with boundary edge glow & bounce feedback (按住鼠标左键滑动拖拽看K线)
    if (isDraggingRef.current && visibleCount > 0) {
      const deltaX = clientX - lastPointerX.current;
      lastPointerX.current = clientX;

      if (touchMode === "pan") {
        const candleSlotW = chartWidth / (visibleCount || 1);
        if (candleSlotW > 0 && Math.abs(deltaX) > 0.05) {
          const deltaCandles = deltaX / candleSlotW;
          const maxStart = Math.max(0, activeCandles.length - visibleCount);

          setStartIndex(prev => {
            const target = prev - deltaCandles;
            if (target < 0) {
              // Pulled past earliest historical data (Start boundary glow & slight rubber-band)
              const resistance = Math.max(0.08, 1 - Math.abs(overscrollRef.current) / 36);
              overscrollRef.current = Math.min(28, overscrollRef.current + deltaX * resistance * 0.45);
              setOverscrollX(overscrollRef.current);
              triggerEdgeFeedback("start");
              return 0;
            } else if (target > maxStart) {
              // Pulled past latest real-time data (End boundary glow & slight rubber-band)
              const resistance = Math.max(0.08, 1 - Math.abs(overscrollRef.current) / 36);
              overscrollRef.current = Math.max(-28, overscrollRef.current + deltaX * resistance * 0.45);
              setOverscrollX(overscrollRef.current);
              triggerEdgeFeedback("end");
              return maxStart;
            } else {
              // Normal panning inside valid historical boundaries
              if (overscrollRef.current !== 0) {
                overscrollRef.current = overscrollRef.current * 0.5;
                if (Math.abs(overscrollRef.current) < 0.25) {
                  overscrollRef.current = 0;
                  setEdgeGlow(null);
                }
                setOverscrollX(overscrollRef.current);
              }
              return target;
            }
          });
        }
      }
    }
  }, [chartWidth, totalChartHeight, baseCount, safeStartIndexFloat, safeStartIndex, activeCandles.length, touchMode, visibleCount, triggerEdgeFeedback]);

  const handlePointerDown = (clientX: number, clientY: number, button = 0) => {
    if (button !== 0) return; // Only trigger on primary mouse button (left-click)
    isDraggingRef.current = true;
    setIsDragging(true);
    lastPointerX.current = clientX;

    // Immediately trigger inspect on click/down so the crosshair line and tooltip show up instantly
    pendingPointerRef.current = { clientX, clientY };
    processPointerMove();
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    pendingPointerRef.current = { clientX, clientY };
    if (rafPointerRef.current === null) {
      rafPointerRef.current = requestAnimationFrame(processPointerMove);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (rafPointerRef.current !== null) {
      cancelAnimationFrame(rafPointerRef.current);
      rafPointerRef.current = null;
    }
    if (overscrollRef.current !== 0) {
      bounceBackAnimation();
    }
  };

  const handlePointerLeave = () => {
    if (!isDraggingRef.current) {
      if (rafPointerRef.current !== null) {
        cancelAnimationFrame(rafPointerRef.current);
        rafPointerRef.current = null;
      }
      setHoverIndex(null);
      setHoverY(null);
    } else {
      if (overscrollRef.current !== 0) {
        bounceBackAnimation();
      }
    }
  };

  // Pointer Events with PointerCapture (ensures continuous dragging without losing focus)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Don't drag if user clicked on button inside the container
    if ((e.target as HTMLElement).closest("button")) return;

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    handlePointerDown(e.clientX, e.clientY, e.button);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    handlePointerUp();
  };

  const onPointerLeave = () => {
    handlePointerLeave();
  };

  // Touch Events (Multi-touch pinch zoom support)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchDist.current = dist;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = touchPinchDist.current - dist;
      if (Math.abs(delta) > 10) {
        if (delta > 0) {
          setVisibleCount(prev => Math.min(activeCandles.length, Math.floor(prev * 1.08)));
        } else {
          setVisibleCount(prev => Math.max(10, Math.floor(prev * 0.92)));
        }
        touchPinchDist.current = dist;
      }
    }
  };

  const onTouchEnd = () => {
    touchPinchDist.current = null;
  };

  // Wheel Zoom & Pan with RAF and cursor-anchored view transformation
  const pendingWheelRef = useRef<{ deltaX: number; deltaY: number; clientX: number } | null>(null);
  const rafWheelRef = useRef<number | null>(null);

  const processWheel = useCallback(() => {
    rafWheelRef.current = null;
    if (!pendingWheelRef.current) return;
    const { deltaX, deltaY, clientX } = pendingWheelRef.current;
    pendingWheelRef.current = null;

    // 1. Horizontal Pan (Trackpad or Shift + Wheel)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 1.5) {
      const candleSlotW = chartWidth / (visibleCount || 1);
      if (candleSlotW > 0) {
        const deltaCandles = deltaX / candleSlotW;
        const maxStart = Math.max(0, activeCandles.length - visibleCount);
        setStartIndex(prev => {
          const target = prev + deltaCandles;
          if (target < 0) {
            triggerEdgeFeedback("start", 12);
            return 0;
          } else if (target > maxStart) {
            triggerEdgeFeedback("end", -12);
            return maxStart;
          }
          return target;
        });
      }
      return;
    }

    // 2. Cursor-Anchored Time Window Zoom
    if (Math.abs(deltaY) > 1) {
      const container = containerRef.current;
      const rect = container ? container.getBoundingClientRect() : null;
      const mouseX = rect ? Math.max(0, Math.min(chartWidth, clientX - rect.left)) : chartWidth / 2;
      const cursorRatio = mouseX / (chartWidth || 1); // 0 (left edge) to 1 (right edge)

      const zoomFactor = deltaY < 0 
        ? Math.max(0.72, 1 + deltaY * 0.0018) 
        : Math.min(1.38, 1 + deltaY * 0.0018);

      setVisibleCount(prevVisible => {
        const targetVisible = Math.max(10, Math.min(activeCandles.length, Math.round(prevVisible * zoomFactor)));
        if (targetVisible === prevVisible) return prevVisible;

        // Anchor the exact candle under cursor so the view transforms smoothly around the pointer
        const deltaCount = prevVisible - targetVisible;
        setStartIndex(currentStart => {
          return Math.max(0, Math.min(activeCandles.length - targetVisible, currentStart + deltaCount * cursorRatio));
        });

        return targetVisible;
      });
    }
  }, [chartWidth, visibleCount, activeCandles.length]);

  // Non-passive wheel event listener attached directly to container DOM element
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      pendingWheelRef.current = {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        clientX: e.clientX,
      };
      if (rafWheelRef.current === null) {
        rafWheelRef.current = requestAnimationFrame(processWheel);
      }
    };

    container.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onNativeWheel);
    };
  }, [processWheel]);

  // Quick Controls
  const handlePanLeft = () => {
    setStartIndex(prev => {
      const target = prev - Math.max(5, Math.floor(visibleCount * 0.25));
      if (target <= 0) {
        triggerEdgeFeedback("start", 12);
        return 0;
      }
      return target;
    });
  };

  const handlePanRight = () => {
    setStartIndex(prev => {
      const maxStart = Math.max(0, activeCandles.length - visibleCount);
      const target = prev + Math.max(5, Math.floor(visibleCount * 0.25));
      if (target >= maxStart) {
        triggerEdgeFeedback("end", -12);
        return maxStart;
      }
      return target;
    });
  };

  const handleJumpToLatest = () => {
    if (activeCandles.length > 0) {
      const maxStart = Math.max(0, activeCandles.length - visibleCount);
      setStartIndex(maxStart);
      triggerEdgeFeedback("end", -10);
    }
  };
  const handleZoomIn = () => setVisibleCount(prev => Math.max(10, Math.floor(prev * 0.75)));
  const handleZoomOut = () => setVisibleCount(prev => Math.min(activeCandles.length, Math.floor(prev * 1.3)));
  const handleResetZoom = () => {
    const initCount = Math.min(38, activeCandles.length);
    setVisibleCount(initCount);
    setStartIndex(activeCandles.length - initCount);
    overscrollRef.current = 0;
    setOverscrollX(0);
    setEdgeGlow(null);
  };

  // Cleanup all RAF and bounce callbacks on unmount
  useEffect(() => {
    return () => {
      if (rafDrawId.current !== null) cancelAnimationFrame(rafDrawId.current);
      if (rafPointerRef.current !== null) cancelAnimationFrame(rafPointerRef.current);
      if (rafWheelRef.current !== null) cancelAnimationFrame(rafWheelRef.current);
      if (bounceRafRef.current !== null) cancelAnimationFrame(bounceRafRef.current);
      if (edgeGlowTimeoutRef.current !== null) clearTimeout(edgeGlowTimeoutRef.current);
    };
  }, []);

  // Export CSV
  const handleExportCSV = () => {
    if (!displayedCandles || displayedCandles.length === 0) return;
    const headers = ["时间(Time)", "开盘价(Open)", "最高价(High)", "最低价(Low)", "收盘价(Close)", "成交量(Volume)"];
    const rows = displayedCandles.map(c => [`"${c.time}"`, c.open, c.high, c.low, c.close, c.volume]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${symbol}_kline_${cycleType}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Hovered Candle Data & Dynamic Tooltip
  const hoveredCandle = hoverIndex !== null ? activeCandles[hoverIndex] : null;
  const hoveredX = hoverIndex !== null ? getCenterX(hoverIndex - safeStartIndex) : null;

  // Precise Crosshair Snapping Engine:
  // Snaps vertical and horizontal lines directly to candle positions and key OHLC levels
  const snappedCrosshair = useMemo(() => {
    if (!hoveredCandle || hoveredX === null) return null;

    const closeY = yScale(hoveredCandle.close);
    const openY = yScale(hoveredCandle.open);
    const highY = yScale(hoveredCandle.high);
    const lowY = yScale(hoveredCandle.low);

    // Free floating mode: follows raw pointer coordinates
    if (crosshairSnapMode === "free") {
      const targetY = hoverY !== null && hoverY >= 0 && hoverY <= totalChartHeight ? hoverY : closeY;
      const isMain = targetY <= mainHeight;
      const isVol = showVolume && targetY > mainHeight && targetY <= mainHeight + volChartHeight;
      const priceVal = isMain ? paddedMax - (targetY / mainHeight) * (paddedMax - paddedMin) : null;
      return {
        x: hoveredX,
        y: targetY,
        snappedPrice: priceVal,
        snappedVolume: isVol ? hoveredCandle.volume : null,
        pointType: isVol ? ("volume" as const) : ("free" as const),
        pointLabel: isVol ? "量" : "准星",
        isMainChart: isMain,
        isVolumeChart: isVol,
        closeY,
        openY,
        highY,
        lowY,
      };
    }

    // Close Snap Mode: strictly locks horizontal line to Close price
    if (crosshairSnapMode === "close") {
      return {
        x: hoveredX,
        y: closeY,
        snappedPrice: hoveredCandle.close,
        snappedVolume: null,
        pointType: "close" as const,
        pointLabel: "收",
        isMainChart: true,
        isVolumeChart: false,
        closeY,
        openY,
        highY,
        lowY,
      };
    }

    // Default: "ohlc" Smart Magnetic Snap Mode
    // 1. If pointer is inside the main price chart, snap to the nearest OHLC cardinal price level of this candle
    if (hoverY !== null && hoverY <= mainHeight) {
      const candidates = [
        { type: "close" as const, label: "收", price: hoveredCandle.close, y: closeY },
        { type: "open" as const, label: "开", price: hoveredCandle.open, y: openY },
        { type: "high" as const, label: "高", price: hoveredCandle.high, y: highY },
        { type: "low" as const, label: "低", price: hoveredCandle.low, y: lowY },
      ];

      // Find candidate with minimum vertical distance to cursor
      let closest = candidates[0];
      let minDiff = Math.abs(hoverY - closest.y);
      for (let i = 1; i < candidates.length; i++) {
        const diff = Math.abs(hoverY - candidates[i].y);
        if (diff < minDiff) {
          minDiff = diff;
          closest = candidates[i];
        }
      }

      return {
        x: hoveredX,
        y: closest.y,
        snappedPrice: closest.price,
        snappedVolume: null,
        pointType: closest.type,
        pointLabel: closest.label,
        isMainChart: true,
        isVolumeChart: false,
        closeY,
        openY,
        highY,
        lowY,
      };
    } else if (showVolume && hoverY !== null && hoverY > mainHeight && hoverY <= mainHeight + volChartHeight) {
      // 2. Pointer is in the independent Volume sub-chart area: snap directly to the volume bar top
      const plotH = volChartHeight - 24;
      const volBarH = Math.max(1.5, ((hoveredCandle.volume || 0) / maxVolume) * plotH);
      const volBarTop = mainHeight + volChartHeight - volBarH - 2;

      return {
        x: hoveredX,
        y: volBarTop,
        snappedPrice: null,
        snappedVolume: hoveredCandle.volume,
        pointType: "volume" as const,
        pointLabel: "量",
        isMainChart: false,
        isVolumeChart: true,
        closeY,
        openY,
        highY,
        lowY,
      };
    } else if (hoverY !== null && hoverY > mainHeight) {
      // 3. Pointer is in secondary sub-chart indicators area (PSY, KDJ, MACD)
      return {
        x: hoveredX,
        y: hoverY,
        snappedPrice: null,
        snappedVolume: null,
        pointType: "subchart" as const,
        pointLabel: "指标",
        isMainChart: false,
        isVolumeChart: false,
        closeY,
        openY,
        highY,
        lowY,
      };
    }

    // Fallback: lock to close price
    return {
      x: hoveredX,
      y: closeY,
      snappedPrice: hoveredCandle.close,
      snappedVolume: null,
      pointType: "close" as const,
      pointLabel: "收",
      isMainChart: true,
      isVolumeChart: false,
      closeY,
      openY,
      highY,
      lowY,
    };
  }, [hoveredCandle, hoveredX, hoverY, crosshairSnapMode, yScale, mainHeight, volChartHeight, showVolume, maxVolume, totalChartHeight, paddedMax, paddedMin]);

  const hoveredY = snappedCrosshair ? snappedCrosshair.y : null;

  // Latest Price Reference
  const latestClose = activeCandles[activeCandles.length - 1]?.close;
  const latestCloseY = latestClose ? yScale(latestClose) : null;

  // Tooltip Placement: Intelligently flips left/right so it never gets clipped or covers the candle,
  // and strictly stays within the SVG container boundaries even when hovering near the extreme left or right edges of the chart area.
  const tooltipStyle = useMemo(() => {
    if (hoveredX === null) return {};
    const cardWidth = 240;
    const cardHeight = (activeMAs.ma1 || activeMAs.ma2 || activeMAs.ma3) ? 230 : 205;
    const paddingX = 8;
    const paddingY = 8;
    const offsetFromCursor = 16;

    const svgWidth = dimensions.width || 800;
    const svgHeight = dimensions.height || 500;

    // Check available clearance to the right and left of the cursor / candle
    const spaceOnRight = svgWidth - (hoveredX + offsetFromCursor);
    const spaceOnLeft = hoveredX - offsetFromCursor;

    const canFitOnRight = spaceOnRight >= cardWidth + paddingX;
    const canFitOnLeft = spaceOnLeft >= cardWidth + paddingX;

    let targetLeft: number;
    if (canFitOnRight && !canFitOnLeft) {
      // Near extreme left edge of chart area: place to the right of cursor
      targetLeft = hoveredX + offsetFromCursor;
    } else if (canFitOnLeft && !canFitOnRight) {
      // Near extreme right edge of chart area: place to the left of cursor
      targetLeft = hoveredX - cardWidth - offsetFromCursor;
    } else if (canFitOnRight && canFitOnLeft) {
      // Both sides have ample clearance: flip based on center of chart area
      if (hoveredX < chartWidth * 0.5) {
        targetLeft = hoveredX + offsetFromCursor;
      } else {
        targetLeft = hoveredX - cardWidth - offsetFromCursor;
      }
    } else {
      // Constrained viewport: pick whichever side has more room
      if (spaceOnRight >= spaceOnLeft) {
        targetLeft = hoveredX + offsetFromCursor;
      } else {
        targetLeft = hoveredX - cardWidth - offsetFromCursor;
      }
    }

    // Strict boundary clamping so tooltip NEVER breaches SVG horizontal boundaries
    const minLeft = paddingX;
    const maxLeft = Math.max(minLeft, svgWidth - cardWidth - paddingX);
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, targetLeft));

    // Vertical positioning: centered near the cursor, strictly clamped within SVG vertical boundaries
    const idealTop = (hoveredY ?? 60) - 40;
    const minTop = paddingY;
    const maxTop = Math.max(minTop, svgHeight - cardHeight - paddingY);
    const clampedTop = Math.max(minTop, Math.min(maxTop, idealTop));

    return {
      left: `${clampedLeft}px`,
      top: `${clampedTop}px`,
    };
  }, [hoveredX, hoveredY, dimensions.width, dimensions.height, chartWidth, activeMAs.ma1, activeMAs.ma2, activeMAs.ma3]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.985, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={`transition-all duration-300 ${
        isExpanded
          ? "fixed inset-0 z-[100] w-screen h-screen m-0 p-3 sm:p-4 md:p-5 rounded-none border-none bg-slate-950/98 backdrop-blur-md flex flex-col justify-between overflow-hidden shadow-2xl"
          : "bg-theme-card border border-theme-border rounded-2xl p-3 md:p-5 flex flex-col justify-between transition-colors duration-300 shadow-sm"
      }`} 
      id="kline-chart-section"
    >
      
      {/* 1. Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-theme-border text-xs select-none">
        
        {/* Left: Stock Name & Timeframe Cycle Tabs */}
        <div className="flex items-center gap-2.5 flex-wrap max-w-full">
          <div className="flex items-center gap-2">
            <Layers className="text-indigo-500" size={18} />
            <h3 className="font-bold text-base text-theme-text-heading font-mono tracking-tight flex items-center gap-1.5">
              <span>{name || symbol}</span>
              <span className="text-xs text-theme-text-muted font-normal">({symbol})</span>
            </h3>
            {isExpanded && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold animate-in fade-in duration-200">
                <Maximize2 size={11} />
                <span>全屏宽景模式</span>
              </span>
            )}
          </div>

          {/* Timeframe Cycles (5分, 时K, 日K, 周K, 月K, 年K) */}
          <div className="flex bg-theme-panel p-0.5 rounded-lg border border-theme-border overflow-x-auto max-w-full scrollbar-none">
            {(["5M", "60M", "1D", "1W", "1M", "1Y"] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => {
                  setCycleType(cycle);
                  if (onRangeChange) onRangeChange(cycle);
                }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs cursor-pointer whitespace-nowrap ${
                  cycleType === cycle ? "bg-theme-card text-indigo-500 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
                }`}
              >
                {cycle === "5M" ? "5分" : cycle === "60M" ? "时K" : cycle === "1D" ? "日K" : cycle === "1W" ? "周K" : cycle === "1M" ? "月K" : "年K"}
              </button>
            ))}
          </div>

          {/* Chart Type Toggle (Candlestick, Hollow, Area, OHLC) */}
          <div className="flex bg-theme-panel p-0.5 rounded-lg border border-theme-border">
            <button
              onClick={() => setLocalChartType("candlestick")}
              className={`px-2 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                localChartType === "candlestick" ? "bg-theme-card text-indigo-500 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              蜡烛图
            </button>
            <button
              onClick={() => setLocalChartType("hollow")}
              className={`px-2 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                localChartType === "hollow" ? "bg-theme-card text-indigo-500 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              空心K
            </button>
            <button
              onClick={() => setLocalChartType("area")}
              className={`px-2 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                localChartType === "area" ? "bg-theme-card text-indigo-500 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              分时图
            </button>
            <button
              onClick={() => setLocalChartType("ohlc")}
              className={`px-2 py-1 rounded-md font-bold transition text-xs cursor-pointer ${
                localChartType === "ohlc" ? "bg-theme-card text-indigo-500 shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              美国线
            </button>
          </div>
        </div>

        {/* Right: Technical Indicator Toggle Pills */}
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <div className="flex bg-theme-panel p-0.5 rounded-lg border border-theme-border text-[11px] font-mono overflow-x-auto scrollbar-none">
            <button
              onClick={() => setShowBoll(!showBoll)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${showBoll ? "bg-indigo-600 text-white font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
            >
              BOLL
            </button>
            <button
              onClick={() => setShowBBI(!showBBI)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${showBBI ? "bg-indigo-600 text-white font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
            >
              BBI
            </button>
            <button
              onClick={() => setShowPSY(!showPSY)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${showPSY ? "bg-indigo-600 text-white font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
            >
              PSY
            </button>
            <button
              onClick={() => setShowKDJ(!showKDJ)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${showKDJ ? "bg-indigo-600 text-white font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
            >
              KDJ
            </button>
            <button
              onClick={() => setShowVolume(!showVolume)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${showVolume ? "bg-indigo-600 text-white font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
            >
              VOL
            </button>
            <button
              onClick={() => setShowMACD(!showMACD)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${showMACD ? "bg-indigo-600 text-white font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
            >
              MACD
            </button>
          </div>

          {/* Density Preset Control (舒展 / 适中 / 密集 / 全景) */}
          <div className="flex bg-theme-panel p-0.5 rounded-lg border border-theme-border text-[11px]">
            <button
              onClick={() => {
                const count = Math.min(30, activeCandles.length);
                setVisibleCount(count);
                setStartIndex(Math.max(0, activeCandles.length - count));
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount <= 32 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="舒展模式（每根K线间隙充裕）"
            >
              舒展
            </button>
            <button
              onClick={() => {
                const count = Math.min(48, activeCandles.length);
                setVisibleCount(count);
                setStartIndex(Math.max(0, activeCandles.length - count));
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount > 32 && visibleCount <= 55 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="适中模式"
            >
              适中
            </button>
            <button
              onClick={() => {
                const count = Math.min(75, activeCandles.length);
                setVisibleCount(count);
                setStartIndex(Math.max(0, activeCandles.length - count));
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount > 55 && visibleCount < activeCandles.length - 5 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="紧凑模式"
            >
              紧凑
            </button>
            <button
              onClick={() => {
                const count = activeCandles.length;
                setVisibleCount(count);
                setStartIndex(0);
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount >= activeCandles.length - 5 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="全景视野（查看全部历史K线）"
            >
              全景
            </button>
          </div>

          <div className="flex items-center gap-1 border-l border-theme-border pl-2">
            <button onClick={handleZoomIn} className="p-1.5 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover cursor-pointer" title="放大">
              <ZoomIn size={16} />
            </button>
            <button onClick={handleZoomOut} className="p-1.5 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover cursor-pointer" title="缩小">
              <ZoomOut size={16} />
            </button>
            <button onClick={handleResetZoom} className="p-1.5 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover cursor-pointer" title="复位">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={handleExportCSV}
              className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition flex items-center gap-1 font-semibold cursor-pointer border border-emerald-500/20"
              title="导出当前可见K线数据为CSV"
            >
              <Download size={15} />
              <span className="text-[11px] hidden sm:inline">导出CSV</span>
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition flex items-center gap-1 font-semibold border border-indigo-500/20 cursor-pointer"
              title="指标设置"
            >
              <Settings size={15} />
              <span className="text-[11px] hidden sm:inline">设置</span>
            </button>
            <button
              onClick={toggleFullScreen}
              className={`p-1.5 rounded-md transition border cursor-pointer flex items-center gap-1 font-semibold ${
                isExpanded
                  ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border-rose-500/40 shadow-xs"
                  : "bg-theme-panel text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover border-theme-border"
              }`}
              title={isExpanded ? "退出全屏 (ESC)" : "全屏模式 (获得更宽广的历史K线视野)"}
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span className="text-[11px] hidden sm:inline">
                {isExpanded ? "退出全屏" : "全屏"}
              </span>
              {isExpanded && (
                <kbd className="hidden lg:inline px-1 py-0.2 bg-slate-900/80 border border-slate-700 text-[9px] rounded text-slate-400 font-mono">
                  ESC
                </kbd>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live Candle Real-Time Metrics & Indicators Legend Banner */}
      <div className="bg-theme-panel/80 p-2.5 sm:p-3 rounded-xl border border-theme-border mb-2 font-mono text-xs md:text-sm leading-relaxed text-theme-text-primary select-none shadow-2xs">
        {/* Row 1: OHLC & Volume Data */}
        <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1.5 font-semibold">
          {hoverIndex !== null && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span>{snappedCrosshair?.pointLabel && crosshairSnapMode !== "free" ? `准星吸附 · ${snappedCrosshair.pointLabel}` : "准星定位"}</span>
            </span>
          )}
          <span><strong className="text-theme-text-muted font-normal text-xs">时间:</strong> <span className="price-digit text-theme-text-heading">{currentCandle.time || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal text-xs">开:</strong> <span className="price-digit text-theme-text-heading">${currentCandle.open?.toFixed(2) || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal text-xs">高:</strong> <span className="price-digit text-red-500">${currentCandle.high?.toFixed(2) || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal text-xs">低:</strong> <span className="price-digit text-emerald-500">${currentCandle.low?.toFixed(2) || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal text-xs">收:</strong> <span className={`price-digit ${isUp ? (isUpRed ? "text-red-500" : "text-emerald-500") : (isUpRed ? "text-emerald-500" : "text-red-500")}`}>${currentCandle.close?.toFixed(2) || "--"}</span></span>
          
          <span className="flex items-center gap-1">
            <strong className="text-theme-text-muted font-normal text-xs">涨跌:</strong> 
            <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded border font-semibold price-digit text-xs shadow-2xs ${
              currentChangePercent >= 0 
                ? isUpRed ? "bg-red-500/15 text-red-500 border-red-500/30" : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                : isUpRed ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : "bg-red-500/15 text-red-500 border-red-500/30"
            }`}>
              {currentChange >= 0 ? "+" : ""}${currentChange.toFixed(2)} ({currentChangePercent >= 0 ? "+" : ""}{currentChangePercent.toFixed(2)}%)
            </span>
          </span>

          <span>
            <strong className="text-theme-text-muted font-normal text-xs">振幅:</strong> 
            <span className="price-digit text-theme-text-heading ml-1">
              {currentCandle.open > 0 ? (((currentCandle.high - currentCandle.low) / currentCandle.open) * 100).toFixed(2) : "0.00"}%
            </span>
          </span>

          <span><strong className="text-theme-text-muted font-normal text-xs">成交量:</strong> <span className="price-digit text-theme-text-heading">{((currentCandle.volume || 0) / 10000).toFixed(2)}万</span></span>
        </div>

        {/* Row 2: Overlay & Sub-chart Indicator Values */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-theme-border/60 text-[11px]">
          {showVolume && (
            <>
              <span className="text-theme-text-secondary font-medium">VOL: <span className="price-digit text-theme-text-heading">{((currentCandle.volume || 0) / 10000).toFixed(2)}万</span></span>
              {fullVolMa1[activeCandleIndex] !== null && fullVolMa1[activeCandleIndex] !== undefined && (
                <span className="text-amber-500 font-medium">量MA{volParams.ma1}: <span className="price-digit">{(Number(fullVolMa1[activeCandleIndex]) / 10000).toFixed(2)}万</span></span>
              )}
              {fullVolMa2[activeCandleIndex] !== null && fullVolMa2[activeCandleIndex] !== undefined && (
                <span className="text-sky-500 font-medium">量MA{volParams.ma2}: <span className="price-digit">{(Number(fullVolMa2[activeCandleIndex]) / 10000).toFixed(2)}万</span></span>
              )}
            </>
          )}
          {showBoll && (
            <span className="text-orange-500 font-medium">
              BOLL({bollParams.n},{bollParams.k}) UP: {fullBoll.upper[activeCandleIndex]?.toFixed(2) || "-"} MID: {fullBoll.mid[activeCandleIndex]?.toFixed(2) || "-"} DN: {fullBoll.lower[activeCandleIndex]?.toFixed(2) || "-"}
            </span>
          )}
          {showBBI && (
            <span className="text-sky-500 font-medium">
              BBI: {fullBBI[activeCandleIndex]?.toFixed(2) || "-"}
            </span>
          )}
          {activeMAs.ma1 && <span className="text-amber-500 font-medium">MA{maParams.p1}: {fullMa1[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {activeMAs.ma2 && <span className="text-pink-500 font-medium">MA{maParams.p2}: {fullMa2[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {activeMAs.ma3 && <span className="text-blue-500 font-medium">MA{maParams.p3}: {fullMa3[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {activeMAs.ma4 && <span className="text-purple-500 font-medium">MA{maParams.p4}: {fullMa4[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {activeMAs.ma5 && <span className="text-emerald-500 font-medium">MA{maParams.p5}: {fullMa5[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {showPSY && fullPsy.psy[activeCandleIndex] !== null && (
            <span className="text-orange-400 font-medium">
              PSY: {fullPsy.psy[activeCandleIndex]?.toFixed(1) || "-"} (MA: {fullPsy.maPsy[activeCandleIndex]?.toFixed(1) || "-"})
            </span>
          )}
          {showKDJ && fullKdj[activeCandleIndex]?.k !== null && fullKdj[activeCandleIndex]?.k !== undefined && (
            <span className="text-indigo-400 font-medium">
              KDJ K:{fullKdj[activeCandleIndex]?.k?.toFixed(1)} D:{fullKdj[activeCandleIndex]?.d?.toFixed(1)} J:{fullKdj[activeCandleIndex]?.j?.toFixed(1)}
            </span>
          )}
          {showMACD && fullMacd.dif[activeCandleIndex] !== null && fullMacd.dif[activeCandleIndex] !== undefined && (
            <span className="text-sky-400 font-medium">
              MACD DIF:{fullMacd.dif[activeCandleIndex]?.toFixed(2)} DEA:{fullMacd.dea[activeCandleIndex]?.toFixed(2)} BAR:{fullMacd.macdBar[activeCandleIndex]?.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* 3. Interactive D3.js + SVG Candlestick Engine Container */}
      <div 
        ref={containerRef}
        className={`w-full relative select-none rounded-xl overflow-hidden bg-slate-950 dark:bg-slate-950 border transition-all duration-200 ${
          edgeGlow === "start" 
            ? "border-indigo-500/80 shadow-[inset_6px_0_20px_rgba(99,102,241,0.22)]" 
            : edgeGlow === "end" 
              ? "border-emerald-500/80 shadow-[inset_-6px_0_20px_rgba(16,185,129,0.22)]" 
              : "border-theme-border shadow-xs"
        } ${
          isExpanded ? "flex-1 min-h-[460px]" : "h-[420px] sm:h-[520px] md:h-[620px]"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={handleJumpToLatest}
        style={{ touchAction: "none" }}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className={`w-full h-full block pointer-events-none select-none ${isDragging ? "cursor-grabbing" : touchMode === "pan" ? "cursor-grab" : "cursor-crosshair"}`}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUpRed ? "#EF4444" : "#10B981"} stopOpacity="0.28" />
              <stop offset="100%" stopColor={isUpRed ? "#EF4444" : "#10B981"} stopOpacity="0.0" />
            </linearGradient>
            <clipPath id="mainChartClip">
              <rect x="0" y="0" width={chartWidth} height={mainHeight} />
            </clipPath>
            <clipPath id="volumeChartClip">
              <rect x="0" y={mainHeight} width={chartWidth} height={volChartHeight} />
            </clipPath>
          </defs>

          {/* Background Grid */}
          <g className="grid-lines" opacity="0.45">
            {/* Horizontal Grid lines via D3 ticks */}
            {yTicks.map((price) => {
              const y = yScale(price);
              return (
                <line
                  key={`h-grid-${price}`}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#334155"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  shapeRendering="crispEdges"
                />
              );
            })}
            {/* Vertical Grid lines */}
            {[0.2, 0.4, 0.6, 0.8].map((fraction) => {
              const x = chartWidth * fraction;
              return (
                <line
                  key={`v-grid-${fraction}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={totalChartHeight}
                  stroke="#334155"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  shapeRendering="crispEdges"
                />
              );
            })}
          </g>

          {/* Main Chart Area */}
          <g clipPath="url(#mainChartClip)">
            {/* Area Chart Mode */}
            {localChartType === "area" && (
              <>
                <path d={areaPath} fill="url(#areaGradient)" />
                <path d={areaLinePath} fill="none" stroke={upColor} strokeWidth={2} />
              </>
            )}

            {/* Candlesticks (Standard, Hollow, or OHLC) */}
            {localChartType !== "area" && displayedCandles.map((c, idx) => {
              const centerX = getCenterX(idx);
              // Avoid rendering elements far outside view
              if (centerX < -candleSlotWidth || centerX > chartWidth + candleSlotWidth) return null;

              const isCandleUp = c.close >= c.open;
              const color = getCandleColor(c, idx);

              const highY = yScale(c.high);
              const lowY = yScale(c.low);
              const openY = yScale(c.open);
              const closeY = yScale(c.close);

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(1.8, Math.abs(closeY - openY));
              const candleLeft = centerX - candleBarWidth / 2;

              if (localChartType === "ohlc") {
                // American Bar Chart (OHLC): Center wick + left open tick + right close tick
                return (
                  <g key={`ohlc-${safeStartIndex + idx}`}>
                    <line
                      x1={centerX}
                      y1={highY}
                      x2={centerX}
                      y2={lowY}
                      stroke={color}
                      strokeWidth={1.2}
                      shapeRendering="crispEdges"
                    />
                    <line
                      x1={centerX - candleBarWidth / 2}
                      y1={openY}
                      x2={centerX}
                      y2={openY}
                      stroke={color}
                      strokeWidth={1.2}
                      shapeRendering="crispEdges"
                    />
                    <line
                      x1={centerX}
                      y1={closeY}
                      x2={centerX + candleBarWidth / 2}
                      y2={closeY}
                      stroke={color}
                      strokeWidth={1.2}
                      shapeRendering="crispEdges"
                    />
                  </g>
                );
              }

              return (
                <g key={`candle-${safeStartIndex + idx}`}>
                  {/* Upper & Lower Wick Line */}
                  <line
                    x1={centerX}
                    y1={highY}
                    x2={centerX}
                    y2={lowY}
                    stroke={color}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                  {/* Candle Body Rect */}
                  {localChartType === "hollow" && isCandleUp ? (
                    <rect
                      x={candleLeft}
                      y={bodyTop}
                      width={candleBarWidth}
                      height={bodyHeight}
                      fill="#0F172A"
                      stroke={color}
                      strokeWidth={1.2}
                      shapeRendering="crispEdges"
                    />
                  ) : (
                    <rect
                      x={candleLeft}
                      y={bodyTop}
                      width={candleBarWidth}
                      height={bodyHeight}
                      fill={color}
                      stroke={color}
                      strokeWidth={1}
                      shapeRendering="crispEdges"
                    />
                  )}
                </g>
              );
            })}

            {/* Technical Indicator Overlay Lines */}
            {showBoll && (
              <>
                <path d={generateIndicatorPath(fullBoll.upper)} fill="none" stroke="#F97316" strokeWidth={1.2} opacity={0.85} />
                <path d={generateIndicatorPath(fullBoll.mid)} fill="none" stroke="#3B82F6" strokeWidth={1.2} opacity={0.85} />
                <path d={generateIndicatorPath(fullBoll.lower)} fill="none" stroke="#F97316" strokeWidth={1.2} opacity={0.85} />
              </>
            )}

            {showBBI && (
              <path d={generateIndicatorPath(fullBBI)} fill="none" stroke="#38BDF8" strokeWidth={1.5} opacity={0.9} />
            )}

            {activeMAs.ma1 && <path d={generateIndicatorPath(fullMa1)} fill="none" stroke="#F59E0B" strokeWidth={1.2} />}
            {activeMAs.ma2 && <path d={generateIndicatorPath(fullMa2)} fill="none" stroke="#EC4899" strokeWidth={1.2} />}
            {activeMAs.ma3 && <path d={generateIndicatorPath(fullMa3)} fill="none" stroke="#3B82F6" strokeWidth={1.2} />}
            {activeMAs.ma4 && <path d={generateIndicatorPath(fullMa4)} fill="none" stroke="#8B5CF6" strokeWidth={1.2} />}
            {activeMAs.ma5 && <path d={generateIndicatorPath(fullMa5)} fill="none" stroke="#10B981" strokeWidth={1.2} />}

            {/* High & Low Price Annotations on Main Chart with Non-Overlapping Badges */}
            {highestCandle && (
              <g className="high-annotation">
                <rect
                  x={highestCandle.x > chartWidth / 2 ? highestCandle.x - 84 : highestCandle.x + 8}
                  y={highestCandle.y < 30 ? highestCandle.y + 4 : highestCandle.y - 18}
                  width={76}
                  height={18}
                  rx={4}
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke={upColor}
                  strokeWidth={1}
                />
                <text
                  x={highestCandle.x > chartWidth / 2 ? highestCandle.x - 46 : highestCandle.x + 46}
                  y={highestCandle.y < 30 ? highestCandle.y + 16 : highestCandle.y - 5}
                  textAnchor="middle"
                  fill={upColor}
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  最高 {highestCandle.price.toFixed(2)} ↗
                </text>
              </g>
            )}

            {lowestCandle && (
              <g className="low-annotation">
                <rect
                  x={lowestCandle.x > chartWidth / 2 ? lowestCandle.x - 84 : lowestCandle.x + 8}
                  y={lowestCandle.y > mainHeight - 30 ? lowestCandle.y - 20 : lowestCandle.y + 4}
                  width={76}
                  height={18}
                  rx={4}
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke={downColor}
                  strokeWidth={1}
                />
                <text
                  x={lowestCandle.x > chartWidth / 2 ? lowestCandle.x - 46 : lowestCandle.x + 46}
                  y={lowestCandle.y > mainHeight - 30 ? lowestCandle.y - 7 : lowestCandle.y + 16}
                  textAnchor="middle"
                  fill={downColor}
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  最低 {lowestCandle.price.toFixed(2)} ↘
                </text>
              </g>
            )}

            {/* Current Real-time Price Dashed Line */}
            {latestCloseY !== null && latestCloseY >= 0 && latestCloseY <= mainHeight && (
              <line
                x1={0}
                y1={latestCloseY}
                x2={chartWidth}
                y2={latestCloseY}
                stroke="#EF4444"
                strokeWidth={1}
                strokeDasharray="3 3"
                shapeRendering="crispEdges"
              />
            )}
          </g>

          {/* Right Y-Axis Price Labels */}
          <g className="y-axis-labels">
            {yTicks.map((price) => {
              const y = yScale(price);
              return (
                <text
                  key={`y-tick-${price}`}
                  x={chartWidth + 6}
                  y={y + 4}
                  fill="#94A3B8"
                  fontSize={11}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="start"
                >
                  {price.toFixed(2)}
                </text>
              );
            })}

            {/* Latest Price Right Margin Badge */}
            {latestClose && latestCloseY !== null && (
              <g transform={`translate(${chartWidth + 2}, ${latestCloseY - 9})`}>
                <rect width={66} height={18} rx={3} fill="#EF4444" />
                <text
                  x={33}
                  y={13}
                  fill="#FFFFFF"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {latestClose.toFixed(2)}
                </text>
              </g>
            )}
          </g>

          {/* Sub-Charts Stack (Independent Volume Sub-Chart + Secondary Indicators) */}
          {(() => {
            let runningSubTop = mainHeight;

            return (
              <>
                {/* 1. Independent Volume (成交量) Sub-Chart Area */}
                {showVolume && (() => {
                  const volTop = runningSubTop;
                  runningSubTop += volChartHeight;
                  const plotH = Math.max(20, volChartHeight - 24);

                  return (
                    <g key="subchart-volume" className="subchart-volume">
                      {/* Independent Sub-Chart Background Container */}
                      <rect
                        x={0}
                        y={volTop}
                        width={chartWidth}
                        height={volChartHeight}
                        fill="rgba(15, 23, 42, 0.35)"
                      />

                      {/* Top Separator Line from Main K-line Chart */}
                      <line
                        x1={0}
                        y1={volTop}
                        x2={chartWidth + rightMargin}
                        y2={volTop}
                        stroke="#334155"
                        strokeWidth={1.2}
                        shapeRendering="crispEdges"
                      />

                      {/* 50% Midline Grid */}
                      <line
                        x1={0}
                        y1={volTop + volYScale(maxVolume * 0.5)}
                        x2={chartWidth}
                        y2={volTop + volYScale(maxVolume * 0.5)}
                        stroke="#1E293B"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        shapeRendering="crispEdges"
                      />

                      {/* Sub-Chart Title & Dynamic Legend Header */}
                      <g className="volume-legend">
                        <text x={6} y={volTop + 14} fill="#818CF8" fontSize={11} fontWeight="bold" fontFamily="monospace">
                          成交量 VOL
                        </text>
                        <text x={84} y={volTop + 14} fill="#E2E8F0" fontSize={10} fontFamily="monospace">
                          量: <tspan fontWeight="bold">{((currentCandle.volume || 0) / 10000).toFixed(2)}万</tspan>
                        </text>
                        {fullVolMa1[activeCandleIndex] !== null && fullVolMa1[activeCandleIndex] !== undefined && (
                          <text x={180} y={volTop + 14} fill="#F59E0B" fontSize={10} fontFamily="monospace">
                            MA{volParams.ma1}: {(Number(fullVolMa1[activeCandleIndex]) / 10000).toFixed(2)}万
                          </text>
                        )}
                        {fullVolMa2[activeCandleIndex] !== null && fullVolMa2[activeCandleIndex] !== undefined && (
                          <text x={280} y={volTop + 14} fill="#38BDF8" fontSize={10} fontFamily="monospace">
                            MA{volParams.ma2}: {(Number(fullVolMa2[activeCandleIndex]) / 10000).toFixed(2)}万
                          </text>
                        )}
                        {fullVolMa1[activeCandleIndex] !== null && fullVolMa1[activeCandleIndex] !== undefined && (
                          <text
                            x={380}
                            y={volTop + 14}
                            fill={(currentCandle.volume || 0) >= (fullVolMa1[activeCandleIndex] as number) ? (isUpRed ? "#F87171" : "#34D399") : "#94A3B8"}
                            fontSize={9}
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {(currentCandle.volume || 0) >= (fullVolMa1[activeCandleIndex] as number) ? "▲ 放量" : "▼ 缩量"}
                          </text>
                        )}
                      </g>

                      {/* Right Y-Axis Volume Scale Indicators */}
                      <g className="volume-y-axis">
                        {/* Max volume tick */}
                        <text
                          x={chartWidth + 6}
                          y={volTop + 14}
                          fill="#94A3B8"
                          fontSize={10}
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {(maxVolume / 10000).toFixed(1)}万
                        </text>
                        {/* 50% volume tick */}
                        <text
                          x={chartWidth + 6}
                          y={volTop + volYScale(maxVolume * 0.5) + 3}
                          fill="#64748B"
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          {(maxVolume / 20000).toFixed(1)}万
                        </text>
                        {/* Baseline 0 tick */}
                        <text
                          x={chartWidth + 6}
                          y={volTop + volChartHeight - 4}
                          fill="#475569"
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          0
                        </text>
                      </g>

                      {/* Daily Volume Rectangles (Color-synchronized with K-line, linked to zoom & pan) */}
                      <g className="volume-bars" clipPath="url(#volumeChartClip)">
                        {displayedCandles.map((c, idx) => {
                          const centerX = getCenterX(idx);
                          if (centerX < -candleSlotWidth || centerX > chartWidth + candleSlotWidth) return null;

                          const origIdx = safeStartIndex + idx;
                          const isHovered = hoverIndex === origIdx;
                          const color = getCandleColor(c, idx);
                          const volBarH = Math.max(1.5, ((c.volume || 0) / maxVolume) * plotH);
                          const barTop = volTop + volChartHeight - volBarH - 2;
                          const barLeft = centerX - candleBarWidth / 2;

                          return (
                            <rect
                              key={`vol-${origIdx}`}
                              x={barLeft}
                              y={barTop}
                              width={candleBarWidth}
                              height={volBarH}
                              fill={color}
                              fillOpacity={isHovered ? 1 : 0.88}
                              stroke={isHovered ? "#FFFFFF" : color}
                              strokeWidth={isHovered ? 1.2 : 0}
                              shapeRendering="crispEdges"
                            />
                          );
                        })}

                        {/* Volume Moving Average Lines */}
                        <path d={generateVolMAPath(fullVolMa1, volTop)} fill="none" stroke="#F59E0B" strokeWidth={1.2} />
                        <path d={generateVolMAPath(fullVolMa2, volTop)} fill="none" stroke="#38BDF8" strokeWidth={1.2} />
                      </g>
                    </g>
                  );
                })()}

                {/* 2. Secondary Indicator Sub-Charts (PSY, KDJ, MACD) */}
                {/* PSY Sub-Chart */}
                {showPSY && (() => {
                  const subTop = runningSubTop;
                  runningSubTop += otherSubChartHeight;
                  const psyScale = d3.scaleLinear().domain([0, 100]).range([otherSubChartHeight - 6, 18]);

                  const getSubLine = (data: (number | null)[]) => {
                    const pts: { val: number; idx: number }[] = [];
                    for (let i = 0; i < displayedCandles.length; i++) {
                      const v = data[safeStartIndex + i];
                      if (v !== null && v !== undefined && !isNaN(v)) pts.push({ val: v, idx: i });
                    }
                    const lGen = d3.line<{ val: number; idx: number }>()
                      .x(d => getCenterX(d.idx))
                      .y(d => subTop + psyScale(d.val))
                      .curve(d3.curveLinear);
                    return lGen(pts) || "";
                  };

                  return (
                    <g key="subchart-psy" className="subchart-psy">
                      <line x1={0} y1={subTop} x2={chartWidth} y2={subTop} stroke="#334155" strokeWidth={1} shapeRendering="crispEdges" />
                      <line x1={0} y1={subTop + psyScale(50)} x2={chartWidth} y2={subTop + psyScale(50)} stroke="#334155" strokeDasharray="2 2" strokeWidth={1} />
                      <text x={6} y={subTop + 14} fill="#FB923C" fontSize={10} fontWeight="bold" fontFamily="monospace">
                        PSY({psyParams.n}) {fullPsy.psy[activeCandleIndex]?.toFixed(1) || "-"}
                      </text>
                      {fullPsy.maPsy[activeCandleIndex] !== null && (
                        <text x={96} y={subTop + 14} fill="#38BDF8" fontSize={10} fontFamily="monospace">
                          MAPSY({psyParams.m}) {fullPsy.maPsy[activeCandleIndex]?.toFixed(1) || "-"}
                        </text>
                      )}
                      <text x={chartWidth + 6} y={subTop + psyScale(50) + 4} fill="#64748B" fontSize={10} fontFamily="monospace">50</text>
                      <path d={getSubLine(fullPsy.psy)} fill="none" stroke="#FB923C" strokeWidth={1.5} />
                      <path d={getSubLine(fullPsy.maPsy)} fill="none" stroke="#38BDF8" strokeWidth={1.5} />
                    </g>
                  );
                })()}

                {/* KDJ Sub-Chart */}
                {showKDJ && (() => {
                  const subTop = runningSubTop;
                  runningSubTop += otherSubChartHeight;
                  const kdjScale = d3.scaleLinear().domain([0, 100]).range([otherSubChartHeight - 6, 18]);

                  const getSubLine = (getter: (idx: number) => number | null | undefined) => {
                    const pts: { val: number; idx: number }[] = [];
                    for (let i = 0; i < displayedCandles.length; i++) {
                      const v = getter(safeStartIndex + i);
                      if (v !== null && v !== undefined && !isNaN(v)) pts.push({ val: v, idx: i });
                    }
                    const lGen = d3.line<{ val: number; idx: number }>()
                      .x(d => getCenterX(d.idx))
                      .y(d => subTop + kdjScale(d.val))
                      .curve(d3.curveLinear);
                    return lGen(pts) || "";
                  };

                  return (
                    <g key="subchart-kdj" className="subchart-kdj">
                      <line x1={0} y1={subTop} x2={chartWidth} y2={subTop} stroke="#334155" strokeWidth={1} shapeRendering="crispEdges" />
                      <line x1={0} y1={subTop + kdjScale(50)} x2={chartWidth} y2={subTop + kdjScale(50)} stroke="#334155" strokeDasharray="2 2" strokeWidth={1} />
                      <text x={6} y={subTop + 14} fill="#818CF8" fontSize={10} fontWeight="bold" fontFamily="monospace">
                        KDJ({kdjParams.n},{kdjParams.m1},{kdjParams.m2})
                      </text>
                      <text x={110} y={subTop + 14} fill="#F59E0B" fontSize={10} fontFamily="monospace">
                        K:{fullKdj[activeCandleIndex]?.k?.toFixed(1) || "-"}
                      </text>
                      <text x={160} y={subTop + 14} fill="#38BDF8" fontSize={10} fontFamily="monospace">
                        D:{fullKdj[activeCandleIndex]?.d?.toFixed(1) || "-"}
                      </text>
                      <text x={210} y={subTop + 14} fill="#C084FC" fontSize={10} fontFamily="monospace">
                        J:{fullKdj[activeCandleIndex]?.j?.toFixed(1) || "-"}
                      </text>
                      <path d={getSubLine(i => fullKdj[i]?.k)} fill="none" stroke="#F59E0B" strokeWidth={1.2} />
                      <path d={getSubLine(i => fullKdj[i]?.d)} fill="none" stroke="#38BDF8" strokeWidth={1.2} />
                      <path d={getSubLine(i => fullKdj[i]?.j)} fill="none" stroke="#C084FC" strokeWidth={1.2} />
                    </g>
                  );
                })()}

                {/* MACD Sub-Chart */}
                {showMACD && (() => {
                  const subTop = runningSubTop;
                  runningSubTop += otherSubChartHeight;
                  let maxVal = 0.1;
                  for (let i = safeStartIndex; i < safeEndIndex; i++) {
                    if (fullMacd.dif[i] !== null) maxVal = Math.max(maxVal, Math.abs(fullMacd.dif[i] as number));
                    if (fullMacd.dea[i] !== null) maxVal = Math.max(maxVal, Math.abs(fullMacd.dea[i] as number));
                    if (fullMacd.macdBar[i] !== null) maxVal = Math.max(maxVal, Math.abs(fullMacd.macdBar[i] as number));
                  }
                  maxVal = maxVal * 1.15;
                  const macdScale = d3.scaleLinear().domain([-maxVal, maxVal]).range([otherSubChartHeight - 6, 18]);
                  const zeroY = subTop + macdScale(0);

                  const getSubLine = (data: (number | null)[]) => {
                    const pts: { val: number; idx: number }[] = [];
                    for (let i = 0; i < displayedCandles.length; i++) {
                      const v = data[safeStartIndex + i];
                      if (v !== null && v !== undefined && !isNaN(v)) pts.push({ val: v, idx: i });
                    }
                    const lGen = d3.line<{ val: number; idx: number }>()
                      .x(d => getCenterX(d.idx))
                      .y(d => subTop + macdScale(d.val))
                      .curve(d3.curveLinear);
                    return lGen(pts) || "";
                  };

                  return (
                    <g key="subchart-macd" className="subchart-macd">
                      <line x1={0} y1={subTop} x2={chartWidth} y2={subTop} stroke="#334155" strokeWidth={1} shapeRendering="crispEdges" />
                      <line x1={0} y1={zeroY} x2={chartWidth} y2={zeroY} stroke="#475569" strokeDasharray="2 2" strokeWidth={1} />
                      <text x={6} y={subTop + 14} fill="#38BDF8" fontSize={10} fontWeight="bold" fontFamily="monospace">
                        MACD({macdParams.short},{macdParams.long},{macdParams.signal})
                      </text>
                      <text x={140} y={subTop + 14} fill="#F59E0B" fontSize={10} fontFamily="monospace">
                        DIF:{fullMacd.dif[activeCandleIndex]?.toFixed(2) || "-"}
                      </text>
                      <text x={205} y={subTop + 14} fill="#38BDF8" fontSize={10} fontFamily="monospace">
                        DEA:{fullMacd.dea[activeCandleIndex]?.toFixed(2) || "-"}
                      </text>
                      <text x={270} y={subTop + 14} fill="#CBD5E1" fontSize={10} fontFamily="monospace">
                        BAR:{fullMacd.macdBar[activeCandleIndex]?.toFixed(2) || "-"}
                      </text>

                      {/* MACD Histogram Bars */}
                      {displayedCandles.map((_, idx) => {
                        const origIdx = safeStartIndex + idx;
                        const barVal = fullMacd.macdBar[origIdx];
                        if (barVal === null || barVal === undefined) return null;
                        const centerX = getCenterX(idx);
                        const barY = subTop + macdScale(Math.max(0, barVal));
                        const barH = Math.max(1, Math.abs(macdScale(barVal) - macdScale(0)));
                        const barColor = barVal >= 0 ? upColor : downColor;

                        return (
                          <rect
                            key={`macd-bar-${origIdx}`}
                            x={centerX - candleBarWidth / 2}
                            y={barVal >= 0 ? barY : zeroY}
                            width={candleBarWidth}
                            height={barH}
                            fill={barColor}
                            shapeRendering="crispEdges"
                            opacity={0.85}
                          />
                        );
                      })}

                      {/* DIF and DEA Lines */}
                      <path d={getSubLine(fullMacd.dif)} fill="none" stroke="#F59E0B" strokeWidth={1.3} />
                      <path d={getSubLine(fullMacd.dea)} fill="none" stroke="#38BDF8" strokeWidth={1.3} />
                    </g>
                  );
                })()}
              </>
            );
          })()}

          {/* Bottom X-Axis Date Labels */}
          <g className="x-axis-labels">
            {displayedCandles.map((c, idx) => {
              // Show date every step items
              const step = Math.max(1, Math.floor(baseCount / 6));
              if (idx % step !== 0) return null;
              const x = getCenterX(idx);
              if (x < 10 || x > chartWidth - 20) return null;
              return (
                <text
                  key={`x-label-${safeStartIndex + idx}`}
                  x={x}
                  y={totalChartHeight + 16}
                  fill="#94A3B8"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {c.time}
                </text>
              );
            })}
          </g>

          {/* Interactive Crosshairs & Axis Badges with Precision Snapping */}
          {snappedCrosshair && hoveredCandle && (
            <g className="crosshair-overlay pointer-events-none">
              {/* Vertical Dashed Line snapped precisely to candle center */}
              <line
                x1={snappedCrosshair.x}
                y1={0}
                x2={snappedCrosshair.x}
                y2={totalChartHeight}
                stroke="rgba(129, 140, 248, 0.85)"
                strokeWidth={1}
                strokeDasharray="3 3"
                shapeRendering="crispEdges"
              />

              {/* Horizontal Dashed Line snapped precisely to candle price point */}
              <line
                x1={0}
                y1={snappedCrosshair.y}
                x2={chartWidth}
                y2={snappedCrosshair.y}
                stroke="rgba(129, 140, 248, 0.85)"
                strokeWidth={1}
                strokeDasharray="3 3"
                shapeRendering="crispEdges"
              />

              {/* Main Chart: Candle OHLC Alignment Anchor Notches */}
              {snappedCrosshair.isMainChart && (
                <g className="candle-anchor-guides opacity-75">
                  {/* High anchor notch */}
                  <line
                    x1={snappedCrosshair.x - 6}
                    y1={snappedCrosshair.highY}
                    x2={snappedCrosshair.x + 6}
                    y2={snappedCrosshair.highY}
                    stroke="#EF4444"
                    strokeWidth={snappedCrosshair.pointType === "high" ? 2 : 1}
                    shapeRendering="crispEdges"
                  />
                  {/* Low anchor notch */}
                  <line
                    x1={snappedCrosshair.x - 6}
                    y1={snappedCrosshair.lowY}
                    x2={snappedCrosshair.x + 6}
                    y2={snappedCrosshair.lowY}
                    stroke="#10B981"
                    strokeWidth={snappedCrosshair.pointType === "low" ? 2 : 1}
                    shapeRendering="crispEdges"
                  />
                  {/* Open anchor notch */}
                  <line
                    x1={snappedCrosshair.x - 5}
                    y1={snappedCrosshair.openY}
                    x2={snappedCrosshair.x + 5}
                    y2={snappedCrosshair.openY}
                    stroke="#94A3B8"
                    strokeWidth={snappedCrosshair.pointType === "open" ? 2 : 1}
                    shapeRendering="crispEdges"
                  />
                  {/* Close anchor notch */}
                  <line
                    x1={snappedCrosshair.x - 5}
                    y1={snappedCrosshair.closeY}
                    x2={snappedCrosshair.x + 5}
                    y2={snappedCrosshair.closeY}
                    stroke={hoveredCandle.close >= hoveredCandle.open ? upColor : downColor}
                    strokeWidth={snappedCrosshair.pointType === "close" ? 2 : 1}
                    shapeRendering="crispEdges"
                  />
                </g>
              )}

              {/* Pulsing Intersecting Target Reticle */}
              {(() => {
                const reticleColor = snappedCrosshair.pointType === "high" 
                  ? "#EF4444" 
                  : snappedCrosshair.pointType === "low"
                  ? "#10B981"
                  : hoveredCandle.close >= hoveredCandle.open ? upColor : downColor;

                return (
                  <g className="snapping-reticle">
                    {/* Outer Target Halo */}
                    <circle
                      cx={snappedCrosshair.x}
                      cy={snappedCrosshair.y}
                      r={7}
                      fill="none"
                      stroke={reticleColor}
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      opacity={0.85}
                    />
                    {/* Inner Solid Anchor Dot */}
                    <circle
                      cx={snappedCrosshair.x}
                      cy={snappedCrosshair.y}
                      r={3.5}
                      fill={reticleColor}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                    {/* Precise Alignment Bracket Crosses */}
                    <line x1={snappedCrosshair.x - 10} y1={snappedCrosshair.y} x2={snappedCrosshair.x - 5} y2={snappedCrosshair.y} stroke={reticleColor} strokeWidth={1} />
                    <line x1={snappedCrosshair.x + 5} y1={snappedCrosshair.y} x2={snappedCrosshair.x + 10} y2={snappedCrosshair.y} stroke={reticleColor} strokeWidth={1} />
                    <line x1={snappedCrosshair.x} y1={snappedCrosshair.y - 10} x2={snappedCrosshair.x} y2={snappedCrosshair.y - 5} stroke={reticleColor} strokeWidth={1} />
                    <line x1={snappedCrosshair.x} y1={snappedCrosshair.y + 5} x2={snappedCrosshair.x} y2={snappedCrosshair.y + 10} stroke={reticleColor} strokeWidth={1} />
                  </g>
                );
              })()}

              {/* Right Y-Axis Hovered Price / Volume Badge */}
              <g transform={`translate(${chartWidth + 2}, ${Math.max(2, Math.min(totalChartHeight - 22, snappedCrosshair.y - 10))})`}>
                {/* Pointer arrow to crosshair line */}
                <polygon points="-4,10 0,6 0,14" fill="#0F172A" stroke="rgba(99, 102, 241, 0.9)" />
                <rect width={74} height={20} rx={4} fill="#0F172A" stroke="rgba(99, 102, 241, 0.9)" strokeWidth={1.2} />
                <text
                  x={37}
                  y={14}
                  fill="#FFFFFF"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {snappedCrosshair.snappedPrice !== null && snappedCrosshair.snappedPrice !== undefined ? (
                    <>
                      <tspan fill="#A5B4FC">{snappedCrosshair.pointLabel} </tspan>
                      <tspan fill="#FFFFFF">${snappedCrosshair.snappedPrice.toFixed(2)}</tspan>
                    </>
                  ) : snappedCrosshair.snappedVolume !== null && snappedCrosshair.snappedVolume !== undefined ? (
                    <>
                      <tspan fill="#A5B4FC">量 </tspan>
                      <tspan fill="#FFFFFF">{(snappedCrosshair.snappedVolume / 10000).toFixed(1)}万</tspan>
                    </>
                  ) : (
                    snappedCrosshair.pointLabel
                  )}
                </text>
              </g>

              {/* Bottom X-Axis Hovered Time Badge */}
              <g transform={`translate(${Math.max(2, Math.min(chartWidth - 86, snappedCrosshair.x - 43))}, ${totalChartHeight + 2})`}>
                {/* Pointer arrow to crosshair line */}
                <polygon points="43,-4 39,0 47,0" fill="#0F172A" stroke="rgba(99, 102, 241, 0.9)" />
                <rect width={86} height={20} rx={4} fill="#0F172A" stroke="rgba(99, 102, 241, 0.9)" strokeWidth={1.2} />
                <text
                  x={43}
                  y={14}
                  fill="#FFFFFF"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {hoveredCandle.time}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* 3.5 Boundary Edge Glow & Bounce-Back Feedback (数据起点与终点边界发光与回弹反馈提示) */}
        <AnimatePresence>
          {edgeGlow === "start" && (
            <motion.div
              key="edge-glow-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute top-0 bottom-0 left-0 pointer-events-none z-30 flex items-center"
              style={{ width: "72px" }}
            >
              {/* Soft Linear Gradient Beam */}
              <div className="w-full h-full bg-gradient-to-r from-indigo-500/35 via-indigo-500/10 to-transparent pointer-events-none" />
              {/* Crisp Inner Neon Accent Border */}
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-indigo-400/20 via-indigo-400/90 to-indigo-400/20 shadow-[0_0_14px_rgba(99,102,241,0.95)]" />
              {/* Floating Start-of-Data Notification Badge */}
              <motion.div
                initial={{ x: -12, opacity: 0, scale: 0.92 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -12, opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.14 }}
                className="absolute left-3 py-1 px-2.5 rounded-full bg-slate-900/95 border border-indigo-500/50 backdrop-blur-md shadow-xl flex items-center gap-1.5 text-[10px] font-mono text-indigo-200 select-none whitespace-nowrap"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>已至最早历史数据</span>
              </motion.div>
            </motion.div>
          )}

          {edgeGlow === "end" && (
            <motion.div
              key="edge-glow-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute top-0 bottom-0 pointer-events-none z-30 flex items-center"
              style={{ right: `${rightMargin}px`, width: "72px" }}
            >
              {/* Soft Linear Gradient Beam */}
              <div className="w-full h-full bg-gradient-to-l from-emerald-500/35 via-emerald-500/10 to-transparent pointer-events-none" />
              {/* Crisp Inner Neon Accent Border */}
              <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-emerald-400/20 via-emerald-400/90 to-emerald-400/20 shadow-[0_0_14px_rgba(16,185,129,0.95)]" />
              {/* Floating End-of-Data Notification Badge */}
              <motion.div
                initial={{ x: 12, opacity: 0, scale: 0.92 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: 12, opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.14 }}
                className="absolute right-3 py-1 px-2.5 rounded-full bg-slate-900/95 border border-emerald-500/50 backdrop-blur-md shadow-xl flex items-center gap-1.5 text-[10px] font-mono text-emerald-200 select-none whitespace-nowrap"
              >
                <span>已至最新实时数据</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. Dynamic Floating Tooltip (动态工具提示) */}
        <AnimatePresence>
          {hoveredCandle && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              style={tooltipStyle}
              className="absolute z-40 w-60 max-w-[calc(100%-16px)] box-border rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl p-3 text-xs text-slate-100 pointer-events-none select-none font-mono"
            >
              {/* Tooltip Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <div>
                  <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <span>{symbol}</span>
                    <span className="text-[11px] font-normal text-slate-400 truncate max-w-[100px]">{name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{hoveredCandle.time}</div>
                </div>
                {/* Status Badge */}
                {(() => {
                  const chg = hoveredCandle.close - hoveredCandle.open;
                  const chgPct = hoveredCandle.open > 0 ? (chg / hoveredCandle.open) * 100 : 0;
                  const isCandleRise = chg >= 0;
                  const badgeColor = isCandleRise 
                    ? isUpRed ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : isUpRed ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30";

                  return (
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${badgeColor}`}>
                      {isCandleRise ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      <span>{chgPct >= 0 ? "+" : ""}{chgPct.toFixed(2)}%</span>
                    </span>
                  );
                })()}
              </div>

              {/* OHLC Numerical Grid with Snapped Target Highlight */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded transition-all ${snappedCrosshair?.pointType === "open" ? "bg-indigo-500/30 border border-indigo-400/50 shadow-xs" : ""}`}>
                  <span className={snappedCrosshair?.pointType === "open" ? "text-indigo-200 font-bold" : "text-slate-400"}>开盘:</span>
                  <span className="font-bold text-slate-200">${hoveredCandle.open.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded transition-all ${snappedCrosshair?.pointType === "close" ? "bg-indigo-500/30 border border-indigo-400/50 shadow-xs" : ""}`}>
                  <span className={snappedCrosshair?.pointType === "close" ? "text-indigo-200 font-bold" : "text-slate-400"}>收盘:</span>
                  <span className={`font-bold ${hoveredCandle.close >= hoveredCandle.open ? (isUpRed ? "text-red-400" : "text-emerald-400") : (isUpRed ? "text-emerald-400" : "text-red-400")}`}>
                    ${hoveredCandle.close.toFixed(2)}
                  </span>
                </div>
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded transition-all ${snappedCrosshair?.pointType === "high" ? "bg-indigo-500/30 border border-indigo-400/50 shadow-xs" : ""}`}>
                  <span className={snappedCrosshair?.pointType === "high" ? "text-indigo-200 font-bold" : "text-slate-400"}>最高:</span>
                  <span className={`font-bold ${isUpRed ? "text-red-400" : "text-emerald-400"}`}>
                    ${hoveredCandle.high.toFixed(2)}
                  </span>
                </div>
                <div className={`flex justify-between items-center px-1.5 py-0.5 rounded transition-all ${snappedCrosshair?.pointType === "low" ? "bg-indigo-500/30 border border-indigo-400/50 shadow-xs" : ""}`}>
                  <span className={snappedCrosshair?.pointType === "low" ? "text-indigo-200 font-bold" : "text-slate-400"}>最低:</span>
                  <span className={`font-bold ${isUpRed ? "text-emerald-400" : "text-red-400"}`}>
                    ${hoveredCandle.low.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">涨跌额:</span>
                  <span className={`font-bold ${hoveredCandle.close >= hoveredCandle.open ? (isUpRed ? "text-red-400" : "text-emerald-400") : (isUpRed ? "text-emerald-400" : "text-red-400")}`}>
                    {(hoveredCandle.close - hoveredCandle.open) >= 0 ? "+" : ""}
                    ${(hoveredCandle.close - hoveredCandle.open).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">振幅:</span>
                  <span className="font-bold text-slate-200">
                    {hoveredCandle.open > 0 ? (((hoveredCandle.high - hoveredCandle.low) / hoveredCandle.open) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
                <div className="flex justify-between items-center col-span-2 pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">成交量:</span>
                  <span className="font-bold text-indigo-300">
                    {((hoveredCandle.volume || 0) / 10000).toFixed(2)} 万股
                  </span>
                </div>
              </div>

              {/* Active Indicator Summary in Tooltip */}
              {activeCandleIndex !== null && (activeMAs.ma1 || activeMAs.ma2 || activeMAs.ma3) && (
                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-2 text-[10px] text-slate-400">
                  {activeMAs.ma1 && fullMa1[activeCandleIndex] && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>MA{maParams.p1}:{fullMa1[activeCandleIndex]?.toFixed(2)}</span>
                    </span>
                  )}
                  {activeMAs.ma2 && fullMa2[activeCandleIndex] && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                      <span>MA{maParams.p2}:{fullMa2[activeCandleIndex]?.toFixed(2)}</span>
                    </span>
                  )}
                  {activeMAs.ma3 && fullMa3[activeCandleIndex] && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>MA{maParams.p3}:{fullMa3[activeCandleIndex]?.toFixed(2)}</span>
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top-Left Touch/Mouse Mode Toggle & Dynamic Dragging Status */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap pointer-events-auto">
          <div className="bg-theme-card/90 backdrop-blur border border-theme-border p-0.5 rounded-lg flex items-center shadow-xs text-[10px] font-bold">
            <button
              onClick={() => setTouchMode("pan")}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${
                touchMode === "pan" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="按住鼠标左键滑动拖动K线，十字准星跟随"
            >
              <Hand size={12} />
              <span>拖拽平移</span>
            </button>
            <button
              onClick={() => setTouchMode("crosshair")}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${
                touchMode === "crosshair" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="按住鼠标左键滑动定位查线"
            >
              <Crosshair size={12} />
              <span>准星查线</span>
            </button>
          </div>

          {/* Magnetic Precision Snap Mode Toggle */}
          <div className="bg-theme-card/90 backdrop-blur border border-theme-border p-0.5 rounded-lg flex items-center shadow-xs text-[10px] font-bold">
            <button
              onClick={() => setCrosshairSnapMode(prev => prev === "ohlc" ? "close" : prev === "close" ? "free" : "ohlc")}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${
                crosshairSnapMode !== "free" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="点击切换准星吸附模式：OHLC全点智能吸附（推荐）/ 收盘价吸附 / 自由十字线"
            >
              <Magnet size={12} className={crosshairSnapMode !== "free" ? "text-indigo-400" : "text-theme-text-muted"} />
              <span>
                吸附: {crosshairSnapMode === "ohlc" ? "OHLC点" : crosshairSnapMode === "close" ? "收盘价" : "自由"}
              </span>
            </button>
          </div>

          {isDragging ? (
            <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-semibold bg-indigo-950/90 border border-indigo-500/40 px-2 py-1 rounded-lg animate-pulse shadow-xs">
              <MoveHorizontal size={12} />
              <span>{touchMode === "pan" ? "按住滑动中 (平移K线)" : "按住定位中 (准星查线)"}</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-theme-text-muted bg-theme-card/85 backdrop-blur px-2 py-1 rounded-lg border border-theme-border">
              <MoveHorizontal size={12} />
              <span>支持鼠标左键按住滑动拖拽看线 / 滚轮缩放</span>
            </div>
          )}
        </div>

        {/* Bottom-Right Floating Quick Action Control Bar */}
        <div className="absolute bottom-3 right-3 z-10 bg-theme-card/90 backdrop-blur-md border border-theme-border p-1 rounded-xl shadow-lg flex items-center gap-1 text-xs select-none">
          <button
            onClick={handlePanLeft}
            className="p-1.5 rounded-lg hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-primary transition cursor-pointer active:scale-95"
            title="查看历史K线 (向左平移)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-primary transition cursor-pointer active:scale-95"
            title="缩小K线"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-primary transition cursor-pointer active:scale-95"
            title="放大K线"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handlePanRight}
            className="p-1.5 rounded-lg hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-primary transition cursor-pointer active:scale-95"
            title="查看近期K线 (向右平移)"
          >
            <ChevronRight size={16} />
          </button>
          <div className="h-4 w-px bg-theme-border mx-0.5" />
          <button
            onClick={handleJumpToLatest}
            className="px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 font-bold transition flex items-center gap-1 text-[11px] cursor-pointer active:scale-95 border border-indigo-500/20"
            title="一键平移至最新K线"
          >
            <SkipForward size={13} />
            <span>最新</span>
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg hover:bg-theme-bg-hover text-theme-text-muted hover:text-theme-text-primary transition cursor-pointer active:scale-95"
            title="重置缩放"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 5. Technical Indicators & Color Scheme Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-card border border-theme-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-panel">
              <div className="flex items-center gap-2">
                <Sliders className="text-indigo-500" size={18} />
                <h3 className="font-bold text-theme-text-heading text-sm">技术指标与配色自定义</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-theme-text-muted hover:text-theme-text-primary p-1 rounded-md cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-theme-border bg-theme-panel/50 overflow-x-auto text-xs font-semibold text-theme-text-muted">
              {(["MA", "BOLL", "PSY", "KDJ", "VOL", "MACD", "COLOR"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSettingsTab(tab)}
                  className={`px-4 py-2.5 transition whitespace-nowrap cursor-pointer border-b-2 ${
                    activeSettingsTab === tab
                      ? "border-indigo-600 text-indigo-500 font-bold bg-theme-card"
                      : "border-transparent hover:text-theme-text-primary"
                  }`}
                >
                  {tab === "MA" ? "均线(MA)" : tab === "BOLL" ? "布林线" : tab === "PSY" ? "心理线" : tab === "KDJ" ? "KDJ" : tab === "VOL" ? "成交量" : tab === "MACD" ? "MACD" : "配色方案"}
                </button>
              ))}
            </div>

            <div className="p-6 text-xs text-theme-text-primary space-y-4 max-h-[380px] overflow-y-auto">
              {activeSettingsTab === "MA" && (
                <div className="space-y-3">
                  <p className="text-theme-text-muted mb-2 font-medium">配置移动平均线 (MA) 周期:</p>
                  {[
                    { key: "ma1", paramKey: "p1", name: "MA 1", color: "text-amber-500" },
                    { key: "ma2", paramKey: "p2", name: "MA 2", color: "text-pink-500" },
                    { key: "ma3", paramKey: "p3", name: "MA 3", color: "text-blue-500" },
                    { key: "ma4", paramKey: "p4", name: "MA 4", color: "text-purple-500" },
                    { key: "ma5", paramKey: "p5", name: "MA 5", color: "text-emerald-500" },
                  ].map(({ key, paramKey, name, color }) => (
                    <div key={key} className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <label className="flex items-center gap-2 cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={(activeMAs as any)[key]}
                          onChange={(e) => setActiveMAs({ ...activeMAs, [key]: e.target.checked })}
                          className="rounded text-indigo-600"
                        />
                        <span className={color}>{name}</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-theme-text-muted">周期:</span>
                        <input
                          type="number"
                          value={(maParams as any)[paramKey]}
                          onChange={(e) => setMaParams({ ...maParams, [paramKey]: Number(e.target.value) || 1 })}
                          className="w-16 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeSettingsTab === "BOLL" && (
                <div className="space-y-3">
                  <p className="text-theme-text-muted mb-2 font-medium">配置布林线 (BOLL) 参数:</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <span className="font-bold text-orange-500">周期 (N):</span>
                      <input
                        type="number"
                        value={bollParams.n}
                        onChange={(e) => setBollParams({ ...bollParams, n: Number(e.target.value) || 20 })}
                        className="w-20 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <span className="font-bold text-orange-500">标准差倍数 (K):</span>
                      <input
                        type="number"
                        value={bollParams.k}
                        onChange={(e) => setBollParams({ ...bollParams, k: Number(e.target.value) || 2 })}
                        className="w-20 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "PSY" && (
                <div className="space-y-3">
                  <p className="text-theme-text-muted mb-2 font-medium">配置心理线 (PSY) 参数:</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <span className="font-bold text-indigo-400">统计周期 (N):</span>
                      <input
                        type="number"
                        value={psyParams.n}
                        onChange={(e) => setPsyParams({ ...psyParams, n: Number(e.target.value) || 12 })}
                        className="w-20 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <span className="font-bold text-indigo-400">平滑周期 (M):</span>
                      <input
                        type="number"
                        value={psyParams.m}
                        onChange={(e) => setPsyParams({ ...psyParams, m: Number(e.target.value) || 6 })}
                        className="w-20 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "KDJ" && (
                <div className="space-y-3">
                  <p className="text-theme-text-muted mb-2 font-medium">配置随机指标 (KDJ) 参数:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-theme-panel p-2.5 rounded-lg border border-theme-border text-center">
                      <span className="block text-theme-text-muted font-bold mb-1">N (周期)</span>
                      <input
                        type="number"
                        value={kdjParams.n}
                        onChange={(e) => setKdjParams({ ...kdjParams, n: Number(e.target.value) || 9 })}
                        className="w-full px-1 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="bg-theme-panel p-2.5 rounded-lg border border-theme-border text-center">
                      <span className="block text-theme-text-muted font-bold mb-1">M1 (K平滑)</span>
                      <input
                        type="number"
                        value={kdjParams.m1}
                        onChange={(e) => setKdjParams({ ...kdjParams, m1: Number(e.target.value) || 3 })}
                        className="w-full px-1 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="bg-theme-panel p-2.5 rounded-lg border border-theme-border text-center">
                      <span className="block text-theme-text-muted font-bold mb-1">M2 (D平滑)</span>
                      <input
                        type="number"
                        value={kdjParams.m2}
                        onChange={(e) => setKdjParams({ ...kdjParams, m2: Number(e.target.value) || 3 })}
                        className="w-full px-1 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "VOL" && (
                <div className="space-y-3">
                  <p className="text-theme-text-muted mb-2 font-medium">配置成交量均线 (VOL MA) 参数:</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <span className="font-bold text-amber-500">VOL MA 1 周期:</span>
                      <input
                        type="number"
                        value={volParams.ma1}
                        onChange={(e) => setVolParams({ ...volParams, ma1: Number(e.target.value) || 5 })}
                        className="w-20 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between bg-theme-panel p-2.5 rounded-lg border border-theme-border">
                      <span className="font-bold text-sky-500">VOL MA 2 周期:</span>
                      <input
                        type="number"
                        value={volParams.ma2}
                        onChange={(e) => setVolParams({ ...volParams, ma2: Number(e.target.value) || 10 })}
                        className="w-20 px-2 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "MACD" && (
                <div className="space-y-3">
                  <p className="text-theme-text-muted mb-2 font-medium">配置指数平滑异同移动平均线 (MACD):</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-theme-panel p-2.5 rounded-lg border border-theme-border text-center">
                      <span className="block text-theme-text-muted font-bold mb-1">快线 (SHORT)</span>
                      <input
                        type="number"
                        value={macdParams.short}
                        onChange={(e) => setMacdParams({ ...macdParams, short: Number(e.target.value) || 12 })}
                        className="w-full px-1 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="bg-theme-panel p-2.5 rounded-lg border border-theme-border text-center">
                      <span className="block text-theme-text-muted font-bold mb-1">慢线 (LONG)</span>
                      <input
                        type="number"
                        value={macdParams.long}
                        onChange={(e) => setMacdParams({ ...macdParams, long: Number(e.target.value) || 26 })}
                        className="w-full px-1 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                    <div className="bg-theme-panel p-2.5 rounded-lg border border-theme-border text-center">
                      <span className="block text-theme-text-muted font-bold mb-1">信号 (SIGNAL)</span>
                      <input
                        type="number"
                        value={macdParams.signal}
                        onChange={(e) => setMacdParams({ ...macdParams, signal: Number(e.target.value) || 9 })}
                        className="w-full px-1 py-1 bg-theme-card border border-theme-border rounded text-center font-mono font-bold text-theme-text-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === "COLOR" && (
                <div className="space-y-4">
                  <p className="text-theme-text-muted font-medium">切换 K 线红绿涨跌习惯:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsUpRed(true)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition cursor-pointer ${
                        isUpRed ? "border-indigo-600 bg-indigo-500/10" : "border-theme-border bg-theme-panel"
                      }`}
                    >
                      <div className="flex gap-2 font-bold text-sm">
                        <span className="text-red-500">红涨</span>
                        <span className="text-emerald-500">绿跌</span>
                      </div>
                      <span className="text-[11px] text-theme-text-muted">中国 A 股 / 港股标准</span>
                    </button>

                    <button
                      onClick={() => setIsUpRed(false)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition cursor-pointer ${
                        !isUpRed ? "border-indigo-600 bg-indigo-500/10" : "border-theme-border bg-theme-panel"
                      }`}
                    >
                      <div className="flex gap-2 font-bold text-sm">
                        <span className="text-emerald-500">绿涨</span>
                        <span className="text-red-500">红跌</span>
                      </div>
                      <span className="text-[11px] text-theme-text-muted">美股 / 欧股国际标准</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-theme-panel border-t border-theme-border flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition cursor-pointer"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(StockChart);
