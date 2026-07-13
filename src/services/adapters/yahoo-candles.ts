import type { YahooQuoteIndicators } from "@/types/asset";
import type { TrendDirection } from "@/types/market";
import {
  calculateEMA,
  calculateDMI,
} from "@/features/engine/indicators";
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

    if (
      !isFiniteNumber(open) ||
      !isFiniteNumber(high) ||
      !isFiniteNumber(low) ||
      !isFiniteNumber(close) ||
      high < low
    ) {
      continue;
    }

    const rawVolume = volumes[i];
    const volume = isFiniteNumber(rawVolume) ? rawVolume : 0;
    const timestamp = isFiniteNumber(timestamps[i]) ? timestamps[i] : i;

    candles.push({ open, high, low, close, volume, timestamp });
  }

  return candles;
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
): NormalizedYahooCandle[] {
  if (factor <= 1 || candles.length === 0) return candles;

  const result: NormalizedYahooCandle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const bucket = candles.slice(i, i + factor);
    result.push({
      open: bucket[0].open,
      high: Math.max(...bucket.map((c) => c.high)),
      low: Math.min(...bucket.map((c) => c.low)),
      close: bucket[bucket.length - 1].close,
      volume: bucket.reduce((sum, c) => sum + c.volume, 0),
      timestamp: bucket[bucket.length - 1].timestamp,
    });
  }
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
  if (candles.length < 50) return "sideways";

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const close = closes[closes.length - 1];
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const dmi = calculateDMI(highs, lows, closes);

  if (dmi.adx < SIGNAL_THRESHOLDS.ADX_WEAK_TREND) return "sideways";
  if (close > ema20 && ema20 > ema50 && dmi.plusDI > dmi.minusDI) {
    return "bullish";
  }
  if (close < ema20 && ema20 < ema50 && dmi.minusDI > dmi.plusDI) {
    return "bearish";
  }
  return "sideways";
}
