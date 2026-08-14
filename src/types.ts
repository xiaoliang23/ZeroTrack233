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

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number; // Avg cost
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  pnl: number; // Profit/Loss (currentValue - totalCost)
  pnlPercent: number; // (pnl / totalCost) * 100
  dividends?: number; // Total dividends received (USD)
  history?: number[];
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  history?: number[];
}

export type ChartType = "candlestick" | "area" | "hollow" | "ohlc";

export type TimeRange = "1D" | "1W" | "1M" | "1Y";

export interface AIAnalysisResult {
  analysis: string;
}

export interface PortfolioHistoryItem {
  time: string;
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalDividends: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: "above" | "below";
  isActive: boolean;
  triggered: boolean;
}

export interface QuarterlyFinancial {
  period: string; // e.g. "2024 Q3"
  revenue: number; // in Billions USD
  netIncome: number; // in Billions USD
  eps: number;
  grossMargin: number; // Percentage
  operatingCashFlow: number; // in Billions USD
}

export interface CompanyFinancials {
  symbol: string;
  name: string;
  marketCap: number; // in Billions USD
  peRatio: number;
  forwardPE: number;
  pbRatio: number;
  psRatio: number;
  epsTTM: number;
  revenueTTM: number; // in Billions USD
  revenueGrowthYoY: number; // Percentage
  netIncomeTTM: number; // in Billions USD
  grossMargin: number; // Percentage
  operatingMargin: number; // Percentage
  netMargin: number; // Percentage
  freeCashFlow: number; // in Billions USD
  debtToEquity: number;
  dividendYield: number; // Percentage
  nextEarningsDate: string;
  earningsCallHighlight?: string;
  quarterlyHistory: QuarterlyFinancial[];
}

export interface SuperinvestorHolding {
  symbol: string;
  name: string;
  weight: number; // Percentage of portfolio
  valueUsd: number; // in Billions USD
  shares: number; // in Millions
  action: "BUY" | "ADD" | "HOLD" | "REDUCE" | "SELL";
  changePercent?: number;
}

export interface Superinvestor {
  id: string;
  name: string;
  fundName: string;
  avatar: string;
  portfolioValue: number; // in Billions USD
  cashReservePercent: number;
  topHoldings: SuperinvestorHolding[];
  philosophy: string;
  recentMoveSummary: string;
  filingDate: string;
}

export interface SectorMetric {
  name: string;
  nameEn: string;
  change1D: number;
  change1M: number;
  weight: number;
  topStock: string;
  leaderChange: number;
}

export interface MacroIndicator {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  unit: string;
  description: string;
  status: "bullish" | "bearish" | "neutral";
}

export interface FearAndGreedData {
  score: number; // 0 - 100
  rating: "极度恐慌" | "恐慌" | "中性" | "贪婪" | "极度贪婪";
  previousClose: number;
  oneWeekAgo: number;
  oneMonthAgo: number;
}

export interface MacroMarketData {
  fearAndGreed: FearAndGreedData;
  indicators: MacroIndicator[];
  sectors: SectorMetric[];
  marketBreadth: {
    advancingCount: number;
    decliningCount: number;
    unchangedCount: number;
    newHighs52W: number;
    newLows52W: number;
  };
}

export interface NewsItem {
  id?: string;
  title: string;
  publisher: string;
  providerPublishTime: number;
  link: string;
  summary?: string;
  fullContent?: string;
  sentiment?: "bullish" | "bearish" | "neutral";
  category?: "ALL" | "EARNINGS" | "SUPERINVESTOR" | "MACRO" | "QUANT";
  tags?: string[];
}
