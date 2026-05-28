import type { YahooQuoteIndicators } from "@/types/asset";

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
  if (!quote) return [];

  const candles: NormalizedYahooCandle[] = [];
  const length = quote.close.length;

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

    const rawVolume = quote.volume[i];
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
