import { apiClient } from "./client";

const BASE_URL = "https://fapi.binance.com";

/** Yahoo bases that map to Binance's 1000× perpetual contracts. */
const PERP_OVERRIDES: Record<string, string> = {
  PEPE: "1000PEPE",
  SHIB: "1000SHIB",
  BONK: "1000BONK",
  FLOKI: "1000FLOKI",
  LUNC: "1000LUNC",
  XEC: "1000XEC",
  RATS: "1000RATS",
  SATS: "1000SATS",
};

/**
 * Map a Yahoo crypto symbol ("BTC-USD") to a Binance USDT-M perpetual
 * ("BTCUSDT"). Best-effort: returns null for non-USD-crypto symbols, and coins
 * without a perp will simply 404 at fetch time and be treated as having no
 * smart-money data (graceful) — the symbol-mapping lesson from the R&D logs.
 */
export function yahooToBinancePerp(symbol: string): string | null {
  const s = symbol.toUpperCase();
  if (!s.endsWith("-USD")) return null;
  const base = s.slice(0, -4);
  if (!base) return null;
  return `${PERP_OVERRIDES[base] ?? base}USDT`;
}

interface PremiumIndexResponse {
  lastFundingRate?: string;
  markPrice?: string;
}
interface OpenInterestHistPoint {
  sumOpenInterest?: string;
  timestamp?: number;
}
interface LongShortPoint {
  longShortRatio?: string;
}

/**
 * Derivatives endpoints get blocked in some regions/ISPs (geo 451/403) or just
 * hang. We don't want a blocked exchange to stall the screener, so we use a
 * shorter timeout than the default client (fail fast, degrade gracefully).
 */
const BINANCE_TIMEOUT = 5_000;

/** Raw derivatives snapshot — price-independent, so it caches cleanly by symbol.
 *  Positioning interpretation (which needs live price direction) is applied
 *  separately in derivePositioning.
 *
 *  EVERY field is optional: when a source is blocked/unavailable the field is
 *  simply absent (NOT defaulted to 0). A missing value must never be mistaken
 *  for a real "funding 0% / OI flat" reading — absent data contributes nothing
 *  to positioning rather than nudging a signal on fake zeros. */
export interface BinanceDerivatives {
  openInterest?: number;
  /** OI change over the lookback window, as a fraction. */
  openInterestDelta?: number;
  /** Latest funding rate (per 8h) as a fraction. */
  fundingRate?: number;
  longShortRatio?: number;
}

/**
 * Fetch the three public derivatives signals for a perp, tolerating partial
 * failure. Each call fails independently; whatever succeeds is returned.
 *
 * Returns `null` only when EVERY source failed (e.g. Binance is blocked on this
 * network) — the caller treats null as "no smart-money data" and skips
 * positioning entirely. A partial result still produces a (partial) positioning
 * read from the data that IS available.
 */
export async function fetchBinanceDerivatives(
  perp: string,
): Promise<BinanceDerivatives | null> {
  const opts = { timeout: BINANCE_TIMEOUT };
  const [premium, oiHist, ls] = await Promise.all([
    apiClient
      .get<PremiumIndexResponse>(
        `${BASE_URL}/fapi/v1/premiumIndex?symbol=${perp}`,
        opts,
      )
      .catch(() => null),
    apiClient
      .get<OpenInterestHistPoint[]>(
        `${BASE_URL}/futures/data/openInterestHist?symbol=${perp}&period=1h&limit=24`,
        opts,
      )
      .catch(() => null),
    apiClient
      .get<LongShortPoint[]>(
        `${BASE_URL}/futures/data/globalLongShortAccountRatio?symbol=${perp}&period=1h&limit=1`,
        opts,
      )
      .catch(() => null),
  ]);

  // Every source failed → signal "no data" so positioning is skipped entirely.
  if (!premium && !oiHist && !ls) return null;

  const result: BinanceDerivatives = {};

  const fundingRate = Number(premium?.lastFundingRate);
  if (premium && Number.isFinite(fundingRate)) {
    result.fundingRate = fundingRate;
  }

  if (Array.isArray(oiHist) && oiHist.length > 0) {
    const latest = Number(oiHist[oiHist.length - 1]?.sumOpenInterest);
    const first = Number(oiHist[0]?.sumOpenInterest);
    if (Number.isFinite(latest)) {
      result.openInterest = latest;
      if (Number.isFinite(first) && first > 0) {
        result.openInterestDelta = (latest - first) / first;
      }
    }
  }

  const lsRatio =
    Array.isArray(ls) && ls.length > 0 ? Number(ls[0]?.longShortRatio) : NaN;
  if (Number.isFinite(lsRatio)) {
    result.longShortRatio = lsRatio;
  }

  return result;
}
