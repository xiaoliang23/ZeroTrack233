import express from "express";
import path from "path";
// @ts-ignore
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

dotenv.config();



const db = new Database('app.db');
db.pragma('journal_mode = WAL');

// Initialize users table and login_attempts
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0
);
`);

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret';

const app = express();
const PORT = 3000;

function isExpectedFetchFallback(err: any): boolean {
  if (!err) return true;
  const msg = String(err.message || err).toLowerCase();
  const name = String(err.name || "");
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    name === "TypeError" ||
    msg.includes("aborted") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("429") ||
    msg.includes("too many requests") ||
    msg.includes("unexpected token") ||
    msg.includes("econnreset")
  );
}

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client safely
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "placeholder-key-for-init",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Mock Stock Base Data
interface Stock {
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

const STOCKS: Stock[] = [
  // === INDEX ETFs ===
  { symbol: "SPY", name: "SPDR S&P 500 ETF (标普500指数ETF)", basePrice: 550.0, currentPrice: 551.2, prevClose: 549.5, high: 552.5, low: 548.8, volume: 75000000 },
  { symbol: "QQQ", name: "Invesco QQQ Trust (纳斯达克100 ETF)", basePrice: 490.0, currentPrice: 491.4, prevClose: 488.0, high: 493.0, low: 487.2, volume: 48000000 },
  { symbol: "IWM", name: "iShares Russell 2000 ETF (罗素2000小盘股)", basePrice: 225.0, currentPrice: 224.8, prevClose: 226.1, high: 227.5, low: 223.5, volume: 32000000 },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial ETF (道琼斯工业 ETF)", basePrice: 410.0, currentPrice: 411.2, prevClose: 409.0, high: 412.5, low: 408.2, volume: 15000000 },
  { symbol: "GLD", name: "SPDR Gold Shares (黄金 ETF - 商品基金)", basePrice: 235.0, currentPrice: 236.5, prevClose: 234.2, high: 237.8, low: 233.9, volume: 8000000 },
  { symbol: "USO", name: "United States Oil Fund (美国原油 ETF)", basePrice: 78.5, currentPrice: 78.2, prevClose: 79.0, high: 79.8, low: 77.5, volume: 12000000 },

  // === S&P 500 TECH & AI GIANTS ===
  { symbol: "AAPL", name: "Apple Inc. (苹果公司)", basePrice: 300.0, currentPrice: 302.25, prevClose: 300.0, high: 304.5, low: 299.0, volume: 48000000 },
  { symbol: "NVDA", name: "NVIDIA Corp. (英伟达)", basePrice: 220.0, currentPrice: 224.09, prevClose: 220.0, high: 225.1, low: 216.2, volume: 105000000 },
  { symbol: "MSFT", name: "Microsoft Corp. (微软)", basePrice: 490.0, currentPrice: 492.43, prevClose: 490.0, high: 495.8, low: 488.0, volume: 25000000 },
  { symbol: "TSLA", name: "Tesla, Inc. (特斯拉)", basePrice: 325.0, currentPrice: 327.51, prevClose: 325.0, high: 331.0, low: 322.0, volume: 68000000 },
  { symbol: "AMZN", name: "Amazon.com, Inc. (亚马逊)", basePrice: 265.0, currentPrice: 267.28, prevClose: 265.0, high: 269.5, low: 264.0, volume: 32000000 },
  { symbol: "GOOGL", name: "Alphabet Inc. (谷歌/Google)", basePrice: 343.8, currentPrice: 343.54, prevClose: 343.8, high: 346.48, low: 340.88, volume: 23850000 },
  { symbol: "META", name: "Meta Platforms (脸书/元宇宙)", basePrice: 575.0, currentPrice: 578.85, prevClose: 575.0, high: 582.0, low: 572.0, volume: 19000000 },
  { symbol: "AMD", name: "Advanced Micro Devices (超威半导体)", basePrice: 480.0, currentPrice: 482.93, prevClose: 480.0, high: 488.0, low: 476.0, volume: 38000000 },
  { symbol: "AVGO", name: "Broadcom Inc. (博通)", basePrice: 410.0, currentPrice: 416.05, prevClose: 410.0, high: 420.0, low: 408.0, volume: 15000000 },
  { symbol: "NFLX", name: "Netflix Inc. (网飞/奈飞)", basePrice: 680.0, currentPrice: 682.8, prevClose: 675.0, high: 685.5, low: 670.0, volume: 4500000 },
  { symbol: "ADBE", name: "Adobe Inc. (奥多比)", basePrice: 535.0, currentPrice: 536.4, prevClose: 532.0, high: 542.0, low: 531.0, volume: 3800000 },
  { symbol: "CRM", name: "Salesforce Inc. (赛富时)", basePrice: 290.0, currentPrice: 291.5, prevClose: 288.5, high: 294.0, low: 287.0, volume: 5500000 },
  { symbol: "ORCL", name: "Oracle Corp. (甲骨文)", basePrice: 125.0, currentPrice: 126.1, prevClose: 124.8, high: 128.0, low: 124.0, volume: 9000000 },
  { symbol: "QCOM", name: "Qualcomm Inc. (高通)", basePrice: 168.0, currentPrice: 169.3, prevClose: 167.0, high: 171.5, low: 166.0, volume: 11000000 },
  { symbol: "INTC", name: "Intel Corp. (英特尔)", basePrice: 42.0, currentPrice: 41.8, prevClose: 42.5, high: 43.1, low: 41.5, volume: 35000000 },

  // === S&P 500 FINANCIALS & HEALTH & VALUE ===
  { symbol: "BRK.B", name: "Berkshire Hathaway (伯克希尔哈撒韦-B)", basePrice: 415.0, currentPrice: 416.2, prevClose: 414.0, high: 418.5, low: 413.0, volume: 6000000 },
  { symbol: "JPM", name: "JPMorgan Chase & Co. (摩根大通)", basePrice: 195.0, currentPrice: 196.4, prevClose: 194.5, high: 198.0, low: 193.8, volume: 12000000 },
  { symbol: "BAC", name: "Bank of America (美国银行)", basePrice: 37.0, currentPrice: 37.2, prevClose: 36.8, high: 37.6, low: 36.5, volume: 38000000 },
  { symbol: "GS", name: "Goldman Sachs Group (高盛集团)", basePrice: 410.0, currentPrice: 411.8, prevClose: 408.0, high: 415.0, low: 407.2, volume: 2800000 },
  { symbol: "V", name: "Visa Inc. (维萨卡)", basePrice: 280.0, currentPrice: 281.3, prevClose: 279.0, high: 283.5, low: 278.2, volume: 6500000 },
  { symbol: "MA", name: "Mastercard Inc. (万事达卡)", basePrice: 475.0, currentPrice: 476.9, prevClose: 473.5, high: 480.0, low: 472.0, volume: 3200000 },
  { symbol: "XOM", name: "Exxon Mobil Corp. (埃克森美孚)", basePrice: 115.0, currentPrice: 115.8, prevClose: 114.2, high: 116.9, low: 113.8, volume: 18000000 },
  { symbol: "CVX", name: "Chevron Corp. (雪佛龙)", basePrice: 158.0, currentPrice: 157.6, prevClose: 159.0, high: 161.0, low: 156.5, volume: 9500000 },
  { symbol: "KO", name: "Coca-Cola Co. (可口可乐)", basePrice: 87.0, currentPrice: 87.02, prevClose: 86.48, high: 87.29, low: 85.68, volume: 14000000 },
  { symbol: "PEP", name: "PepsiCo Inc. (百事公司)", basePrice: 168.0, currentPrice: 168.5, prevClose: 167.2, high: 170.0, low: 166.8, volume: 5500000 },
  { symbol: "PG", name: "Procter & Gamble (宝洁公司)", basePrice: 162.0, currentPrice: 162.9, prevClose: 161.5, high: 164.0, low: 161.0, volume: 7000000 },
  { symbol: "WMT", name: "Walmart Inc. (沃尔玛)", basePrice: 60.0, currentPrice: 60.3, prevClose: 59.8, high: 60.8, low: 59.5, volume: 18000000 },
  { symbol: "COST", name: "Costco Wholesale (开市客)", basePrice: 725.0, currentPrice: 728.1, prevClose: 722.0, high: 733.0, low: 720.0, volume: 2500000 },
  { symbol: "NKE", name: "NIKE Inc. (耐克)", basePrice: 100.0, currentPrice: 99.4, prevClose: 101.2, high: 102.5, low: 98.8, volume: 8000000 },
  { symbol: "DIS", name: "Walt Disney Co. (华特迪士尼)", basePrice: 112.0, currentPrice: 112.5, prevClose: 111.0, high: 114.2, low: 110.5, volume: 9000000 },
  { symbol: "LLY", name: "Eli Lilly & Co. (礼来制药)", basePrice: 760.0, currentPrice: 764.5, prevClose: 755.0, high: 775.0, low: 752.0, volume: 4000000 },
  { symbol: "JNJ", name: "Johnson & Johnson (强生制药)", basePrice: 155.0, currentPrice: 155.4, prevClose: 154.8, high: 156.8, low: 154.0, volume: 8500000 },
  { symbol: "UNH", name: "UnitedHealth Group (联合健康)", basePrice: 490.0, currentPrice: 488.5, prevClose: 492.1, high: 495.0, low: 485.5, volume: 3500000 },
  { symbol: "VZ", name: "Verizon Communications Inc. (威瑞森电信)", basePrice: 40.5, currentPrice: 40.85, prevClose: 40.2, high: 41.2, low: 39.9, volume: 18500000 },
  { symbol: "T", name: "AT&T Inc. (美国电话电报)", basePrice: 18.8, currentPrice: 18.95, prevClose: 18.7, high: 19.2, low: 18.5, volume: 32000000 },
  { symbol: "TMUS", name: "T-Mobile US, Inc. (T-移动)", basePrice: 178.0, currentPrice: 179.2, prevClose: 177.5, high: 181.0, low: 176.8, volume: 4500000 },

  // === GLOBAL CHIPS & CARS ===
  { symbol: "TSM", name: "TSMC (台积电 ADR)", basePrice: 140.0, currentPrice: 140.8, prevClose: 139.2, high: 142.0, low: 138.5, volume: 15000000 },
  { symbol: "ASML", name: "ASML Holding (阿斯麦 ADR)", basePrice: 920.0, currentPrice: 924.5, prevClose: 915.0, high: 938.0, low: 912.0, volume: 1500000 },
  { symbol: "F", name: "Ford Motor Co. (福特汽车)", basePrice: 12.2, currentPrice: 12.3, prevClose: 12.1, high: 12.5, low: 11.9, volume: 45000000 },
  { symbol: "GM", name: "General Motors (通用汽车)", basePrice: 40.5, currentPrice: 40.9, prevClose: 40.1, high: 41.5, low: 39.8, volume: 12000000 },

  // === CHINA CONCEPT ADRs & HK & A-SHARES ===
  { symbol: "BABA", name: "Alibaba Group (阿里巴巴 ADR)", basePrice: 72.0, currentPrice: 71.8, prevClose: 72.5, high: 73.2, low: 71.0, volume: 19000000 },
  { symbol: "PDD", name: "PDD Holdings (拼多多 ADR)", basePrice: 120.0, currentPrice: 121.5, prevClose: 118.9, high: 124.0, low: 118.0, volume: 11000000 },
  { symbol: "JD", name: "JD.com, Inc. (京东集团 ADR)", basePrice: 26.5, currentPrice: 26.2, prevClose: 26.9, high: 27.2, low: 25.9, volume: 14000000 },
  { symbol: "LI", name: "Li Auto Inc. (理想汽车 ADR)", basePrice: 24.5, currentPrice: 24.8, prevClose: 24.1, high: 25.5, low: 23.8, volume: 15000000 },
  { symbol: "NIO", name: "NIO Inc. (蔚来汽车 ADR)", basePrice: 4.8, currentPrice: 4.75, prevClose: 4.85, high: 5.0, low: 4.65, volume: 38000000 },
  { symbol: "XPEV", name: "XPeng Inc. (小鹏汽车 ADR)", basePrice: 7.5, currentPrice: 7.42, prevClose: 7.6, high: 7.9, low: 7.3, volume: 22000000 },
  { symbol: "0700.HK", name: "Tencent Holdings (腾讯控股)", basePrice: 380.0, currentPrice: 382.4, prevClose: 378.0, high: 385.0, low: 377.2, volume: 12000000 },
  { symbol: "3690.HK", name: "Meituan (美团)", basePrice: 115.0, currentPrice: 116.3, prevClose: 114.2, high: 118.0, low: 113.5, volume: 21000000 },
  { symbol: "1810.HK", name: "Xiaomi Group (小米集团)", basePrice: 18.5, currentPrice: 18.7, prevClose: 18.3, high: 19.1, low: 18.2, volume: 48000000 },
  { symbol: "9988.HK", name: "Alibaba HK (阿里巴巴-SW)", basePrice: 73.0, currentPrice: 72.8, prevClose: 73.5, high: 74.2, low: 72.0, volume: 35000000 },
  { symbol: "9618.HK", name: "JD HK (京东集团-SW)", basePrice: 104.0, currentPrice: 102.8, prevClose: 105.1, high: 106.5, low: 101.8, volume: 8000000 },
  { symbol: "BYDDF", name: "BYD Company (比亚迪股份 ADR)", basePrice: 28.0, currentPrice: 28.3, prevClose: 27.9, high: 28.8, low: 27.6, volume: 5000000 },
  { symbol: "600519.SH", name: "Kweichow Moutai (贵州茅台 A股)", basePrice: 1650.0, currentPrice: 1654.5, prevClose: 1642.0, high: 1670.0, low: 1640.0, volume: 1800000 },
  { symbol: "000001.SZ", name: "Ping An Bank (平安银行 A股)", basePrice: 10.5, currentPrice: 10.55, prevClose: 10.48, high: 10.7, low: 10.4, volume: 85000000 }
];

const GLOBAL_STOCK_DIRECTORY: Record<string, { name: string; basePrice: number }> = {
  // === POPULAR US STOCKS ===
  "NEE": { name: "NextEra Energy (新纪元能源)", basePrice: 72.80 },
  "VZ": { name: "Verizon Communications Inc. (威瑞森电信)", basePrice: 40.50 },
  "T": { name: "AT&T Inc. (美国电话电报)", basePrice: 18.80 },
  "TMUS": { name: "T-Mobile US, Inc. (T-移动)", basePrice: 178.00 },
  "MCD": { name: "McDonald's Corp. (麦当劳)", basePrice: 285.50 },
  "BILI": { name: "Bilibili Inc. (哔哩哔哩 ADR)", basePrice: 15.20 },
  "SBUX": { name: "Starbucks Corp. (星巴克)", basePrice: 79.20 },
  "COIN": { name: "Coinbase Global, Inc. (币安交易所)", basePrice: 220.00 },
  "MSTR": { name: "MicroStrategy Inc. (微策略)", basePrice: 1450.00 },
  "MARA": { name: "Marathon Digital Holdings (马拉松数字)", basePrice: 18.50 },
  "RIOT": { name: "Riot Platforms (莱特比特币)", basePrice: 10.20 },
  "PLTR": { name: "Palantir Technologies (帕兰提尔 AI)", basePrice: 26.50 },
  "LLY": { name: "Eli Lilly & Co. (礼来制药)", basePrice: 915.00 },
  "NVO": { name: "Novo Nordisk (诺和诺德 ADR)", basePrice: 135.00 },
  "ARM": { name: "Arm Holdings plc (安谋科技)", basePrice: 125.00 },
  "COST": { name: "Costco Wholesale Corp. (开市客)", basePrice: 840.50 },
  "WMT": { name: "Walmart Inc. (沃尔玛)", basePrice: 65.20 },
  "HD": { name: "Home Depot, Inc. (家得宝)", basePrice: 345.00 },
  "DIS": { name: "The Walt Disney Co. (迪士尼)", basePrice: 104.20 },
  "NKE": { name: "NIKE, Inc. (耐克)", basePrice: 95.40 },
  "KO": { name: "Coca-Cola Co. (可口可乐)", basePrice: 87.02 },
  "PEP": { name: "PepsiCo, Inc. (百事公司)", basePrice: 168.50 },
  "PG": { name: "Procter & Gamble (宝洁)", basePrice: 164.20 },
  "CAT": { name: "Caterpillar Inc. (卡特彼勒)", basePrice: 325.00 },
  "GE": { name: "General Electric Co. (通用电气)", basePrice: 165.00 },
  "BA": { name: "Boeing Co. (波音飞机)", basePrice: 175.00 },
  "JNJ": { name: "Johnson & Johnson (强生)", basePrice: 148.50 },
  "PFE": { name: "Pfizer Inc. (辉瑞制药)", basePrice: 28.50 },
  "MRK": { name: "Merck & Co., Inc. (默沙东)", basePrice: 125.50 },
  "XOM": { name: "Exxon Mobil Corp. (埃克森美孚)", basePrice: 114.50 },
  "CVX": { name: "Chevron Corp. (雪佛龙)", basePrice: 156.20 },
  "COP": { name: "ConocoPhillips (康菲石油)", basePrice: 110.00 },
  "LMT": { name: "Lockheed Martin (洛克希德马丁)", basePrice: 465.00 },
  "V": { name: "Visa Inc. (维萨卡)", basePrice: 275.80 },
  "MA": { name: "Mastercard Inc. (万事达卡)", basePrice: 462.50 },
  "GS": { name: "Goldman Sachs Group (高盛)", basePrice: 462.00 },
  "MS": { name: "Morgan Stanley (大摩/摩根士丹利)", basePrice: 98.20 },
  "JPM": { name: "JPMorgan Chase & Co. (小摩/摩根大通)", basePrice: 205.40 },
  "BAC": { name: "Bank of America (美国银行)", basePrice: 39.50 },
  "C": { name: "Citigroup Inc. (花旗集团)", basePrice: 62.40 },
  "WFC": { name: "Wells Fargo & Co. (富国银行)", basePrice: 58.20 },
  "BLK": { name: "BlackRock, Inc. (贝莱德)", basePrice: 785.00 },
  "AXP": { name: "American Express (美国运通)", basePrice: 225.00 },
  "SCHW": { name: "Charles Schwab (嘉信理财)", basePrice: 72.40 },
  "SOFI": { name: "SoFi Technologies (互联网理财)", basePrice: 7.20 },
  "PYPL": { name: "PayPal Holdings (贝宝支付)", basePrice: 68.20 },
  "SQ": { name: "Block Inc. (前Square支付)", basePrice: 65.40 },
  "SHOP": { name: "Shopify Inc. (声学/商铺通)", basePrice: 68.20 },
  "SPOT": { name: "Spotify Technology (声田流媒体)", basePrice: 310.00 },
  "DUOL": { name: "Duolingo, Inc. (多邻国)", basePrice: 195.00 },
  "U": { name: "Unity Software (Unity游戏引擎)", basePrice: 18.20 },
  "RBLX": { name: "Roblox Corp. (沙盒游戏龙头)", basePrice: 38.50 },
  "FUTU": { name: "Futu Holdings (富途控股)", basePrice: 68.50 },
  "PANW": { name: "Palo Alto Networks (派拓安全)", basePrice: 325.00 },
  "CRWD": { name: "CrowdStrike Holdings (众击安全)", basePrice: 340.00 },
  "SNOW": { name: "Snowflake Inc. (雪花云仓)", basePrice: 135.00 },
  "NTES": { name: "NetEase Inc. (网易)", basePrice: 95.00 },
  "BIDU": { name: "Baidu Inc. (百度)", basePrice: 105.00 },

  // === POPULAR HK STOCKS ===
  "9626.HK": { name: "哔哩哔哩-W (Bilibili)", basePrice: 118.50 },
  "9988.HK": { name: "阿里巴巴-SW", basePrice: 72.50 },
  "9618.HK": { name: "京东集团-SW", basePrice: 110.20 },
  "9999.HK": { name: "网易-S", basePrice: 148.00 },
  "9888.HK": { name: "百度集团-SW", basePrice: 102.00 },
  "3033.HK": { name: "南方恒生科技 ETF (恒生科技指数 ETF)", basePrice: 3.82 },
  "2800.HK": { name: "盈富基金 (恒指追踪基金)", basePrice: 17.50 },
  "2828.HK": { name: "恒生中国企业 ETF (国企指数 ETF)", basePrice: 62.10 },
  "0388.HK": { name: "香港交易所 (HKEX)", basePrice: 255.40 },
  "0941.HK": { name: "中国移动 (China Mobile)", basePrice: 72.50 },
  "0762.HK": { name: "中国联通 (China Unicom)", basePrice: 6.20 },
  "0728.HK": { name: "中国电信 (China Telecom)", basePrice: 4.10 },
  "1024.HK": { name: "快手-W (Kuaishou Technology)", basePrice: 48.50 },
  "9868.HK": { name: "小鹏汽车-W (XPeng Inc.)", basePrice: 28.50 },
  "2015.HK": { name: "理想汽车-W (Li Auto Inc.)", basePrice: 78.40 },
  "9866.HK": { name: "蔚来-SW (NIO Inc.)", basePrice: 35.20 },
  "0005.HK": { name: "汇丰控股 (HSBC Holdings)", basePrice: 62.40 },
  "1299.HK": { name: "友邦保险 (AIA Group)", basePrice: 58.50 },
  "2318.HK": { name: "中国平安 (Ping An Insurance)", basePrice: 35.80 },
  "0857.HK": { name: "中国石油股份 (PetroChina)", basePrice: 6.80 },
  "0883.HK": { name: "中国海洋石油 (CNOOC)", basePrice: 18.50 },
  "2382.HK": { name: "舜宇光学科技 (Sunny Optical)", basePrice: 42.50 },
  "3988.HK": { name: "中国银行 (Bank of China)", basePrice: 3.42 },
  "0939.HK": { name: "建设银行 (China Construction Bank)", basePrice: 4.85 },
  "1398.HK": { name: "工商银行 (ICBC)", basePrice: 4.15 },
  "2628.HK": { name: "中国人寿 (China Life)", basePrice: 11.20 },
  "0016.HK": { name: "新鸿基地产 (Sun Hung Kai Properties)", basePrice: 72.40 }
};

function ensureStockExists(symbolStr: string): Stock {
  const symbol = symbolStr.trim().toUpperCase();
  if (!symbol) return STOCKS[0];

  // 1. Already exists in simulation?
  const existing = STOCKS.find(s => s.symbol === symbol);
  if (existing) return existing;

  // 2. Exact match in directory?
  let match = GLOBAL_STOCK_DIRECTORY[symbol];

  // 3. HK Stock numeric autocomplete (e.g. "700" -> "0700.HK" or "9626" -> "9626.HK")
  if (!match && /^\d{1,5}$/.test(symbol)) {
    const padded4 = symbol.padStart(4, '0') + '.HK';
    const padded5 = symbol.padStart(5, '0') + '.HK';
    const rawHk = symbol + '.HK';
    
    const matchedKey = [padded4, padded5, rawHk].find(key => GLOBAL_STOCK_DIRECTORY[key]);
    if (matchedKey) {
      const existingHk = STOCKS.find(s => s.symbol === matchedKey);
      if (existingHk) return existingHk;
      match = GLOBAL_STOCK_DIRECTORY[matchedKey];
      // Override target symbol to use correct format
      const finalHkSymbol = matchedKey;
      const newStock = {
        symbol: finalHkSymbol,
        name: match.name,
        basePrice: match.basePrice,
        currentPrice: match.basePrice,
        prevClose: Number((match.basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
        high: match.basePrice,
        low: match.basePrice,
        volume: 1000000 + Math.floor(Math.random() * 5000000)
      };
      STOCKS.push(newStock);
      return newStock;
    }
  }

  // 4. Exact match found in directory
  if (match) {
    const newStock = {
      symbol: symbol,
      name: match.name,
      basePrice: match.basePrice,
      currentPrice: match.basePrice,
      prevClose: Number((match.basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
      high: match.basePrice,
      low: match.basePrice,
      volume: 1000000 + Math.floor(Math.random() * 5000000)
    };
    STOCKS.push(newStock);
    return newStock;
  }

  // 5. Generate dynamic fallback for ANY custom ticker search
  const isNumericOnly = /^\d+$/.test(symbol);
  const isHkSuffix = /\.HK$/i.test(symbol);
  const isAShareSuffix = /(\.SH|\.SZ)$/i.test(symbol);
  
  let companyName = `${symbol} Corporation (自定义美股)`;
  if (isNumericOnly || isHkSuffix) {
    const displaySymbol = isHkSuffix ? symbol : symbol.padStart(4, '0') + '.HK';
    companyName = `${displaySymbol} (自定义港股)`;
  } else if (isAShareSuffix || (isNumericOnly && symbol.length === 6)) {
    companyName = `${symbol} (自定义A股)`;
  }

  // Consistent stable seed price based on hashing the symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const seedPrice = Number((10 + Math.abs(hash % 290) + (Math.abs(hash % 100) / 100)).toFixed(2)) || 50.0;

  const newStock = {
    symbol: (isNumericOnly && !isHkSuffix && !isAShareSuffix) ? (symbol.padStart(4, '0') + '.HK') : symbol,
    name: companyName,
    basePrice: seedPrice,
    currentPrice: seedPrice,
    prevClose: Number((seedPrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
    high: seedPrice,
    low: seedPrice,
    volume: 1000000 + Math.floor(Math.random() * 5000000)
  };

  // Prevent duplicates of padded formats
  const finalCheck = STOCKS.find(s => s.symbol === newStock.symbol);
  if (finalCheck) return finalCheck;

  STOCKS.push(newStock);
  return newStock;
}

// Removed Random Walk simulate live ticker to stop jumping
// Generate historical candlesticks based on a seed as fallback
function generateCandles(symbol: string, range: string, currentPrice: number) {
  const stock = STOCKS.find(s => s.symbol === symbol) || STOCKS[0];
  let days = 30;
  if (range === "5M") days = 1;
  else if (range === "60M") days = 5;
  else if (range === "1D") days = 1;
  else if (range === "1W") days = 7;
  else if (range === "1M") days = 30;
  else if (range === "1Y") days = 250;

  const data = [];
  let price = (stock.prevClose && stock.prevClose > 0) ? stock.prevClose : (currentPrice || 100);
  const now = Date.now();
  
  const totalSteps = (range === "1D" || range === "5M") ? 48 
                   : range === "60M" ? 30 
                   : days;

  const step = (range === "1D" || range === "5M") ? 5 * 60 * 1000 
             : range === "60M" ? 60 * 60 * 1000 
             : 24 * 60 * 60 * 1000;

  for (let i = totalSteps; i >= 0; i--) {
    const time = now - i * step;
    
    const volatility = 0.012;
    const change = price * (Math.random() - 0.49) * volatility;
    const open = Number(price.toFixed(2));
    const close = Number(Math.max(1, price + change).toFixed(2));
    
    const maxBar = Math.max(open, close);
    const minBar = Math.min(open, close);
    const high = Number((maxBar + Math.random() * price * 0.005).toFixed(2));
    const low = Number((Math.max(0.5, minBar - Math.random() * price * 0.005)).toFixed(2));
    const volume = Math.floor((stock.volume || 1000000) / 30 + Math.random() * 50000);

    price = close;

    let dateStr = "";
    if (range === "1D" || range === "5M" || range === "60M") {
      dateStr = new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    } else {
      dateStr = new Date(time).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    }

    data.push({
      time: dateStr,
      open,
      high,
      low,
      close,
      volume
    });
  }

  // Force the final candle to exactly match current live price
  const lastIndex = data.length - 1;
  if (lastIndex >= 0 && currentPrice > 0) {
    data[lastIndex].close = currentPrice;
    if (currentPrice > data[lastIndex].high) data[lastIndex].high = currentPrice;
    if (currentPrice < data[lastIndex].low && data[lastIndex].low > 0) data[lastIndex].low = currentPrice;
  }

  return data;
}


// Initialize history array
STOCKS.forEach(s => {
  s.history = [];
  for (let i = 0; i < 15; i++) {
    s.history.push(s.currentPrice * (1 + (Math.random() - 0.5) * 0.005));
  }
});

// Background task: Periodically refresh real Yahoo Finance quotes every 20s in rotating batches
let backgroundSyncOffset = 0;
setInterval(async () => {
  try {
    const batchSize = 15;
    const batch = STOCKS.slice(backgroundSyncOffset, backgroundSyncOffset + batchSize);
    backgroundSyncOffset = (backgroundSyncOffset + batchSize) % STOCKS.length;
    const symbols = batch.map(s => s.symbol);

    await Promise.all(symbols.map(async (sym) => {
      try {
        const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta && meta.regularMarketPrice > 0) {
            const stock = STOCKS.find(s => s.symbol === sym);
            if (stock) {
              stock.currentPrice = meta.regularMarketPrice;
              stock.prevClose = meta.previousClose || meta.chartPreviousClose || stock.prevClose;
              stock.high = meta.regularMarketDayHigh || stock.high;
              stock.low = meta.regularMarketDayLow || stock.low;
              stock.volume = meta.regularMarketVolume || stock.volume;
              if (!stock.history) stock.history = [];
              stock.history.push(stock.currentPrice);
              if (stock.history.length > 15) stock.history.shift();
            }
          }
        }
      } catch {}
    }));
  } catch {}
}, 20000);

// 1. API: List Stocks
app.get("/api/stocks", async (req, res) => {
  try {
    // Only fetch real quotes for a subset to avoid hitting rate limits instantly on load
    const topSymbols = STOCKS.slice(0, 15).map(s => s.symbol);
    
    // Also fetch symbols that the user explicitly requests (like their portfolio)
    let requestedSymbols: string[] = [];
    if (req.query.symbols) {
      const parsed = String(req.query.symbols).split(",").map(s => s.trim().toUpperCase());
      requestedSymbols = parsed.filter(s => !!s);
    }
    
    const symbolsToFetch = Array.from(new Set([...topSymbols, ...requestedSymbols]));
    
    if (symbolsToFetch.length > 0) {
      // Fetch directly to bypass some 429 errors from the module
      const quotes: any[] = await Promise.all(symbolsToFetch.map(async (sym) => {
        try {
          const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(4000)
          });
          if (res.ok) {
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
              return {
                symbol: sym,
                regularMarketPrice: meta.regularMarketPrice,
                regularMarketPreviousClose: meta.previousClose,
                regularMarketDayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice,
                regularMarketDayLow: meta.regularMarketDayLow || meta.regularMarketPrice,
                regularMarketVolume: meta.regularMarketVolume || 0
              };
            }
          }
        } catch (e) {}
        return null;
      })).then(res => res.filter(Boolean));
      quotes.forEach(quote => {
        const stock = STOCKS.find(s => s.symbol === quote.symbol);
        if (stock) {
          stock.currentPrice = quote.regularMarketPrice || stock.currentPrice;
          stock.prevClose = quote.regularMarketPreviousClose || stock.prevClose;
          if (stock.history) {
            stock.history.push(stock.currentPrice);
            if (stock.history.length > 15) stock.history.shift();
          }
          stock.high = quote.regularMarketDayHigh || stock.high;
          stock.low = quote.regularMarketDayLow || stock.low;
          stock.volume = quote.regularMarketVolume || stock.volume;
        } else if (requestedSymbols.includes(quote.symbol)) {
          // If a requested symbol wasn't in our local cache, add it
          STOCKS.push({
            symbol: quote.symbol,
            name: quote.longName || quote.shortName || quote.symbol,
            basePrice: quote.regularMarketPreviousClose || 0,
            currentPrice: quote.regularMarketPrice || quote.postMarketPrice || 0,
            prevClose: quote.regularMarketPreviousClose || 0,
            high: quote.regularMarketDayHigh || 0,
            low: quote.regularMarketDayLow || 0,
            volume: quote.regularMarketVolume || 0,
            history: Array(15).fill(quote.regularMarketPrice || quote.postMarketPrice || 0)
          });
        }
      });
    }
  } catch (err: any) {
    if (!isExpectedFetchFallback(err)) {
      console.warn("Notice: Using mock data for initial quotes due to:", err?.message || err);
    }
  }
  res.json(STOCKS);
});

// 1.5 API: Add Custom Stock
app.post("/api/stocks", (req, res) => {
  const { symbol, name, basePrice } = req.body;
  if (!symbol || !name || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
    return res.status(400).json({ error: "请输入有效的股票代码、股票名称和合理的价格" });
  }
  const cleanSymbol = String(symbol).trim().toUpperCase();
  const cleanName = String(name).trim();
  const price = Number(basePrice);

  const existing = STOCKS.find(s => s.symbol === cleanSymbol);
  if (existing) {
    return res.status(400).json({ error: `股票代码 ${cleanSymbol} 已经存在了，您可以直接搜索并添加持仓！` });
  }

  const newStock = {
    symbol: cleanSymbol,
    name: cleanName,
    basePrice: price,
    currentPrice: price,
    prevClose: Number((price * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
    high: price,
    low: price,
    volume: 1000000 + Math.floor(Math.random() * 5000000)
  };

  STOCKS.push(newStock);
  res.status(201).json(newStock);
});

// 2. API: Search Stocks
app.get("/api/stocks/search", async (req, res) => {
  const rawQuery = String(req.query.q || "").trim();
  const query = rawQuery.toLowerCase();
  if (!query) return res.json([]);
  
  try {
    const normalized = rawQuery.toUpperCase();
    const localMatches = STOCKS.filter(
      s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    );
    
    // Fetch from Yahoo Finance Search API
    let validQuotes: any[] = [];
    try {
      const resYahoo = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12`, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(3500)
      });
      if (resYahoo.ok) {
        const data = await resYahoo.json();
        if (data.quotes && Array.isArray(data.quotes)) {
          validQuotes = data.quotes.filter((q: any) => q.symbol).slice(0, 12);
        }
      }
    } catch (e) {}
    
    // Build quote name map
    const infoMap = new Map<string, { name: string; exch?: string }>();
    validQuotes.forEach(q => {
      const sym = q.symbol.toUpperCase();
      const companyName = q.longname || q.shortname || q.dispName || q.name || sym;
      infoMap.set(sym, { name: companyName, exch: q.exchDisp || q.exchange });
    });

    // If query looks like a ticker symbol, make sure it is in infoMap
    if (/^[A-Z0-9\.\-]{1,10}$/.test(normalized) && !infoMap.has(normalized)) {
      infoMap.set(normalized, { name: `${normalized} (证券标的)` });
    }

    const symbolsToFetch = Array.from(infoMap.keys());
    let fetchedStocks: any[] = [];
    
    if (symbolsToFetch.length > 0) {
      const liveQuotes = await Promise.all(symbolsToFetch.map(async (sym) => {
        const info = infoMap.get(sym);
        let curPrice = 0;
        let prevClose = 0;
        let high = 0;
        let low = 0;
        let volume = 0;

        try {
          const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(3500)
          });
          if (res.ok) {
            const data = await res.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
              curPrice = meta.regularMarketPrice || 0;
              prevClose = meta.previousClose || meta.chartPreviousClose || curPrice;
              high = meta.regularMarketDayHigh || curPrice;
              low = meta.regularMarketDayLow || curPrice;
              volume = meta.regularMarketVolume || 0;
            }
          }
        } catch (e) {}

        return {
          symbol: sym,
          name: info?.name || sym,
          basePrice: prevClose || curPrice || 100,
          currentPrice: curPrice || prevClose || 100,
          prevClose: prevClose || curPrice || 100,
          high: high || curPrice || 100,
          low: low || curPrice || 100,
          volume: volume || 1000000
        };
      }));

      fetchedStocks = liveQuotes;
    }

    // Merge: favor Yahoo Finance / Live results, fallback to local matches
    const map = new Map();
    localMatches.forEach(s => map.set(s.symbol, s));
    fetchedStocks.forEach(s => {
       map.set(s.symbol, s);
       // Add to local cache if missing
       const existingIndex = STOCKS.findIndex(exist => exist.symbol === s.symbol);
       if (existingIndex === -1) {
         (s as any).history = Array(15).fill((s as any).currentPrice || 100);
         STOCKS.push(s);
       } else if (s.currentPrice > 0) {
         STOCKS[existingIndex].currentPrice = s.currentPrice;
         if (s.name && s.name !== s.symbol) STOCKS[existingIndex].name = s.name;
       }
    });

    return res.json(Array.from(map.values()).slice(0, 50));
  } catch (error: any) {
    if (!isExpectedFetchFallback(error)) {
      console.warn("Notice: Search falling back to local due to:", error?.message || error);
    }
    const localMatches = STOCKS.filter(
      s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    );
    return res.json(localMatches.slice(0, 50));
  }
});

