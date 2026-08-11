// Pure Client-side Stock Data API for GitHub Pages & Static Deployment

export interface Stock {
  symbol: string;
  name: string;
  basePrice: number;
  currentPrice: number;
  prevClose: number;
  high: number;
  low: number;
  volume: number;
  history?: number[];
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  publisher: string;
  providerPublishTime: number;
  link: string;
}

// Default initial stocks directory
export const DEFAULT_STOCKS: Stock[] = [
  { symbol: "NVDA", name: "NVIDIA Corp. (英伟达 AI芯片)", basePrice: 120.0, currentPrice: 121.5, prevClose: 118.8, high: 123.4, low: 118.2, volume: 45000000, history: [118.8, 119.2, 120.1, 121.5] },
  { symbol: "AAPL", name: "Apple Inc. (苹果公司)", basePrice: 220.0, currentPrice: 222.3, prevClose: 219.5, high: 224.0, low: 219.0, volume: 38000000, history: [219.5, 220.5, 221.8, 222.3] },
  { symbol: "TSLA", name: "Tesla Inc. (特斯拉电动车)", basePrice: 210.0, currentPrice: 208.5, prevClose: 212.0, high: 215.8, low: 206.2, volume: 52000000, history: [212.0, 210.2, 209.1, 208.5] },
  { symbol: "MSFT", name: "Microsoft Corp. (微软)", basePrice: 440.0, currentPrice: 442.8, prevClose: 438.5, high: 445.0, low: 438.0, volume: 21000000, history: [438.5, 439.8, 441.2, 442.8] },
  { symbol: "AMZN", name: "Amazon.com Inc. (亚马逊)", basePrice: 180.0, currentPrice: 181.2, prevClose: 179.0, high: 182.5, low: 178.5, volume: 28000000, history: [179.0, 180.0, 180.8, 181.2] },
  { symbol: "GOOGL", name: "Alphabet Inc. (谷歌/Google)", basePrice: 175.0, currentPrice: 176.4, prevClose: 174.2, high: 177.8, low: 174.0, volume: 22000000, history: [174.2, 175.1, 175.8, 176.4] },
  { symbol: "META", name: "Meta Platforms (元宇宙/社交)", basePrice: 500.0, currentPrice: 504.2, prevClose: 495.0, high: 508.0, low: 494.0, volume: 16000000, history: [495.0, 498.2, 501.5, 504.2] },
  { symbol: "AMD", name: "Advanced Micro Devices (超威半导体)", basePrice: 150.0, currentPrice: 151.8, prevClose: 148.5, high: 153.2, low: 148.0, volume: 32000000, history: [148.5, 149.8, 150.5, 151.8] },
  { symbol: "INTC", name: "Intel Corp. (英特尔晶圆)", basePrice: 30.0, currentPrice: 29.8, prevClose: 30.5, high: 31.0, low: 29.5, volume: 41000000, history: [30.5, 30.2, 30.0, 29.8] },
  { symbol: "AVGO", name: "Broadcom Inc. (博通芯片)", basePrice: 160.0, currentPrice: 162.5, prevClose: 158.0, high: 164.0, low: 157.5, volume: 12000000, history: [158.0, 159.5, 161.0, 162.5] },
  { symbol: "QCOM", name: "Qualcomm Inc. (高通)", basePrice: 170.0, currentPrice: 171.2, prevClose: 169.0, high: 173.0, low: 168.5, volume: 11000000, history: [169.0, 170.1, 170.8, 171.2] },
  { symbol: "TSM", name: "TSMC (台积电 ADR)", basePrice: 140.0, currentPrice: 140.8, prevClose: 139.2, high: 142.0, low: 138.5, volume: 15000000, history: [139.2, 139.8, 140.2, 140.8] },
  { symbol: "BABA", name: "Alibaba Group (阿里巴巴 ADR)", basePrice: 72.0, currentPrice: 71.8, prevClose: 72.5, high: 73.2, low: 71.0, volume: 19000000, history: [72.5, 72.2, 72.0, 71.8] },
  { symbol: "PDD", name: "PDD Holdings (拼多多 ADR)", basePrice: 120.0, currentPrice: 121.5, prevClose: 118.9, high: 124.0, low: 118.0, volume: 11000000, history: [118.9, 119.8, 120.5, 121.5] },
  { symbol: "0700.HK", name: "Tencent Holdings (腾讯控股)", basePrice: 380.0, currentPrice: 382.4, prevClose: 378.0, high: 385.0, low: 377.2, volume: 12000000, history: [378.0, 379.5, 381.0, 382.4] },
  { symbol: "9988.HK", name: "Alibaba HK (阿里巴巴-SW)", basePrice: 73.0, currentPrice: 72.8, prevClose: 73.5, high: 74.2, low: 72.0, volume: 35000000, history: [73.5, 73.2, 73.0, 72.8] },
  { symbol: "600519.SH", name: "Kweichow Moutai (贵州茅台 A股)", basePrice: 1650.0, currentPrice: 1654.5, prevClose: 1642.0, high: 1670.0, low: 1640.0, volume: 1800000, history: [1642.0, 1648.0, 1650.0, 1654.5] }
];

