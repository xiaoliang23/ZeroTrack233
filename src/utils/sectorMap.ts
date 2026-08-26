export const SECTOR_MAP: Record<string, string> = {
  "AAPL": "Technology",
  "MSFT": "Technology",
  "GOOGL": "Technology",
  "GOOG": "Technology",
  "AMZN": "Consumer Cyclical",
  "META": "Technology",
  "NVDA": "Technology",
  "TSLA": "Consumer Cyclical",
  "TSM": "Technology",
  "AVGO": "Technology",
  "ORCL": "Technology",
  "AMD": "Technology",
  "ASML": "Technology",
  "CRM": "Technology",
  "NFLX": "Communication Services",
  "DIS": "Communication Services",
  "JPM": "Financials",
  "BAC": "Financials",
  "WFC": "Financials",
  "GS": "Financials",
  "MS": "Financials",
  "V": "Financials",
  "MA": "Financials",
  "BRK.B": "Financials",
  "JNJ": "Healthcare",
  "UNH": "Healthcare",
  "LLY": "Healthcare",
  "PFE": "Healthcare",
  "MRK": "Healthcare",
  "ABBV": "Healthcare",
  "TMO": "Healthcare",
  "XOM": "Energy",
  "CVX": "Energy",
  "SHEL": "Energy",
  "WMT": "Consumer Defensive",
  "PG": "Consumer Defensive",
  "KO": "Consumer Defensive",
  "PEP": "Consumer Defensive",
  "COST": "Consumer Defensive",
  "HD": "Consumer Cyclical",
  "MCD": "Consumer Cyclical",
  "NKE": "Consumer Cyclical",
  "BA": "Industrials",
  "CAT": "Industrials",
  "UNP": "Industrials",
  "RTX": "Industrials",
  "HON": "Industrials",
  "NEE": "Utilities",
  "DUK": "Utilities",
  "SO": "Utilities",
  "PLD": "Real Estate",
  "AMT": "Real Estate",
  "SPY": "ETF",
  "QQQ": "ETF",
  "IWM": "ETF",
  "DIA": "ETF",
  "VOO": "ETF",
  "VTI": "ETF",
  "ARKK": "ETF",
  "GLD": "Commodities",
  "SLV": "Commodities",
  "USO": "Commodities",
  "BTC-USD": "Crypto",
  "ETH-USD": "Crypto",
};

export function getSector(symbol: string, name: string): string {
  const sym = symbol.toUpperCase();
  if (SECTOR_MAP[sym]) return SECTOR_MAP[sym];
  
  // Guess based on name
  const lowerName = name.toLowerCase();
  if (lowerName.includes("etf") || lowerName.includes("trust") || lowerName.includes("fund") || lowerName.includes("shares") || lowerName.includes("vanguard") || lowerName.includes("invesco")) return "ETF";
  if (lowerName.includes("bank") || lowerName.includes("banc") || lowerName.includes("银行") || lowerName.includes("financial") || lowerName.includes("holding") || lowerName.includes("capital")) return "Financials";
  if (lowerName.includes("tech") || lowerName.includes("software") || lowerName.includes("semi") || lowerName.includes("科技") || lowerName.includes("微") || lowerName.includes("芯片") || lowerName.includes("网络")) return "Technology";
  if (lowerName.includes("health") || lowerName.includes("pharma") || lowerName.includes("bio") || lowerName.includes("医疗") || lowerName.includes("药")) return "Healthcare";
  if (lowerName.includes("energy") || lowerName.includes("oil") || lowerName.includes("gas") || lowerName.includes("能源") || lowerName.includes("石油")) return "Energy";
  if (lowerName.includes("gold") || lowerName.includes("silver") || lowerName.includes("mining") || lowerName.includes("矿") || lowerName.includes("金")) return "Commodities";
  if (lowerName.includes("auto") || lowerName.includes("motor") || lowerName.includes("汽车") || lowerName.includes("车")) return "Consumer Cyclical";
  
  return "Other";
}
