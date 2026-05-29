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
  /** Max share of zero/missing-volume candles (in the recent window) tolerated
   *  before OBV and volume-spike confirmation are disabled. Crypto feeds (e.g.
   *  Yahoo) frequently return volume:0, which fakes spikes and corrupts OBV. */
  ZERO_VOLUME_MAX_RATIO: 0.3,
  /** Recent candle window used to measure volume reliability. */
  VOLUME_RELIABILITY_WINDOW: 50,
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

/** Market regime classification thresholds (Layer 1). */
export const REGIME_THRESHOLDS = {
  /** Bollinger bandwidth (% of middle band) below this = compression/squeeze. */
  SQUEEZE_BANDWIDTH_PERCENT: 3,
  /** ADX below this counts as non-trending for squeeze detection. */
  SQUEEZE_MAX_ADX: 20,
};

/** Maximum raw (unsigned) contribution each category can accumulate, derived
 *  from the indicator weights it owns. Used to normalize categories to [-1..1]. */
export const CATEGORY_MAX_SCORE = {
  trend:
    SIGNAL_WEIGHTS.EMA_ALIGNMENT +
    SIGNAL_WEIGHTS.MACD +
    SIGNAL_WEIGHTS.ADX_TREND,
  momentum:
    SIGNAL_WEIGHTS.RSI +
    SIGNAL_WEIGHTS.STOCH_RSI +
    SIGNAL_WEIGHTS.RSI_DIVERGENCE,
  volatility: SIGNAL_WEIGHTS.BOLLINGER + SIGNAL_WEIGHTS.FIBONACCI_BOUNCE,
  volume: SIGNAL_WEIGHTS.OBV_DIRECTION + SIGNAL_WEIGHTS.VOLUME_SPIKE,
};

/** Base category weights. Correlated indicators live in the same category, so
 *  trend is no longer counted multiple times across EMA/MACD/ADX. */
export const CATEGORY_BASE_WEIGHTS = {
  trend: 0.4,
  momentum: 0.3,
  volatility: 0.2,
  volume: 0.1,
};

/** Per-regime multipliers applied to the base category weights. Indicators
 *  perform differently per regime: trend tools dominate trends, oscillators
 *  dominate ranges, and momentum is de-emphasized in volatility expansion. */
export const REGIME_WEIGHT_MULTIPLIERS = {
  trending: { trend: 1.5, momentum: 0.8, volatility: 0.8, volume: 1.0 },
  ranging: { trend: 0.5, momentum: 1.5, volatility: 1.5, volume: 1.0 },
  high_volatility: { trend: 1.0, momentum: 0.6, volatility: 1.2, volume: 1.0 },
  low_volatility: { trend: 1.0, momentum: 1.0, volatility: 1.0, volume: 1.0 },
};

/** |directionScore| at/above which a counter-trend signal is allowed through. */
export const DIRECTION_OVERRIDE_SCORE = 0.6;

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
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  neutral: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
};

/** Signal display labels (signal neutral = no actionable trade). */
export const SIGNAL_LABELS = {
  long: "Long",
  short: "Short",
  neutral: "Neutral",
};

export const TREND_DISPLAY = {
  bullish: { label: "Bullish", text: "text-emerald-400" },
  bearish: { label: "Bearish", text: "text-rose-400" },
  sideways: { label: "Sideways", text: "text-amber-400" },
};

export const TIER_COLORS = {
  A: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  B: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  C: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
};

export const RISK_COLORS = {
  low: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  medium: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  high: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
};

/** Badge colors per market regime (distinct from the directional signal/trend
 *  hues so they aren't read as bullish/bearish). */
export const REGIME_COLORS = {
  trending: {
    bg: "bg-primary/15",
    text: "text-primary",
    border: "border-primary/30",
  },
  ranging: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  high_volatility: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  low_volatility: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
};

export const SIGNAL_FILTER_OPTIONS = [
  { value: "all", label: "All Signals" },
  { value: "long", label: "Buy / Long" },
  { value: "short", label: "Sell / Short" },
  { value: "neutral", label: "Neutral" },
];
