/**
 * Relative strength vs the asset's OWN benchmark (id-stock → IHSG, us-stock →
 * S&P 500, crypto → BTC). computeWindowReturns is the asset-agnostic returns
 * helper (shared with the context hooks); deriveRelativeStrength turns an
 * asset's returns + its benchmark's returns into excess performance + a label;
 * applyRelativeStrength nudges conviction by that leadership (bounded, never
 * flips). All functions pure.
 */
import type { Outlook } from "./signals";
import type { RelativeStrength } from "@/types/asset";
import type { RelativeStrengthLabel } from "@/constants/taxonomy/indicator";
import { TIER_THRESHOLDS, RELATIVE_STRENGTH } from "@/constants/signals";

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

/** Excess return over a window = asset return − benchmark return, or undefined
 *  when either side lacks the window. */
function excess(
  assetR?: number,
  benchR?: number,
): number | undefined {
  if (typeof assetR !== "number" || typeof benchR !== "number") return undefined;
  return assetR - benchR;
}

function labelFor(primaryExcess: number): RelativeStrengthLabel {
  const { INLINE_BAND_PCT } = RELATIVE_STRENGTH;
  if (primaryExcess > INLINE_BAND_PCT) return "outperform";
  if (primaryExcess < -INLINE_BAND_PCT) return "underperform";
  return "inline";
}

/**
 * Compare an asset's daily closes against its benchmark's window returns,
 * producing excess performance (1w & 1m) + a leadership label + the benchmark
 * name for display. Returns null when no overlapping window can be measured
 * (caller degrades gracefully). The 1-month excess is the primary read (more
 * stable), falling back to 1-week.
 */
export function deriveRelativeStrength(
  assetDailyCloses: number[],
  benchmarkReturns: WindowReturns,
  benchmark: string,
): RelativeStrength | null {
  const assetReturns = computeWindowReturns(assetDailyCloses);
  const r1w = excess(assetReturns.r1w, benchmarkReturns.r1w);
  const r1m = excess(assetReturns.r1m, benchmarkReturns.r1m);
  const primary = r1m ?? r1w;
  if (typeof primary !== "number") return null;
  return { r1w, r1m, label: labelFor(primary), benchmark };
}

function tierFor(strength: number): Outlook["tier"] {
  if (strength >= TIER_THRESHOLDS.A) return "A";
  if (strength >= TIER_THRESHOLDS.B) return "B";
  return "C";
}

function alignmentFor(strength: number): Outlook["technicalAlignment"] {
  if (strength >= TIER_THRESHOLDS.A) return "strong";
  if (strength >= TIER_THRESHOLDS.B) return "moderate";
  return "weak";
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

/**
 * Nudge conviction by relative-strength leadership (bounded to
 * ±MAX_CONVICTION_ADJ). A leader strengthens an aligned LONG / weakens a SHORT;
 * a laggard does the reverse. The score scales the primary excess by SCALE_PCT
 * and clamps to [-1..1]. Never flips the signal. Returns a NEW outlook (mirrors
 * applyAccumulation). No measurable excess → outlook unchanged.
 */
export function applyRelativeStrength(
  outlook: Outlook,
  rs: RelativeStrength,
): Outlook {
  if (outlook.signal === "neutral") return outlook;
  const primaryExcess = rs.r1m ?? rs.r1w;
  if (typeof primaryExcess !== "number") return outlook;

  // rsScore ∈ [-1..1]: + = outperforming its benchmark.
  const rsScore = clampUnit(primaryExcess / RELATIVE_STRENGTH.SCALE_PCT);
  const dir = outlook.signal === "long" ? 1 : -1;
  // agreement ∈ [-1..1]: + when leadership supports the signal direction.
  const agreement =
    Math.sign(rsScore) === dir ? Math.abs(rsScore) : -Math.abs(rsScore);
  if (agreement === 0) return outlook;

  const factor = 1 + agreement * RELATIVE_STRENGTH.MAX_CONVICTION_ADJ;
  const directionScore = clampUnit(outlook.directionScore * factor);
  const strength = Math.max(
    0,
    Math.min(100, Math.round(outlook.strength * factor)),
  );

  const lead =
    rs.label === "outperform"
      ? `outperforming ${rs.benchmark ?? "its benchmark"}`
      : `lagging ${rs.benchmark ?? "its benchmark"}`;
  const note =
    agreement > 0
      ? `Relative strength: ${lead} supports this ${outlook.signal.toUpperCase()} — conviction nudged up.`
      : `Relative strength: ${lead} opposes this ${outlook.signal.toUpperCase()} — conviction dampened.`;

  return {
    ...outlook,
    directionScore,
    strength,
    tier: tierFor(strength),
    technicalAlignment: alignmentFor(strength),
    reasons: {
      ...outlook.reasons,
      warnings: [...outlook.reasons.warnings, note],
    },
  };
}
