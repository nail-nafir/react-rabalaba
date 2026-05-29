import type { YahooChartResult } from "../api/yahoo-finance";
import type {
  UnifiedAsset,
  AssetType,
  TradingPlan,
} from "@/types/asset";
import { computeSignal, createUnavailableSignal } from "@/features/signals/engine/signal-engine";
import type { Outlook } from "@/features/signals/engine/signal-engine";
import { resolveTimeframePreset } from "@/constants/timeframes";
import type { TimeframePresetKey } from "@/constants/timeframes";
import { computeTradingPlan } from "@/features/signals/engine/trading-plan";
import {
  buildSignalSeriesFromCandles,
  normalizeYahooCandles,
  resampleCandles,
  deriveCandleTrend,
} from "./yahoo-candles";

/** Higher-timeframe resample factor per active timeframe (no extra fetch):
 *  scalp 5m→1h (×12), swing 1h→4h (×4), position 1d→~1w (×5 trading days). */
const HTF_RESAMPLE_FACTOR: Record<TimeframePresetKey, number> = {
  scalp: 12,
  swing: 4,
  position: 5,
};

function detectAssetType(symbol: string, instrumentType?: string): AssetType {
  const sym = symbol.toUpperCase();
  if (sym.endsWith(".JK")) return "id-stock";
  if (
    sym.includes("=F") ||
    sym === "GC=F" ||
    sym === "SI=F" ||
    sym === "CL=F" ||
    sym === "NG=F" ||
    sym === "HG=F"
  )
    return "commodity";
  if (instrumentType === "CRYPTOCURRENCY" || sym.includes("-USD"))
    return "crypto";
  if (sym.endsWith("=X") || instrumentType === "FOREX") return "forex";
  return "us-stock";
}

export function adaptYahooChart(
  result: YahooChartResult | null | undefined,
  fearGreedValue?: number,
): UnifiedAsset | null {
  if (!result) return null;

  const { meta } = result;
  const quote = result.indicators?.quote?.[0];

  const timeframe = meta.range ?? "1d";
  const currentPrice = meta.regularMarketPrice ?? 0;
  const volume = meta.regularMarketVolume ?? 0;
  const assetType = detectAssetType(meta.symbol, meta.instrumentType);

  // IMPORTANT: For daily percentage change, we MUST use previousClose (yesterday's close)
  // instead of chartPreviousClose (which is the close before the requested range start).
  const previousClose =
    meta.previousClose ??
    meta.regularMarketPreviousClose ??
    meta.chartPreviousClose ??
    currentPrice;

  const changePercent =
    previousClose > 0
      ? ((currentPrice - previousClose) / previousClose) * 100
      : 0;

  // Normalize candles ONCE — reused for both signal computation and UI rendering.
  const candles = quote
    ? normalizeYahooCandles(quote, result.timestamp)
    : [];

  let outlook: Outlook | null = null;
  let tradingPlan: TradingPlan | null = null;

  if (candles.length > 0) {
    const signalSeries = buildSignalSeriesFromCandles(candles);
    const timeframeKey = resolveTimeframePreset(
      meta.range,
      meta.dataGranularity,
    );

    // Multi-timeframe confirmation: derive the higher-timeframe trend by
    // resampling the already-fetched candles (no extra network request).
    const htfFactor = HTF_RESAMPLE_FACTOR[timeframeKey];
    const higherTimeframeTrend = deriveCandleTrend(
      resampleCandles(candles, htfFactor),
    );

    // Compute signal from complete, index-aligned candles. The engine itself
    // decides whether the sample is deep enough for an actionable LONG/SHORT.
    outlook = computeSignal({
      ...signalSeries,
      assetType,
      timeframe: timeframeKey,
      fearGreedValue,
      higherTimeframeTrend,
    });

    if (outlook.signal !== "neutral") {
      tradingPlan = computeTradingPlan(outlook, currentPrice, assetType);
    }
  }
  
  if (!outlook) {
    outlook = createUnavailableSignal(fearGreedValue);
    // If we have price change but no full signal, we can still set a basic trend
    if (changePercent > 1) {
      outlook.trend = "bullish";
    } else if (changePercent < -1) {
      outlook.trend = "bearish";
    }
  }

  // Use day high/low from meta, fallback to indicators or price if not present
  const high24h =
    meta.regularMarketDayHigh ??
    (candles.length > 0
      ? Math.max(...candles.map((candle) => candle.high))
      : currentPrice);
  const low24h =
    meta.regularMarketDayLow ??
    (candles.length > 0
      ? Math.min(...candles.map((candle) => candle.low))
      : currentPrice);

  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || meta.symbol,
    assetType,
    quoteIndicators: quote,
    price: currentPrice,
    timeframe: timeframe,
    volume: volume,
    outlook,
    tradingPlan,
    changePercent,
    high24h,
    low24h,
    timestamps: result.timestamp,
  };
}
