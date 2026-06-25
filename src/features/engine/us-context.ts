import type { Outlook } from "./signals";
import type { UnifiedAsset } from "@/types/asset";
import type { RiskState, UsContext } from "@/types/market";
import { US_CONTEXT } from "@/constants/signals";
import { applyBenchmarkDerate, fightsBenchmark } from "./benchmark-derate";

/**
 * Top-down US (S&P 500) context layer — structural mirror of idx-context.ts
 * with the S&P 500 in IHSG's seat.
 *
 * US stocks are beta to the index: a technically clean "LONG AAPL" while the
 * S&P is dumping is contextually wrong. When the S&P score is indecisive, two
 * fear gauges break the tie — VIX (a spike = fear) and the Dollar Index (a
 * surging USD = risk-off pressure for equities). This module derives an
 * S&P-led risk state once, then DE-RATES (not hides) any us-stock setup that
 * fights it, adding a transparent warning. All functions are pure;
 * applyUsContext returns a NEW outlook (the input lives in the react-query
 * cache and must not be mutated).
 */

/** A single tiebreak gauge's lean: -1 risk-on, +1 risk-off, 0 undecided. */
function vixLean(vixLevel?: number, vix1wChangePercent?: number): number {
  const { VIX_RISK_OFF_LEVEL, VIX_RISK_ON_LEVEL, VIX_PRESSURE_1W_PCT } =
    US_CONTEXT;
  if (typeof vixLevel === "number") {
    if (vixLevel >= VIX_RISK_OFF_LEVEL) return 1;
    if (vixLevel <= VIX_RISK_ON_LEVEL) return -1;
  }
  // Mid-range level: let a sharp 1-week move decide.
  if (typeof vix1wChangePercent === "number") {
    if (vix1wChangePercent >= VIX_PRESSURE_1W_PCT) return 1;
    if (vix1wChangePercent <= -VIX_PRESSURE_1W_PCT) return -1;
  }
  return 0;
}

function dxyLean(dxy1wChangePercent?: number): number {
  const { DXY_PRESSURE_1W_PCT } = US_CONTEXT;
  if (typeof dxy1wChangePercent === "number") {
    if (dxy1wChangePercent >= DXY_PRESSURE_1W_PCT) return 1;
    if (dxy1wChangePercent <= -DXY_PRESSURE_1W_PCT) return -1;
  }
  return 0;
}

/** Derive the net US risk posture from the S&P's regime-weighted score, with
 *  VIX + DXY breaking the tie when the S&P is indecisive. The two gauges must
 *  AGREE (or one leans while the other is undecided) — a conflict stays
 *  neutral, so a single noisy gauge never forces a posture. */
export function deriveUsRiskState(
  spxDirectionScore: number,
  tiebreak?: {
    vixLevel?: number;
    vix1wChangePercent?: number;
    dxy1wChangePercent?: number;
  },
): RiskState {
  const { RISK_SCORE_THRESHOLD } = US_CONTEXT;
  if (spxDirectionScore <= -RISK_SCORE_THRESHOLD) return "risk_off";
  if (spxDirectionScore >= RISK_SCORE_THRESHOLD) return "risk_on";
  // S&P indecisive: combine VIX + DXY leans (FX/vol lead equity flow).
  if (!tiebreak) return "neutral";
  const lean =
    vixLean(tiebreak.vixLevel, tiebreak.vix1wChangePercent) +
    dxyLean(tiebreak.dxy1wChangePercent);
  if (lean >= 1) return "risk_off";
  if (lean <= -1) return "risk_on";
  return "neutral";
}

/** Package the S&P's computed outlook + VIX/DXY posture into the shared
 *  UsContext consumed by the screener and the detail dialog. */
export function deriveUsContext(
  spxOutlook: Outlook,
  tiebreak: {
    vixLevel?: number;
    vix1wChangePercent?: number;
    dxy1wChangePercent?: number;
  },
  spxReturns?: UsContext["spxReturns"],
): UsContext {
  return {
    spxTrend: spxOutlook.trend,
    spxRegime: spxOutlook.regime,
    spxDirectionScore: spxOutlook.directionScore,
    riskState: deriveUsRiskState(spxOutlook.directionScore, tiebreak),
    vixLevel: tiebreak.vixLevel,
    vix1wChangePercent: tiebreak.vix1wChangePercent,
    dxy1wChangePercent: tiebreak.dxy1wChangePercent,
    spxReturns,
    lastUpdated: Date.now(),
  };
}

/**
 * Apply top-down US context to a per-asset us-stock outlook.
 *
 * When a us-stock setup fights the S&P-led risk state (LONG in risk-off / SHORT
 * in risk-on), DE-RATE its directionScore & strength and add a warning. The
 * signal still shows (transparent) — it just reads weaker and ranks lower.
 * Aligned setups, neutral signals, and non-us-stock assets pass through
 * unchanged. Returns a NEW outlook; never mutates the input.
 */
export function applyUsContext(
  outlook: Outlook,
  asset: Pick<UnifiedAsset, "assetType">,
  ctx: UsContext,
): Outlook {
  if (
    asset.assetType !== "us-stock" ||
    outlook.signal === "neutral" ||
    !fightsBenchmark(outlook.signal, ctx.riskState)
  ) {
    return outlook;
  }

  const riskLabel = ctx.riskState === "risk_off" ? "risk-off" : "risk-on";
  const vixLabel =
    typeof ctx.vixLevel === "number"
      ? `, VIX ${ctx.vixLevel.toFixed(1)}`
      : "";
  return applyBenchmarkDerate(outlook, {
    factor: US_CONTEXT.COUNTER_MARKET_DERATE,
    warning: `US context: S&P 500 is ${riskLabel} (score ${ctx.spxDirectionScore.toFixed(
      2,
    )}${vixLabel}), conflicting with this ${outlook.signal.toUpperCase()} setup — conviction de-rated. US stocks are beta to the index.`,
  });
}
