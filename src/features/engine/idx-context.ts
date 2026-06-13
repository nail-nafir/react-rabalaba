import type { Outlook } from "./signals";
import type { UnifiedAsset } from "@/types/asset";
import type { IdxContext, RiskState, TrendDirection } from "@/types/market";
import { TIER_THRESHOLDS, IDX_CONTEXT } from "@/constants/signals";
import { fightsMarket } from "./market-context";

/**
 * Top-down IDX (Indonesian equities) context layer — structural mirror of
 * market-context.ts with IHSG in BTC's seat.
 *
 * .JK stocks are beta to IHSG flow: a technically clean "LONG saham" while the
 * composite is dumping is contextually wrong. Foreign outflow also shows up in
 * the rupiah BEFORE it shows up in stock prices (USDIDR up = rupiah weakening
 * = risk-off pressure), so USDIDR acts as the tiebreak when IHSG is
 * indecisive. This module derives an IHSG-led risk state once, then DE-RATES
 * (not hides) any id-stock setup that fights it, adding a transparent warning.
 * All functions are pure; applyIdxContext returns a NEW outlook (the input
 * lives in the react-query cache and must not be mutated).
 */

/** Derive the net IDX risk posture from IHSG's regime-weighted score, with
 *  rupiah pressure (~1-week USDIDR % change) breaking the tie. */
export function deriveIdxRiskState(
  ihsgDirectionScore: number,
  usdIdr1wChangePercent?: number,
): RiskState {
  const { RISK_SCORE_THRESHOLD, RUPIAH_PRESSURE_1W_PCT } = IDX_CONTEXT;
  if (ihsgDirectionScore <= -RISK_SCORE_THRESHOLD) return "risk_off";
  if (ihsgDirectionScore >= RISK_SCORE_THRESHOLD) return "risk_on";
  // IHSG indecisive: rupiah pressure breaks the tie (FX leads equity flow).
  if (typeof usdIdr1wChangePercent === "number") {
    if (usdIdr1wChangePercent >= RUPIAH_PRESSURE_1W_PCT) return "risk_off";
    if (usdIdr1wChangePercent <= -RUPIAH_PRESSURE_1W_PCT) return "risk_on";
  }
  return "neutral";
}

/** Package IHSG's computed outlook + USDIDR posture into the shared
 *  IdxContext consumed by the screener and the detail dialog. */
export function deriveIdxContext(
  ihsgOutlook: Outlook,
  usdIdr: { trend: TrendDirection; oneWeekChangePercent?: number },
  ihsgReturns?: IdxContext["ihsgReturns"],
): IdxContext {
  return {
    ihsgTrend: ihsgOutlook.trend,
    ihsgRegime: ihsgOutlook.regime,
    ihsgDirectionScore: ihsgOutlook.directionScore,
    riskState: deriveIdxRiskState(
      ihsgOutlook.directionScore,
      usdIdr.oneWeekChangePercent,
    ),
    usdIdrTrend: usdIdr.trend,
    usdIdr1wChangePercent: usdIdr.oneWeekChangePercent,
    ihsgReturns,
    lastUpdated: Date.now(),
  };
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

/**
 * Apply top-down IDX context to a per-asset id-stock outlook.
 *
 * When an id-stock setup fights the IHSG-led risk state (LONG in risk-off /
 * SHORT in risk-on), DE-RATE its directionScore & strength and add a warning.
 * The signal still shows (transparent) — it just reads weaker and ranks lower.
 * Aligned setups, neutral signals, and non-id-stock assets pass through
 * unchanged. Returns a NEW outlook; never mutates the input.
 */
export function applyIdxContext(
  outlook: Outlook,
  asset: Pick<UnifiedAsset, "assetType">,
  ctx: IdxContext,
): Outlook {
  if (
    asset.assetType !== "id-stock" ||
    outlook.signal === "neutral" ||
    !fightsMarket(outlook.signal, ctx.riskState)
  ) {
    return outlook;
  }

  const factor = IDX_CONTEXT.COUNTER_MARKET_DERATE;
  const directionScore = outlook.directionScore * factor;
  const strength = Math.round(outlook.strength * factor);
  const riskLabel = ctx.riskState === "risk_off" ? "risk-off" : "risk-on";
  const rupiahLabel =
    ctx.usdIdrTrend === "bullish"
      ? "rupiah weakening"
      : ctx.usdIdrTrend === "bearish"
        ? "rupiah strengthening"
        : "rupiah stable";

  return {
    ...outlook,
    directionScore,
    strength,
    tier: tierFor(strength),
    technicalAlignment: alignmentFor(strength),
    reasons: {
      ...outlook.reasons,
      warnings: [
        ...outlook.reasons.warnings,
        `IDX context: IHSG is ${riskLabel} (score ${ctx.ihsgDirectionScore.toFixed(
          2,
        )}, ${rupiahLabel}), conflicting with this ${outlook.signal.toUpperCase()} setup — conviction de-rated. ID stocks are beta to IHSG flow.`,
      ],
    },
  };
}
