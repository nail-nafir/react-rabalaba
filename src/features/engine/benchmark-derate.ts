import type { Outlook } from "./signals";
import type { RiskState } from "@/types/market";
import { TIER_THRESHOLDS } from "@/constants/signals";

/**
 * Shared top-down de-rate core for every benchmark context (BTC for crypto,
 * IHSG for ID stocks, S&P 500 for US stocks). The three context modules are
 * near-identical mirrors; this is the ONE place the de-rate math + tiering
 * lives so they can never drift apart. The per-market modules own the GATE
 * (assetType, neutral signal, fightsBenchmark) and the warning copy; this owns
 * the maths. All functions are pure.
 */

/** Strength → tier letter. Shared so every context tiers identically. */
export function tierFor(strength: number): Outlook["tier"] {
  if (strength >= TIER_THRESHOLDS.A) return "A";
  if (strength >= TIER_THRESHOLDS.B) return "B";
  return "C";
}

/** Strength → technical-alignment label. Shared, mirrors tierFor. */
export function alignmentFor(strength: number): Outlook["technicalAlignment"] {
  if (strength >= TIER_THRESHOLDS.A) return "strong";
  if (strength >= TIER_THRESHOLDS.B) return "moderate";
  return "weak";
}

/** True when a directional signal fights the prevailing benchmark risk state
 *  (LONG into risk-off / SHORT into risk-on). Benchmark-agnostic — BTC, IHSG
 *  and S&P 500 all share this rule. */
export function fightsBenchmark(
  signal: Outlook["signal"],
  riskState: RiskState,
): boolean {
  if (signal === "long" && riskState === "risk_off") return true;
  if (signal === "short" && riskState === "risk_on") return true;
  return false;
}

/**
 * De-rate an outlook that fights its benchmark: scale directionScore & strength
 * by `factor` (<1), re-tier, and append `warning`. Returns a NEW outlook —
 * never mutates the input (it lives in the react-query cache). Callers gate
 * BEFORE calling this; here we just apply the maths.
 */
export function applyBenchmarkDerate(
  outlook: Outlook,
  options: { factor: number; warning: string },
): Outlook {
  const { factor, warning } = options;
  const directionScore = outlook.directionScore * factor;
  const strength = Math.round(outlook.strength * factor);
  return {
    ...outlook,
    directionScore,
    strength,
    tier: tierFor(strength),
    technicalAlignment: alignmentFor(strength),
    reasons: {
      ...outlook.reasons,
      warnings: [...outlook.reasons.warnings, warning],
    },
  };
}
