import {
  DEFAULT_CRYPTO_TICKERS,
  DEFAULT_US_STOCK_TICKERS,
  DEFAULT_ID_STOCK_TICKERS,
} from "@/constants/assets";

/** Per-type ticker lists the screener renders from the DB-driven (premium)
 *  universe. Commodity & forex are deliberately absent — they stay on the
 *  DEFAULT_COMMODITY/FOREX constants everywhere (screener + cron), not the DB. */
export interface ScreenerUniverse {
  crypto: string[];
  usStock: string[];
  idStock: string[];
}

/** Minimal shape of a `journal_assets` row this module needs. Structural (not the
 *  full DB row type) so the grouping stays pure and trivially unit-testable. */
export interface UniverseRow {
  symbol: string;
  asset_type: string | null;
  active: boolean;
}

/** DEFAULT_* fallback for free users and the initial loading state. */
export const FALLBACK_UNIVERSE: ScreenerUniverse = {
  crypto: DEFAULT_CRYPTO_TICKERS,
  usStock: DEFAULT_US_STOCK_TICKERS,
  idStock: DEFAULT_ID_STOCK_TICKERS,
};

/**
 * Group active `journal_assets` rows into the screener's per-type ticker lists.
 * Pure: undefined means not loaded; an empty array is a real empty universe.
 * Commodity/forex rows are ignored (constants, not the DB universe).
 */
export function groupUniverse(
  rows: UniverseRow[] | null | undefined,
): ScreenerUniverse {
  if (!rows) return FALLBACK_UNIVERSE;
  const pick = (type: string) =>
    rows.filter((r) => r.active && r.asset_type === type).map((r) => r.symbol);
  const crypto = pick("crypto");
  const usStock = pick("us-stock");
  const idStock = pick("id-stock");
  return {
    crypto,
    usStock,
    idStock,
  };
}
