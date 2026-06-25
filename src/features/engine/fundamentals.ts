import type { Outlook } from "./signals";
import type { Fundamentals } from "@/types/asset";
import { FUNDAMENTALS } from "@/constants/signals";
import { alignmentFor, tierFor } from "./benchmark-derate";

/**
 * Fundamentals + analyst overlay for stocks. Conservative by design — three
 * effects, none of which flips a signal:
 *  1) Pre-earnings blackout: a directional call inside the event window is
 *     de-rated (event risk) and flagged.
 *  2) Analyst consensus: a small bounded nudge in the consensus direction.
 *  3) Valuation caution: high leverage / rich P/E raise a warning on a LONG
 *     (no strength change — just honesty).
 * Pure; returns a NEW outlook only when something fired, else the same input.
 */

const TRADING_DAY_MS = 24 * 60 * 60 * 1000;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

export function applyFundamentals(
  outlook: Outlook,
  f: Fundamentals,
  now: number = Date.now(),
): Outlook {
  if (outlook.signal === "neutral") return outlook;
  const dir = outlook.signal === "long" ? 1 : -1;

  let directionScore = outlook.directionScore;
  let strength = outlook.strength;
  const warnings: string[] = [];

  // 1) Pre-earnings blackout — high event risk near the print → de-rate.
  if (typeof f.nextEarningsMs === "number") {
    const daysToEarnings = (f.nextEarningsMs - now) / TRADING_DAY_MS;
    if (
      daysToEarnings >= 0 &&
      daysToEarnings <= FUNDAMENTALS.EARNINGS_BLACKOUT_DAYS
    ) {
      directionScore *= FUNDAMENTALS.EARNINGS_DERATE;
      strength = Math.round(strength * FUNDAMENTALS.EARNINGS_DERATE);
      warnings.push(
        `Earnings in ~${Math.ceil(daysToEarnings)}d — pre-earnings event risk, conviction de-rated.`,
      );
    }
  }

  // 2) Analyst consensus — a small nudge in the direction the call agrees with.
  if (
    typeof f.analystScore === "number" &&
    Math.abs(f.analystScore) >= FUNDAMENTALS.ANALYST_MIN_SCORE
  ) {
    const agreement =
      Math.sign(f.analystScore) === dir
        ? Math.abs(f.analystScore)
        : -Math.abs(f.analystScore);
    if (agreement !== 0) {
      const factor = 1 + agreement * FUNDAMENTALS.ANALYST_MAX_ADJ;
      directionScore *= factor;
      strength = Math.round(strength * factor);
      const consensus = f.analystScore > 0 ? "bullish" : "bearish";
      warnings.push(
        agreement > 0
          ? `Analyst consensus ${consensus} supports this ${outlook.signal.toUpperCase()} — conviction nudged up.`
          : `Analyst consensus ${consensus} opposes this ${outlook.signal.toUpperCase()} — conviction dampened.`,
      );
    }
  }

  // 3) Valuation caution (LONG only) — warnings, no strength change.
  if (outlook.signal === "long") {
    if (
      typeof f.debtToEquity === "number" &&
      f.debtToEquity >= FUNDAMENTALS.HIGH_DEBT_TO_EQUITY
    ) {
      warnings.push(
        `High leverage (D/E ≈ ${(f.debtToEquity / 100).toFixed(1)}×) — fundamental caution on this LONG.`,
      );
    }
    if (
      typeof f.trailingPE === "number" &&
      f.trailingPE >= FUNDAMENTALS.HIGH_TRAILING_PE
    ) {
      warnings.push(
        `Rich valuation (P/E ${f.trailingPE.toFixed(0)}) — limited margin of safety on this LONG.`,
      );
    }
  }

  if (warnings.length === 0) return outlook;

  directionScore = clamp(directionScore, -1, 1);
  strength = Math.max(0, Math.min(100, strength));
  return {
    ...outlook,
    directionScore,
    strength,
    tier: tierFor(strength),
    technicalAlignment: alignmentFor(strength),
    reasons: {
      ...outlook.reasons,
      warnings: [...outlook.reasons.warnings, ...warnings],
    },
  };
}