const LOCAL_STORAGE_STOCKS_KEY = "stock_app_custom_stocks_v1";

export function loadStoredStocks(): Stock[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_STOCKS_KEY);
    if (saved) {
      const parsed: Stock[] = JSON.parse(saved);
      // Merge with default stocks to ensure base stocks exist
      const symbolMap = new Map<string, Stock>();
      DEFAULT_STOCKS.forEach(s => symbolMap.set(s.symbol, s));
      parsed.forEach(s => symbolMap.set(s.symbol, s));
      return Array.from(symbolMap.values());
    }
  } catch {
    // Ignore parse error
  }
  return DEFAULT_STOCKS;
}

export function saveStoredStocks(stocks: Stock[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_STOCKS_KEY, JSON.stringify(stocks));
  } catch {
    // Ignore storage write error
  }
}

// Fetch helper via CORS Proxy for browser environment
async function fetchWithProxy(url: string, timeoutMs = 4000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Attempt direct fetch first
    const directRes = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (directRes.ok) {
      return await directRes.json();
    }
  } catch {
    // Direct fetch blocked by CORS or network error, fallback to CORS proxies
  }

  // Try AllOrigins CORS proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
    const proxyRes = await fetch(proxyUrl, { signal: controller2.signal });
    clearTimeout(timeoutId2);
    if (proxyRes.ok) {
      return await proxyRes.json();
    }
  } catch {
    // Fallback to second proxy if available
  }

  throw new Error("Unable to fetch via CORS proxy");
}

/**
 * Fetch stock quote directly in browser
 */
