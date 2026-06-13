/**
 * Relative strength vs the IHSG benchmark.
 *
 * Phase 1 ships only computeWindowReturns — an asset-agnostic helper (shared
 * with useIdxContext). deriveRelativeStrength (stock vs IHSG comparison +
 * label, the IDX-specific part) lands in Phase 2.
 */

/** Window lengths in TRADING days — universal across exchanges (a trading
 *  week ≈ 5 sessions, a month ≈ 21), not IDX-specific. */
const TRADING_DAYS_1W = 5;
const TRADING_DAYS_1M = 21;

export interface WindowReturns {
  /** Percent return over the last ~1 trading week (5 sessions). */
  r1w?: number;
  /** Percent return over the last ~1 trading month (21 sessions). */
  r1m?: number;
}

/**
 * Percent returns over fixed trading-day windows from a DAILY close series.
 * A window is undefined when history is too short for it (needs N+1 closes),
 * so callers degrade gracefully instead of comparing different horizons.
 */
export function computeWindowReturns(dailyCloses: number[]): WindowReturns {
  return {
    r1w: windowReturn(dailyCloses, TRADING_DAYS_1W),
    r1m: windowReturn(dailyCloses, TRADING_DAYS_1M),
  };
}

function windowReturn(closes: number[], days: number): number | undefined {
  if (closes.length < days + 1) return undefined;
  const last = closes[closes.length - 1];
  const base = closes[closes.length - 1 - days];
  if (!Number.isFinite(last) || !Number.isFinite(base) || base <= 0) {
    return undefined;
  }
  return ((last - base) / base) * 100;
}
