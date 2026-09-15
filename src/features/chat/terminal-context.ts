export const MAX_RESEARCH_CONTEXT_CANDLES = 50;

export type ResearchCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

export type ResearchPosition = {
  id: string;
  signal: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfits: number[];
  riskRewardRatio: number;
  strengthAtEntry: number;
  grade?: string;
  regime?: string;
  higherTimeframeTrend?: string;
  directionScore?: number;
  followedAt: number;
  highestTpReached: number;
  status: string;
  exitReason?: string;
  reversed?: boolean;
  closePrice?: number;
  closedAt?: number;
  pnl: { pct: number; r: number };
  progress: {
    lifecycle: string;
    tpReached: number;
    tpSecured: number;
    tpTotal: number;
    slHit: boolean;
    exitReason?: string;
  };
};

export interface TerminalResearchContext {
  kind: "asset" | "trade";
  capturedAt: number;
  symbol: string;
  name: string;
  assetType: string;
  price: number;
  changePercent: number;
  quoteTime: number | null;
  timeframe: string;
  signalStatus?: string;
  outlook: unknown;
  tradingPlan: unknown;
  overlays: Record<string, unknown>;
  marketContext: Record<string, unknown>;
  backtest: unknown;
  recentCandles: ResearchCandle[];
  position?: ResearchPosition;
}