export async function fetchStockQuote(symbol: string): Promise<Stock | null> {
  const cleanSym = symbol.trim().toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSym}?range=1d&interval=1d`;

  try {
    const data = await fetchWithProxy(url, 3500);
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta && meta.regularMarketPrice) {
      return {
        symbol: cleanSym,
        name: meta.longName || meta.shortName || cleanSym,
        basePrice: meta.previousClose || meta.regularMarketPrice,
        currentPrice: meta.regularMarketPrice,
        prevClose: meta.previousClose || meta.regularMarketPrice,
        high: meta.regularMarketDayHigh || meta.regularMarketPrice,
        low: meta.regularMarketDayLow || meta.regularMarketPrice,
        volume: meta.regularMarketVolume || 1000000,
        history: [meta.previousClose, meta.regularMarketPrice]
      };
    }
  } catch {
    // Return null on failure to allow local cache fallback
  }

  return null;
}

/**
 * Fetch stocks list & update quotes
 */
export async function fetchStocksList(requestedSymbols: string[] = []): Promise<Stock[]> {
  const currentLocal = loadStoredStocks();
  const localMap = new Map<string, Stock>();
  currentLocal.forEach(s => localMap.set(s.symbol, s));

  // Symbols to update
  const targetSymbols = Array.from(new Set([
    ...currentLocal.slice(0, 8).map(s => s.symbol),
    ...requestedSymbols
  ]));

  // Try updating live quotes
  await Promise.allSettled(
    targetSymbols.map(async (sym) => {
      const updated = await fetchStockQuote(sym);
      if (updated) {
        const existing = localMap.get(sym);
        if (existing) {
          const history = existing.history || [];
          history.push(updated.currentPrice);
          if (history.length > 15) history.shift();
          localMap.set(sym, {
            ...existing,
            currentPrice: updated.currentPrice,
            high: Math.max(existing.high, updated.high),
            low: Math.min(existing.low || updated.low, updated.low),
            volume: updated.volume,
            history
          });
        } else {
          localMap.set(sym, updated);
        }
      }
    })
  );

  const updatedList = Array.from(localMap.values());
  saveStoredStocks(updatedList);
  return updatedList;
}

/**
 * Search stocks across local directory & Yahoo Finance search
 */
export async function searchStocks(query: string): Promise<Stock[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const localStocks = loadStoredStocks();
  const localMatches = localStocks.filter(
    s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  );

  const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8`;

  try {
    const data = await fetchWithProxy(searchUrl, 3000);
    if (data?.quotes && Array.isArray(data.quotes)) {
      const remoteQuotes = data.quotes.filter((item: any) => item.symbol && item.isYahooFinance);

      const fetchedStocks = await Promise.all(
        remoteQuotes.map(async (item: any) => {
          const sym = item.symbol.toUpperCase();
          const quote = await fetchStockQuote(sym);
          if (quote) return quote;
          return {
            symbol: sym,
            name: item.longname || item.shortname || sym,
            basePrice: 100,
            currentPrice: 100,
            prevClose: 100,
            high: 100,
            low: 100,
            volume: 1000000
          };
        })
      );

      const map = new Map<string, Stock>();
      localMatches.forEach(s => map.set(s.symbol, s));
      fetchedStocks.forEach(s => map.set(s.symbol, s));

      const merged = Array.from(map.values());
      saveStoredStocks(merged);
      return merged.slice(0, 30);
    }
  } catch {
    // Fallback to local search
  }

  return localMatches;
}

/**
 * Fetch Candlestick Chart data directly
 */
