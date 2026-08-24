export interface SignalProfile {
  /** Minimum candle count before the engine can emit LONG/SHORT.
   *  Below this, data is too shallow for reliable indicators (e.g. EMA50). */
  minCandles: number;
  /** Regime-weighted directionScore (|value| in 0..1) required to emit a
   *  directional signal. */
  directionThreshold: number;
}

export interface TimeframePreset {
  range: string;
  interval: string;
  label: string;
  description: string;
  /** Signal engine thresholds — how aggressive/conservative the engine
   *  should be for this data resolution. */
  signalProfile: SignalProfile;
}

export const TIMEFRAME_PRESETS = {
  /** Intraday scalping — 5-min candles are noisy, so the engine demands
   *  more indicator confluence (3.75) before emitting a directional signal. */
  scalp: {
    range: "1d",
    interval: "5m",
    label: "Scalp",
    description: "1 Day / 5min candles",
    signalProfile: {
      minCandles: 120,
      directionThreshold: 0.4,
    },
  },
  /** Swing trading (DEFAULT) — 1-hour candles give decent trend resolution.
   *  EMA50 needs ≥50 candles; threshold at 3.25 balances signal quality
   *  vs. responsiveness. */
  swing: {
    range: "60d",
    interval: "1h",
    label: "Swing",
    description: "60 Days / 1h candles",
    signalProfile: {
      minCandles: 120,
      directionThreshold: 0.3,
    },
  },
  /** Position trading — daily candles are smoother but each bar represents
   *  a full session, so trends develop slower. Same thresholds as swing
   *  but needs 80+ candles of history for meaningful ADX/DMI. */
  position: {
    range: "6mo",
    interval: "1d",
    label: "Position",
    description: "6 Months / Daily candles",
    signalProfile: {
      minCandles: 120,
      directionThreshold: 0.3,
    },
  },
} as const satisfies Record<string, TimeframePreset>;

export type TimeframePresetKey = keyof typeof TIMEFRAME_PRESETS;

/** Higher-timeframe resampling without an additional network request. */
export const HIGHER_TIMEFRAME_FACTOR: Record<TimeframePresetKey, number> = {
  scalp: 12,
  swing: 4,
  position: 5,
};

/** Default timeframe for all market data fetching — 60 days, 1h candles. */
export const DEFAULT_TIMEFRAME: TimeframePreset = TIMEFRAME_PRESETS["swing"];

/**
 * Resolves raw range + interval strings (e.g. from Yahoo meta) back to a
 * preset key. Falls back to "swing" when no exact match is found.
 */
export function resolveTimeframePreset(
  range?: string,
  interval?: string,
): TimeframePresetKey {
  for (const [key, preset] of Object.entries(TIMEFRAME_PRESETS)) {
    if (preset.range === range && preset.interval === interval) {
      return key as TimeframePresetKey;
    }
  }
  // Default: swing (60d/1h)
  return "swing";
}

/** Canonical storage/UI label for Yahoo ranges and legacy persisted labels. */
export function canonicalTimeframe(value?: string): TimeframePresetKey {
  if (value === "scalp" || value === "swing" || value === "position") {
    return value;
  }
  if (value === "1d/position" || value === "1d") return "position";
  return "swing";
}
