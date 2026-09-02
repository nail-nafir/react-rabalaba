import type { YahooChartResult } from "../api/yahoo-finance";
import type { UnifiedAsset, AssetType, TradingPlan } from "@/types/asset";
import { computeSignal, createUnavailableSignal } from "@/core/engine/signals";
import type { Outlook } from "@/types/engine";
import {
  canonicalTimeframe,
  HIGHER_TIMEFRAME_FACTOR,
  resolveTimeframePreset,
} from "@/constants/timeframes";
import { computeTradingPlan } from "@/core/engine/trading-plan";
import {
  buildSignalSeriesFromCandles,
  candleClosedAt,
  closedCandlesForSignal,
  intervalSeconds,
  normalizeYahooCandles,
  resampleCandles,
  deriveCandleTrendState,
} from "@/core/market/candles";

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
): UnifiedAsset | null {
  if (!result) return null;

  const { meta } = result;
  const quote = result.indicators?.quote?.[0];

  const timeframeKey = canonicalTimeframe(
    resolveTimeframePreset(meta.range, meta.dataGranularity),
  );
  const currentPrice = meta.regularMarketPrice ?? 0;
  const volume = meta.regularMarketVolume ?? 0;
  const assetType = detectAssetType(meta.symbol, meta.instrumentType);

  // Normalize candles ONCE — reused for change%, signal computation and UI.
  const candles = quote
    ? normalizeYahooCandles(quote, result.timestamp, { requirePhysical: true })
    : [];
  const signalCandles = closedCandlesForSignal(candles, {
    interval: meta.dataGranularity,
    regularSessionEnd: meta.currentTradingPeriod?.regular?.end,
  });
  const decisionCandle = signalCandles[signalCandles.length - 1];
  const decisionCandleClosedAt = decisionCandle
    ? candleClosedAt(decisionCandle, {
        interval: meta.dataGranularity,
        regularSessionEnd: meta.currentTradingPeriod?.regular?.end,
      })
    : null;
  const candleSeconds = intervalSeconds(meta.dataGranularity);
  const executionCandle =
    decisionCandleClosedAt == null || !decisionCandle
      ? undefined
      : candles.find(
          (candle) =>
            candle.timestamp >= decisionCandleClosedAt &&
            (candleSeconds == null ||
              candle.timestamp >= decisionCandle.timestamp + candleSeconds),
        );

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

  if (signalCandles.length > 0) {
    const signalSeries = buildSignalSeriesFromCandles(signalCandles);
    // Multi-timeframe confirmation: derive the higher-timeframe trend by
    // resampling the already-fetched candles (no extra network request).
    const htfFactor = HIGHER_TIMEFRAME_FACTOR[timeframeKey];
    const higherTimeframe = deriveCandleTrendState(
      resampleCandles(signalCandles, htfFactor, {
        includeTrailingPartial: false,
      }),
    );

    // Compute signal from complete, index-aligned candles. The engine itself
    // decides whether the sample is deep enough for an actionable LONG/SHORT.
    outlook = computeSignal({
      ...signalSeries,
      assetType,
      timeframe: timeframeKey,
      higherTimeframeTrend: higherTimeframe.trend,
      higherTimeframeReady: higherTimeframe.ready,
    });

    if (outlook.signal !== "neutral" && executionCandle) {
      tradingPlan = computeTradingPlan(outlook, executionCandle.open, assetType);
    }
  }

  if (!outlook) {
    outlook = createUnavailableSignal();
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
    timeframe: timeframeKey,
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
    decisionCandleOpenAt:
      decisionCandle != null ? decisionCandle.timestamp * 1000 : undefined,
    decisionCandleClosedAt:
      decisionCandleClosedAt != null
        ? decisionCandleClosedAt * 1000
        : undefined,
    executionCandleOpenAt:
      executionCandle != null ? executionCandle.timestamp * 1000 : undefined,
  };
}
