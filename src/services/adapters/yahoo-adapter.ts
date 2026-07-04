import type { YahooChartResult } from "../api/yahoo-finance";
import type { UnifiedAsset, AssetType, TradingPlan } from "@/types/asset";
import {
  computeSignal,
  createUnavailableSignal,
} from "@/features/engine/signals";
import type { Outlook } from "@/features/engine/signals";
import { resolveTimeframePreset } from "@/constants/timeframes";
import type { TimeframePresetKey } from "@/constants/timeframes";
import { computeTradingPlan } from "@/features/engine/trading-plan";
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

  // Fear & Greed (alternative.me) is a CRYPTO sentiment index. Applying it to
  // stocks/forex/commodities is misleading, so scope it to crypto only.
  const effectiveFearGreed =
    assetType === "crypto" ? fearGreedValue : undefined;

  // Normalize candles ONCE — reused for change%, signal computation and UI.
  const candles = quote ? normalizeYahooCandles(quote, result.timestamp) : [];

  // Daily change baseline is CONVENTION-DEPENDENT per market:
  //  - equities/forex/commodities: vs the previous SESSION close (Yahoo's
  //    previousClose — never chartPreviousClose, which is the close before the
  //    requested range start, i.e. potentially a month old).
  //  - crypto trades 24/7, so its convention is a ROLLING 24h window (what
  //    Binance/CoinGecko show). Yahoo's previousClose for crypto is the last
  //    UTC-midnight close (a 0-24h-old baseline, understating/overstating the
  //    move) and for some young coins it's outright garbage (near-zero →
  //    +1,000,000% readings). Derive it from the candle record instead: the
  //    last close at/before 24h ago, falling back to the meta chain only when
  //    the candles don't reach back that far.
  const metaPreviousClose =
    meta.previousClose ??
    meta.regularMarketPreviousClose ??
    meta.chartPreviousClose ??
    currentPrice;

  let previousClose = metaPreviousClose;
  if (assetType === "crypto") {
    const refSec =
      typeof meta.regularMarketTime === "number"
        ? meta.regularMarketTime
        : candles.length > 0
          ? candles[candles.length - 1].timestamp
          : null;
    if (refSec != null) {
      const target = refSec - 24 * 60 * 60;
      let rolling: number | null = null;
      for (const candle of candles) {
        if (candle.timestamp > target) break;
        if (Number.isFinite(candle.close) && candle.close > 0) {
          rolling = candle.close;
        }
      }
      if (rolling != null) previousClose = rolling;
    }
  }

  const changePercent =
    previousClose > 0
      ? ((currentPrice - previousClose) / previousClose) * 100
      : 0;

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
      fearGreedValue: effectiveFearGreed,
      higherTimeframeTrend,
    });

    if (outlook.signal !== "neutral") {
      tradingPlan = computeTradingPlan(outlook, currentPrice, assetType);
    }
  }

  if (!outlook) {
    outlook = createUnavailableSignal(effectiveFearGreed);
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
    // Quote freshness (epoch ms). The auto-journal cron uses this to reject
    // stale snapshots instead of journaling a trade off hours-old data.
    quoteTime:
      typeof meta.regularMarketTime === "number"
        ? meta.regularMarketTime * 1000
        : undefined,
  };
}
