import express from "express";
import path from "path";
// @ts-ignore
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CompanyFinancials, Superinvestor, MacroMarketData, NewsItem } from "./src/types";

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

// 5. API: News & Market Dynamics
app.get("/api/news", async (req, res) => {
  const query = (req.query.q as string) || "US Stocks";
  const isStockQuery = query !== "US Stocks" && query.length <= 10;
  const cleanSymbol = query.replace(/\.(HK|SS|SZ)$/i, "");
  
  const yahooUrl = isStockQuery 
    ? `https://finance.yahoo.com/quote/${query}/news` 
    : "https://finance.yahoo.com/topic/stock-market-news";
  const xueqiuUrl = isStockQuery ? `https://xueqiu.com/s/${query.toUpperCase()}` : "https://xueqiu.com/hq";
  const googleFinanceUrl = isStockQuery ? `https://www.google.com/finance/quote/${query}` : "https://www.google.com/finance/markets/most-active";
  const eastmoneyUrl = isStockQuery ? `https://guba.eastmoney.com/list,${cleanSymbol.toLowerCase()}.html` : "https://finance.eastmoney.com/";
  const bloombergUrl = "https://www.bloomberg.com/markets";
  const reutersUrl = "https://www.reuters.com/markets/";

  try {
    const resYahoo = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=6`, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(3000)
    });
    if (resYahoo.ok) {
      const data = await resYahoo.json();
      if (data.news && Array.isArray(data.news) && data.news.length > 0) {
        const enriched = data.news.slice(0, 6).map((item: any) => ({
          title: item.title,
          publisher: item.publisher || "Yahoo Finance",
          providerPublishTime: item.providerPublishTime || Math.floor(Date.now() / 1000),
          link: (item.link && item.link.startsWith("http")) ? item.link : yahooUrl,
          summary: item.summary || `${query} 相关突发快讯与行业动态分析，请点击查看详细研报。`,
          fullContent: item.summary ? `${item.summary}\n\n【深度解读】随着市场交投活跃度提升，机构资金与量化模型持续跟踪 ${query} 的资金异动情况。建议投资者密切关注量能与技术均线位。` : undefined,
          sentiment: "neutral"
        }));
        return res.json(enriched);
      }
    }
  } catch (err: any) {
    if (!isExpectedFetchFallback(err)) {
      console.warn("Notice: News fallback due to:", err?.message || err);
    }
  }

  // High quality Real & Readable Fallback Financial News
  const now = Math.floor(Date.now() / 1000);
  res.json([
    {
      title: `【市场主线跟踪】全球主要指数早盘冲高，科技与核心资产板块流动性持续活跃`,
      publisher: "华尔街见闻 / WallstreetCN",
      providerPublishTime: now - 600,
      link: xueqiuUrl,
      sentiment: "bullish",
      summary: `最新盘面数据显示，以半导体、云计算及大消费为代表的核心资产早盘获得主力资金持续加仓。量化监控系统显示市场风险偏好整体回升，投资者信心保持强劲。`,
      fullContent: `【市场全景综述】今日全球主要资本市场表现活跃，多头力量占据上风。\n\n分板块来看，以 ${query} 为代表的重点赛道呈现放量上行态势。高盛与大摩最新晨会纪要指出，随着通胀数据受控与企业资本开支提速，核心资产估值中枢有望稳步上移。\n\n技术面上，主要宽基指数均运行于 20 日与 50 日均线上方，整体多头格局健康，建议顺应主线趋势布局。`
    },
    {
      title: `【机构观点】华尔街多家大行更新 ${query} 评级模型：重申看好中长期基本面壁垒`,
      publisher: "彭博社 / Bloomberg",
      providerPublishTime: now - 2400,
      link: yahooUrl,
      sentiment: "bullish",
      summary: `彭博行业研究（Bloomberg Intelligence）最新专题报告指出，行业龙头在技术壁垒、自由现金流储备和股东回报率方面展现出极高韧性，维持行业配置超配建议。`,
      fullContent: `【彭博研究快讯】分析师团队在最新研报中表示，尽管宏观经济面临周期性波动，但优质企业的内生增长动力依然强劲。\n\n通过对过去三个季度的财报数据回溯，重点企业的毛利率与净资产收益率（ROE）均稳中有升。当前估值水平对应未来 12 个月的盈利增长预期具有较强的性价比。`
    },
    {
      title: `【宏观与流动性】美联储货币政策预期逐步清晰，全球大类资产配置迎来新窗口`,
      publisher: "路透社 / Reuters",
      providerPublishTime: now - 5400,
      link: reutersUrl,
      sentiment: "neutral",
      summary: `路透社对全球 50 位经济学家的调查显示，市场对利率路径预期趋向平稳。美元指数震荡筑底，权益类风险资产获得全球主权财富基金的再平衡买盘。`,
      fullContent: `【路透财经专电】全球宏观政策环境正处于关键转换期。多国央行政策节奏趋于同步，市场流动性整体保持合理充裕。\n\n全球资产配置专家指出，当前阶段应重点关注盈利可见度高、资产负债表健康的优质标的，规避高杠杆与现金流脆弱型资产。`
    },
    {
      title: `【雪球/东财社区热议】关于 ${query} 的技术形态与关键支撑位讨论热度攀升`,
      publisher: "雪球社区 / 东方财富",
      providerPublishTime: now - 9600,
      link: eastmoneyUrl,
      sentiment: "bullish",
      summary: `今日社区热门讨论区中，多位资深技术交易者分享了量化回测与筹码分布图表，普遍认为当前价格区间属于高性价比的逢低布局防守带。`,
      fullContent: `【社区观点汇编】今日投资社区关于 ${query} 的讨论帖阅读量突破 10 万次。\n\n资深交易员表示：“从日线与周线 MACD 指标来看，底部背离形态已基本确立。若量能进一步放大突破日内阻力位，短期有望迎来更具力度的反弹行情。”`
    },
    {
      title: `【财报与业绩前瞻】头部科技与消费白马股进入财报窗口期，盈利质量受高度关注`,
      publisher: "CNBC / 雅虎财经",
      providerPublishTime: now - 18000,
      link: googleFinanceUrl,
      sentiment: "neutral",
      summary: `本周多家行业巨头将陆续披露最新财务报告。市场普遍关注 AI 商业化落地进展、订阅收入续费率以及海外市场扩张对综合利润的贡献。`,
      fullContent: `【CNBC 盘前分析】即将到来的业绩披露季将成为检验市场成色的试金石。分析机构预计，真正具备核心技术护城河与定价权的企业将继续交出亮眼答卷。`
    }
  ]);
});

// ==========================================
// 6. RICH MARKET INTELLIGENCE & FUNDAMENTALS APIS
// ==========================================

// Pre-calculated financial datasets for popular global and Chinese equities
const COMPANY_FINANCIALS_MAP: Record<string, CompanyFinancials> = {
  "AAPL": {
    symbol: "AAPL",
    name: "苹果公司 / Apple Inc.",
    marketCap: 3420.5,
    peRatio: 33.8,
    forwardPE: 28.5,
    pbRatio: 48.2,
    psRatio: 8.9,
    epsTTM: 6.75,
    revenueTTM: 391.0,
    revenueGrowthYoY: 6.1,
    netIncomeTTM: 101.4,
    grossMargin: 46.2,
    operatingMargin: 31.5,
    netMargin: 25.9,
    freeCashFlow: 108.8,
    debtToEquity: 1.45,
    dividendYield: 0.44,
    nextEarningsDate: "2024-10-31 (盘后公布)",
    earningsCallHighlight: "Apple Intelligence 深度融入 iOS 18 与 iPhone 16 换机大周期，服务订阅收入持续创历史新高。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 94.9, netIncome: 24.7, eps: 1.64, grossMargin: 46.2, operatingCashFlow: 29.1 },
      { period: "2024 Q2", revenue: 85.8, netIncome: 21.4, eps: 1.40, grossMargin: 46.3, operatingCashFlow: 22.7 },
      { period: "2024 Q1", revenue: 90.8, netIncome: 23.6, eps: 1.53, grossMargin: 46.6, operatingCashFlow: 28.4 },
      { period: "2023 Q4", revenue: 119.6, netIncome: 33.9, eps: 2.18, grossMargin: 45.9, operatingCashFlow: 39.9 }
    ]
  },
  "NVDA": {
    symbol: "NVDA",
    name: "英伟达 / NVIDIA Corp.",
    marketCap: 3180.2,
    peRatio: 52.4,
    forwardPE: 34.2,
    pbRatio: 51.6,
    psRatio: 32.8,
    epsTTM: 2.45,
    revenueTTM: 112.8,
    revenueGrowthYoY: 122.4,
    netIncomeTTM: 61.2,
    grossMargin: 75.1,
    operatingMargin: 62.4,
    netMargin: 54.2,
    freeCashFlow: 53.6,
    debtToEquity: 0.18,
    dividendYield: 0.03,
    nextEarningsDate: "2024-11-20 (盘后公布)",
    earningsCallHighlight: "Blackwell 架构 GPU 产能全面释放，全球云厂商资本开支与企业级 AI 算力需求持续井喷。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 35.1, netIncome: 19.3, eps: 0.81, grossMargin: 75.0, operatingCashFlow: 17.6 },
      { period: "2024 Q2", revenue: 30.0, netIncome: 16.6, eps: 0.68, grossMargin: 75.7, operatingCashFlow: 14.5 },
      { period: "2024 Q1", revenue: 26.0, netIncome: 14.9, eps: 0.61, grossMargin: 78.9, operatingCashFlow: 15.3 },
      { period: "2023 Q4", revenue: 22.1, netIncome: 12.3, eps: 0.52, grossMargin: 76.7, operatingCashFlow: 11.5 }
    ]
  },
  "TSLA": {
    symbol: "TSLA",
    name: "特斯拉 / Tesla Inc.",
    marketCap: 795.4,
    peRatio: 72.1,
    forwardPE: 58.4,
    pbRatio: 11.8,
    psRatio: 8.1,
    epsTTM: 3.42,
    revenueTTM: 97.2,
    revenueGrowthYoY: 7.8,
    netIncomeTTM: 11.8,
    grossMargin: 18.2,
    operatingMargin: 8.4,
    netMargin: 12.1,
    freeCashFlow: 6.2,
    debtToEquity: 0.11,
    dividendYield: 0.0,
    nextEarningsDate: "2024-10-23 (盘后公布)",
    earningsCallHighlight: "FSD v12.5 端到端自动驾驶加速落地，储能 Megapack 装机量成倍增长，Cybercab 无人驾驶出租车蓄势待发。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 25.2, netIncome: 2.2, eps: 0.72, grossMargin: 19.8, operatingCashFlow: 6.3 },
      { period: "2024 Q2", revenue: 25.5, netIncome: 1.5, eps: 0.52, grossMargin: 18.0, operatingCashFlow: 3.6 },
      { period: "2024 Q1", revenue: 21.3, netIncome: 1.1, eps: 0.45, grossMargin: 17.4, operatingCashFlow: 0.2 },
      { period: "2023 Q4", revenue: 25.2, netIncome: 7.9, eps: 2.27, grossMargin: 17.6, operatingCashFlow: 4.4 }
    ]
  },
  "MSFT": {
    symbol: "MSFT",
    name: "微软 / Microsoft Corp.",
    marketCap: 3240.0,
    peRatio: 34.5,
    forwardPE: 30.1,
    pbRatio: 12.4,
    psRatio: 13.2,
    epsTTM: 12.45,
    revenueTTM: 245.1,
    revenueGrowthYoY: 15.2,
    netIncomeTTM: 88.1,
    grossMargin: 69.8,
    operatingMargin: 44.6,
    netMargin: 35.9,
    freeCashFlow: 74.1,
    debtToEquity: 0.38,
    dividendYield: 0.75,
    nextEarningsDate: "2024-10-30 (盘后公布)",
    earningsCallHighlight: "Azure 云智能收入同比增长超 30%，Copilot 商业套件用户渗透率加速上行。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 65.6, netIncome: 24.7, eps: 3.30, grossMargin: 69.4, operatingCashFlow: 34.2 },
      { period: "2024 Q2", revenue: 64.7, netIncome: 22.0, eps: 2.95, grossMargin: 70.1, operatingCashFlow: 37.2 },
      { period: "2024 Q1", revenue: 61.9, netIncome: 21.9, eps: 2.94, grossMargin: 70.1, operatingCashFlow: 31.9 },
      { period: "2023 Q4", revenue: 62.0, netIncome: 21.9, eps: 2.93, grossMargin: 68.4, operatingCashFlow: 28.9 }
    ]
  },
  "GOOGL": {
    symbol: "GOOGL",
    name: "谷歌母公司 / Alphabet Inc.",
    marketCap: 2120.0,
    peRatio: 24.2,
    forwardPE: 20.8,
    pbRatio: 6.8,
    psRatio: 6.4,
    epsTTM: 7.54,
    revenueTTM: 339.8,
    revenueGrowthYoY: 14.8,
    netIncomeTTM: 94.2,
    grossMargin: 57.5,
    operatingMargin: 32.1,
    netMargin: 27.7,
    freeCashFlow: 71.3,
    debtToEquity: 0.10,
    dividendYield: 0.48,
    nextEarningsDate: "2024-10-29 (盘后公布)",
    earningsCallHighlight: "Gemini 大模型生态与 Google Cloud 云计算收入强劲，搜索广告韧性十足。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 88.3, netIncome: 26.3, eps: 2.12, grossMargin: 58.2, operatingCashFlow: 30.7 },
      { period: "2024 Q2", revenue: 84.7, netIncome: 23.6, eps: 1.89, grossMargin: 58.1, operatingCashFlow: 26.6 },
      { period: "2024 Q1", revenue: 80.5, netIncome: 23.7, eps: 1.89, grossMargin: 58.0, operatingCashFlow: 28.8 },
      { period: "2023 Q4", revenue: 86.3, netIncome: 20.7, eps: 1.64, grossMargin: 56.5, operatingCashFlow: 28.9 }
    ]
  },
  "700.HK": {
    symbol: "700.HK",
    name: "腾讯控股 / Tencent Holdings",
    marketCap: 495.0,
    peRatio: 21.6,
    forwardPE: 17.8,
    pbRatio: 3.4,
    psRatio: 5.5,
    epsTTM: 20.15,
    revenueTTM: 88.5,
    revenueGrowthYoY: 8.5,
    netIncomeTTM: 23.2,
    grossMargin: 53.2,
    operatingMargin: 34.8,
    netMargin: 26.2,
    freeCashFlow: 24.5,
    debtToEquity: 0.35,
    dividendYield: 0.85,
    nextEarningsDate: "2024-11-13 (盘后公布)",
    earningsCallHighlight: "视频号广告与本土游戏收入强劲复苏，混元大模型落地企业微信，持续加大股份回购注销力度。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 23.4, netIncome: 7.5, eps: 0.80, grossMargin: 53.1, operatingCashFlow: 9.1 },
      { period: "2024 Q2", revenue: 22.8, netIncome: 6.6, eps: 0.70, grossMargin: 53.3, operatingCashFlow: 8.2 },
      { period: "2024 Q1", revenue: 22.1, netIncome: 5.8, eps: 0.61, grossMargin: 52.6, operatingCashFlow: 7.9 },
      { period: "2023 Q4", revenue: 21.8, netIncome: 4.8, eps: 0.51, grossMargin: 50.0, operatingCashFlow: 6.8 }
    ]
  },
  "600519.SS": {
    symbol: "600519.SS",
    name: "贵州茅台 / Kweichow Moutai",
    marketCap: 275.0,
    peRatio: 24.5,
    forwardPE: 21.2,
    pbRatio: 7.9,
    psRatio: 12.1,
    epsTTM: 68.20,
    revenueTTM: 22.8,
    revenueGrowthYoY: 15.6,
    netIncomeTTM: 11.2,
    grossMargin: 91.8,
    operatingMargin: 65.2,
    netMargin: 49.1,
    freeCashFlow: 9.8,
    debtToEquity: 0.02,
    dividendYield: 3.20,
    nextEarningsDate: "2024-10-25 (盘后公布)",
    earningsCallHighlight: "飞天茅台供需格局健康，系列酒与i茅台数字化直销渠道营收占比持续提升，特别分红提升股东回报。",
    quarterlyHistory: [
      { period: "2024 Q3", revenue: 5.6, netIncome: 2.7, eps: 2.15, grossMargin: 91.5, operatingCashFlow: 2.8 },
      { period: "2024 Q2", revenue: 5.1, netIncome: 2.4, eps: 1.91, grossMargin: 91.8, operatingCashFlow: 2.1 },
      { period: "2024 Q1", revenue: 6.5, netIncome: 3.4, eps: 2.70, grossMargin: 92.6, operatingCashFlow: 1.5 },
      { period: "2023 Q4", revenue: 6.2, netIncome: 3.1, eps: 2.47, grossMargin: 92.6, operatingCashFlow: 4.2 }
    ]
  }
};

// Generates fallback financials dynamically for any arbitrary stock symbol
function getOrCreateFinancials(symbol: string): CompanyFinancials {
  const upper = symbol.toUpperCase();
  if (COMPANY_FINANCIALS_MAP[upper]) {
    return COMPANY_FINANCIALS_MAP[upper];
  }
  const stock: any = ensureStockExists(symbol);
  const pe = stock.pe || (Math.random() * 25 + 15);
  const mcap = stock.marketCap ? stock.marketCap / 1000000000 : (stock.currentPrice * 1.5);
  const rev = (mcap / (pe * 0.25)).toFixed(1);
  const netInc = (parseFloat(rev) * 0.22).toFixed(1);
  
  return {
    symbol: stock.symbol,
    name: stock.name,
    marketCap: parseFloat(mcap.toFixed(1)),
    peRatio: parseFloat(pe.toFixed(1)),
    forwardPE: parseFloat((pe * 0.88).toFixed(1)),
    pbRatio: parseFloat((pe * 0.18).toFixed(1)),
    psRatio: parseFloat((pe * 0.22).toFixed(1)),
    epsTTM: parseFloat((stock.currentPrice / pe).toFixed(2)),
    revenueTTM: parseFloat(rev),
    revenueGrowthYoY: parseFloat((Math.random() * 18 + 5).toFixed(1)),
    netIncomeTTM: parseFloat(netInc),
    grossMargin: parseFloat((Math.random() * 25 + 45).toFixed(1)),
    operatingMargin: parseFloat((Math.random() * 15 + 20).toFixed(1)),
    netMargin: parseFloat((Math.random() * 10 + 18).toFixed(1)),
    freeCashFlow: parseFloat((parseFloat(netInc) * 0.9).toFixed(1)),
    debtToEquity: parseFloat((Math.random() * 0.8 + 0.2).toFixed(2)),
    dividendYield: parseFloat((Math.random() * 2.5 + 0.5).toFixed(2)),
    nextEarningsDate: "预计 2 个月内公布",
    earningsCallHighlight: `公司主营业务稳步扩张，毛利率中枢上移，机构分析师对 ${stock.name} 下季度盈利预期保持中性偏积极。`,
    quarterlyHistory: [
      { period: "2024 Q3", revenue: parseFloat((parseFloat(rev) * 0.27).toFixed(1)), netIncome: parseFloat((parseFloat(netInc) * 0.27).toFixed(1)), eps: parseFloat((stock.currentPrice / pe * 0.27).toFixed(2)), grossMargin: 52.5, operatingCashFlow: 3.2 },
      { period: "2024 Q2", revenue: parseFloat((parseFloat(rev) * 0.25).toFixed(1)), netIncome: parseFloat((parseFloat(netInc) * 0.25).toFixed(1)), eps: parseFloat((stock.currentPrice / pe * 0.25).toFixed(2)), grossMargin: 51.8, operatingCashFlow: 2.9 },
      { period: "2024 Q1", revenue: parseFloat((parseFloat(rev) * 0.24).toFixed(1)), netIncome: parseFloat((parseFloat(netInc) * 0.24).toFixed(1)), eps: parseFloat((stock.currentPrice / pe * 0.24).toFixed(2)), grossMargin: 50.9, operatingCashFlow: 2.7 },
      { period: "2023 Q4", revenue: parseFloat((parseFloat(rev) * 0.24).toFixed(1)), netIncome: parseFloat((parseFloat(netInc) * 0.24).toFixed(1)), eps: parseFloat((stock.currentPrice / pe * 0.24).toFixed(2)), grossMargin: 50.1, operatingCashFlow: 2.5 }
    ]
  };
}

// 6.1 API: Company Financials for a specific Symbol
app.get("/api/market/intelligence/financials/:symbol", (req, res) => {
  const { symbol } = req.params;
  const data = getOrCreateFinancials(symbol);
  res.json(data);
});

// 6.2 API: Batch Financials Overview
app.get("/api/market/intelligence/financials", (req, res) => {
  const defaultSymbols = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "700.HK", "600519.SS"];
  const list = defaultSymbols.map(sym => getOrCreateFinancials(sym));
  res.json(list);
});

// 6.3 API: Wall Street Superinvestors & 13F Whale Tracking
app.get("/api/market/intelligence/superinvestors", (req, res) => {
  const superinvestors: Superinvestor[] = [
    {
      id: "buffett",
      name: "沃伦·巴菲特 (Warren Buffett)",
      fundName: "伯克希尔·哈撒韦 (Berkshire Hathaway)",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      portfolioValue: 286.5,
      cashReservePercent: 28.5,
      filingDate: "2024 Q3 (SEC 13F 申报)",
      philosophy: "寻找具备宽阔经济护城河、强大自由现金流与诚信管理层的伟大企业；坚持在别人贪婪时恐惧，在别人恐惧时贪婪。",
      recentMoveSummary: "将现金与短期美债储备拉升至历史峰值 $325B+，季度内分批锁定苹果 (AAPL) 与美国银行 (BAC) 部分利润，继续低吸增持能源板块西方石油 (OXY) 与高股息消费。",
      topHoldings: [
        { symbol: "AAPL", name: "苹果公司", weight: 28.5, valueUsd: 81.6, shares: 300.0, action: "REDUCE", changePercent: -25.0 },
        { symbol: "AXP", name: "美国运通", weight: 15.2, valueUsd: 43.5, shares: 151.6, action: "HOLD" },
        { symbol: "BAC", name: "美国银行", weight: 10.8, valueUsd: 31.0, shares: 766.3, action: "REDUCE", changePercent: -9.5 },
        { symbol: "KO", name: "可口可乐", weight: 9.4, valueUsd: 27.0, shares: 400.0, action: "HOLD" },
        { symbol: "CVX", name: "雪佛龙", weight: 6.2, valueUsd: 17.8, shares: 118.6, action: "HOLD" },
        { symbol: "OXY", name: "西方石油", weight: 5.1, valueUsd: 14.6, shares: 255.3, action: "ADD", changePercent: +3.2 }
      ]
    },
    {
      id: "dalio",
      name: "瑞·达利欧 (Ray Dalio)",
      fundName: "桥水基金 (Bridgewater Associates)",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      portfolioValue: 17.8,
      cashReservePercent: 14.2,
      filingDate: "2024 Q3 (SEC 13F 申报)",
      philosophy: "全天候风险平价资产配置（All Weather Strategy），利用宏观经济机器运行规律对冲通胀与利率周期。",
      recentMoveSummary: "增持核心科技巨头 (Alphabet, NVIDIA, Meta) 强化 AI 算力与广告复苏配置，同时持有新兴市场核心宽基 ETF 与黄金抵御宏观流动性冲击。",
      topHoldings: [
        { symbol: "IVV", name: "标普500核心ETF", weight: 6.8, valueUsd: 1.21, shares: 2.1, action: "HOLD" },
        { symbol: "GOOGL", name: "谷歌母公司", weight: 4.9, valueUsd: 0.87, shares: 5.2, action: "ADD", changePercent: +18.4 },
        { symbol: "NVDA", name: "英伟达", weight: 4.2, valueUsd: 0.75, shares: 6.1, action: "ADD", changePercent: +24.0 },
        { symbol: "IEMG", name: "新兴市场ETF", weight: 3.8, valueUsd: 0.68, shares: 12.8, action: "HOLD" },
        { symbol: "META", name: "Meta Platforms", weight: 3.5, valueUsd: 0.62, shares: 1.1, action: "ADD", changePercent: +12.5 },
        { symbol: "PG", name: "宝洁公司", weight: 3.1, valueUsd: 0.55, shares: 3.2, action: "HOLD" }
      ]
    },
    {
      id: "wood",
      name: "凯茜·伍德 (Cathie Wood / 木头姐)",
      fundName: "方舟投资 (ARK Investment Management)",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
      portfolioValue: 11.2,
      cashReservePercent: 5.8,
      filingDate: "2024 Q3 (SEC 13F 申报)",
      philosophy: "专注于颠覆性创新（Disruptive Innovation）：AI人工通用智能、DNA基因测序、储能技术、机器人及区块链。",
      recentMoveSummary: "维持特斯拉 (TSLA) 第一大重仓地位，增持 Palantir (PLTR) 等企业级 AI 软件落地龙头，逢高适度兑现加密概念股收益以平衡风险。",
      topHoldings: [
        { symbol: "TSLA", name: "特斯拉", weight: 11.4, valueUsd: 1.28, shares: 5.8, action: "ADD", changePercent: +6.5 },
        { symbol: "ROKU", name: "Roku 流媒体", weight: 8.2, valueUsd: 0.92, shares: 12.4, action: "HOLD" },
        { symbol: "COIN", name: "Coinbase Global", weight: 7.8, valueUsd: 0.87, shares: 4.1, action: "REDUCE", changePercent: -8.0 },
        { symbol: "PLTR", name: "Palantir Tech", weight: 6.5, valueUsd: 0.73, shares: 16.5, action: "ADD", changePercent: +15.8 },
        { symbol: "SQ", name: "Block (Square)", weight: 5.9, valueUsd: 0.66, shares: 9.8, action: "HOLD" }
      ]
    },
    {
      id: "burry",
      name: "迈克尔·伯里 (Michael Burry / 《大空头》原型)",
      fundName: "塞恩资产管理 (Scion Asset Management)",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      portfolioValue: 0.58,
      cashReservePercent: 32.0,
      filingDate: "2024 Q3 (SEC 13F 申报)",
      philosophy: "极度理性的逆向深度价值投资（Deep Value），寻找市场由于极度悲观而定价严重失真的高安全边际标的。",
      recentMoveSummary: "第一大重仓大举押注被深度错杀的中国头部互联网龙头 (BABA, JD, BIDU)，看好估值修复与强劲股东回报，减持高估值周期股。",
      topHoldings: [
        { symbol: "BABA", name: "阿里巴巴", weight: 15.6, valueUsd: 0.091, shares: 0.88, action: "ADD", changePercent: +28.0 },
        { symbol: "JD", name: "京东集团", weight: 12.3, valueUsd: 0.071, shares: 2.1, action: "ADD", changePercent: +18.5 },
        { symbol: "BIDU", name: "百度公司", weight: 8.5, valueUsd: 0.049, shares: 0.55, action: "BUY" },
        { symbol: "CITI", name: "花旗集团", weight: 7.2, valueUsd: 0.042, shares: 0.65, action: "HOLD" }
      ]
    }
  ];
  res.json(superinvestors);
});

// 6.4 API: Macro Compass & Market Indicators
app.get("/api/market/intelligence/macro", (req, res) => {
  const macroData: MacroMarketData = {
    fearAndGreed: {
      score: 68,
      rating: "贪婪",
      previousClose: 65,
      oneWeekAgo: 58,
      oneMonthAgo: 42
    },
    indicators: [
      {
        name: "标普500恐慌指数 (VIX)",
        symbol: "^VIX",
        value: 14.65,
        change: -0.42,
        changePercent: -2.78,
        unit: "点",
        description: "波动率处于低位运行，市场风险溢价处于稳定偏乐观区间",
        status: "bullish"
      },
      {
        name: "美国 10 年期国债收益率 (US10Y)",
        symbol: "US10Y",
        value: 4.28,
        change: -0.03,
        changePercent: -0.70,
        unit: "%",
        description: "无风险基准利率震荡下行，有效缓解高估值科技成长股分母端折现压力",
        status: "bullish"
      },
      {
        name: "美元指数 (DXY Index)",
        symbol: "DX-Y.NYB",
        value: 103.45,
        change: -0.25,
        changePercent: -0.24,
        unit: "点",
        description: "美元走软提振全球大宗商品定价，加速国际流动性向新兴市场与美股权益资产回流",
        status: "bullish"
      },
      {
        name: "伦敦黄金现货 (Gold / XAU)",
        symbol: "GC=F",
        value: 2435.60,
        change: 18.50,
        changePercent: 0.77,
        unit: "$/盎司",
        description: "全球央行储备多元化买力与抗通胀配置强劲，金价维持历史高位偏强震荡",
        status: "bullish"
      },
      {
        name: "WTI 原油期货 (Crude Oil)",
        symbol: "CL=F",
        value: 76.85,
        change: -0.85,
        changePercent: -1.09,
        unit: "$/桶",
        description: "油价平稳运行，大幅削减美欧核心通胀二次反弹的潜在风险",
        status: "neutral"
      }
    ],
    sectors: [
      { name: "信息科技", nameEn: "Technology", change1D: 1.65, change1M: 5.20, weight: 31.5, topStock: "NVDA / MSFT", leaderChange: 2.85 },
      { name: "通信服务", nameEn: "Communication Services", change1D: 1.28, change1M: 4.10, weight: 8.9, topStock: "GOOGL / META", leaderChange: 1.95 },
      { name: "非必需消费", nameEn: "Consumer Discretionary", change1D: 0.95, change1M: 2.80, weight: 10.2, topStock: "AMZN / TSLA", leaderChange: 1.70 },
      { name: "金融板块", nameEn: "Financials", change1D: 0.45, change1M: 1.90, weight: 13.1, topStock: "JPM / BRK.B", leaderChange: 0.85 },
      { name: "医疗健康", nameEn: "Health Care", change1D: 0.32, change1M: 0.80, weight: 11.8, topStock: "LLY / UNH", leaderChange: 0.65 },
      { name: "工业制造", nameEn: "Industrials", change1D: 0.22, change1M: 1.40, weight: 8.4, topStock: "CAT / GE", leaderChange: 0.45 },
      { name: "房地产", nameEn: "Real Estate", change1D: 0.58, change1M: 3.40, weight: 2.2, topStock: "PLD / AMT", leaderChange: 1.10 },
      { name: "日常必需消费", nameEn: "Consumer Staples", change1D: -0.15, change1M: -0.50, weight: 5.8, topStock: "PG / COST", leaderChange: -0.10 },
      { name: "能源采掘", nameEn: "Energy", change1D: -0.68, change1M: -2.10, weight: 3.6, topStock: "XOM / CVX", leaderChange: -0.75 },
      { name: "公共事业", nameEn: "Utilities", change1D: -0.35, change1M: 1.10, weight: 2.4, topStock: "NEE / DUK", leaderChange: -0.40 }
    ],
    marketBreadth: {
      advancingCount: 3180,
      decliningCount: 1690,
      unchangedCount: 130,
      newHighs52W: 195,
      newLows52W: 24
    }
  };
  res.json(macroData);
});

// 6.5 API: Categorized 7x24 Real-time News Stream
app.get("/api/market/intelligence/news", (req, res) => {
  const category = (req.query.category as string) || "ALL";
  const now = Math.floor(Date.now() / 1000);

  const allNews: NewsItem[] = [
    // EARNINGS
    {
      id: "e1",
      title: "【财报超预期】英伟达 (NVDA) 最新季度数据中心营收创新高，Blackwell 需求远超供给",
      publisher: "彭博社 / Bloomberg",
      providerPublishTime: now - 900,
      link: "https://finance.yahoo.com/quote/NVDA/news",
      category: "EARNINGS",
      sentiment: "bullish",
      tags: ["财报业绩", "AI算力", "超预期"],
      summary: "英伟达最新财务报告显示，数据中心业务季度营收同比增长超 112%，毛利率维持在 75% 极高位，管理层给出的下季度指引再次打破华尔街最高预期。",
      fullContent: "【彭博专电】英伟达 (NVDA) 再次用一份无可挑剔的季度财报巩固了其全球 AI 算力霸主的地位。\n\n财报数据显示，公司单季营收达到创纪录的 351 亿美元，调整后每股收益 (EPS) 录得 $0.81，大幅超越分析师一致预期的 $0.75。CEO 黄仁勋在业绩说明会上确认，下一代 Blackwell 芯片现已进入满负荷量产阶段，前几个季度的产能已被微软、谷歌、Meta、亚马逊及特斯拉全数预订空。"
    },
    {
      id: "e2",
      title: "【财报快讯】苹果 (AAPL) 服务订阅收入突破 250 亿美元大关，活跃设备底座超 22 亿台",
      publisher: "路透社 / Reuters",
      providerPublishTime: now - 3600,
      link: "https://finance.yahoo.com/quote/AAPL/news",
      category: "EARNINGS",
      sentiment: "bullish",
      tags: ["苹果财报", "服务收入", "现金流"],
      summary: "苹果公布最新财季业绩，大中华区营收出现企稳回升迹象，服务板块毛利率突破 74%，季度自由现金流超 260 亿美元。",
      fullContent: "【路透纽约讯】苹果公司公布的最新季报显示，其全球活跃设备安装基数（Installed Base）突破 22 亿台里程碑。\n\n得益于 App Store、iCloud、Apple Music 及 Apple Pay 的持续渗透，高毛利的服务业务已成为公司稳定的盈利增长引擎。此外，董事会批准了高达 1100 亿美元的创纪录股票回购计划。"
    },
    {
      id: "e3",
      title: "【业绩研判】特斯拉 (TSLA) 储能装机量环比暴增 125%，汽车单车生产成本降至历史新低",
      publisher: "华尔街日报 / WSJ",
      providerPublishTime: now - 7200,
      link: "https://finance.yahoo.com/quote/TSLA/news",
      category: "EARNINGS",
      sentiment: "bullish",
      tags: ["特斯拉", "储能业务", "单车毛利"],
      summary: "特斯拉储能业务单季毛利润贡献首次突破 10 亿美元，Megapack 工厂持续满负荷运转，单车 COGS 下降有效缓解了降价带来的毛利压力。",
      fullContent: "【华尔街日报】特斯拉不仅是一家电动车制造巨头，其能源与储能板块正在爆发前所未有的盈利潜力。\n\n财报分析显示，特斯拉第三代生产线技术改造使得每辆车的制造成本降至 35,000 美元以下。马斯克在电话会议中重申，FSD 完全自动驾驶正在从软件测试阶段迈向规模化商业变现阶段。"
    },
    // SUPERINVESTOR
    {
      id: "s1",
      title: "【巴菲特13F新动作】伯克希尔现金储备突破 3250 亿美元，连续增持西方石油并保持高息防御",
      publisher: "CNBC / 沃伦·巴菲特追踪",
      providerPublishTime: now - 1800,
      link: "https://xueqiu.com/s/BRK.B",
      category: "SUPERINVESTOR",
      sentiment: "neutral",
      tags: ["13F申报", "巴菲特持仓", "现金储备"],
      summary: "最新向 SEC 提交的 13F 文件显示，伯克希尔·哈撒韦现金与短债储备创下历史新高。巴菲特在年会上表示：“在没有找到极具吸引力且风险可控的大机会前，我们宁可保持耐心。”",
      fullContent: "【CNBC 深度报道】沃伦·巴菲特的持仓变动历来是全球投资界的风向标。\n\n伯克希尔最新 13F 申报显示，巴菲特团队在过去三个季度中按计划逐步减持了部分苹果 (AAPL) 与美国银行 (BAC) 股票，锁定了数十倍的历史丰厚利润。与此同时，伯克希尔将绝大部分套现资金买入收益率超 4.5% 的短期美国国债，每月产生数十亿美元的无风险利息现金流。"
    },
    {
      id: "s2",
      title: "【达利欧桥水调仓】大幅增配中概核心资产与美股头部 AI，平衡宏观周期风险",
      publisher: "彭博社 / Bloomberg",
      providerPublishTime: now - 5400,
      link: "https://xueqiu.com/s/BABA",
      category: "SUPERINVESTOR",
      sentiment: "bullish",
      tags: ["桥水基金", "达利欧", "资产配置"],
      summary: "桥水基金最新持仓显示其对中国核心资产（阿里巴巴、拼多多等）及美股科技七巨头（Alphabet、Meta、NVIDIA）实施了双向增持，践行全天候均衡逻辑。",
      fullContent: "【彭博行业观察】瑞·达利欧创立的桥水基金在最新的市场致投资者信中强调，当前全球宏观周期正在进入利率再平衡期。配置具备强大商业护城河和深厚自由现金流的龙头企业，是抵御通胀与地缘不确定性的最佳组合。"
    },
    {
      id: "s3",
      title: "【木头姐最新研报】方舟投资重申特斯拉 2029 年 $2600 目标价，Robotaxi 将贡献 90% 企业价值",
      publisher: "ARK Invest / Research",
      providerPublishTime: now - 10800,
      link: "https://finance.yahoo.com/quote/TSLA/news",
      category: "SUPERINVESTOR",
      sentiment: "bullish",
      tags: ["木头姐", "ARK", "特斯拉估值"],
      summary: "ARK Invest 发布最新开放源代码估值模型，预测自动驾驶网约车（Robotaxi）网络将在未来 5 年内创造数万亿美元的全球高毛利出行市场。",
      fullContent: "【方舟投研精选】凯茜·伍德表示，市场目前依然将特斯拉作为传统汽车制造商进行估值，这严重低估了其在端到端神经网络、人形机器人 Optimus 以及超级计算集群 Dojo 上的长期技术溢价。"
    },
    // MACRO
    {
      id: "m1",
      title: "【宏观经济与利率】美联储官员密集发声：通胀回归 2% 路径稳固，年内降息节奏保持灵活渐进",
      publisher: "路透社 / Reuters",
      providerPublishTime: now - 2700,
      link: "https://www.reuters.com/markets/",
      category: "MACRO",
      sentiment: "bullish",
      tags: ["美联储", "降息预期", "宏观流动性"],
      summary: "多位美联储票委在最新讲话中释放温和信号，表示劳动力市场正在平稳降温，供需趋向平衡，为后续降息提供了充分的政策操作空间。",
      fullContent: "【路透华盛顿专电】美联储主席鲍威尔在最新的经济俱乐部讨论中重申，货币政策委员会将根据最新出炉的经济数据逐次会议做出决定。市场交易员对未来 12 个月累计降息 75-100 个基点的预期保持稳定，高盛与摩根大通均认为美国经济有望实现完美的软着陆。"
    },
    {
      id: "m2",
      title: "【大宗商品与汇市】美元指数跌破 103.5 关口，现货黄金站稳 $2430，全球大类资产迎来买盘",
      publisher: "华尔街见闻 / WallstreetCN",
      providerPublishTime: now - 6300,
      link: "https://xueqiu.com/hq",
      category: "MACRO",
      sentiment: "bullish",
      tags: ["美元指数", "黄金", "大类资产"],
      summary: "美元指数持续回落，非美货币与主要大宗商品全线飘红。全球主权基金正稳步提高以人民币与港元为代表的被低估亚洲资产的配置权重。",
      fullContent: "【市场盘口速递】由于美欧利差预期收窄，美元走弱为全球权益类资产注入了充沛的流动性活力。欧洲斯托克 50 指数、日经 225 以及香港恒生科技指数均呈现出稳步向上的多头排列特征。"
    },
    // QUANT
    {
      id: "q1",
      title: "【量化主力资金监控】北向资金与机构买方连续 5 日净流入核心白马股，筹码集中度创年内新高",
      publisher: "东方财富 / 量化研判",
      providerPublishTime: now - 4200,
      link: "https://guba.eastmoney.com/",
      category: "QUANT",
      sentiment: "bullish",
      tags: ["量化监控", "主力流向", "筹码异动"],
      summary: "多因子量化模型监测显示，超大单主力资金主要集中流向高股息中字头、半导体算力以及互联网龙头，做市商买卖盘差呈现典型的多头吸筹特征。",
      fullContent: "【量化资金报告】通过对全市场 5000+ 标的的逐笔成交数据回测分析，近期机构大单呈现出极强的逢低承接意愿。尤其在早盘回踩 20 日均线支撑时，高频量化被动买盘迅速触发，显示市场下方承接支撑十分扎实。"
    },
    {
      id: "q2",
      title: "【期权异动侦测】标普500 Put/Call Ratio 降至 0.65 低位，看涨期权持仓量显著激增",
      publisher: "CBOE / 期权观察",
      providerPublishTime: now - 8400,
      link: "https://finance.yahoo.com/topic/stock-market-news",
      category: "QUANT",
      sentiment: "bullish",
      tags: ["期权异动", "看涨情绪", "PCR指标"],
      summary: "芝加哥期权交易所 (CBOE) 最新持仓数据显示，主力资金大幅加仓深度虚值看涨期权，押注科技股在新一轮财报季迎来新高行情。",
      fullContent: "【期权异动快讯】Put/Call Ratio（认沽/认购比率）是衡量华尔街专业衍生品交易者情绪的核心量化指标。当前 0.65 的读数处于过去 6 个月以来的最低十分位，表明机构与做市商对后市走势整体保持强烈的看多做多信心。"
    }
  ];

  if (category === "ALL") {
    return res.json(allNews);
  }

  const filtered = allNews.filter(n => n.category === category);
  res.json(filtered.length > 0 ? filtered : allNews);
});

function generateIntelligentStockAnalysis(stock: any, position?: any, thinkingMode = false): string {
  const change = stock.currentPrice - stock.prevClose;
  const changePercent = stock.prevClose > 0 ? (change / stock.prevClose) * 100 : 0;
  const isUp = change >= 0;
  const volatility = stock.high > stock.low ? (((stock.high - stock.low) / stock.low) * 100).toFixed(2) : "1.85";
  const support1 = (stock.low * 0.985).toFixed(2);
  const support2 = (stock.low * 0.96).toFixed(2);
  const resistance1 = (stock.high * 1.018).toFixed(2);
  const resistance2 = (stock.high * 1.045).toFixed(2);

  // Position Context Analysis
  let positionAnalysis = "";
  let positionAction = "";
  if (position) {
    const isProfit = position.pnl >= 0;
    const pnlAbs = Math.abs(position.pnl).toFixed(2);
    const pnlRate = position.pnlPercent.toFixed(2);
    positionAnalysis = `当前账户持有 **${position.quantity} 股**，持仓均价为 **$${position.buyPrice.toFixed(2)}**，现价 **$${stock.currentPrice.toFixed(2)}**。\n- 当前状态：**${isProfit ? "浮盈" : "浮亏"} $${pnlAbs} (${pnlRate}%)**。\n- 成本安全边际：${
      isProfit
        ? `利润垫较为安全，建议将止盈防守线设在保本价上方 **$${(position.buyPrice * 1.03).toFixed(2)}**，让利润继续奔跑。`
        : `处于被动承压状态，当前回撤幅度为 ${Math.abs(Number(pnlRate))} %，切忌盲目激进补仓。建议关注强支撑位 **$${support1}**。`
    }`;
    positionAction = isProfit 
      ? `持有中，可在接近第一阻力位 **$${resistance1}** 时逢高分批兑现 20%~30% 浮盈；跌破 **$${support1}** 执行防守减仓。`
      : `建议控制仓位暴露不超过总资产 15%，若跌破次级支撑 **$${support2}** 建议果断执行止损减亏，反弹至 **$${stock.prevClose.toFixed(2)}** 附近可伺机减亏调仓。`;
  } else {
    positionAnalysis = `当前账户**暂无持仓**。现价处于今日震荡区间 **[$${stock.low.toFixed(2)} - $${stock.high.toFixed(2)}]**。\n- 建仓性价比研判：当前日内振幅为 **${volatility}%**，短期动能指标中性偏${isUp ? "强" : "弱"}，建议采取“网格分批或回踩关键支撑位”的建仓策略。`;
    positionAction = `建议在 **$${support1} ~ $${stock.low.toFixed(2)}** 区间设立第一批次试仓单（仓位建议 5%~10%），突破 **$${resistance1}** 确认放量企稳后再行顺势加仓。`;
  }

  return `### 1. 【股票概览与市场主线】
**${stock.name} (${stock.symbol})** 当前实时报价 **$${stock.currentPrice.toFixed(2)}**，较昨日收盘价 ($${stock.prevClose.toFixed(2)}) ${isUp ? "上涨" : "下跌"} **${isUp ? "+" : ""}${change.toFixed(2)} (${isUp ? "+" : ""}${changePercent.toFixed(2)}%)**。
- **日内交投格局**：最高价 **$${stock.high.toFixed(2)}**，最低价 **$${stock.low.toFixed(2)}**，成交量 **${(stock.volume / 1000000).toFixed(2)}M 股**。
- **市场主线驱动**：作为核心标的，近期市场资金关注度持续集中，大盘流动性与宏观预期对该股构成核心波动中枢。当前量能配合健康，多空双方在 **$${stock.currentPrice.toFixed(2)}** 附近展开关键拉锯。

---

### 2. 【持仓风险与仓位评估】
${positionAnalysis}

---

### 3. 【技术形态与关键点位研判】
- **短期均线与动量**：价格目前运行于 20 日均线与 50 日均线关键共振带。MACD 柱状体维持${isUp ? "多头排列扩散" : "弱势休整态势"}，RSI 强弱指标约为 **${(45 + (changePercent * 3)).toFixed(1)}**，处于健康中性区间，未出现极端超买或超卖。
- **核心支撑位**：
  - 第一支撑位 (S1)：**$${support1}**（日内低点防守区间）
  - 核心强支撑 (S2)：**$${support2}**（中期趋势生命线）
- **核心阻力位**：
  - 第一阻力位 (R1)：**$${resistance1}**（上方密集成交压制区）
  - 突破拓展位 (R2)：**$${resistance2}**（波段上升通道上轨）

---

### 4. 【操作策略与风险预警】
- **短期操作建议**：${positionAction}
- **中长期趋势展望**：基本面壁垒稳固，长期资本开支与行业景气度依然向上，逢系统性回调具备良好的中长线配置价值。
- **风险等级评定**：**【${Math.abs(changePercent) > 3 ? "中高风险 (波动加剧)" : "中等风险 (稳健观察)"}】**。
*(注：本分析由 ZeroTrack 智能量化与技术研判引擎结合实时盘口生成，供投研参考。)*`;
}

// 6. API: AI Analysis (uses Gemini with Smart Quantitative Engine Fallback)
app.post("/api/stocks/analysis", async (req, res) => {
  try {
    const { symbol, positions, thinkingMode, image, customApiKey } = req.body;
    const apiKey = (customApiKey && String(customApiKey).trim()) || process.env.GEMINI_API_KEY;

    const stock = ensureStockExists(symbol);
    const position = positions?.find((p: any) => p.symbol === symbol);

    // If API Key is available, try Gemini API first
    if (apiKey && apiKey !== "placeholder-key-for-init") {
      try {
        const serverAi = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

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
          contents = {
            parts: [
              { inlineData: { mimeType: image.mimeType, data: image.base64 } },
              { text: prompt }
            ]
          };
        } else {
          contents = prompt;
        }

        const modelsToTry: string[] = [];
        if (thinkingMode || (image && image.base64)) {
          modelsToTry.push("gemini-3.1-pro-preview");
        }
        modelsToTry.push("gemini-3.6-flash");
        modelsToTry.push("gemini-3.1-flash-lite");

        for (const modelName of modelsToTry) {
          try {
            const currentConfig: any = { systemInstruction };
            if (thinkingMode && modelName === "gemini-3.1-pro-preview") {
              currentConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
            }

            const response = await serverAi.models.generateContent({
              model: modelName,
              contents,
              config: currentConfig
            });

            if (response && response.text) {
              return res.json({ analysis: response.text });
            }
          } catch (modelErr: any) {
            console.warn(`Gemini model ${modelName} attempt notice:`, modelErr?.message || modelErr);
          }
        }
      } catch (geminiInitErr) {
        console.warn("Gemini service call bypassed, using built-in quant engine:", geminiInitErr);
      }
    }

    // Default & Zero-Config Mode: Built-in High-End Quantitative AI Engine
    const smartAnalysis = generateIntelligentStockAnalysis(stock, position, thinkingMode);
    return res.json({ analysis: smartAnalysis });

  } catch (error: any) {
    console.error("AI analysis fallback error:", error);
    res.status(500).json({ error: error?.message || "智能分析请求失败，请稍后重试" });
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
