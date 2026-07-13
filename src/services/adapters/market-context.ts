import { IDX_BENCHMARK_SYMBOL } from "@/constants/idx";
import {
  COPPER_SYMBOL,
  DXY_SYMBOL,
  GOLD_SYMBOL,
  VIX_SYMBOL,
} from "@/constants/us";
import type { UnifiedAsset } from "@/types/asset";
import type {
  MarketContextByAssetClass,
  MarketContextDirection,
  QuoteMarketContext,
  RealizedVolatilityMarketContext,
} from "@/types/market";
import type { YahooChartResult } from "@/services/api/yahoo-finance";
import {
  normalizeYahooCandles,
  type NormalizedYahooCandle,
} from "@/services/adapters/yahoo-candles";

export const CMC_CRYPTO_200_SYMBOL = "^CMC200";
export const CRYPTO_INDEX_FALLBACK_SYMBOL = "^NCI";
export const IHSG_VOLATILITY_LOOKBACK_DAYS = 20;
export const IHSG_VOLATILITY_CHANGE_OFFSET_DAYS = 5;

/** Module-level and unique so Forex and Commodity never trigger two DXY queries. */
export const MARKET_CONTEXT_QUOTE_SYMBOLS = [
  CMC_CRYPTO_200_SYMBOL,
  CRYPTO_INDEX_FALLBACK_SYMBOL,
  VIX_SYMBOL,
  DXY_SYMBOL,
  GOLD_SYMBOL,
  COPPER_SYMBOL,
] as const;

const DAY_MS = 86_400_000;
const CMC_MAX_AGE_MS = 2 * DAY_MS;
// A weekly ceiling tolerates weekends and exchange holidays while still
// rejecting abandoned Yahoo feeds. CMC is deliberately held to a stricter
// limit because Yahoo's ^CMC200 feed has historically remained frozen.
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
    name: "IHSG Volatility",
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
 * Build a Copper/Gold ratio context from two validated quotes. Reuses
 * adaptQuoteMarketContext's staleness/candle validation on each leg, then
 * derives the ratio and its relative change. A rising ratio = risk-on
 * (industrial demand outpacing the safe haven); falling = risk-off.
 */
function adaptCopperGoldRatioContext(
  copperAsset: UnifiedAsset | null | undefined,
  goldAsset: UnifiedAsset | null | undefined,
  nowMs: number,
): QuoteMarketContext | null {
  const copper = adaptQuoteMarketContext(copperAsset, {
    precision: 2,
    nowMs,
    name: "Copper",
  });
  const gold = adaptQuoteMarketContext(goldAsset, {
    precision: 2,
    nowMs,
    name: "Gold",
  });
  if (!copper || !gold || gold.value === 0) return null;

  const ratio = copper.value / gold.value;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;

  const denominatorMove = 1 + gold.changePercent / 100;
  const changePercent =
    denominatorMove !== 0
      ? ((1 + copper.changePercent / 100) / denominatorMove - 1) * 100
      : 0;

  return {
    kind: "quote",
    symbol: `${COPPER_SYMBOL}/${GOLD_SYMBOL}`,
    name: "Copper Gold Ratio",
    value: ratio,
    changePercent,
    direction: marketContextDirection(changePercent),
    precision: 5,
    timestamp: Math.max(copper.timestamp, gold.timestamp),
  };
}

/**
 * Assemble all five contexts. DXY feeds Forex; the Copper/Gold ratio feeds
 * Commodity. Both reuse the shared per-symbol cache via MARKET_CONTEXT_QUOTE_SYMBOLS.
 */
export function buildMarketContextByAssetClass(
  assets: UnifiedAsset[],
  ihsgVolatility: RealizedVolatilityMarketContext | null,
  nowMs: number = Date.now(),
): MarketContextByAssetClass {
  const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));

  const primaryCrypto = adaptQuoteMarketContext(
    bySymbol.get(CMC_CRYPTO_200_SYMBOL),
    {
      precision: 2,
      nowMs,
      maxAgeMs: CMC_MAX_AGE_MS,
      name: "CMC Crypto 200 Index",
    },
  );
  const fallbackCrypto = adaptQuoteMarketContext(
    bySymbol.get(CRYPTO_INDEX_FALLBACK_SYMBOL),
    { precision: 2, nowMs, name: "NCI Crypto Index" },
  );
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
  const copperGoldRatio = adaptCopperGoldRatioContext(
    bySymbol.get(COPPER_SYMBOL),
    bySymbol.get(GOLD_SYMBOL),
    nowMs,
  );

  return {
    crypto: primaryCrypto ?? fallbackCrypto,
    "us-stock": vix,
    "id-stock": ihsgVolatility,
    forex: dxy,
    commodity: copperGoldRatio,
  };
}
