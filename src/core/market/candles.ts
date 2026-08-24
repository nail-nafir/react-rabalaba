import type { YahooQuoteIndicators } from "@/types/asset";
import type { TrendDirection } from "@/types/market";
import { calculateEMA, calculateDMI } from "@/core/engine/indicators";
import { SIGNAL_THRESHOLDS } from "@/constants/signals";

export interface NormalizedYahooCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface SignalSeries {
  prices: number[];
  volumes: number[];
  highPrices: number[];
  lowPrices: number[];
  periodHigh: number;
  periodLow: number;
}

export interface HigherTimeframeState {
  trend: TrendDirection;
  ready: boolean;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Normalize Yahoo OHLCV data by candle index.
 *
 * Yahoo sometimes returns null in only one field (for example volume or open).
 * Filtering close/high/low/volume independently breaks candle alignment and can
 * make ADX, ATR, OBV, support, and resistance read different candles. This
 * helper zips by index first, keeps only valid OHLC rows, and uses 0 volume
 * when volume is missing so price-only assets can still be analyzed.
 */
export function normalizeYahooCandles(
  quote: YahooQuoteIndicators | null | undefined,
  timestamps: number[] = [],
  options: { requireTimestamps?: boolean; requirePhysical?: boolean } = {},
): NormalizedYahooCandle[] {
  if (
    !quote ||
    !Array.isArray(quote.open) ||
    !Array.isArray(quote.high) ||
    !Array.isArray(quote.low) ||
    !Array.isArray(quote.close)
  ) {
    return [];
  }

  const candles: NormalizedYahooCandle[] = [];
  const length = quote.close.length;
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];

  for (let i = 0; i < length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];

    const timestamp =
      isFiniteNumber(timestamps[i]) && timestamps[i] > 0 ? timestamps[i] : null;

    if (
      !isFiniteNumber(open) ||
      !isFiniteNumber(high) ||
      !isFiniteNumber(low) ||
      !isFiniteNumber(close) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0 ||
      high < low ||
      (options.requirePhysical &&
        (high < Math.max(open, close) || low > Math.min(open, close))) ||
      (options.requireTimestamps && timestamp == null)
    ) {
      continue;
    }

    const rawVolume = volumes[i];
    const volume = isFiniteNumber(rawVolume) && rawVolume >= 0 ? rawVolume : 0;

    candles.push({ open, high, low, close, volume, timestamp: timestamp ?? i });
  }

  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles.filter(
    (candle, index) =>
      index === 0 || candle.timestamp !== candles[index - 1].timestamp,
  );
}