// 3. API: Get Quote
app.get("/api/stocks/quote/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    let quote: any = { symbol };
    try {
      const res = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta) {
          quote = {
            symbol,
            longName: symbol,
            shortName: symbol,
            regularMarketPrice: meta.regularMarketPrice,
            regularMarketPreviousClose: meta.previousClose,
            regularMarketDayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice,
            regularMarketDayLow: meta.regularMarketDayLow || meta.regularMarketPrice,
            regularMarketVolume: meta.regularMarketVolume || 0
          };
        }
      }
    } catch (e) {}
    const existing = STOCKS.find(s => s.symbol === symbol) || GLOBAL_STOCK_DIRECTORY[symbol];
    const resolvedName = (existing && existing.name && existing.name !== symbol)
      ? existing.name
      : (GLOBAL_STOCK_DIRECTORY[symbol]?.name || quote.longName || quote.shortName || symbol);

    const stockData = {
      symbol: quote.symbol,
      name: resolvedName,
      basePrice: quote.regularMarketPreviousClose || (existing as any)?.basePrice || 0,
      currentPrice: quote.regularMarketPrice || quote.postMarketPrice || (existing as any)?.currentPrice || 0,
      prevClose: quote.regularMarketPreviousClose || (existing as any)?.prevClose || 0,
      high: quote.regularMarketDayHigh || (existing as any)?.high || 0,
      low: quote.regularMarketDayLow || (existing as any)?.low || 0,
      volume: quote.regularMarketVolume || (existing as any)?.volume || 0
    };
    
    // Update local cache
    const stockInCache = STOCKS.find(s => s.symbol === symbol);
    if (stockInCache) {
      if (stockData.currentPrice > 0) stockInCache.currentPrice = stockData.currentPrice;
      if (stockData.prevClose > 0) stockInCache.prevClose = stockData.prevClose;
      if (stockData.high > 0) stockInCache.high = stockData.high;
      if (stockData.low > 0) stockInCache.low = stockData.low;
      if (stockData.volume > 0) stockInCache.volume = stockData.volume;
      if (resolvedName && resolvedName !== symbol) stockInCache.name = resolvedName;
    } else {
      (stockData as any).history = Array(15).fill(stockData.currentPrice || 0);
      STOCKS.push(stockData);
    }
    
    return res.json(stockData);
  } catch (error: any) {
    if (!isExpectedFetchFallback(error)) {
      console.warn("Notice: Quote falling back to mock due to:", error?.message || error);
    }
    const stock = ensureStockExists(symbol);
    res.json(stock);
  }
});

