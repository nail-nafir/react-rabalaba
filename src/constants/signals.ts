/** Signal engine thresholds and scoring configuration */

/** Weighted scoring — each indicator contributes differently based on reliability */
export const SIGNAL_WEIGHTS = {
  EMA_ALIGNMENT: 1.5,
  MACD: 1.0,
  RSI: 1.0,
  ADX_TREND: 1.0,
  VOLUME_SPIKE: 0.75,
  BOLLINGER: 0.75,
  STOCH_RSI: 0.5,
  OBV_DIRECTION: 0.5,
  RSI_DIVERGENCE: 1.0,
  FIBONACCI_BOUNCE: 1.0,
};

export const SIGNAL_THRESHOLDS = {
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  RSI_NEUTRAL_LOW: 40,
  RSI_NEUTRAL_HIGH: 60,
  VOLUME_SPIKE_MULTIPLIER: 1.5,
  LONG_SCORE_THRESHOLD: 3,
  SHORT_SCORE_THRESHOLD: -3,
  /** Computed from the sum of all indicator weights at full strength */
  MAX_SCORE:
    SIGNAL_WEIGHTS.EMA_ALIGNMENT +
    SIGNAL_WEIGHTS.MACD +
    SIGNAL_WEIGHTS.RSI +
    SIGNAL_WEIGHTS.ADX_TREND +
    SIGNAL_WEIGHTS.VOLUME_SPIKE +
    SIGNAL_WEIGHTS.BOLLINGER +
    SIGNAL_WEIGHTS.STOCH_RSI +
    SIGNAL_WEIGHTS.OBV_DIRECTION +
    SIGNAL_WEIGHTS.RSI_DIVERGENCE +
    SIGNAL_WEIGHTS.FIBONACCI_BOUNCE,
  // ADX thresholds
  ADX_STRONG_TREND: 25,
  ADX_WEAK_TREND: 20,
  // Bollinger Bands
  BOLLINGER_PERIOD: 20,
  BOLLINGER_STD_DEV: 2,
  // Stochastic RSI
  STOCH_RSI_OVERSOLD: 20,
  STOCH_RSI_OVERBOUGHT: 80,
};

export const TIER_THRESHOLDS = {
  A: 80,
  B: 60,
};

export const RISK_RULES = {
  LOW_MIN_CONFIDENCE: 75,
  MEDIUM_MIN_CONFIDENCE: 50,
};

export const SIGNAL_COLORS = {
  long: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  short: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  neutral: {
    bg: "bg-zinc-500/15",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
  },
};

export const TREND_COLORS = {
  bullish: { text: "text-emerald-400", icon: "↑" },
  bearish: { text: "text-red-400", icon: "↓" },
  neutral: { text: "text-zinc-400", icon: "→" },
};

export const TIER_COLORS = {
  A: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  B: {
    bg: "bg-slate-400/15",
    text: "text-slate-300",
    border: "border-slate-400/30",
  },
  C: {
    bg: "bg-orange-800/15",
    text: "text-orange-400",
    border: "border-orange-800/30",
  },
};

export const RISK_COLORS = {
  low: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  medium: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  high: { bg: "bg-red-500/15", text: "text-red-400" },
};

export const SIGNAL_FILTER_OPTIONS = [
  { value: "all", label: "All Signals" },
  { value: "long", label: "Buy / Long" },
  { value: "short", label: "Sell / Short" },
  { value: "neutral", label: "Neutral" },
];