/** Convert Yahoo interval labels to seconds. Unknown intervals fail closed. */
export function intervalSeconds(interval?: string): number | null {
  const match = interval?.match(/^(\d+)(m|h|d|wk)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60 : unit === "h" ? 3600 : unit === "d" ? 86400 : 604800;
  return amount > 0 ? amount * multiplier : null;
}

/**
 * Keep only candles whose full interval has elapsed. Every candle followed by a
 * newer candle is necessarily complete; only the trailing bar needs a clock
 * check. A regular-session end can shorten the final intraday bar.
 */
export function closedCandlesForSignal(
  candles: NormalizedYahooCandle[],
  options: { interval?: string; nowSeconds?: number; regularSessionEnd?: number } = {},
): NormalizedYahooCandle[] {
  if (candles.length === 0) return candles;
  const seconds = intervalSeconds(options.interval);
  if (seconds == null) return candles.slice(0, -1);

  const last = candles[candles.length - 1];
  let closesAt = last.timestamp + seconds;
  if (
    typeof options.regularSessionEnd === "number" &&
    options.regularSessionEnd > last.timestamp
  ) {
    closesAt = Math.min(closesAt, options.regularSessionEnd);
  }
  const now = options.nowSeconds ?? Date.now() / 1000;
  return now >= closesAt ? candles : candles.slice(0, -1);
}

/**
 * Convert normalized candles into the array-based SignalInput shape.
 * The support/resistance period uses the latest 20 complete candles, matching
 * the original engine behavior while preserving OHLC alignment.
 */
export function buildSignalSeriesFromCandles(
  candles: NormalizedYahooCandle[],
): SignalSeries {
  const prices = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const highPrices = candles.map((candle) => candle.high);
  const lowPrices = candles.map((candle) => candle.low);
  const recentCandles = candles.slice(-20);

  return {
    prices,
    volumes,
    highPrices,
    lowPrices,
    periodHigh:
      recentCandles.length > 0
        ? Math.max(...recentCandles.map((candle) => candle.high))
        : 0,
    periodLow:
      recentCandles.length > 0
        ? Math.min(...recentCandles.map((candle) => candle.low))
        : 0,
  };
}

/**
 * Resample candles into a higher timeframe by bucketing `factor` consecutive
 * candles into one (open=first, high=max, low=min, close=last, volume=sum).
 * Used for multi-timeframe confirmation without an extra network fetch.
 * A trailing partial bucket is included so the latest HTF state is reflected.
 */
export function resampleCandles(
  candles: NormalizedYahooCandle[],
  factor: number,
  options: { includeTrailingPartial?: boolean } = {},
): NormalizedYahooCandle[] {
  if (factor <= 1 || candles.length === 0) return candles;

  const result: NormalizedYahooCandle[] = [];
  const gaps = candles
    .slice(1)
    .map((candle, index) => candle.timestamp - candles[index].timestamp)
    .filter((gap) => gap > 0);
  const baseGap =
    gaps.length > 0
      ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      : 0;
  let bucket: NormalizedYahooCandle[] = [];
  const flush = (trailing = false) => {
    if (bucket.length === 0) return;
    if (
      trailing &&
      options.includeTrailingPartial === false &&
      bucket.length < factor
    ) {
      bucket = [];
      return;
    }
    result.push({
      open: bucket[0].open,
      high: Math.max(...bucket.map((c) => c.high)),
      low: Math.min(...bucket.map((c) => c.low)),
      close: bucket[bucket.length - 1].close,
      volume: bucket.reduce((sum, c) => sum + c.volume, 0),
      timestamp: bucket[bucket.length - 1].timestamp,
    });
    bucket = [];
  };
  for (const candle of candles) {
    const previous = bucket[bucket.length - 1];
    const sessionGap =
      previous &&
      baseGap > 0 &&
      candle.timestamp - previous.timestamp > baseGap * 1.5;
    if (sessionGap || bucket.length >= factor) flush();
    bucket.push(candle);
  }
  flush(true);
  return result;
}

/**
 * Resample candles into calendar-daily bars by bucketing on UTC date
 * (open=first, high=max, low=min, close=last, volume=sum, timestamp=last).
 *
 * resampleCandles buckets by COUNT, which drifts across session gaps; flow
 * math (A/D, CMF, MFI) needs a stable per-day unit instead. UTC-date bucketing
 * is exact for .JK: the IDX session (02:00–09:00 UTC) never crosses UTC
 * midnight. Input that is already daily passes through ~1:1. Timestamps are
 * epoch seconds (Yahoo convention).
 */
export function resampleCandlesToDaily(
  candles: NormalizedYahooCandle[],
): NormalizedYahooCandle[] {
  if (candles.length === 0) return candles;

  const result: NormalizedYahooCandle[] = [];
  let currentDay = "";
  for (const candle of candles) {
    const day = new Date(candle.timestamp * 1000).toISOString().slice(0, 10);
    if (day === currentDay) {
      // Mutates only the local clone pushed below — input stays untouched.
      const bucket = result[result.length - 1];
      bucket.high = Math.max(bucket.high, candle.high);
      bucket.low = Math.min(bucket.low, candle.low);
      bucket.close = candle.close;
      bucket.volume += candle.volume;
      bucket.timestamp = candle.timestamp;
    } else {
      currentDay = day;
      result.push({ ...candle });
    }
  }
  return result;
}

/**
 * Derive a coarse trend direction from a candle series using EMA alignment and
 * DMI sign — the same logic the engine uses for its own trend, applied to a
 * higher timeframe for multi-timeframe confirmation.
 */
export function deriveCandleTrend(
  candles: NormalizedYahooCandle[],
): TrendDirection {
  return deriveCandleTrendState(candles).trend;
}

export function deriveCandleTrendState(
  candles: NormalizedYahooCandle[],
): HigherTimeframeState {
  if (candles.length < 50) return { trend: "sideways", ready: false };

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const close = closes[closes.length - 1];
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const dmi = calculateDMI(highs, lows, closes);

  if (dmi.adx < SIGNAL_THRESHOLDS.ADX_WEAK_TREND) {
    return { trend: "sideways", ready: true };
  }
  if (close > ema20 && ema20 > ema50 && dmi.plusDI > dmi.minusDI) {
    return { trend: "bullish", ready: true };
  }
  if (close < ema20 && ema20 < ema50 && dmi.minusDI > dmi.plusDI) {
    return { trend: "bearish", ready: true };
  }
  return { trend: "sideways", ready: true };
}
