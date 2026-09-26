export const MAX_RESEARCH_CONTEXT_CANDLES = 50;

const RESEARCH_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

export function formatResearchTimestamp(timestamp: number | null): string {
  if (timestamp === null || !Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? ""
    : `${RESEARCH_TIMESTAMP_FORMATTER.format(date)} WIB`;
}

export type ResearchCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

export type PageResearchContext =
  | {
      kind: "calendar";
      selectedDate: string | null;
      filters: {
        impact: string;
        currency: string;
        asset: string;
        timeHorizon: string;
        search: string;
      };
      events: Array<{
        title: string;
        country: string;
        date: string;
        time: string;
        impact: string;
        forecast?: string;
        previous?: string;
        actual?: string;
        assetRelevance: string[];
      }>;
    }
  | {
      kind: "calculator";
      currency: "USD" | "IDR";
      direction: "long" | "short" | "invalid";
      entry: number;
      stopLoss: number;
      target: number;
      riskPercent: number;
      riskRewardRatio: number;
      stopPercentDistance: number;
      targetPercentDistance: number;
      breakevenWinrate: number;
      isValid: boolean;
    }
  | {
      kind: "learn";
      activeTab: string;
      category: string;
      bias: string;
      search: string;
      topics: string[];
    };

export type MarketResearchContext = {
  source: "Yahoo Finance";
  symbol: string;
  name: string;
  assetType: string;
  price: number;
  changePercent: number;
  quoteTime: number | null;
  capturedAt: number;
  stale: boolean;
  timeframe: string;
  signalStatus?: string;
  outlook: unknown;
  tradingPlan: unknown;
  recentCandles: ResearchCandle[];
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