export async function fetchCandlesticks(symbol: string, range: string): Promise<Candle[]> {
  const cleanSym = symbol.trim().toUpperCase();
  const period1 = new Date();
  const period2 = new Date();
  let interval: string = "1d";

  if (range === "5M") {
    period1.setDate(period1.getDate() - 1);
    interval = "5m";
  } else if (range === "60M") {
    period1.setDate(period1.getDate() - 5);
    interval = "60m";
  } else if (range === "1D") {
    period1.setDate(period1.getDate() - 2);
    interval = "5m";
  } else if (range === "1W") {
    period1.setDate(period1.getDate() - 7);
    interval = "1h";
  } else if (range === "1M") {
    period1.setMonth(period1.getMonth() - 1);
    interval = "1d";
  } else if (range === "1Y") {
    period1.setFullYear(period1.getFullYear() - 1);
    interval = "1d";
  }

  const p1 = Math.floor(period1.getTime() / 1000);
  const p2 = Math.floor(period2.getTime() / 1000);
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanSym}?period1=${p1}&period2=${p2}&interval=${interval}`;

  try {
    const data = await fetchWithProxy(chartUrl, 4000);
    const result = data?.chart?.result?.[0];
    if (result && result.timestamp && result.indicators?.quote?.[0]) {
      const quotes = result.indicators.quote[0];
      const timestamps = result.timestamp;
      let lastClose = 100;

      const candles: Candle[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const t = timestamps[i];
        let closeVal = quotes.close?.[i];
        let openVal = quotes.open?.[i];
        let highVal = quotes.high?.[i];
        let lowVal = quotes.low?.[i];
        let volVal = quotes.volume?.[i] || 0;

        if (closeVal === null || closeVal === undefined || isNaN(closeVal) || closeVal <= 0) {
          closeVal = lastClose;
        } else {
          lastClose = closeVal;
        }

        if (openVal === null || openVal === undefined || isNaN(openVal) || openVal <= 0) {
          openVal = closeVal;
        }

        if (highVal === null || highVal === undefined || isNaN(highVal) || highVal < Math.max(openVal, closeVal)) {
          highVal = Math.max(openVal, closeVal);
        }

        if (lowVal === null || lowVal === undefined || isNaN(lowVal) || lowVal <= 0 || lowVal > Math.min(openVal, closeVal)) {
          lowVal = Math.min(openVal, closeVal);
        }

        const time = new Date(t * 1000);
        let dateStr = "";
        if (range === "1D" || range === "5M" || range === "60M") {
          dateStr = time.toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (range === "1Y") {
          dateStr = time.toLocaleDateString("zh-CN", { year: '2-digit', month: '2-digit', day: '2-digit' });
        } else {
          dateStr = time.toLocaleDateString("zh-CN", { month: '2-digit', day: '2-digit' });
        }

        candles.push({
          time: dateStr,
          open: Number(openVal.toFixed(2)),
          high: Number(highVal.toFixed(2)),
          low: Number(lowVal.toFixed(2)),
          close: Number(closeVal.toFixed(2)),
          volume: Math.round(volVal)
        });
      }

      if (candles.length > 0) {
        return candles;
      }
    }
  } catch {
    // Generate fallback mock candles
  }

  // Fallback synthetic candle generator
  return generateMockCandles(cleanSym, range);
}

function generateMockCandles(symbol: string, range: string): Candle[] {
  const stocks = loadStoredStocks();
  const stock = stocks.find(s => s.symbol === symbol) || stocks[0] || DEFAULT_STOCKS[0];
  let days = 30;
  if (range === "5M" || range === "1D") days = 1;
  else if (range === "60M") days = 5;
  else if (range === "1W") days = 7;
  else if (range === "1Y") days = 250;

  const data: Candle[] = [];
  let price = stock.currentPrice || 100;
  const now = Date.now();
  const totalSteps = (range === "1D" || range === "5M") ? 48 : range === "60M" ? 30 : days;
  const step = (range === "1D" || range === "5M") ? 5 * 60 * 1000 : range === "60M" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  for (let i = totalSteps; i >= 0; i--) {
    const time = now - i * step;
    const change = price * (Math.random() - 0.49) * 0.012;
    const open = Number(price.toFixed(2));
    const close = Number(Math.max(1, price + change).toFixed(2));
    const high = Number((Math.max(open, close) + Math.random() * price * 0.005).toFixed(2));
    const low = Number((Math.max(0.5, Math.min(open, close) - Math.random() * price * 0.005)).toFixed(2));
    const volume = Math.floor(100000 + Math.random() * 500000);

    price = close;

    let dateStr = "";
    if (range === "1D" || range === "5M" || range === "60M") {
      dateStr = new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    } else {
      dateStr = new Date(time).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    }

    data.push({ time: dateStr, open, high, low, close, volume });
  }

  return data;
}

/**
 * Fetch Stock News
 */
export async function fetchStockNews(query = "US Stocks"): Promise<NewsItem[]> {
  const newsUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=6`;

  try {
    const data = await fetchWithProxy(newsUrl, 3000);
    if (data?.news && Array.isArray(data.news) && data.news.length > 0) {
      return data.news.slice(0, 6).map((item: any) => ({
        title: item.title,
        publisher: item.publisher || "Yahoo Finance",
        providerPublishTime: item.providerPublishTime || Math.floor(Date.now() / 1000),
        link: item.link || "#"
      }));
    }
  } catch {
    // Fallback mock news
  }

  return [
    {
      title: `【市场动态】${query} 市场表现强劲，分析师普遍看好后续科技与龙头趋势`,
      publisher: "Yahoo Finance",
      providerPublishTime: Math.floor(Date.now() / 1000) - 1200,
      link: "#"
    },
    {
      title: `全球资本局势：资金流向优质龙头与科技创新资产，核心板块表现活跃`,
      publisher: "Reuters",
      providerPublishTime: Math.floor(Date.now() / 1000) - 3600,
      link: "#"
    },
    {
      title: `宏观洞察：美联储货币政策与宏观利好提振市场，多维估值处于合理区间`,
      publisher: "Bloomberg",
      providerPublishTime: Math.floor(Date.now() / 1000) - 7200,
      link: "#"
    }
  ];
}