// 4. API: Get Candlesticks
app.get("/api/stocks/candles/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const range = String(req.query.range || "1M").toUpperCase();
  
  try {
    const period1 = new Date();
    const period2 = new Date();
    let interval: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1h" | "1d" | "5d" | "1wk" | "1mo" | "3mo" = "1d";
    
    if (range === "5M") {
      period1.setDate(period1.getDate() - 1);
      interval = "5m";
    } else if (range === "60M") {
      period1.setDate(period1.getDate() - 5);
      interval = "60m";
    } else if (range === "1D") {
      period1.setDate(period1.getDate() - 2); // get past 2 days to ensure we have data
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

    const resYahoo = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${Math.floor(period1.getTime()/1000)}&period2=${Math.floor(period2.getTime()/1000)}&interval=${interval}`, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(4000)
    });
    if (resYahoo.ok) {
      const data = await resYahoo.json();
      const result = data?.chart?.result?.[0];
      if (result && result.timestamp && result.indicators?.quote?.[0]) {
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        const stock = STOCKS.find(s => s.symbol === symbol);
        let lastClose = stock?.currentPrice || 100;

        const candles = [];
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

        // Sync last candle with current real-time stock price
        if (stock && stock.currentPrice > 0 && candles.length > 0) {
          const lastIdx = candles.length - 1;
          candles[lastIdx].close = stock.currentPrice;
          if (stock.currentPrice > candles[lastIdx].high) candles[lastIdx].high = stock.currentPrice;
          if (stock.currentPrice < candles[lastIdx].low && candles[lastIdx].low > 0) candles[lastIdx].low = stock.currentPrice;
        }

        return res.json(candles);
      }
    }
  } catch (error: any) {
    if (!isExpectedFetchFallback(error)) {
      console.warn("Notice: Candles falling back to mock due to:", error?.message || error);
    }
  }

  // Fallback to mock
  const stock = ensureStockExists(symbol);
  const candles = generateCandles(symbol, range, stock.currentPrice);
  res.json(candles);
});

// 5. API: News
app.get("/api/news", async (req, res) => {
  const query = (req.query.q as string) || "US Stocks";
  try {
    const resYahoo = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=5`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3000)
    });
    if (resYahoo.ok) {
      const data = await resYahoo.json();
      if (data.news && Array.isArray(data.news) && data.news.length > 0) {
        return res.json(data.news.slice(0, 5));
      }
    }
  } catch (err: any) {
    if (!isExpectedFetchFallback(err)) {
      console.warn("Notice: News fallback due to:", err?.message || err);
    }
  }
  // Fallback to mock news
  res.json([
    {
      title: `【热点新闻】${query} 市场情绪偏向积极，多数分析师上调评级，预计Q3财报将超预期`,
      publisher: "Yahoo Finance",
      providerPublishTime: Math.floor(Date.now() / 1000) - 1200,
      link: "#"
    },
    {
      title: `突发：${query} 相关产业链迎来重大利好，核心供应商或迎估值重估`,
      publisher: "Reuters",
      providerPublishTime: Math.floor(Date.now() / 1000) - 3600,
      link: "#"
    },
    {
      title: `股市观察：资金持续流入 ${query} 板块，技术面显示多头排列`,
      publisher: "Bloomberg",
      providerPublishTime: Math.floor(Date.now() / 1000) - 7200,
      link: "#"
    },
    {
      title: `宏观视角：美联储重磅发言关注行业动态，${query} 的长期基本面逻辑不变`,
      publisher: "CNBC",
      providerPublishTime: Math.floor(Date.now() / 1000) - 14400,
      link: "#"
    },
    {
      title: `雅虎头条：散户抱团现象重现？${query} 社交媒体热度飙升 300%`,
      publisher: "Yahoo Finance",
      providerPublishTime: Math.floor(Date.now() / 1000) - 20000,
      link: "#"
    },
    {
      title: `深度解析：未来3年 ${query} 所在的赛道竞争格局，谁将胜出？`,
      publisher: "Wall Street Journal",
      providerPublishTime: Math.floor(Date.now() / 1000) - 40000,
      link: "#"
    }
  ]);
});

