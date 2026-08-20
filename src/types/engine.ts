import type { AssetType } from "@/constants/taxonomy/asset";
import type { RiskLevel } from "@/constants/taxonomy/risk";
import type { SignalDirection } from "@/constants/taxonomy/signal";
import type { SignalTier } from "@/constants/taxonomy/tier";
import type { ObvTrend, RsiDivergence } from "@/constants/taxonomy/indicator";
import type { MarketRegime, TrendDirection } from "@/types/market";

/** Engine interpolation values stay serializable and i18n-free. */
export type AnalysisParam = string | number | { tkey: string };

/** Localizable analysis descriptor emitted by the pure signal engine. */
export interface AnalysisText {
  key: string;
  params?: Record<string, AnalysisParam>;
}

export interface SignalInput {
  prices: number[];
  volumes: number[];
  highPrices: number[];
  lowPrices: number[];
  periodHigh: number;
  periodLow: number;
  assetType?: AssetType;
  timeframe?: import("@/constants/timeframes").TimeframePresetKey;
  higherTimeframeTrend?: TrendDirection;
}

export interface SignalReasons {
  bullish: string[];
  bearish: string[];
  warnings: string[];
}

export interface SignalDataQuality {
  candleCount: number;
  ready: boolean;
  missingVolume: boolean;
  volumeReliable: boolean;
}

export interface Outlook {
  signal: SignalDirection;
  strength: number;
  technicalAlignment: "strong" | "moderate" | "weak";
  tier: SignalTier;
  suppressed: boolean;
  risk: RiskLevel;
  trend: TrendDirection;
  regime: MarketRegime;
  higherTimeframeTrend: TrendDirection;
  directionScore: number;
  categoryScores: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
  };
  reasons: SignalReasons;
  dataQuality: SignalDataQuality;
  indicators: {
    rsi: number;
    ema20: number;
    ema50: number;
    ema200: number;
    macd: { macdLine: number; signalLine: number; histogram: number };
    volumeMA: number;
    volumeSpike: boolean;
    support: number;
    resistance: number;
    recentSwingHigh: number;
    recentSwingLow: number;
    bollingerBands: {
      upper: number;
      middle: number;
      lower: number;
      percentB: number;
    };
    stochRSI: number;
    adx: number;
    plusDI: number;
    minusDI: number;
    atr: number;
    obvTrend: ObvTrend;
    rsiDivergence: RsiDivergence;
    fibLevels: { 0.382: number; 0.5: number; 0.618: number };
  };
  analysis: {
    trend: AnalysisText;
    volume: AnalysisText;
    momentum: AnalysisText;
  };
}
