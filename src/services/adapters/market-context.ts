import { DEFAULT_COMMODITY_TICKERS } from "@/constants/assets";
import { IDX_BENCHMARK_SYMBOL } from "@/constants/idx";
import {
  DXY_SYMBOL,
  VIX_SYMBOL,
} from "@/constants/us";
import { computeWindowReturns } from "@/features/engine/relative-strength";
import type { UnifiedAsset } from "@/types/asset";
import type {
  Dominance,
  MarketContextByAssetClass,
  MarketContextDirection,
  QuoteMarketContext,
  RealizedVolatilityMarketContext,
} from "@/types/market";
import type { YahooChartResult } from "@/services/api/yahoo-finance";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
  type NormalizedYahooCandle,
} from "@/services/adapters/yahoo-candles";

/** 30-day window mirrors the CBOE VIX horizon so the IHSG proxy reads on the
 *  same time scale as the US volatility index. */
export const IHSG_VOLATILITY_LOOKBACK_DAYS = 30;
export const IHSG_VOLATILITY_CHANGE_OFFSET_DAYS = 5;

const GOLD_SYMBOL = DEFAULT_COMMODITY_TICKERS[0];
const COMMODITY_PEER_SYMBOLS = DEFAULT_COMMODITY_TICKERS.slice(1);
const MIN_COMMODITY_PEERS = 3;
const RELATIVE_STRENGTH_SCORE_SCALE = 10;

/** One canonical quote per market context; shared through React Query. */
export const MARKET_CONTEXT_QUOTE_SYMBOLS = [
  VIX_SYMBOL,
  DXY_SYMBOL,
  ...DEFAULT_COMMODITY_TICKERS,
] as const;

const DAY_MS = 86_400_000;
// A weekly ceiling tolerates weekends and exchange holidays while still
// rejecting abandoned Yahoo feeds.
const STANDARD_QUOTE_MAX_AGE_MS = 7 * DAY_MS;
const FUTURE_QUOTE_TOLERANCE_MS = 5 * 60_000;
const TRADING_DAYS_PER_YEAR = 252;
const GARMAN_KLASS_CLOSE_WEIGHT = 2 * Math.log(2) - 1;

interface QuoteContextOptions {
  precision: number;
  nowMs?: number;
  maxAgeMs?: number;
  name?: string;
}

function hasUsableCandle(asset: UnifiedAsset): boolean {
  return normalizeYahooCandles(
    asset.quoteIndicators,
    asset.timestamps,
  ).some(
    (candle) =>
      candle.open > 0 &&
      candle.high > 0 &&
      candle.low > 0 &&
      candle.close > 0,
  );
}

function oneWeekReturn(asset: UnifiedAsset | null | undefined): number | undefined {
  if (!asset) return undefined;
  const dailyCandles = resampleCandlesToDaily(
    normalizeYahooCandles(asset.quoteIndicators, asset.timestamps),
  );
  return computeWindowReturns(dailyCandles.map((candle) => candle.close)).r1w;
}

export function marketContextDirection(
  changePercent: number,
): MarketContextDirection {
  if (changePercent > 0) return "up";
  if (changePercent < 0) return "down";
  return "flat";
}

/**
 * Convert a canonical UnifiedAsset quote into the small display model.
 * Invalid, future-dated, stale, or candle-less snapshots are deliberately
 * rejected instead of presenting a convincing-looking frozen value.
 */
export function adaptQuoteMarketContext(
  asset: UnifiedAsset | null | undefined,
  options: QuoteContextOptions,
): QuoteMarketContext | null {
  if (
    !asset ||
    asset.isNotFound ||
    !Number.isFinite(asset.price) ||
    asset.price <= 0 ||
    !Number.isFinite(asset.changePercent) ||
    typeof asset.quoteTime !== "number" ||
    !Number.isFinite(asset.quoteTime) ||
    asset.quoteTime <= 0 ||
    !hasUsableCandle(asset)
  ) {
    return null;
  }

  const nowMs = options.nowMs ?? Date.now();
  const ageMs = nowMs - asset.quoteTime;
  const maxAgeMs = options.maxAgeMs ?? STANDARD_QUOTE_MAX_AGE_MS;
  if (ageMs > maxAgeMs || ageMs < -FUTURE_QUOTE_TOLERANCE_MS) return null;

  const name = options.name ?? asset.name.trim();
  if (!name) return null;

  return {
    kind: "quote",
    symbol: asset.symbol,
    name,
    value: asset.price,
    changePercent: asset.changePercent,
    direction: marketContextDirection(asset.changePercent),
    precision: options.precision,
    timestamp: asset.quoteTime,
  };
}

