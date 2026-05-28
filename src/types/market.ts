export type TrendDirection = "bullish" | "bearish" | "neutral";

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  trend: TrendDirection;
}

export interface FearGreedData {
  value: number;
  label: string;
  timestamp: number;
  previousClose: number;
  change: number;
}

export interface MarketSummary {
  fearGreed: FearGreedData;
  indices: MarketIndex[];
  lastUpdated: number;
}
