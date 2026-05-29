export interface SignalProfile {
  /** Minimum candle count before the engine can emit LONG/SHORT.
   *  Below this, data is too shallow for reliable indicators (e.g. EMA50). */
  minCandles: number;
  /** Weighted score must reach this to emit a LONG signal.
   *  Higher = more confirmations needed = fewer false positives. */
  longThreshold: number;
  /** Weighted score must drop below this to emit a SHORT signal. */
  shortThreshold: number;
  /** Regime-weighted directionScore (|value| in 0..1) required to emit a
   *  directional signal. Replaces the legacy flat-score thresholds. */
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
      longThreshold: 3.75,
      shortThreshold: -3.75,
      directionThreshold: 0.4,
    },
  },
  /** Swing trading (DEFAULT) — 1-hour candles give decent trend resolution.
   *  EMA50 needs ≥50 candles; threshold at 3.25 balances signal quality
   *  vs. responsiveness. */
  swing: {
    range: "1mo",
    interval: "1h",
    label: "Swing",
    description: "1 Month / 1h candles",
    signalProfile: {
      minCandles: 120,
      longThreshold: 3.25,
      shortThreshold: -3.25,
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
      longThreshold: 3.25,
      shortThreshold: -3.25,
      directionThreshold: 0.3,
    },
  },
} as const satisfies Record<string, TimeframePreset>;

export type TimeframePresetKey = keyof typeof TIMEFRAME_PRESETS;

/** Default timeframe for all market data fetching — 1 month range, 1h candles */
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
  // Default: swing (1mo/1h)
  return "swing";
}