/** Map CoinGecko's upstream snapshot into the crypto card footer model. */
export function adaptCryptoDominanceMarketContext(
  dominance: Dominance | null | undefined,
): QuoteMarketContext | null {
  if (
    !dominance ||
    !Number.isFinite(dominance.btc) ||
    dominance.btc <= 0 ||
    dominance.btc > 100 ||
    !Number.isFinite(dominance.updatedAt) ||
    dominance.updatedAt <= 0
  ) {
    return null;
  }

  const changePercent = dominance.btcDominanceChangePercent24h;
  const hasChange =
    typeof changePercent === "number" && Number.isFinite(changePercent);

  return {
    kind: "quote",
    symbol: "BTC.D",
    name: "BTC Dominance Index",
    value: dominance.btc,
    precision: 1,
    timestamp: dominance.updatedAt,
    ...(hasChange
      ? {
          changePercent,
          direction: marketContextDirection(changePercent),
        }
      : {}),
  };
}

function isPhysicalOhlc(candle: NormalizedYahooCandle): boolean {
  return (
    Number.isFinite(candle.timestamp) &&
    candle.timestamp > 0 &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0 &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close)
  );
}

function completedDailyCandles(
  result: YahooChartResult,
  nowMs: number,
): NormalizedYahooCandle[] {
  const quote = result.indicators?.quote?.[0];
  let candles = normalizeYahooCandles(quote, result.timestamp)
    .filter(isPhysicalOhlc)
    .sort((left, right) => left.timestamp - right.timestamp);

  const regular = result.meta.currentTradingPeriod?.regular;
  const nowSeconds = nowMs / 1000;
  const sessionIsInProgress =
    regular != null &&
    Number.isFinite(nowSeconds) &&
    nowSeconds >= regular.start &&
    nowSeconds < regular.end;

  if (sessionIsInProgress) {
    // Yahoo daily bars are stamped at the regular-session start. Remove any
    // bar inside that still-open session before selecting the trailing window.
    candles = candles.filter(
      (candle) =>
        candle.timestamp < regular.start || candle.timestamp >= regular.end,
    );
  }

  return candles;
}

interface GarmanKlassResult {
  value: number;
  latestTimestamp: number;
}

function garmanKlassFromCandles(
  candles: NormalizedYahooCandle[],
): GarmanKlassResult | null {
  if (candles.length < IHSG_VOLATILITY_LOOKBACK_DAYS) return null;

  const window = candles.slice(-IHSG_VOLATILITY_LOOKBACK_DAYS);
  const dailyVariance =
    window.reduce((sum, candle) => {
      const logRange = Math.log(candle.high / candle.low);
      const logOpenClose = Math.log(candle.close / candle.open);
      return (
        sum +
        0.5 * logRange ** 2 -
        GARMAN_KLASS_CLOSE_WEIGHT * logOpenClose ** 2
      );
    }, 0) / window.length;

  if (!Number.isFinite(dailyVariance)) return null;
  const value =
    100 * Math.sqrt(TRADING_DAYS_PER_YEAR * Math.max(0, dailyVariance));
  if (!Number.isFinite(value)) return null;

  return {
    value,
    latestTimestamp: window[window.length - 1].timestamp,
  };
}

function calculateGarmanKlassResult(
  result: YahooChartResult | null | undefined,
  nowMs: number = Date.now(),
): GarmanKlassResult | null {
  if (!result || result.meta.symbol !== IDX_BENCHMARK_SYMBOL) return null;

  const candles = completedDailyCandles(result, nowMs);
  return garmanKlassFromCandles(candles);
}

/** 20-day annualized Garman-Klass realized volatility, in percentage points. */
export function calculateGarmanKlassVolatility(
  result: YahooChartResult | null | undefined,
  nowMs?: number,
): number | null {
  return calculateGarmanKlassResult(result, nowMs)?.value ?? null;
}

