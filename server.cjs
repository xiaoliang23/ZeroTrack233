var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_bcrypt = __toESM(require("bcrypt"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
import_dotenv.default.config();
var db = new import_better_sqlite3.default("app.db");
db.pragma("journal_mode = WAL");
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
var JWT_SECRET = process.env.JWT_SECRET || "your-default-jwt-secret";
var app = (0, import_express.default)();
var PORT = 3e3;
function isExpectedFetchFallback(err) {
  if (!err) return true;
  const msg = String(err.message || err).toLowerCase();
  const name = String(err.name || "");
  return name === "AbortError" || name === "TimeoutError" || name === "TypeError" || msg.includes("aborted") || msg.includes("timeout") || msg.includes("fetch failed") || msg.includes("429") || msg.includes("too many requests") || msg.includes("unexpected token") || msg.includes("econnreset");
}
app.use(import_express.default.json({ limit: "10mb" }));
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var STOCKS = [
  // === INDEX ETFs ===
  { symbol: "SPY", name: "SPDR S&P 500 ETF (\u6807\u666E500\u6307\u6570ETF)", basePrice: 550, currentPrice: 551.2, prevClose: 549.5, high: 552.5, low: 548.8, volume: 75e6 },
  { symbol: "QQQ", name: "Invesco QQQ Trust (\u7EB3\u65AF\u8FBE\u514B100 ETF)", basePrice: 490, currentPrice: 491.4, prevClose: 488, high: 493, low: 487.2, volume: 48e6 },
  { symbol: "IWM", name: "iShares Russell 2000 ETF (\u7F57\u7D202000\u5C0F\u76D8\u80A1)", basePrice: 225, currentPrice: 224.8, prevClose: 226.1, high: 227.5, low: 223.5, volume: 32e6 },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial ETF (\u9053\u743C\u65AF\u5DE5\u4E1A ETF)", basePrice: 410, currentPrice: 411.2, prevClose: 409, high: 412.5, low: 408.2, volume: 15e6 },
  { symbol: "GLD", name: "SPDR Gold Shares (\u9EC4\u91D1 ETF - \u5546\u54C1\u57FA\u91D1)", basePrice: 235, currentPrice: 236.5, prevClose: 234.2, high: 237.8, low: 233.9, volume: 8e6 },
  { symbol: "USO", name: "United States Oil Fund (\u7F8E\u56FD\u539F\u6CB9 ETF)", basePrice: 78.5, currentPrice: 78.2, prevClose: 79, high: 79.8, low: 77.5, volume: 12e6 },
  // === S&P 500 TECH & AI GIANTS ===
  { symbol: "AAPL", name: "Apple Inc. (\u82F9\u679C\u516C\u53F8)", basePrice: 225, currentPrice: 226.4, prevClose: 224.5, high: 227.2, low: 223, volume: 52e6 },
  { symbol: "NVDA", name: "NVIDIA Corp. (\u82F1\u4F1F\u8FBE)", basePrice: 128, currentPrice: 130.5, prevClose: 125, high: 132, low: 124, volume: 268e6 },
  { symbol: "MSFT", name: "Microsoft Corp. (\u5FAE\u8F6F)", basePrice: 450, currentPrice: 451.1, prevClose: 448, high: 453.5, low: 447.2, volume: 22e6 },
  { symbol: "TSLA", name: "Tesla, Inc. (\u7279\u65AF\u62C9)", basePrice: 250, currentPrice: 248.8, prevClose: 255.2, high: 260.5, low: 245, volume: 85e6 },
  { symbol: "AMZN", name: "Amazon.com, Inc. (\u4E9A\u9A6C\u900A)", basePrice: 200, currentPrice: 201.5, prevClose: 199, high: 203.8, low: 198.5, volume: 33e6 },
  { symbol: "GOOGL", name: "Alphabet Inc. (\u8C37\u6B4C)", basePrice: 185, currentPrice: 186.9, prevClose: 184.5, high: 188, low: 183, volume: 28e6 },
  { symbol: "META", name: "Meta Platforms (\u8138\u4E66/\u5143\u5B87\u5B99)", basePrice: 530, currentPrice: 533.5, prevClose: 525.1, high: 538, low: 520, volume: 18e6 },
  { symbol: "AMD", name: "Advanced Micro Devices (\u8D85\u5A01\u534A\u5BFC\u4F53)", basePrice: 165, currentPrice: 167.2, prevClose: 160, high: 168.5, low: 158, volume: 45e6 },
  { symbol: "AVGO", name: "Broadcom Inc. (\u535A\u901A)", basePrice: 1650, currentPrice: 1654.2, prevClose: 1645, high: 1668, low: 1640, volume: 35e5 },
  { symbol: "NFLX", name: "Netflix Inc. (\u7F51\u98DE/\u5948\u98DE)", basePrice: 680, currentPrice: 682.8, prevClose: 675, high: 685.5, low: 670, volume: 45e5 },
  { symbol: "ADBE", name: "Adobe Inc. (\u5965\u591A\u6BD4)", basePrice: 535, currentPrice: 536.4, prevClose: 532, high: 542, low: 531, volume: 38e5 },
  { symbol: "CRM", name: "Salesforce Inc. (\u8D5B\u5BCC\u65F6)", basePrice: 290, currentPrice: 291.5, prevClose: 288.5, high: 294, low: 287, volume: 55e5 },
  { symbol: "ORCL", name: "Oracle Corp. (\u7532\u9AA8\u6587)", basePrice: 125, currentPrice: 126.1, prevClose: 124.8, high: 128, low: 124, volume: 9e6 },
  { symbol: "QCOM", name: "Qualcomm Inc. (\u9AD8\u901A)", basePrice: 168, currentPrice: 169.3, prevClose: 167, high: 171.5, low: 166, volume: 11e6 },
  { symbol: "INTC", name: "Intel Corp. (\u82F1\u7279\u5C14)", basePrice: 42, currentPrice: 41.8, prevClose: 42.5, high: 43.1, low: 41.5, volume: 35e6 },
  // === S&P 500 FINANCIALS & HEALTH & VALUE ===
  { symbol: "BRK.B", name: "Berkshire Hathaway (\u4F2F\u514B\u5E0C\u5C14\u54C8\u6492\u97E6-B)", basePrice: 415, currentPrice: 416.2, prevClose: 414, high: 418.5, low: 413, volume: 6e6 },
  { symbol: "JPM", name: "JPMorgan Chase & Co. (\u6469\u6839\u5927\u901A)", basePrice: 195, currentPrice: 196.4, prevClose: 194.5, high: 198, low: 193.8, volume: 12e6 },
  { symbol: "BAC", name: "Bank of America (\u7F8E\u56FD\u94F6\u884C)", basePrice: 37, currentPrice: 37.2, prevClose: 36.8, high: 37.6, low: 36.5, volume: 38e6 },
  { symbol: "GS", name: "Goldman Sachs Group (\u9AD8\u76DB\u96C6\u56E2)", basePrice: 410, currentPrice: 411.8, prevClose: 408, high: 415, low: 407.2, volume: 28e5 },
  { symbol: "V", name: "Visa Inc. (\u7EF4\u8428\u5361)", basePrice: 280, currentPrice: 281.3, prevClose: 279, high: 283.5, low: 278.2, volume: 65e5 },
  { symbol: "MA", name: "Mastercard Inc. (\u4E07\u4E8B\u8FBE\u5361)", basePrice: 475, currentPrice: 476.9, prevClose: 473.5, high: 480, low: 472, volume: 32e5 },
  { symbol: "XOM", name: "Exxon Mobil Corp. (\u57C3\u514B\u68EE\u7F8E\u5B5A)", basePrice: 115, currentPrice: 115.8, prevClose: 114.2, high: 116.9, low: 113.8, volume: 18e6 },
  { symbol: "CVX", name: "Chevron Corp. (\u96EA\u4F5B\u9F99)", basePrice: 158, currentPrice: 157.6, prevClose: 159, high: 161, low: 156.5, volume: 95e5 },
  { symbol: "KO", name: "Coca-Cola Co. (\u53EF\u53E3\u53EF\u4E50)", basePrice: 60.5, currentPrice: 60.8, prevClose: 60.2, high: 61.2, low: 60, volume: 14e6 },
  { symbol: "PEP", name: "PepsiCo Inc. (\u767E\u4E8B\u516C\u53F8)", basePrice: 168, currentPrice: 168.5, prevClose: 167.2, high: 170, low: 166.8, volume: 55e5 },
  { symbol: "PG", name: "Procter & Gamble (\u5B9D\u6D01\u516C\u53F8)", basePrice: 162, currentPrice: 162.9, prevClose: 161.5, high: 164, low: 161, volume: 7e6 },
  { symbol: "WMT", name: "Walmart Inc. (\u6C83\u5C14\u739B)", basePrice: 60, currentPrice: 60.3, prevClose: 59.8, high: 60.8, low: 59.5, volume: 18e6 },
  { symbol: "COST", name: "Costco Wholesale (\u5F00\u5E02\u5BA2)", basePrice: 725, currentPrice: 728.1, prevClose: 722, high: 733, low: 720, volume: 25e5 },
  { symbol: "NKE", name: "NIKE Inc. (\u8010\u514B)", basePrice: 100, currentPrice: 99.4, prevClose: 101.2, high: 102.5, low: 98.8, volume: 8e6 },
  { symbol: "DIS", name: "Walt Disney Co. (\u534E\u7279\u8FEA\u58EB\u5C3C)", basePrice: 112, currentPrice: 112.5, prevClose: 111, high: 114.2, low: 110.5, volume: 9e6 },
  { symbol: "LLY", name: "Eli Lilly & Co. (\u793C\u6765\u5236\u836F)", basePrice: 760, currentPrice: 764.5, prevClose: 755, high: 775, low: 752, volume: 4e6 },
  { symbol: "JNJ", name: "Johnson & Johnson (\u5F3A\u751F\u5236\u836F)", basePrice: 155, currentPrice: 155.4, prevClose: 154.8, high: 156.8, low: 154, volume: 85e5 },
  { symbol: "UNH", name: "UnitedHealth Group (\u8054\u5408\u5065\u5EB7)", basePrice: 490, currentPrice: 488.5, prevClose: 492.1, high: 495, low: 485.5, volume: 35e5 },
  // === GLOBAL CHIPS & CARS ===
  { symbol: "TSM", name: "TSMC (\u53F0\u79EF\u7535 ADR)", basePrice: 140, currentPrice: 140.8, prevClose: 139.2, high: 142, low: 138.5, volume: 15e6 },
  { symbol: "ASML", name: "ASML Holding (\u963F\u65AF\u9EA6 ADR)", basePrice: 920, currentPrice: 924.5, prevClose: 915, high: 938, low: 912, volume: 15e5 },
  { symbol: "F", name: "Ford Motor Co. (\u798F\u7279\u6C7D\u8F66)", basePrice: 12.2, currentPrice: 12.3, prevClose: 12.1, high: 12.5, low: 11.9, volume: 45e6 },
  { symbol: "GM", name: "General Motors (\u901A\u7528\u6C7D\u8F66)", basePrice: 40.5, currentPrice: 40.9, prevClose: 40.1, high: 41.5, low: 39.8, volume: 12e6 },
  // === CHINA CONCEPT ADRs & HK & A-SHARES ===
  { symbol: "BABA", name: "Alibaba Group (\u963F\u91CC\u5DF4\u5DF4 ADR)", basePrice: 72, currentPrice: 71.8, prevClose: 72.5, high: 73.2, low: 71, volume: 19e6 },
  { symbol: "PDD", name: "PDD Holdings (\u62FC\u591A\u591A ADR)", basePrice: 120, currentPrice: 121.5, prevClose: 118.9, high: 124, low: 118, volume: 11e6 },
  { symbol: "JD", name: "JD.com, Inc. (\u4EAC\u4E1C\u96C6\u56E2 ADR)", basePrice: 26.5, currentPrice: 26.2, prevClose: 26.9, high: 27.2, low: 25.9, volume: 14e6 },
  { symbol: "LI", name: "Li Auto Inc. (\u7406\u60F3\u6C7D\u8F66 ADR)", basePrice: 24.5, currentPrice: 24.8, prevClose: 24.1, high: 25.5, low: 23.8, volume: 15e6 },
  { symbol: "NIO", name: "NIO Inc. (\u851A\u6765\u6C7D\u8F66 ADR)", basePrice: 4.8, currentPrice: 4.75, prevClose: 4.85, high: 5, low: 4.65, volume: 38e6 },
  { symbol: "XPEV", name: "XPeng Inc. (\u5C0F\u9E4F\u6C7D\u8F66 ADR)", basePrice: 7.5, currentPrice: 7.42, prevClose: 7.6, high: 7.9, low: 7.3, volume: 22e6 },
  { symbol: "0700.HK", name: "Tencent Holdings (\u817E\u8BAF\u63A7\u80A1)", basePrice: 380, currentPrice: 382.4, prevClose: 378, high: 385, low: 377.2, volume: 12e6 },
  { symbol: "3690.HK", name: "Meituan (\u7F8E\u56E2)", basePrice: 115, currentPrice: 116.3, prevClose: 114.2, high: 118, low: 113.5, volume: 21e6 },
  { symbol: "1810.HK", name: "Xiaomi Group (\u5C0F\u7C73\u96C6\u56E2)", basePrice: 18.5, currentPrice: 18.7, prevClose: 18.3, high: 19.1, low: 18.2, volume: 48e6 },
  { symbol: "9988.HK", name: "Alibaba HK (\u963F\u91CC\u5DF4\u5DF4-SW)", basePrice: 73, currentPrice: 72.8, prevClose: 73.5, high: 74.2, low: 72, volume: 35e6 },
  { symbol: "9618.HK", name: "JD HK (\u4EAC\u4E1C\u96C6\u56E2-SW)", basePrice: 104, currentPrice: 102.8, prevClose: 105.1, high: 106.5, low: 101.8, volume: 8e6 },
  { symbol: "BYDDF", name: "BYD Company (\u6BD4\u4E9A\u8FEA\u80A1\u4EFD ADR)", basePrice: 28, currentPrice: 28.3, prevClose: 27.9, high: 28.8, low: 27.6, volume: 5e6 },
  { symbol: "600519.SH", name: "Kweichow Moutai (\u8D35\u5DDE\u8305\u53F0 A\u80A1)", basePrice: 1650, currentPrice: 1654.5, prevClose: 1642, high: 1670, low: 1640, volume: 18e5 },
  { symbol: "000001.SZ", name: "Ping An Bank (\u5E73\u5B89\u94F6\u884C A\u80A1)", basePrice: 10.5, currentPrice: 10.55, prevClose: 10.48, high: 10.7, low: 10.4, volume: 85e6 }
];
var GLOBAL_STOCK_DIRECTORY = {
  // === POPULAR US STOCKS ===
  "NEE": { name: "NextEra Energy (\u65B0\u7EAA\u5143\u80FD\u6E90)", basePrice: 72.8 },
  "MCD": { name: "McDonald's Corp. (\u9EA6\u5F53\u52B3)", basePrice: 285.5 },
  "BILI": { name: "Bilibili Inc. (\u54D4\u54E9\u54D4\u54E9 ADR)", basePrice: 15.2 },
  "SBUX": { name: "Starbucks Corp. (\u661F\u5DF4\u514B)", basePrice: 79.2 },
  "COIN": { name: "Coinbase Global, Inc. (\u5E01\u5B89\u4EA4\u6613\u6240)", basePrice: 220 },
  "MSTR": { name: "MicroStrategy Inc. (\u5FAE\u7B56\u7565)", basePrice: 1450 },
  "MARA": { name: "Marathon Digital Holdings (\u9A6C\u62C9\u677E\u6570\u5B57)", basePrice: 18.5 },
  "RIOT": { name: "Riot Platforms (\u83B1\u7279\u6BD4\u7279\u5E01)", basePrice: 10.2 },
  "PLTR": { name: "Palantir Technologies (\u5E15\u5170\u63D0\u5C14 AI)", basePrice: 26.5 },
  "LLY": { name: "Eli Lilly & Co. (\u793C\u6765\u5236\u836F)", basePrice: 915 },
  "NVO": { name: "Novo Nordisk (\u8BFA\u548C\u8BFA\u5FB7 ADR)", basePrice: 135 },
  "ARM": { name: "Arm Holdings plc (\u5B89\u8C0B\u79D1\u6280)", basePrice: 125 },
  "COST": { name: "Costco Wholesale Corp. (\u5F00\u5E02\u5BA2)", basePrice: 840.5 },
  "WMT": { name: "Walmart Inc. (\u6C83\u5C14\u739B)", basePrice: 65.2 },
  "HD": { name: "Home Depot, Inc. (\u5BB6\u5F97\u5B9D)", basePrice: 345 },
  "DIS": { name: "The Walt Disney Co. (\u8FEA\u58EB\u5C3C)", basePrice: 104.2 },
  "NKE": { name: "NIKE, Inc. (\u8010\u514B)", basePrice: 95.4 },
  "KO": { name: "Coca-Cola Co. (\u53EF\u53E3\u53EF\u4E50)", basePrice: 62.1 },
  "PEP": { name: "PepsiCo, Inc. (\u767E\u4E8B\u516C\u53F8)", basePrice: 168.5 },
  "PG": { name: "Procter & Gamble (\u5B9D\u6D01)", basePrice: 164.2 },
  "CAT": { name: "Caterpillar Inc. (\u5361\u7279\u5F7C\u52D2)", basePrice: 325 },
  "GE": { name: "General Electric Co. (\u901A\u7528\u7535\u6C14)", basePrice: 165 },
  "BA": { name: "Boeing Co. (\u6CE2\u97F3\u98DE\u673A)", basePrice: 175 },
  "JNJ": { name: "Johnson & Johnson (\u5F3A\u751F)", basePrice: 148.5 },
  "PFE": { name: "Pfizer Inc. (\u8F89\u745E\u5236\u836F)", basePrice: 28.5 },
  "MRK": { name: "Merck & Co., Inc. (\u9ED8\u6C99\u4E1C)", basePrice: 125.5 },
  "XOM": { name: "Exxon Mobil Corp. (\u57C3\u514B\u68EE\u7F8E\u5B5A)", basePrice: 114.5 },
  "CVX": { name: "Chevron Corp. (\u96EA\u4F5B\u9F99)", basePrice: 156.2 },
  "COP": { name: "ConocoPhillips (\u5EB7\u83F2\u77F3\u6CB9)", basePrice: 110 },
  "LMT": { name: "Lockheed Martin (\u6D1B\u514B\u5E0C\u5FB7\u9A6C\u4E01)", basePrice: 465 },
  "V": { name: "Visa Inc. (\u7EF4\u8428\u5361)", basePrice: 275.8 },
  "MA": { name: "Mastercard Inc. (\u4E07\u4E8B\u8FBE\u5361)", basePrice: 462.5 },
  "GS": { name: "Goldman Sachs Group (\u9AD8\u76DB)", basePrice: 462 },
  "MS": { name: "Morgan Stanley (\u5927\u6469/\u6469\u6839\u58EB\u4E39\u5229)", basePrice: 98.2 },
  "JPM": { name: "JPMorgan Chase & Co. (\u5C0F\u6469/\u6469\u6839\u5927\u901A)", basePrice: 205.4 },
  "BAC": { name: "Bank of America (\u7F8E\u56FD\u94F6\u884C)", basePrice: 39.5 },
  "C": { name: "Citigroup Inc. (\u82B1\u65D7\u96C6\u56E2)", basePrice: 62.4 },
  "WFC": { name: "Wells Fargo & Co. (\u5BCC\u56FD\u94F6\u884C)", basePrice: 58.2 },
  "BLK": { name: "BlackRock, Inc. (\u8D1D\u83B1\u5FB7)", basePrice: 785 },
  "AXP": { name: "American Express (\u7F8E\u56FD\u8FD0\u901A)", basePrice: 225 },
  "SCHW": { name: "Charles Schwab (\u5609\u4FE1\u7406\u8D22)", basePrice: 72.4 },
  "SOFI": { name: "SoFi Technologies (\u4E92\u8054\u7F51\u7406\u8D22)", basePrice: 7.2 },
  "PYPL": { name: "PayPal Holdings (\u8D1D\u5B9D\u652F\u4ED8)", basePrice: 68.2 },
  "SQ": { name: "Block Inc. (\u524DSquare\u652F\u4ED8)", basePrice: 65.4 },
  "SHOP": { name: "Shopify Inc. (\u58F0\u5B66/\u5546\u94FA\u901A)", basePrice: 68.2 },
  "SPOT": { name: "Spotify Technology (\u58F0\u7530\u6D41\u5A92\u4F53)", basePrice: 310 },
  "DUOL": { name: "Duolingo, Inc. (\u591A\u90BB\u56FD)", basePrice: 195 },
  "U": { name: "Unity Software (Unity\u6E38\u620F\u5F15\u64CE)", basePrice: 18.2 },
  "RBLX": { name: "Roblox Corp. (\u6C99\u76D2\u6E38\u620F\u9F99\u5934)", basePrice: 38.5 },
  "FUTU": { name: "Futu Holdings (\u5BCC\u9014\u63A7\u80A1)", basePrice: 68.5 },
  "PANW": { name: "Palo Alto Networks (\u6D3E\u62D3\u5B89\u5168)", basePrice: 325 },
  "CRWD": { name: "CrowdStrike Holdings (\u4F17\u51FB\u5B89\u5168)", basePrice: 340 },
  "SNOW": { name: "Snowflake Inc. (\u96EA\u82B1\u4E91\u4ED3)", basePrice: 135 },
  "NTES": { name: "NetEase Inc. (\u7F51\u6613)", basePrice: 95 },
  "BIDU": { name: "Baidu Inc. (\u767E\u5EA6)", basePrice: 105 },
  // === POPULAR HK STOCKS ===
  "9626.HK": { name: "\u54D4\u54E9\u54D4\u54E9-W (Bilibili)", basePrice: 118.5 },
  "9988.HK": { name: "\u963F\u91CC\u5DF4\u5DF4-SW", basePrice: 72.5 },
  "9618.HK": { name: "\u4EAC\u4E1C\u96C6\u56E2-SW", basePrice: 110.2 },
  "9999.HK": { name: "\u7F51\u6613-S", basePrice: 148 },
  "9888.HK": { name: "\u767E\u5EA6\u96C6\u56E2-SW", basePrice: 102 },
  "3033.HK": { name: "\u5357\u65B9\u6052\u751F\u79D1\u6280 ETF (\u6052\u751F\u79D1\u6280\u6307\u6570 ETF)", basePrice: 3.82 },
  "2800.HK": { name: "\u76C8\u5BCC\u57FA\u91D1 (\u6052\u6307\u8FFD\u8E2A\u57FA\u91D1)", basePrice: 17.5 },
  "2828.HK": { name: "\u6052\u751F\u4E2D\u56FD\u4F01\u4E1A ETF (\u56FD\u4F01\u6307\u6570 ETF)", basePrice: 62.1 },
  "0388.HK": { name: "\u9999\u6E2F\u4EA4\u6613\u6240 (HKEX)", basePrice: 255.4 },
  "0941.HK": { name: "\u4E2D\u56FD\u79FB\u52A8 (China Mobile)", basePrice: 72.5 },
  "0762.HK": { name: "\u4E2D\u56FD\u8054\u901A (China Unicom)", basePrice: 6.2 },
  "0728.HK": { name: "\u4E2D\u56FD\u7535\u4FE1 (China Telecom)", basePrice: 4.1 },
  "1024.HK": { name: "\u5FEB\u624B-W (Kuaishou Technology)", basePrice: 48.5 },
  "9868.HK": { name: "\u5C0F\u9E4F\u6C7D\u8F66-W (XPeng Inc.)", basePrice: 28.5 },
  "2015.HK": { name: "\u7406\u60F3\u6C7D\u8F66-W (Li Auto Inc.)", basePrice: 78.4 },
  "9866.HK": { name: "\u851A\u6765-SW (NIO Inc.)", basePrice: 35.2 },
  "0005.HK": { name: "\u6C47\u4E30\u63A7\u80A1 (HSBC Holdings)", basePrice: 62.4 },
  "1299.HK": { name: "\u53CB\u90A6\u4FDD\u9669 (AIA Group)", basePrice: 58.5 },
  "2318.HK": { name: "\u4E2D\u56FD\u5E73\u5B89 (Ping An Insurance)", basePrice: 35.8 },
  "0857.HK": { name: "\u4E2D\u56FD\u77F3\u6CB9\u80A1\u4EFD (PetroChina)", basePrice: 6.8 },
  "0883.HK": { name: "\u4E2D\u56FD\u6D77\u6D0B\u77F3\u6CB9 (CNOOC)", basePrice: 18.5 },
  "2382.HK": { name: "\u821C\u5B87\u5149\u5B66\u79D1\u6280 (Sunny Optical)", basePrice: 42.5 },
  "3988.HK": { name: "\u4E2D\u56FD\u94F6\u884C (Bank of China)", basePrice: 3.42 },
  "0939.HK": { name: "\u5EFA\u8BBE\u94F6\u884C (China Construction Bank)", basePrice: 4.85 },
  "1398.HK": { name: "\u5DE5\u5546\u94F6\u884C (ICBC)", basePrice: 4.15 },
  "2628.HK": { name: "\u4E2D\u56FD\u4EBA\u5BFF (China Life)", basePrice: 11.2 },
  "0016.HK": { name: "\u65B0\u9E3F\u57FA\u5730\u4EA7 (Sun Hung Kai Properties)", basePrice: 72.4 }
};
function ensureStockExists(symbolStr) {
  const symbol = symbolStr.trim().toUpperCase();
  if (!symbol) return STOCKS[0];
  const existing = STOCKS.find((s) => s.symbol === symbol);
  if (existing) return existing;
  let match = GLOBAL_STOCK_DIRECTORY[symbol];
  if (!match && /^\d{1,5}$/.test(symbol)) {
    const padded4 = symbol.padStart(4, "0") + ".HK";
    const padded5 = symbol.padStart(5, "0") + ".HK";
    const rawHk = symbol + ".HK";
    const matchedKey = [padded4, padded5, rawHk].find((key) => GLOBAL_STOCK_DIRECTORY[key]);
    if (matchedKey) {
      const existingHk = STOCKS.find((s) => s.symbol === matchedKey);
      if (existingHk) return existingHk;
      match = GLOBAL_STOCK_DIRECTORY[matchedKey];
      const finalHkSymbol = matchedKey;
      const newStock2 = {
        symbol: finalHkSymbol,
        name: match.name,
        basePrice: match.basePrice,
        currentPrice: match.basePrice,
        prevClose: Number((match.basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
        high: match.basePrice,
        low: match.basePrice,
        volume: 1e6 + Math.floor(Math.random() * 5e6)
      };
      STOCKS.push(newStock2);
      return newStock2;
    }
  }
  if (match) {
    const newStock2 = {
      symbol,
      name: match.name,
      basePrice: match.basePrice,
      currentPrice: match.basePrice,
      prevClose: Number((match.basePrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
      high: match.basePrice,
      low: match.basePrice,
      volume: 1e6 + Math.floor(Math.random() * 5e6)
    };
    STOCKS.push(newStock2);
    return newStock2;
  }
  const isNumericOnly = /^\d+$/.test(symbol);
  const isHkSuffix = /\.HK$/i.test(symbol);
  const isAShareSuffix = /(\.SH|\.SZ)$/i.test(symbol);
  let companyName = `${symbol} Corporation (\u81EA\u5B9A\u4E49\u7F8E\u80A1)`;
  if (isNumericOnly || isHkSuffix) {
    const displaySymbol = isHkSuffix ? symbol : symbol.padStart(4, "0") + ".HK";
    companyName = `${displaySymbol} (\u81EA\u5B9A\u4E49\u6E2F\u80A1)`;
  } else if (isAShareSuffix || isNumericOnly && symbol.length === 6) {
    companyName = `${symbol} (\u81EA\u5B9A\u4E49A\u80A1)`;
  }
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const seedPrice = Number((10 + Math.abs(hash % 290) + Math.abs(hash % 100) / 100).toFixed(2)) || 50;
  const newStock = {
    symbol: isNumericOnly && !isHkSuffix && !isAShareSuffix ? symbol.padStart(4, "0") + ".HK" : symbol,
    name: companyName,
    basePrice: seedPrice,
    currentPrice: seedPrice,
    prevClose: Number((seedPrice * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
    high: seedPrice,
    low: seedPrice,
    volume: 1e6 + Math.floor(Math.random() * 5e6)
  };
  const finalCheck = STOCKS.find((s) => s.symbol === newStock.symbol);
  if (finalCheck) return finalCheck;
  STOCKS.push(newStock);
  return newStock;
}
function generateCandles(symbol, range, currentPrice) {
  const stock = STOCKS.find((s) => s.symbol === symbol) || STOCKS[0];
  let days = 30;
  if (range === "5M") days = 1;
  else if (range === "60M") days = 5;
  else if (range === "1D") days = 1;
  else if (range === "1W") days = 7;
  else if (range === "1M") days = 30;
  else if (range === "1Y") days = 250;
  const data = [];
  let price = stock.basePrice || currentPrice || 100;
  const now = Date.now();
  const totalSteps = range === "1D" || range === "5M" ? 48 : range === "60M" ? 30 : days;
  const step = range === "1D" || range === "5M" ? 5 * 60 * 1e3 : range === "60M" ? 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  for (let i = totalSteps; i >= 0; i--) {
    const time = now - i * step;
    const volatility = 0.012;
    const change = price * (Math.random() - 0.49) * volatility;
    const open = Number(price.toFixed(2));
    const close = Number(Math.max(1, price + change).toFixed(2));
    const maxBar = Math.max(open, close);
    const minBar = Math.min(open, close);
    const high = Number((maxBar + Math.random() * price * 5e-3).toFixed(2));
    const low = Number(Math.max(0.5, minBar - Math.random() * price * 5e-3).toFixed(2));
    const volume = Math.floor((stock.volume || 1e6) / 30 + Math.random() * 5e4);
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
  const lastIndex = data.length - 1;
  if (lastIndex >= 0 && currentPrice > 0) {
    data[lastIndex].close = currentPrice;
    if (currentPrice > data[lastIndex].high) data[lastIndex].high = currentPrice;
    if (currentPrice < data[lastIndex].low && data[lastIndex].low > 0) data[lastIndex].low = currentPrice;
  }
  return data;
}
STOCKS.forEach((s) => {
  s.history = [];
  for (let i = 0; i < 15; i++) {
    s.history.push(s.currentPrice * (1 + (Math.random() - 0.5) * 5e-3));
  }
});
setInterval(() => {
  STOCKS.forEach((s) => {
    if (Math.random() > 0.4) {
      const volatility = s.currentPrice * 1e-3;
      s.currentPrice = Number((s.currentPrice + (Math.random() - 0.5) * volatility).toFixed(2));
      if (s.currentPrice > s.high) s.high = s.currentPrice;
      if (s.currentPrice < s.low) s.low = s.currentPrice;
      s.volume += Math.floor(Math.random() * 5e3);
      if (!s.history) s.history = Array(15).fill(s.currentPrice);
      s.history.push(s.currentPrice);
      if (s.history.length > 15) s.history.shift();
    }
  });
}, 3e3);
app.get("/api/stocks", async (req, res) => {
  try {
    const topSymbols = STOCKS.slice(0, 15).map((s) => s.symbol);
    let requestedSymbols = [];
    if (req.query.symbols) {
      const parsed = String(req.query.symbols).split(",").map((s) => s.trim().toUpperCase());
      requestedSymbols = parsed.filter((s) => !!s);
    }
    const symbolsToFetch = Array.from(/* @__PURE__ */ new Set([...topSymbols, ...requestedSymbols]));
    if (symbolsToFetch.length > 0) {
      const quotes = await Promise.all(symbolsToFetch.map(async (sym) => {
        try {
          const res2 = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (res2.ok) {
            const data = await res2.json();
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
        } catch (e) {
        }
        return null;
      })).then((res2) => res2.filter(Boolean));
      quotes.forEach((quote) => {
        const stock = STOCKS.find((s) => s.symbol === quote.symbol);
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
  } catch (err) {
    if (!isExpectedFetchFallback(err)) {
      console.warn("Notice: Using mock data for initial quotes due to:", err?.message || err);
    }
  }
  res.json(STOCKS);
});
app.post("/api/stocks", (req, res) => {
  const { symbol, name, basePrice } = req.body;
  if (!symbol || !name || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
    return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u80A1\u7968\u4EE3\u7801\u3001\u80A1\u7968\u540D\u79F0\u548C\u5408\u7406\u7684\u4EF7\u683C" });
  }
  const cleanSymbol = String(symbol).trim().toUpperCase();
  const cleanName = String(name).trim();
  const price = Number(basePrice);
  const existing = STOCKS.find((s) => s.symbol === cleanSymbol);
  if (existing) {
    return res.status(400).json({ error: `\u80A1\u7968\u4EE3\u7801 ${cleanSymbol} \u5DF2\u7ECF\u5B58\u5728\u4E86\uFF0C\u60A8\u53EF\u4EE5\u76F4\u63A5\u641C\u7D22\u5E76\u6DFB\u52A0\u6301\u4ED3\uFF01` });
  }
  const newStock = {
    symbol: cleanSymbol,
    name: cleanName,
    basePrice: price,
    currentPrice: price,
    prevClose: Number((price * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
    high: price,
    low: price,
    volume: 1e6 + Math.floor(Math.random() * 5e6)
  };
  STOCKS.push(newStock);
  res.status(201).json(newStock);
});
app.get("/api/stocks/search", async (req, res) => {
  const rawQuery = String(req.query.q || "").trim();
  const query = rawQuery.toLowerCase();
  if (!query) return res.json([]);
  try {
    const normalized = rawQuery.toUpperCase();
    const localMatches = STOCKS.filter(
      (s) => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    );
    let validQuotes = [];
    try {
      const resYahoo = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (resYahoo.ok) {
        const data = await resYahoo.json();
        if (data.quotes) {
          validQuotes = data.quotes.filter((q) => q.isYahooFinance).slice(0, 10);
        }
      }
    } catch (e) {
    }
    const symbolsToFetch = validQuotes.map((q) => q.symbol);
    let fetchedStocks = [];
    if (symbolsToFetch.length > 0) {
      const liveQuotes = await Promise.all(symbolsToFetch.map(async (sym) => {
        try {
          const res2 = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (res2.ok) {
            const data = await res2.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta) {
              return {
                symbol: sym,
                longName: sym,
                shortName: sym,
                regularMarketPrice: meta.regularMarketPrice,
                regularMarketPreviousClose: meta.previousClose,
                regularMarketDayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice,
                regularMarketDayLow: meta.regularMarketDayLow || meta.regularMarketPrice,
                regularMarketVolume: meta.regularMarketVolume || 0
              };
            }
          }
        } catch (e) {
        }
        return null;
      })).then((res2) => res2.filter(Boolean));
      fetchedStocks = liveQuotes.map((quote) => ({
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || quote.symbol,
        basePrice: quote.regularMarketPreviousClose || 0,
        currentPrice: quote.regularMarketPrice || quote.postMarketPrice || 0,
        prevClose: quote.regularMarketPreviousClose || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        volume: quote.regularMarketVolume || 0
      }));
    }
    const map = /* @__PURE__ */ new Map();
    localMatches.forEach((s) => map.set(s.symbol, s));
    fetchedStocks.forEach((s) => {
      map.set(s.symbol, s);
      if (!STOCKS.find((exist) => exist.symbol === s.symbol)) {
        s.history = Array(15).fill(s.currentPrice || s.regularMarketPrice || 0);
        STOCKS.push(s);
      }
    });
    return res.json(Array.from(map.values()).slice(0, 50));
  } catch (error) {
    if (!isExpectedFetchFallback(error)) {
      console.warn("Notice: Search falling back to local due to:", error?.message || error);
    }
    const localMatches = STOCKS.filter(
      (s) => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
    );
    return res.json(localMatches.slice(0, 50));
  }
});
app.get("/api/stocks/quote/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    let quote = { symbol };
    try {
      const res2 = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3e3)
      });
      if (res2.ok) {
        const data = await res2.json();
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
    } catch (e) {
    }
    const stockData = {
      symbol: quote.symbol,
      name: quote.longName || quote.shortName || quote.symbol,
      basePrice: quote.regularMarketPreviousClose || 0,
      currentPrice: quote.regularMarketPrice || quote.postMarketPrice || 0,
      prevClose: quote.regularMarketPreviousClose || 0,
      high: quote.regularMarketDayHigh || 0,
      low: quote.regularMarketDayLow || 0,
      volume: quote.regularMarketVolume || 0
    };
    const existing = STOCKS.find((s) => s.symbol === symbol);
    if (existing) {
      Object.assign(existing, stockData);
    } else {
      stockData.history = Array(15).fill(stockData.currentPrice || stockData.regularMarketPrice || 0);
      STOCKS.push(stockData);
    }
    return res.json(stockData);
  } catch (error) {
    if (!isExpectedFetchFallback(error)) {
      console.warn("Notice: Quote falling back to mock due to:", error?.message || error);
    }
    const stock = ensureStockExists(symbol);
    res.json(stock);
  }
});
app.get("/api/stocks/candles/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const range = String(req.query.range || "1M").toUpperCase();
  try {
    const period1 = /* @__PURE__ */ new Date();
    const period2 = /* @__PURE__ */ new Date();
    let interval = "1d";
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
    const resYahoo = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${Math.floor(period1.getTime() / 1e3)}&period2=${Math.floor(period2.getTime() / 1e3)}&interval=${interval}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3500)
    });
    if (resYahoo.ok) {
      const data = await resYahoo.json();
      const result = data?.chart?.result?.[0];
      if (result && result.timestamp && result.indicators?.quote?.[0]) {
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        const stock2 = STOCKS.find((s) => s.symbol === symbol);
        let lastClose = stock2?.currentPrice || 100;
        const candles2 = [];
        for (let i = 0; i < timestamps.length; i++) {
          const t = timestamps[i];
          let closeVal = quotes.close?.[i];
          let openVal = quotes.open?.[i];
          let highVal = quotes.high?.[i];
          let lowVal = quotes.low?.[i];
          let volVal = quotes.volume?.[i] || 0;
          if (closeVal === null || closeVal === void 0 || isNaN(closeVal) || closeVal <= 0) {
            closeVal = lastClose;
          } else {
            lastClose = closeVal;
          }
          if (openVal === null || openVal === void 0 || isNaN(openVal) || openVal <= 0) {
            openVal = closeVal;
          }
          if (highVal === null || highVal === void 0 || isNaN(highVal) || highVal < Math.max(openVal, closeVal)) {
            highVal = Math.max(openVal, closeVal);
          }
          if (lowVal === null || lowVal === void 0 || isNaN(lowVal) || lowVal <= 0 || lowVal > Math.min(openVal, closeVal)) {
            lowVal = Math.min(openVal, closeVal);
          }
          const time = new Date(t * 1e3);
          let dateStr = "";
          if (range === "1D" || range === "5M" || range === "60M") {
            dateStr = time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
          } else if (range === "1Y") {
            dateStr = time.toLocaleDateString("zh-CN", { year: "2-digit", month: "2-digit", day: "2-digit" });
          } else {
            dateStr = time.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
          }
          candles2.push({
            time: dateStr,
            open: Number(openVal.toFixed(2)),
            high: Number(highVal.toFixed(2)),
            low: Number(lowVal.toFixed(2)),
            close: Number(closeVal.toFixed(2)),
            volume: Math.round(volVal)
          });
        }
        if (stock2 && stock2.currentPrice > 0 && candles2.length > 0) {
          const lastIdx = candles2.length - 1;
          candles2[lastIdx].close = stock2.currentPrice;
          if (stock2.currentPrice > candles2[lastIdx].high) candles2[lastIdx].high = stock2.currentPrice;
          if (stock2.currentPrice < candles2[lastIdx].low && candles2[lastIdx].low > 0) candles2[lastIdx].low = stock2.currentPrice;
        }
        return res.json(candles2);
      }
    }
  } catch (error) {
    if (!isExpectedFetchFallback(error)) {
      console.warn("Notice: Candles falling back to mock due to:", error?.message || error);
    }
  }
  const stock = ensureStockExists(symbol);
  const candles = generateCandles(symbol, range, stock.currentPrice);
  res.json(candles);
});
app.get("/api/news", async (req, res) => {
  const query = req.query.q || "US Stocks";
  try {
    const resYahoo = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=5`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3e3)
    });
    if (resYahoo.ok) {
      const data = await resYahoo.json();
      if (data.news && Array.isArray(data.news) && data.news.length > 0) {
        return res.json(data.news.slice(0, 5));
      }
    }
  } catch (err) {
    if (!isExpectedFetchFallback(err)) {
      console.warn("Notice: News fallback due to:", err?.message || err);
    }
  }
  res.json([
    {
      title: `\u3010\u70ED\u70B9\u65B0\u95FB\u3011${query} \u5E02\u573A\u60C5\u7EEA\u504F\u5411\u79EF\u6781\uFF0C\u591A\u6570\u5206\u6790\u5E08\u4E0A\u8C03\u8BC4\u7EA7\uFF0C\u9884\u8BA1Q3\u8D22\u62A5\u5C06\u8D85\u9884\u671F`,
      publisher: "Yahoo Finance",
      providerPublishTime: Math.floor(Date.now() / 1e3) - 1200,
      link: "#"
    },
    {
      title: `\u7A81\u53D1\uFF1A${query} \u76F8\u5173\u4EA7\u4E1A\u94FE\u8FCE\u6765\u91CD\u5927\u5229\u597D\uFF0C\u6838\u5FC3\u4F9B\u5E94\u5546\u6216\u8FCE\u4F30\u503C\u91CD\u4F30`,
      publisher: "Reuters",
      providerPublishTime: Math.floor(Date.now() / 1e3) - 3600,
      link: "#"
    },
    {
      title: `\u80A1\u5E02\u89C2\u5BDF\uFF1A\u8D44\u91D1\u6301\u7EED\u6D41\u5165 ${query} \u677F\u5757\uFF0C\u6280\u672F\u9762\u663E\u793A\u591A\u5934\u6392\u5217`,
      publisher: "Bloomberg",
      providerPublishTime: Math.floor(Date.now() / 1e3) - 7200,
      link: "#"
    },
    {
      title: `\u5B8F\u89C2\u89C6\u89D2\uFF1A\u7F8E\u8054\u50A8\u91CD\u78C5\u53D1\u8A00\u5173\u6CE8\u884C\u4E1A\u52A8\u6001\uFF0C${query} \u7684\u957F\u671F\u57FA\u672C\u9762\u903B\u8F91\u4E0D\u53D8`,
      publisher: "CNBC",
      providerPublishTime: Math.floor(Date.now() / 1e3) - 14400,
      link: "#"
    },
    {
      title: `\u96C5\u864E\u5934\u6761\uFF1A\u6563\u6237\u62B1\u56E2\u73B0\u8C61\u91CD\u73B0\uFF1F${query} \u793E\u4EA4\u5A92\u4F53\u70ED\u5EA6\u98D9\u5347 300%`,
      publisher: "Yahoo Finance",
      providerPublishTime: Math.floor(Date.now() / 1e3) - 2e4,
      link: "#"
    },
    {
      title: `\u6DF1\u5EA6\u89E3\u6790\uFF1A\u672A\u67653\u5E74 ${query} \u6240\u5728\u7684\u8D5B\u9053\u7ADE\u4E89\u683C\u5C40\uFF0C\u8C01\u5C06\u80DC\u51FA\uFF1F`,
      publisher: "Wall Street Journal",
      providerPublishTime: Math.floor(Date.now() / 1e3) - 4e4,
      link: "#"
    }
  ]);
});
app.post("/api/stocks/analysis", async (req, res) => {
  try {
    const { symbol, positions, thinkingMode, image } = req.body;
    const stock = ensureStockExists(symbol);
    const position = positions?.find((p) => p.symbol === symbol);
    let positionContext = "\u8BE5\u7528\u6237\u76EE\u524D\u6CA1\u6709\u6301\u6709\u6B64\u80A1\u7968\u3002";
    if (position) {
      positionContext = `\u8BE5\u7528\u6237\u6301\u6709\u6B64\u80A1\u7968\uFF1A\u6301\u4ED3\u6570\u91CF ${position.quantity} \u80A1\uFF0C\u5E73\u5747\u6210\u672C\u4EF7\u4E3A $${position.buyPrice}\u3002\u5F53\u524D\u4EF7\u683C $${stock.currentPrice}\u3002\u76C8\u4E8F\u4E3A: ${position.pnl >= 0 ? "\u76C8\u5229" : "\u4E8F\u635F"} $${Math.abs(position.pnl).toFixed(2)} (${position.pnlPercent.toFixed(2)}%)\u3002`;
    }
    const systemInstruction = `\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u3001\u5BA2\u89C2\u3001\u4E25\u8C28\u7684 AI \u6295\u8D44\u987E\u95EE\u3002
\u8BF7\u6839\u636E\u63D0\u4F9B\u7684\u80A1\u7968\u5F53\u524D\u6570\u636E\u3001\u4EA4\u6613\u91CF\u3001\u6301\u4ED3\u60C5\u51B5\u7B49\uFF0C\u4E3A\u7528\u6237\u751F\u6210\u4E00\u4EFD\u6781\u9AD8\u6C34\u51C6\u7684\u4E2A\u80A1\u4E0E\u6301\u4ED3\u5206\u6790\u62A5\u544A\u3002
\u8BF7\u4F7F\u7528\u7EAF\u6587\u672C\u6216\u7ED3\u6784\u5316\u7684 Markdown \u683C\u5F0F\uFF08\u4E0D\u4F7F\u7528\u5916\u5C42 HTML\uFF09\uFF0C\u8BED\u8A00\u4E3A\u4E2D\u6587\u3002
\u56DE\u7B54\u5E94\u5F53\u5206\u4E3A\uFF1A
1. \u3010\u80A1\u7968\u6982\u89C8\u3011\u7B80\u8981\u6982\u62EC\u8BE5\u80A1\u7968\u6700\u65B0\u72B6\u6001\u4E0E\u8FD1\u671F\u5E02\u573A\u4E3B\u7EBF\u3002
2. \u3010\u6301\u4ED3\u8BC4\u4F30\u3011\u7ED3\u5408\u6301\u4ED3\u5747\u4EF7\u548C\u5F53\u524D\u4EF7\u683C\uFF0C\u7ED9\u51FA\u5177\u4F53\u7684\u4ED3\u4F4D\u7BA1\u7406\u5EFA\u8BAE\uFF08\u82E5\u672A\u6301\u4ED3\uFF0C\u5219\u5206\u6790\u5F53\u524D\u7684\u5EFA\u4ED3\u65F6\u673A\u548C\u6027\u4EF7\u6BD4\uFF09\u3002
3. \u3010\u6280\u672F\u4E0E\u4F30\u503C\u7814\u5224\u3011\u5206\u6790\u5F53\u524D\u4EF7\u4F4D\u6240\u5904\u7684\u6280\u672F\u652F\u6491/\u963B\u529B\u4F4D\uFF0C\u6216\u4F30\u503C\u9AD8\u4F4E\u3002
4. \u3010\u64CD\u4F5C\u7B56\u7565\u4E0E\u98CE\u9669\u9884\u8B66\u3011\u7ED9\u51FA\u660E\u786E\u7684\u77ED\u671F\u4E0E\u4E2D\u957F\u671F\u64CD\u4F5C\u5EFA\u8BAE\uFF08\u5982\u5206\u6279\u51CF\u4ED3\u3001\u7834\u4F4D\u6B62\u635F\u3001\u9022\u4F4E\u4E70\u5165\uFF09\uFF0C\u5E76\u6807\u51FA\u660E\u786E\u7684\u98CE\u9669\u7B49\u7EA7\uFF08\u4F4E/\u4E2D/\u9AD8\uFF09\u3002`;
    let prompt = `\u80A1\u7968\u4EE3\u7801: ${stock.symbol}
\u80A1\u7968\u540D\u79F0: ${stock.name}
\u5F53\u524D\u53C2\u8003\u4EF7: $${stock.currentPrice}
\u6628\u65E5\u6536\u76D8\u4EF7: $${stock.prevClose}
\u4ECA\u65E5\u6700\u9AD8\u4EF7: $${stock.high}
\u4ECA\u65E5\u6700\u4F4E\u4EF7: $${stock.low}
\u53C2\u8003\u4EA4\u6613\u91CF: ${stock.volume.toLocaleString()}
${positionContext}
\u8BF7\u4F9D\u636E\u4EE5\u4E0A\u5B9E\u65F6\u884C\u60C5\uFF0C\u8FDB\u884C\u591A\u7EF4\u5EA6\u6DF1\u5EA6\u89E3\u6790\uFF0C\u5E76\u9488\u5BF9\u6211\u7684\u4ED3\u4F4D\u7ED9\u51FA\u9488\u5BF9\u6027\u5EFA\u8BAE\u3002`;
    if (image && image.base64 && image.mimeType) {
      prompt += `

[\u7528\u6237\u63D0\u4F9B\u4E86\u4E00\u5F20\u53C2\u8003\u56FE\u50CF\uFF0C\u53EF\u80FD\u662F\u5F53\u524D\u8D70\u52BFK\u7EBF\u622A\u56FE\u3001\u516C\u53F8\u8D22\u62A5\u3001\u76F8\u5173\u65B0\u95FB\u6216\u62A5\u8868\u3002\u8BF7\u7ED3\u5408\u6B64\u56FE\u50CF\u8FDB\u884C\u7EFC\u5408\u7814\u5224\u548C\u591A\u7EF4\u5EA6\u5206\u6790\u3002]`;
    }
    let contents;
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
    const modelsToTry = [];
    if (thinkingMode || image && image.base64) {
      modelsToTry.push("gemini-3.1-pro-preview");
    }
    modelsToTry.push("gemini-3.6-flash");
    modelsToTry.push("gemini-3.1-flash-lite");
    let responseText = "";
    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting Gemini analysis with model: ${modelName}`);
        const currentConfig = {
          systemInstruction
        };
        if (thinkingMode && modelName === "gemini-3.1-pro-preview") {
          currentConfig.thinkingConfig = {
            thinkingLevel: import_genai.ThinkingLevel.HIGH
          };
        }
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: currentConfig
        });
        if (response && response.text) {
          responseText = response.text;
          console.log(`Successfully generated analysis using ${modelName}`);
          break;
        }
      } catch (err) {
        console.warn(`Analysis failed with model ${modelName}:`, err?.message || JSON.stringify(err));
        lastError = err;
      }
    }
    if (!responseText) {
      const errMsg = lastError?.message || (typeof lastError === "object" ? JSON.stringify(lastError) : String(lastError));
      throw new Error(errMsg || "\u6240\u6709\u53EF\u7528\u7684 AI \u6A21\u578B\u5747\u65E0\u6CD5\u751F\u6210\u5206\u6790\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
    }
    res.json({ analysis: responseText });
  } catch (error) {
    console.error("Gemini analysis error:", error);
    res.status(500).json({ error: error?.message || "AI \u5206\u6790\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u786E\u4FDD GEMINI_API_KEY \u914D\u7F6E\u6B63\u786E" });
  }
});
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,32}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: "Password must be 8-32 characters long and contain both letters and numbers" });
  }
  try {
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }
    const saltRounds = 10;
    const passwordHash = await import_bcrypt.default.hash(password, saltRounds);
    const insertUser = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
    insertUser.run(email, passwordHash);
    res.status(201).json({ message: "Registration successful" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ error: "Account and password are required" });
  }
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1e3).toISOString();
    const attempts = db.prepare(`
      SELECT COUNT(*) as count 
      FROM login_attempts 
      WHERE email = ? AND success = 0 AND attempt_time > ?
    `).get(account, fifteenMinutesAgo);
    if (attempts.count >= 5) {
      return res.status(429).json({ error: "Too many failed login attempts. Account locked for 15 minutes." });
    }
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(account);
    if (!user) {
      db.prepare("INSERT INTO login_attempts (email, success) VALUES (?, 0)").run(account);
      return res.status(401).json({ error: "Invalid account or password" });
    }
    if (user.status === 0) {
      return res.status(403).json({ error: "Account is disabled" });
    }
    const match = await import_bcrypt.default.compare(password, user.password_hash);
    if (!match) {
      db.prepare("INSERT INTO login_attempts (email, success) VALUES (?, 0)").run(account);
      return res.status(401).json({ error: "Invalid account or password" });
    }
    db.prepare("INSERT INTO login_attempts (email, success) VALUES (?, 1)").run(account);
    db.prepare("DELETE FROM login_attempts WHERE email = ? AND success = 0").run(account);
    const token = import_jsonwebtoken.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "2h" });
    res.json({ message: "Login successful", token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
async function startServer() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
}
startServer();
//# sourceMappingURL=server.cjs.map
