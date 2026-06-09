import type { SignalTier } from "@/types/asset";
import type { MarketRegime } from "@/types/market";
import type { BacktestMetrics } from "./backtest";

/**
 * Confidence calibration.
 *
 * `strength`/`tier` measure technical alignment, NOT probability of profit.
 * To make confidence honest, we map a live signal's tier (and current regime)
 * to the HISTORICAL hit-rate of comparable trades in this asset's own
 * walk-forward backtest. If the tier hasn't traded enough times to be
 * meaningful, we return null instead of a falsely precise number.
 */
export interface CalibratedConfidence {
  tier: SignalTier;
  /** Historical win-rate (0-1) for this tier on this asset, or null if the
   *  sample is too small to trust. */
  winRate: number | null;
  /** Average R per trade for this tier, or null if sample too small. */
  expectancy: number | null;
  /** Number of historical trades in this tier. */
  sample: number;
  /** Win-rate (0-1) for the current regime, or null if sample too small. */
  regimeWinRate: number | null;
  regimeSample: number;
  /** True when the tier sample meets the minimum for a trustworthy estimate. */
  sufficient: boolean;
}

/** Minimum trades in a bucket before its win-rate is considered meaningful. */
export const MIN_CALIBRATION_SAMPLE = 8;

export function calibrateConfidence(
  metrics: BacktestMetrics,
  tier: SignalTier,
  regime: MarketRegime,
  minSample: number = MIN_CALIBRATION_SAMPLE,
): CalibratedConfidence {
  const tierStat = metrics.perTier[tier];
  const regimeStat = metrics.perRegime[regime];
  const sufficient = tierStat.trades >= minSample;

  return {
    tier,
    winRate: sufficient ? tierStat.winRate : null,
    expectancy: sufficient ? tierStat.expectancy : null,
    sample: tierStat.trades,
    regimeWinRate: regimeStat.trades >= minSample ? regimeStat.winRate : null,
    regimeSample: regimeStat.trades,
    sufficient,
  };
}
