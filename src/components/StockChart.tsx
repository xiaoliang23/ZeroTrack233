import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "motion/react";
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
  SkipForward
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
  onRangeChange?: (range: "5M" | "60M" | "1D" | "1W" | "1M") => void;
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

function calculateRSI(data: Candle[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  if (data.length < period + 1) {
    return data.map(() => null);
  }

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change >= 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(null);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    } else {
      const change = data[i].close - data[i - 1].close;
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
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

export default function StockChart({
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
  const [cycleType, setCycleType] = useState<"5M" | "60M" | "1D" | "1W" | "1M">("1D");

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

  // Patch candles with live real-time price updates (数据跟随)
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

  // Indicators State & Parameters
  const [maParams, setMaParams] = useState({ p1: 5, p2: 10, p3: 20, p4: 50, p5: 200 });
  const [activeMAs, setActiveMAs] = useState({ ma1: true, ma2: true, ma3: true, ma4: false, ma5: false });

  const [bollParams, setBollParams] = useState({ n: 20, k: 2 });
  const [showBoll, setShowBoll] = useState(true);

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

  const [rsiParams, setRsiParams] = useState({ period: 14 });
  const [showRSI, setShowRSI] = useState(false);

  // Settings Modal / Panel
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"MA" | "BOLL" | "PSY" | "KDJ" | "VOL" | "MACD" | "COLOR">("MA");

  // Mobile Touch Mode: "pan" (default dragging left/right) or "crosshair" (inspecting values)
  const [touchMode, setTouchMode] = useState<"pan" | "crosshair">("pan");

  // Viewport zoom & pan (Default 36 candles for spacious, comfortable view)
  const [visibleCount, setVisibleCount] = useState<number>(36);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Canvas Refs & Dimensions
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0, dpr: 1 });

  // 1. Observe Container Sizing
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: Math.floor(rect.width), height: Math.floor(rect.height), dpr });
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [isExpanded]);

  // 2. Set Canvas Hardware Buffer Dimensions ONLY when canvasSize changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) return;
    canvas.width = canvasSize.width * canvasSize.dpr;
    canvas.height = canvasSize.height * canvasSize.dpr;
  }, [canvasSize]);

  // Sync visible window when candles update
  useEffect(() => {
    if (effectiveCandles && effectiveCandles.length > 0) {
      const initCount = Math.min(38, effectiveCandles.length);
      setVisibleCount(initCount);
      setStartIndex(effectiveCandles.length - initCount);
    }
  }, [effectiveCandles.length]);

  // 3. Calculate Full Technical Indicators
  const fullMa1 = useMemo(() => calculateSMA(effectiveCandles, maParams.p1), [effectiveCandles, maParams.p1]);
  const fullMa2 = useMemo(() => calculateSMA(effectiveCandles, maParams.p2), [effectiveCandles, maParams.p2]);
  const fullMa3 = useMemo(() => calculateSMA(effectiveCandles, maParams.p3), [effectiveCandles, maParams.p3]);
  const fullMa4 = useMemo(() => calculateSMA(effectiveCandles, maParams.p4), [effectiveCandles, maParams.p4]);
  const fullMa5 = useMemo(() => calculateSMA(effectiveCandles, maParams.p5), [effectiveCandles, maParams.p5]);

  const fullBoll = useMemo(() => calculateBOLL(effectiveCandles, bollParams.n, bollParams.k), [effectiveCandles, bollParams]);
  const fullBBI = useMemo(() => calculateBBI(effectiveCandles, bbiParams.p1, bbiParams.p2, bbiParams.p3, bbiParams.p4), [effectiveCandles, bbiParams]);
  const fullMacd = useMemo(() => calculateMACD(effectiveCandles, macdParams.short, macdParams.long, macdParams.signal), [effectiveCandles, macdParams]);
  const fullKdj = useMemo(() => calculateKDJ(effectiveCandles, kdjParams.n, kdjParams.m1, kdjParams.m2), [effectiveCandles, kdjParams]);
  const fullPsy = useMemo(() => calculatePSY(effectiveCandles, psyParams.n, psyParams.m), [effectiveCandles, psyParams]);
  const fullRsi = useMemo(() => calculateRSI(effectiveCandles, rsiParams.period), [effectiveCandles, rsiParams]);

  const fullVolMa1 = useMemo(() => calculateVolumeSMA(effectiveCandles, volParams.ma1), [effectiveCandles, volParams.ma1]);
  const fullVolMa2 = useMemo(() => calculateVolumeSMA(effectiveCandles, volParams.ma2), [effectiveCandles, volParams.ma2]);

  // Ensure startIndex bounds stay valid
  const safeStartIndex = Math.max(0, Math.min(startIndex, Math.max(0, effectiveCandles.length - 10)));
  const safeEndIndex = Math.min(effectiveCandles.length, safeStartIndex + visibleCount);
  const displayedCandles = useMemo(() => effectiveCandles.slice(safeStartIndex, safeEndIndex), [effectiveCandles, safeStartIndex, safeEndIndex]);

  // Current active candle stats (hovered or latest)
  const activeCandleIndex = hoverIndex !== null ? hoverIndex : Math.max(0, safeEndIndex - 1);
  const fallbackCandle: Candle = { open: 0, close: 0, high: 0, low: 0, volume: 0, time: "" };
  const currentCandle: Candle = effectiveCandles[activeCandleIndex] || effectiveCandles[effectiveCandles.length - 1] || fallbackCandle;
  const currentChange = currentCandle.close - currentCandle.open;
  const currentChangePercent = currentCandle.open > 0 ? (currentChange / currentCandle.open) * 100 : 0;
  const isUp = currentCandle.close >= currentCandle.open;

  // 4. Render HTML5 Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || displayedCandles.length === 0 || canvasSize.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, dpr } = canvasSize;

    ctx.save();
    ctx.scale(dpr, dpr);

    const isDark = theme === "dark" || (!theme && document.documentElement.classList.contains("dark")) || (!document.documentElement.classList.contains("light") && !document.documentElement.classList.contains("sakura") && !document.documentElement.classList.contains("ocean"));
    const isSakura = theme === "sakura" || document.documentElement.classList.contains("sakura");
    const isOcean = theme === "ocean" || document.documentElement.classList.contains("ocean");

    // Dynamic color assignment synced with CSS variables for seamless theme blend
    let bgColor = "#0F172A";
    let gridColor = "rgba(51, 65, 85, 0.38)";
    let textColor = "#94A3B8";

    if (isSakura) {
      bgColor = "#FFFFFF";
      gridColor = "rgba(252, 231, 243, 0.9)";
      textColor = "#9D7188";
    } else if (isOcean) {
      bgColor = "#FFFFFF";
      gridColor = "rgba(186, 230, 253, 0.65)";
      textColor = "#0284C7";
    } else if (!isDark) {
      bgColor = "#FFFFFF";
      gridColor = "rgba(226, 232, 240, 0.85)";
      textColor = "#64748B";
    }

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Layout Heights & Margins
    const rightMargin = 75; // Y-Axis Price Labels
    const bottomMargin = 28; // X-Axis Dates (increased for larger, clearer font)
    const chartWidth = width - rightMargin;
    const totalHeight = height - bottomMargin;

    // Count Active Sub-charts
    const activeSubCharts = [showVolume, showPSY, showKDJ, showMACD].filter(Boolean);
    const subCount = activeSubCharts.length;
    
    // Sub-chart height allocation
    const subChartHeight = subCount > 0 ? Math.min(100, Math.max(65, (totalHeight * 0.35) / subCount)) : 0;
    const mainHeight = totalHeight - subCount * subChartHeight;

    // --- 1. Draw Grid Lines ---
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Horizontal grid lines for Main Chart
    const mainGridSteps = 5;
    for (let i = 0; i <= mainGridSteps; i++) {
      const y = (mainHeight / mainGridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const vertGridSteps = 6;
    for (let i = 0; i <= vertGridSteps; i++) {
      const x = (chartWidth / vertGridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // --- 2. Calculate Price Bounds for Main Chart ---
    let visHighs = displayedCandles.map((c) => c.high);
    let visLows = displayedCandles.map((c) => c.low);

    let priceValues = [...visHighs, ...visLows];
    if (showBoll) {
      for (let i = safeStartIndex; i < safeEndIndex; i++) {
        if (fullBoll.upper[i]) priceValues.push(fullBoll.upper[i] as number);
        if (fullBoll.lower[i]) priceValues.push(fullBoll.lower[i] as number);
      }
    }

    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);
    const priceRange = maxPrice - minPrice || 1;
    const paddedMax = maxPrice + priceRange * 0.02;
    const paddedMin = Math.max(0, minPrice - priceRange * 0.02);
    const paddedRange = paddedMax - paddedMin || 1;

    const priceToY = (price: number) => {
      return mainHeight - ((price - paddedMin) / paddedRange) * mainHeight;
    };

    // Draw Right Y-Axis Price Labels (Clear, larger font)
    ctx.fillStyle = textColor;
    ctx.font = "bold 11px system-ui, -apple-system, BlinkMacSystemFont, monospace";
    ctx.textAlign = "left";
    for (let i = 0; i <= mainGridSteps; i++) {
      const p = paddedMax - (paddedRange / mainGridSteps) * i;
      const y = (mainHeight / mainGridSteps) * i;
      ctx.fillText(p.toFixed(2), chartWidth + 6, y + 4);
    }

    // --- 3. Render Candlesticks or Area Line ---
    const count = displayedCandles.length;
    const candleSlotWidth = chartWidth / count;
    // Increased padding percentage to make candles sleeker, preventing overly bulky bars
    const barPadding = Math.max(1.5, candleSlotWidth * 0.28);
    const barWidth = Math.max(1.5, candleSlotWidth - barPadding * 2);

    let highestCandle = { price: -Infinity, x: 0, y: 0 };
    let lowestCandle = { price: Infinity, x: 0, y: 0 };

    if (localChartType === "area") {
      // Area Chart
      ctx.beginPath();
      displayedCandles.forEach((c, idx) => {
        const x = idx * candleSlotWidth + candleSlotWidth / 2;
        const y = priceToY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = upColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Area Fill
      const gradient = ctx.createLinearGradient(0, 0, 0, mainHeight);
      gradient.addColorStop(0, isUpRed ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.lineTo((count - 1) * candleSlotWidth + candleSlotWidth / 2, mainHeight);
      ctx.lineTo(candleSlotWidth / 2, mainHeight);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    } else {
      // Standard Professional Candlesticks (蜡烛图)
      displayedCandles.forEach((c, idx) => {
        const slotX = idx * candleSlotWidth;
        const centerX = slotX + candleSlotWidth / 2;
        const isCandleUp = c.close >= c.open;
        const color = isCandleUp ? upColor : downColor;

        const openY = priceToY(c.open);
        const closeY = priceToY(c.close);
        const highY = priceToY(c.high);
        const lowY = priceToY(c.low);

        if (c.high > highestCandle.price) {
          highestCandle = { price: c.high, x: centerX, y: highY };
        }
        if (c.low < lowestCandle.price) {
          lowestCandle = { price: c.low, x: centerX, y: lowY };
        }

        // Wick Line (上下影线)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, highY);
        ctx.lineTo(centerX, lowY);
        ctx.stroke();

        // Candle Body Rect (实体)
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(openY - closeY));
        const bodyLeft = slotX + (candleSlotWidth - barWidth) / 2;

        if (localChartType === "hollow" && isCandleUp) {
          // Hollow Green or Red Body
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(bodyLeft, bodyTop, barWidth, bodyHeight);
        } else {
          // Solid Body
          ctx.fillStyle = color;
          ctx.fillRect(bodyLeft, bodyTop, barWidth, bodyHeight);
        }
      });
    }

    // High & Low Price Annotations on Main Chart
    if (highestCandle.price !== -Infinity) {
      ctx.fillStyle = upColor;
      ctx.font = "bold 11px system-ui, -apple-system, BlinkMacSystemFont, monospace";
      ctx.textAlign = highestCandle.x > chartWidth / 2 ? "right" : "left";
      ctx.fillText(`最高 ${highestCandle.price.toFixed(2)} ↗`, highestCandle.x + (highestCandle.x > chartWidth / 2 ? -6 : 6), highestCandle.y - 5);
    }
    if (lowestCandle.price !== Infinity) {
      ctx.fillStyle = downColor;
      ctx.font = "bold 11px system-ui, -apple-system, BlinkMacSystemFont, monospace";
      ctx.textAlign = lowestCandle.x > chartWidth / 2 ? "right" : "left";
      ctx.fillText(`最低 ${lowestCandle.price.toFixed(2)} ↘`, lowestCandle.x + (lowestCandle.x > chartWidth / 2 ? -6 : 6), lowestCandle.y + 14);
    }

    // --- 4. Render Main Overlay Indicator Lines ---
    const drawIndicatorLine = (lineData: (number | null)[], strokeColor: string, lineWidth = 1.2) => {
      ctx.beginPath();
      let started = false;
      for (let idx = 0; idx < count; idx++) {
        const origIdx = safeStartIndex + idx;
        const val = lineData[origIdx];
        if (val !== null && !isNaN(val)) {
          const x = idx * candleSlotWidth + candleSlotWidth / 2;
          const y = priceToY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    if (showBoll) {
      drawIndicatorLine(fullBoll.upper, "#F97316", 1.2);
      drawIndicatorLine(fullBoll.mid, "#3B82F6", 1.2);
      drawIndicatorLine(fullBoll.lower, "#F97316", 1.2);
    }
    if (showBBI) {
      drawIndicatorLine(fullBBI, "#38BDF8", 1.5);
    }
    if (activeMAs.ma1) drawIndicatorLine(fullMa1, "#F59E0B", 1.2);
    if (activeMAs.ma2) drawIndicatorLine(fullMa2, "#EC4899", 1.2);
    if (activeMAs.ma3) drawIndicatorLine(fullMa3, "#3B82F6", 1.2);
    if (activeMAs.ma4) drawIndicatorLine(fullMa4, "#8B5CF6", 1.2);
    if (activeMAs.ma5) drawIndicatorLine(fullMa5, "#10B981", 1.2);

    // Current Price Dashed Reference Line
    const latestClose = candles[candles.length - 1]?.close;
    if (latestClose) {
      const latestY = priceToY(latestClose);
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, latestY);
      ctx.lineTo(chartWidth, latestY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Badge on right Y-axis
      ctx.fillStyle = "#EF4444";
      ctx.fillRect(chartWidth + 2, latestY - 9, 62, 18);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(latestClose.toFixed(2), chartWidth + 33, latestY + 3);
    }

    // --- 5. Render Sub-Charts ---
    let currentSubTop = mainHeight;

    // Sub-chart 1: VOL
    if (showVolume) {
      const subH = subChartHeight;
      const subBottom = currentSubTop + subH;

      ctx.fillStyle = isDark ? "#0F172A" : "#FAFAFA";
      ctx.fillRect(0, currentSubTop, chartWidth, subH);

      // Section separator line
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(0, currentSubTop);
      ctx.lineTo(chartWidth, currentSubTop);
      ctx.stroke();

      // Label
      ctx.fillStyle = textColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("VOL(成交量)", 6, currentSubTop + 12);

      const visVols = displayedCandles.map((c) => c.volume);
      const maxVol = Math.max(...visVols) || 1;

      displayedCandles.forEach((c, idx) => {
        const slotX = idx * candleSlotWidth;
        const isCandleUp = c.close >= c.open;
        const color = isCandleUp ? upColor : downColor;

        const volH = (c.volume / maxVol) * (subH - 20);
        const barTop = subBottom - volH;
        const bodyLeft = slotX + (candleSlotWidth - barWidth) / 2;

        ctx.fillStyle = color;
        ctx.fillRect(bodyLeft, barTop, barWidth, volH);
      });

      // Volume MA Lines
      const drawVolMALine = (volMaData: (number | null)[], strokeColor: string) => {
        ctx.beginPath();
        let started = false;
        for (let idx = 0; idx < count; idx++) {
          const origIdx = safeStartIndex + idx;
          const val = volMaData[origIdx];
          if (val !== null && !isNaN(val)) {
            const x = idx * candleSlotWidth + candleSlotWidth / 2;
            const y = subBottom - (val / maxVol) * (subH - 20);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      drawVolMALine(fullVolMa1, "#F59E0B");
      drawVolMALine(fullVolMa2, "#EC4899");

      currentSubTop += subH;
    }

    // Sub-chart 2: PSY
    if (showPSY) {
      const subH = subChartHeight;
      const subBottom = currentSubTop + subH;

      ctx.fillStyle = isDark ? "#0F172A" : "#FAFAFA";
      ctx.fillRect(0, currentSubTop, chartWidth, subH);

      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(0, currentSubTop);
      ctx.lineTo(chartWidth, currentSubTop);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("PSY(心理线)", 6, currentSubTop + 12);

      // Reference lines 25 & 75
      const y75 = currentSubTop + subH - (75 / 100) * (subH - 15);
      const y25 = currentSubTop + subH - (25 / 100) * (subH - 15);
      ctx.strokeStyle = isDark ? "#334155" : "#E2E8F0";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, y75); ctx.lineTo(chartWidth, y75);
      ctx.moveTo(0, y25); ctx.lineTo(chartWidth, y25);
      ctx.stroke();
      ctx.setLineDash([]);

      const drawSubLine = (dataArr: (number | null)[], color: string) => {
        ctx.beginPath();
        let started = false;
        for (let idx = 0; idx < count; idx++) {
          const origIdx = safeStartIndex + idx;
          const val = dataArr[origIdx];
          if (val !== null && !isNaN(val)) {
            const x = idx * candleSlotWidth + candleSlotWidth / 2;
            const y = currentSubTop + subH - (val / 100) * (subH - 15);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else { ctx.lineTo(x, y); }
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      };

      drawSubLine(fullPsy.psy, "#F97316");
      drawSubLine(fullPsy.maPsy, "#38BDF8");

      currentSubTop += subH;
    }

    // Sub-chart 3: KDJ
    if (showKDJ) {
      const subH = subChartHeight;

      ctx.fillStyle = isDark ? "#0F172A" : "#FAFAFA";
      ctx.fillRect(0, currentSubTop, chartWidth, subH);

      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(0, currentSubTop);
      ctx.lineTo(chartWidth, currentSubTop);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("KDJ(随机指标)", 6, currentSubTop + 12);

      const drawKdjLine = (key: "k" | "d" | "j", color: string) => {
        ctx.beginPath();
        let started = false;
        for (let idx = 0; idx < count; idx++) {
          const origIdx = safeStartIndex + idx;
          const val = fullKdj[origIdx]?.[key];
          if (val !== null && val !== undefined && !isNaN(val)) {
            const x = idx * candleSlotWidth + candleSlotWidth / 2;
            const y = currentSubTop + subH - (val / 100) * (subH - 15);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else { ctx.lineTo(x, y); }
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      };

      drawKdjLine("k", "#F97316");
      drawKdjLine("d", "#38BDF8");
      drawKdjLine("j", "#EC4899");

      currentSubTop += subH;
    }

    // Sub-chart 4: MACD
    if (showMACD) {
      const subH = subChartHeight;
      const subMid = currentSubTop + subH / 2;

      ctx.fillStyle = isDark ? "#0F172A" : "#FAFAFA";
      ctx.fillRect(0, currentSubTop, chartWidth, subH);

      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(0, currentSubTop);
      ctx.lineTo(chartWidth, currentSubTop);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("MACD", 6, currentSubTop + 12);

      // Zero reference line
      ctx.strokeStyle = isDark ? "#334155" : "#CBD5E1";
      ctx.beginPath();
      ctx.moveTo(0, subMid);
      ctx.lineTo(chartWidth, subMid);
      ctx.stroke();

      // Find max abs macd value for scale
      const macdBars = displayedCandles.map((_, idx) => Math.abs(fullMacd.macdBar[safeStartIndex + idx] || 0));
      const maxMacd = Math.max(...macdBars) || 1;

      displayedCandles.forEach((_, idx) => {
        const origIdx = safeStartIndex + idx;
        const val = fullMacd.macdBar[origIdx];
        if (val !== null && !isNaN(val)) {
          const slotX = idx * candleSlotWidth;
          const barLeft = slotX + (candleSlotWidth - barWidth) / 2;
          const barH = (Math.abs(val) / maxMacd) * (subH / 2 - 10);
          const barTop = val >= 0 ? subMid - barH : subMid;

          ctx.fillStyle = val >= 0 ? upColor : downColor;
          ctx.fillRect(barLeft, barTop, barWidth, barH);
        }
      });

      // DIF & DEA lines
      const drawMacdLine = (dataArr: (number | null)[], color: string) => {
        ctx.beginPath();
        let started = false;
        for (let idx = 0; idx < count; idx++) {
          const origIdx = safeStartIndex + idx;
          const val = dataArr[origIdx];
          if (val !== null && !isNaN(val)) {
            const x = idx * candleSlotWidth + candleSlotWidth / 2;
            const y = subMid - (val / maxMacd) * (subH / 2 - 10);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else { ctx.lineTo(x, y); }
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      };

      drawMacdLine(fullMacd.dif, "#38BDF8");
      drawMacdLine(fullMacd.dea, "#F59E0B");

      currentSubTop += subH;
    }

    // --- 6. X-Axis Time/Date Labels (Clearer & Larger Font) ---
    ctx.fillStyle = textColor;
    ctx.font = "bold 11px system-ui, -apple-system, BlinkMacSystemFont, monospace";
    ctx.textAlign = "center";

    const dateStep = Math.max(1, Math.floor(count / 6));
    for (let idx = 0; idx < count; idx += dateStep) {
      const c = displayedCandles[idx];
      if (c && c.time) {
        const x = idx * candleSlotWidth + candleSlotWidth / 2;
        ctx.fillText(c.time, x, totalHeight + 18);
      }
    }

    // --- 7. Interactive Crosshair Lines (十字光标) ---
    if (hoverIndex !== null) {
      const localIdx = hoverIndex - safeStartIndex;
      if (localIdx >= 0 && localIdx < count) {
        const hoverX = localIdx * candleSlotWidth + candleSlotWidth / 2;

        // Vertical crosshair line
        ctx.strokeStyle = isDark ? "#94A3B8" : "#475569";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, totalHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Hover Time Box at Bottom X-Axis
        const hoverTimeStr = candles[hoverIndex]?.time || "";
        if (hoverTimeStr) {
          ctx.fillStyle = isDark ? "#334155" : "#0F172A";
          ctx.fillRect(hoverX - 42, totalHeight + 3, 84, 20);
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 11px system-ui, -apple-system, monospace";
          ctx.textAlign = "center";
          ctx.fillText(hoverTimeStr, hoverX, totalHeight + 17);
        }
      }
    }

    ctx.restore();
  }, [
    canvasSize, displayedCandles, localChartType, theme, upColor, downColor, isUpRed,
    showBoll, showBBI, activeMAs, showVolume, showPSY, showKDJ, showMACD,
    fullMa1, fullMa2, fullMa3, fullMa4, fullMa5, fullBoll, fullBBI,
    fullVolMa1, fullVolMa2, fullPsy, fullKdj, fullMacd,
    safeStartIndex, safeEndIndex, hoverIndex, candles
  ]);

  // RequestAnimationFrame Render Loop for butter-smooth rendering
  useEffect(() => {
    let animId: number;
    animId = requestAnimationFrame(() => {
      renderCanvas();
    });
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Mouse / Touch Drag-to-Pan and Hover Crosshair Handlers
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(0);
  const touchPinchDist = useRef<number | null>(null);
  const rafMoveId = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartIndex.current = startIndex;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartWidth = rect.width - 70;

    if (rafMoveId.current) cancelAnimationFrame(rafMoveId.current);

    rafMoveId.current = requestAnimationFrame(() => {
      const count = displayedCandles.length;
      if (count > 0 && mouseX >= 0 && mouseX <= chartWidth) {
        const slotW = chartWidth / count;
        const idxInDisplayed = Math.floor(mouseX / slotW);
        const targetIndex = safeStartIndex + idxInDisplayed;

        if (targetIndex >= 0 && targetIndex < effectiveCandles.length) {
          setHoverIndex(targetIndex);
        }
      } else {
        setHoverIndex(null);
      }

      if (isDragging && visibleCount > 0) {
        const deltaX = e.clientX - dragStartX.current;
        const candleSlotW = chartWidth / visibleCount;
        if (candleSlotW > 0) {
          const deltaCandles = Math.trunc(deltaX / candleSlotW);
          if (deltaCandles !== 0) {
            setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev - deltaCandles)));
            dragStartX.current += deltaCandles * candleSlotW;
          }
        }
      }
    });
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverIndex(null);
  };

  // Mobile Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const container = canvasContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        const chartWidth = rect.width - 70;
        const count = displayedCandles.length;
        if (count > 0 && touchX >= 0 && touchX <= chartWidth) {
          const slotW = chartWidth / count;
          const idxInDisplayed = Math.floor(touchX / slotW);
          const targetIndex = safeStartIndex + idxInDisplayed;
          if (targetIndex >= 0 && targetIndex < effectiveCandles.length) {
            setHoverIndex(targetIndex);
          }
        }
      }
      setIsDragging(true);
      dragStartX.current = e.touches[0].clientX;
      dragStartIndex.current = startIndex;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const container = canvasContainerRef.current;
    if (!container) return;

    if (e.touches.length === 1) {
      const rect = container.getBoundingClientRect();
      const chartWidth = rect.width - 70;
      const touchX = e.touches[0].clientX - rect.left;

      if (touchMode === "crosshair") {
        const count = displayedCandles.length;
        if (count > 0 && touchX >= 0 && touchX <= chartWidth) {
          const slotW = chartWidth / count;
          const idxInDisplayed = Math.floor(touchX / slotW);
          const targetIndex = safeStartIndex + idxInDisplayed;
          if (targetIndex >= 0 && targetIndex < effectiveCandles.length) {
            setHoverIndex(targetIndex);
          }
        }
      } else if (isDragging && visibleCount > 0) {
        const deltaX = e.touches[0].clientX - dragStartX.current;
        const candleSlotW = chartWidth / visibleCount;
        if (candleSlotW > 0) {
          const deltaCandles = Math.trunc(deltaX / candleSlotW);
          if (deltaCandles !== 0) {
            setStartIndex((prev) => Math.max(0, Math.min(effectiveCandles.length - visibleCount, prev - deltaCandles)));
            dragStartX.current += deltaCandles * candleSlotW;
          }
        }
      }
    } else if (e.touches.length === 2 && touchPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = touchPinchDist.current - dist;
      if (Math.abs(delta) > 10) {
        if (delta > 0) {
          // Zoom Out
          setVisibleCount((prev) => Math.min(effectiveCandles.length, Math.floor(prev * 1.08)));
        } else {
          // Zoom In
          setVisibleCount((prev) => Math.max(15, Math.floor(prev * 0.92)));
        }
        touchPinchDist.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchPinchDist.current = null;
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom In
      setVisibleCount((prev) => {
        const next = Math.max(15, Math.floor(prev * 0.85));
        setStartIndex((s) => Math.min(effectiveCandles.length - next, s + Math.floor((prev - next) / 2)));
        return next;
      });
    } else {
      // Zoom Out
      setVisibleCount((prev) => {
        const next = Math.min(effectiveCandles.length, Math.floor(prev * 1.18));
        setStartIndex((s) => Math.max(0, s - Math.floor((next - prev) / 2)));
        return next;
      });
    }
  };

  // Navigation & Zoom Handlers
  const handlePanLeft = () => {
    setStartIndex((prev) => Math.max(0, prev - Math.max(5, Math.floor(visibleCount * 0.25))));
  };

  const handlePanRight = () => {
    setStartIndex((prev) => Math.min(effectiveCandles.length - visibleCount, prev + Math.max(5, Math.floor(visibleCount * 0.25))));
  };

  const handleJumpToLatest = () => {
    if (effectiveCandles.length > 0) {
      setStartIndex(Math.max(0, effectiveCandles.length - visibleCount));
    }
  };

  const handleZoomIn = () => setVisibleCount((prev) => Math.max(15, Math.floor(prev * 0.75)));
  const handleZoomOut = () => setVisibleCount((prev) => Math.min(candles.length, Math.floor(prev * 1.3)));
  const handleResetZoom = () => {
    setVisibleCount(Math.min(65, candles.length));
    setStartIndex(candles.length - Math.min(65, candles.length));
  };

  // Export visible K-line data to CSV
  const handleExportCSV = () => {
    if (!displayedCandles || displayedCandles.length === 0) return;

    const headers = ["时间(Time)", "开盘价(Open)", "最高价(High)", "最低价(Low)", "收盘价(Close)", "成交量(Volume)"];
    const rows = displayedCandles.map((c) => [
      `"${c.time}"`,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `${symbol}_kline_${cycleType}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`bg-theme-card border border-theme-border rounded-2xl p-3 md:p-5 flex flex-col justify-between transition-colors duration-300 shadow-sm ${
        isExpanded ? "fixed inset-2 md:inset-4 z-50 overflow-hidden bg-theme-card flex flex-col" : ""
      }`} 
      id="kline-chart-section"
    >
      
      {/* 1. Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-theme-border text-xs select-none">
        
        {/* Left: Stock Name & Timeframe Cycle Tabs */}
        <div className="flex items-center gap-2.5 flex-wrap max-w-full">
          <div className="flex items-center gap-2">
            <Layers className="text-indigo-500" size={18} />
            <h3 className="font-bold text-base text-theme-text-heading font-mono tracking-tight">
              {name || symbol} ({symbol})
            </h3>
          </div>

          {/* Timeframe Cycles (5分, 时K, 日K, 周K, 月K) */}
          <div className="flex bg-theme-panel p-0.5 rounded-lg border border-theme-border overflow-x-auto max-w-full scrollbar-none">
            {(["5M", "60M", "1D", "1W", "1M"] as const).map((cycle) => (
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
                {cycle === "5M" ? "5分" : cycle === "60M" ? "时K" : cycle === "1D" ? "日K" : cycle === "1W" ? "周K" : "月K"}
              </button>
            ))}
          </div>

          {/* Chart Type Toggle */}
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

          {/* Density Preset Control (舒展 / 适中 / 密集) */}
          <div className="flex bg-theme-panel p-0.5 rounded-lg border border-theme-border text-[11px]">
            <button
              onClick={() => {
                const count = Math.min(30, effectiveCandles.length);
                setVisibleCount(count);
                setStartIndex(Math.max(0, effectiveCandles.length - count));
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount <= 32 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="舒展模式（每根K线宽度较大）"
            >
              舒展
            </button>
            <button
              onClick={() => {
                const count = Math.min(48, effectiveCandles.length);
                setVisibleCount(count);
                setStartIndex(Math.max(0, effectiveCandles.length - count));
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount > 32 && visibleCount <= 55 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="适中模式"
            >
              适中
            </button>
            <button
              onClick={() => {
                const count = Math.min(75, effectiveCandles.length);
                setVisibleCount(count);
                setStartIndex(Math.max(0, effectiveCandles.length - count));
              }}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${visibleCount > 55 ? "bg-theme-card text-indigo-500 shadow-xs font-bold" : "text-theme-text-muted hover:text-theme-text-primary"}`}
              title="紧凑模式"
            >
              紧凑
            </button>
          </div>

          <div className="flex items-center gap-1 border-l border-theme-border pl-2">
            <button onClick={handleZoomIn} className="p-1.5 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover" title="放大">
              <ZoomIn size={16} />
            </button>
            <button onClick={handleZoomOut} className="p-1.5 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover" title="缩小">
              <ZoomOut size={16} />
            </button>
            <button onClick={handleResetZoom} className="p-1.5 rounded-md text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover" title="复位">
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
              className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition flex items-center gap-1 font-semibold border border-indigo-500/20"
              title="指标设置"
            >
              <Settings size={15} />
              <span className="text-[11px] hidden sm:inline">设置</span>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-md bg-theme-panel text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-hover transition border border-theme-border"
              title="全屏"
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live Candle Real-Time Metrics & Indicators Legend Banner */}
      <div className="bg-theme-panel/80 p-3 rounded-xl border border-theme-border mb-2 font-mono text-xs md:text-sm leading-relaxed text-theme-text-primary select-none shadow-2xs">
        {/* Row 1: OHLC Data */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-black">
          <span><strong className="text-theme-text-muted font-normal">时间:</strong> {currentCandle.time || "--"}</span>
          <span><strong className="text-theme-text-muted font-normal">开:</strong> <span className="font-mono font-black text-theme-text-heading">${currentCandle.open?.toFixed(2) || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal">高:</strong> <span className="text-red-500 font-black font-mono [text-shadow:_0_1px_2px_rgba(0,0,0,0.3)]">${currentCandle.high?.toFixed(2) || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal">低:</strong> <span className="text-emerald-500 font-black font-mono [text-shadow:_0_1px_2px_rgba(0,0,0,0.3)]">${currentCandle.low?.toFixed(2) || "--"}</span></span>
          <span><strong className="text-theme-text-muted font-normal">收:</strong> <span className={isUp ? "text-red-500 font-black font-mono text-sm [text-shadow:_0_1px_2px_rgba(0,0,0,0.4)]" : "text-emerald-500 font-black font-mono text-sm [text-shadow:_0_1px_2px_rgba(0,0,0,0.4)]"}>${currentCandle.close?.toFixed(2) || "--"}</span></span>
          <span className="flex items-center gap-1">
            <strong className="text-theme-text-muted font-normal">涨跌:</strong> 
            <span className={`inline-flex items-center px-2 py-0.5 rounded border font-black font-mono text-xs md:text-sm shadow-2xs ${
              currentChangePercent >= 0 
                ? isUpRed ? "bg-red-500/20 text-red-500 border-red-500/40" : "bg-emerald-500/20 text-emerald-500 border-emerald-500/40"
                : isUpRed ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40" : "bg-red-500/20 text-red-500 border-red-500/40"
            }`}>
              {currentChangePercent >= 0 ? "+" : ""}{currentChangePercent.toFixed(2)}%
            </span>
          </span>
          <span><strong className="text-theme-text-muted font-normal">成交量:</strong> <span className="font-mono font-black text-theme-text-heading">{((currentCandle.volume || 0) / 10000).toFixed(2)}万</span></span>
        </div>

        {/* Row 2: Overlay Indicator Values */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-theme-border/60 text-[10px]">
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
          {activeMAs.ma1 && <span className="text-amber-500">MA{maParams.p1}: {fullMa1[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {activeMAs.ma2 && <span className="text-pink-500">MA{maParams.p2}: {fullMa2[activeCandleIndex]?.toFixed(2) || "-"}</span>}
          {activeMAs.ma3 && <span className="text-blue-500">MA{maParams.p3}: {fullMa3[activeCandleIndex]?.toFixed(2) || "-"}</span>}
        </div>
      </div>

      {/* 3. HTML5 Canvas Chart Container */}
      <div 
        ref={canvasContainerRef}
        className={`w-full relative select-none rounded-xl overflow-hidden ${
          isExpanded ? "flex-1 min-h-[460px]" : "h-[420px] sm:h-[520px] md:h-[620px]"
        }`}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          onDoubleClick={handleJumpToLatest}
          style={{ touchAction: "none" }}
          className={`w-full h-full block rounded-xl border border-theme-border ${
            isDragging ? "cursor-grabbing" : touchMode === "pan" ? "cursor-grab" : "cursor-crosshair"
          }`}
        />
        
        {/* Top-Left Touch Mode Toggle & Helper Hint Overlay */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap">
          <div className="bg-theme-card/90 backdrop-blur border border-theme-border p-0.5 rounded-lg flex items-center shadow-xs text-[10px] font-bold">
            <button
              onClick={() => setTouchMode("pan")}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${
                touchMode === "pan" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="滑动平移模式"
            >
              <Hand size={12} />
              <span>拖拽</span>
            </button>
            <button
              onClick={() => setTouchMode("crosshair")}
              className={`px-2 py-1 rounded-md flex items-center gap-1 transition cursor-pointer ${
                touchMode === "crosshair" ? "bg-indigo-600 text-white shadow-xs" : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
              title="十字准星查价模式"
            >
              <Crosshair size={12} />
              <span>查价</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] text-theme-text-muted bg-theme-card/85 backdrop-blur px-2 py-1 rounded-lg border border-theme-border">
            <MoveHorizontal size={12} />
            <span>支持拖拽/滚轮/双击回到最新</span>
          </div>
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

      {/* 4. Indicator Settings Modal */}
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
