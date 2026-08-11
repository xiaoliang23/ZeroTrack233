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