// 6. API: AI Analysis (uses Gemini)
app.post("/api/stocks/analysis", async (req, res) => {
  try {
    const { symbol, positions, thinkingMode, image, customApiKey } = req.body;
    const apiKey = (customApiKey && String(customApiKey).trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: "未配置 Gemini API Key。请在 AI 分析界面右上角点击“设置 API Key”，输入您的 Gemini Key 即可开启智能分析！"
      });
    }

    const serverAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const stock = ensureStockExists(symbol);

    // Compose prompt based on whether they have a position in this stock or not
    const position = positions?.find((p: any) => p.symbol === symbol);
    let positionContext = "该用户目前没有持有此股票。";
    if (position) {
      positionContext = `该用户持有此股票：持仓数量 ${position.quantity} 股，平均成本价为 $${position.buyPrice}。当前价格 $${stock.currentPrice}。盈亏为: ${position.pnl >= 0 ? "盈利" : "亏损"} $${Math.abs(position.pnl).toFixed(2)} (${position.pnlPercent.toFixed(2)}%)。`;
    }

    const systemInstruction = `你是一位专业、客观、严谨的 AI 投资顾问。
请根据提供的股票当前数据、交易量、持仓情况等，为用户生成一份极高水准的个股与持仓分析报告。
请使用纯文本或结构化的 Markdown 格式（不使用外层 HTML），语言为中文。
回答应当分为：
1. 【股票概览】简要概括该股票最新状态与近期市场主线。
2. 【持仓评估】结合持仓均价和当前价格，给出具体的仓位管理建议（若未持仓，则分析当前的建仓时机和性价比）。
3. 【技术与估值研判】分析当前价位所处的技术支撑/阻力位，或估值高低。
4. 【操作策略与风险预警】给出明确的短期与中长期操作建议（如分批减仓、破位止损、逢低买入），并标出明确的风险等级（低/中/高）。`;

    let prompt = `股票代码: ${stock.symbol}
股票名称: ${stock.name}
当前参考价: $${stock.currentPrice}
昨日收盘价: $${stock.prevClose}
今日最高价: $${stock.high}
今日最低价: $${stock.low}
参考交易量: ${stock.volume.toLocaleString()}
${positionContext}
请依据以上实时行情，进行多维度深度解析，并针对我的仓位给出针对性建议。`;

    if (image && image.base64 && image.mimeType) {
      prompt += `\n\n[用户提供了一张参考图像，可能是当前走势K线截图、公司财报、相关新闻或报表。请结合此图像进行综合研判和多维度分析。]`;
    }

    let contents: any;
    if (image && image.base64 && image.mimeType) {
      const imagePart = {
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64
        }
      };
      const textPart = {
        text: prompt
      };
      contents = { parts: [imagePart, textPart] };
    } else {
      contents = prompt;
    }

    // Build the ordered list of models to try
    const modelsToTry: string[] = [];
    if (thinkingMode || (image && image.base64)) {
      modelsToTry.push("gemini-3.1-pro-preview");
    }
    modelsToTry.push("gemini-3.6-flash");
    modelsToTry.push("gemini-3.1-flash-lite");

    let responseText = "";
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting Gemini analysis with model: ${modelName}`);
        
        // Prepare the config for this model
        const currentConfig: any = {
          systemInstruction
        };

        // Only use thinkingConfig for thinking-supported models (gemini-3.1-pro-preview)
        if (thinkingMode && modelName === "gemini-3.1-pro-preview") {
          currentConfig.thinkingConfig = {
            thinkingLevel: ThinkingLevel.HIGH
          };
        }

        const response = await serverAi.models.generateContent({
          model: modelName,
          contents,
          config: currentConfig
        });

        if (response && response.text) {
          responseText = response.text;
          console.log(`Successfully generated analysis using ${modelName}`);
          break; // Exit loop on success
        }
      } catch (err: any) {
        console.warn(`Analysis failed with model ${modelName}:`, err?.message || JSON.stringify(err));
        lastError = err;
      }
    }

    if (!responseText) {
      const errMsg = lastError?.message || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError));
      throw new Error(errMsg || "所有可用的 AI 模型均无法生成分析，请稍后再试。");
    }

    res.json({ analysis: responseText });
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: error?.message || "AI 分析请求失败，请确保 GEMINI_API_KEY 配置正确" });
  }
});

// === Auth Endpoints ===

// 1. 注册 (Register)
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Email format regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Password strength (8-32 characters, contains both letters and numbers)
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,32}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: 'Password must be 8-32 characters long and contain both letters and numbers' });
  }

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const insertUser = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    insertUser.run(email, passwordHash);

    res.status(201).json({ message: 'Registration successful' });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. 登录 (Login)
app.post('/api/auth/login', async (req, res) => {
  const { account, password } = req.body; // account is used for email here

  if (!account || !password) {
    return res.status(400).json({ error: 'Account and password are required' });
  }

  try {
    // Check rate limit: 5 failed attempts in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const attempts = db.prepare(`
      SELECT COUNT(*) as count 
      FROM login_attempts 
      WHERE email = ? AND success = 0 AND attempt_time > ?
    `).get(account, fifteenMinutesAgo) as { count: number };

    if (attempts.count >= 5) {
      return res.status(429).json({ error: 'Too many failed login attempts. Account locked for 15 minutes.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(account) as any;

    if (!user) {
      db.prepare('INSERT INTO login_attempts (email, success) VALUES (?, 0)').run(account);
      return res.status(401).json({ error: 'Invalid account or password' });
    }

    if (user.status === 0) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      db.prepare('INSERT INTO login_attempts (email, success) VALUES (?, 0)').run(account);
      return res.status(401).json({ error: 'Invalid account or password' });
    }

    // Login successful
    db.prepare('INSERT INTO login_attempts (email, success) VALUES (?, 1)').run(account);
    // Also clear past failed attempts for this user (optional)
    db.prepare('DELETE FROM login_attempts WHERE email = ? AND success = 0').run(account);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' });

    res.json({ message: 'Login successful', token, user: { id: user.id, email: user.email } });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Setup Vite Dev server middleware in development mode, static serve in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