export function adaptIhsgVolatilityMarketContext(
  result: YahooChartResult | null | undefined,
  nowMs?: number,
): RealizedVolatilityMarketContext | null {
  if (!result || result.meta.symbol !== IDX_BENCHMARK_SYMBOL) return null;

  const resolvedNowMs = nowMs ?? Date.now();
  const candles = completedDailyCandles(result, resolvedNowMs);
  const volatility = garmanKlassFromCandles(candles);
  if (!volatility) return null;

  const minCandlesForChange =
    IHSG_VOLATILITY_LOOKBACK_DAYS + IHSG_VOLATILITY_CHANGE_OFFSET_DAYS;
  let changePercent: number | undefined;
  let direction: MarketContextDirection | undefined;

  if (candles.length >= minCandlesForChange) {
    const priorCandles = candles.slice(
      -minCandlesForChange,
      -IHSG_VOLATILITY_CHANGE_OFFSET_DAYS,
    );
    const priorVolatility = garmanKlassFromCandles(priorCandles);
    if (
      priorVolatility &&
      priorVolatility.value > 0 &&
      Number.isFinite(priorVolatility.value)
    ) {
      changePercent =
        ((volatility.value - priorVolatility.value) / priorVolatility.value) *
        100;
      if (Number.isFinite(changePercent)) {
        direction = marketContextDirection(changePercent);
      } else {
        changePercent = undefined;
      }
    }
  }

  return {
    kind: "realized-volatility",
    sourceSymbol: IDX_BENCHMARK_SYMBOL,
    name: "IHSG Volatility Index",
    value: volatility.value,
    lookbackDays: IHSG_VOLATILITY_LOOKBACK_DAYS,
    precision: 1,
    timestamp: volatility.latestTimestamp * 1000,
    ...(changePercent !== undefined && direction !== undefined
      ? {
          changePercent,
          direction,
          changeOffsetDays: IHSG_VOLATILITY_CHANGE_OFFSET_DAYS,
        }
      : {}),
  };
}

/**
 * Assemble all five contexts. DXY feeds Forex and the commodity basket feeds
 * Gold Strength Index; all quotes reuse the shared per-symbol cache.
 */
export function buildMarketContextByAssetClass(
  assets: UnifiedAsset[],
  ihsgVolatility: RealizedVolatilityMarketContext | null,
  dominance: Dominance | null | undefined,
  nowMs: number = Date.now(),
): MarketContextByAssetClass {
  const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));

  const cryptoDominance = adaptCryptoDominanceMarketContext(dominance);
  const vix = adaptQuoteMarketContext(bySymbol.get(VIX_SYMBOL), {
    precision: 1,
    nowMs,
    name: "CBOE Volatility Index",
  });
  const dxy = adaptQuoteMarketContext(bySymbol.get(DXY_SYMBOL), {
    precision: 2,
    nowMs,
    name: "US Dollar Index",
  });
  const goldQuote = adaptQuoteMarketContext(bySymbol.get(GOLD_SYMBOL), {
    precision: 1,
    nowMs,
    name: "Gold",
  });
  const goldReturn = oneWeekReturn(bySymbol.get(GOLD_SYMBOL));
  const peerReturns = COMMODITY_PEER_SYMBOLS.map((symbol) => {
    const quote = adaptQuoteMarketContext(bySymbol.get(symbol), {
      precision: 1,
      nowMs,
      name: symbol,
    });
    const oneWeek = oneWeekReturn(bySymbol.get(symbol));
    return quote && oneWeek !== undefined
      ? { oneWeek, timestamp: quote.timestamp }
      : null;
  }).filter(
    (peer): peer is { oneWeek: number; timestamp: number } => peer !== null,
  );

  let commodityRelativeStrength: QuoteMarketContext | null = null;
  if (
    goldQuote &&
    goldReturn !== undefined &&
    peerReturns.length >= MIN_COMMODITY_PEERS
  ) {
    const peerAverage =
      peerReturns.reduce((sum, peer) => sum + peer.oneWeek, 0) /
      peerReturns.length;
    const excessReturn = goldReturn - peerAverage;
    const value = Math.min(
      100,
      Math.max(0, 50 + excessReturn * RELATIVE_STRENGTH_SCORE_SCALE),
    );
    commodityRelativeStrength = {
      kind: "quote",
      symbol: "GC=F/COMMODITY_BASKET",
      name: "Gold Strength Index",
      value,
      changePercent: excessReturn,
      direction: marketContextDirection(excessReturn),
      precision: 1,
      timestamp: Math.max(
        goldQuote.timestamp,
        ...peerReturns.map((peer) => peer.timestamp),
      ),
    };
  }

  return {
    crypto: cryptoDominance,
    "us-stock": vix,
    "id-stock": ihsgVolatility,
    forex: dxy,
    commodity: commodityRelativeStrength,
  };
}
