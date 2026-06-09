import type { Outlook } from "./signals";
import type { UnifiedAsset } from "@/types/asset";
import type { MarketContext, RiskState } from "@/types/market";
import { TIER_THRESHOLDS, MARKET_CONTEXT } from "@/constants/signals";

/**
 * Top-down market context layer.
 *
 * The per-asset signal engine (computeSignal) is deliberately isolated — it only
 * sees one asset's candles. But in crypto, ~90% of alts are leveraged beta to
 * BTC: a technically clean "LONG alt" while BTC is dumping is contextually wrong
 * ("ngawur"). This module derives a BTC-led risk state once, then DE-RATES (not
 * hides) any setup that fights it, adding a transparent warning. All functions
 * are pure; applyMarketContext returns a NEW outlook (the input lives in the
 * react-query cache and must not be mutated).
 */

/** Derive the net market risk posture from BTC's regime-weighted score and
 *  sentiment. */
export function deriveRiskState(
  btcDirectionScore: number,
  fearGreed?: number,
): RiskState {
  const { RISK_SCORE_THRESHOLD, EXTREME_FEAR, EXTREME_GREED } = MARKET_CONTEXT;
  if (btcDirectionScore <= -RISK_SCORE_THRESHOLD) return "risk_off";
  if (btcDirectionScore >= RISK_SCORE_THRESHOLD) return "risk_on";
  // BTC indecisive: let sentiment extremes break the tie.
  if (typeof fearGreed === "number") {
    if (fearGreed <= EXTREME_FEAR) return "risk_off";
    if (fearGreed >= EXTREME_GREED) return "risk_on";
  }
  return "neutral";
}

/** Package BTC's computed outlook (+ optional sentiment / dominance) into the
 *  shared MarketContext consumed by the screener, summary row, and dialog. */
export function deriveMarketContext(
  btcOutlook: Outlook,
  fearGreed?: number,
  dominance?: MarketContext["dominance"],
): MarketContext {
  return {
    btcTrend: btcOutlook.trend,
    btcRegime: btcOutlook.regime,
    btcDirectionScore: btcOutlook.directionScore,
    riskState: deriveRiskState(btcOutlook.directionScore, fearGreed),
    fearGreed,
    dominance,
    lastUpdated: Date.now(),
  };
}

/** True when a directional signal fights the prevailing market risk state. */
export function fightsMarket(
  signal: Outlook["signal"],
  riskState: RiskState,
): boolean {
  if (signal === "long" && riskState === "risk_off") return true;
  if (signal === "short" && riskState === "risk_on") return true;
  return false;
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

/** Detects BTC's own symbol so the context isn't applied to itself. */
function isBitcoin(symbol: string): boolean {
  return /^BTC[-/]?USD/i.test(symbol);
}

/**
 * Apply top-down market context to a per-asset crypto outlook.
 *
 * When a crypto setup fights the BTC-led risk state (LONG in risk-off / SHORT in
 * risk-on), DE-RATE its directionScore & strength and add a warning. The signal
 * still shows (transparent) — it just reads weaker and ranks lower. Aligned
 * setups, BTC itself, neutral signals, and non-crypto assets pass through
 * unchanged. Returns a NEW outlook; never mutates the input.
 */
export function applyMarketContext(
  outlook: Outlook,
  asset: Pick<UnifiedAsset, "assetType" | "symbol">,
  ctx: MarketContext,
): Outlook {
  if (
    asset.assetType !== "crypto" ||
    isBitcoin(asset.symbol) ||
    outlook.signal === "neutral" ||
    !fightsMarket(outlook.signal, ctx.riskState)
  ) {
    return outlook;
  }

  const factor = MARKET_CONTEXT.COUNTER_MARKET_DERATE;
  const directionScore = outlook.directionScore * factor;
  const strength = Math.round(outlook.strength * factor);
  const riskLabel = ctx.riskState === "risk_off" ? "risk-off" : "risk-on";

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
        `Market context: BTC is ${riskLabel} (score ${ctx.btcDirectionScore.toFixed(
          2,
        )}), conflicting with this ${outlook.signal.toUpperCase()} setup — conviction de-rated. Most alts are leveraged beta to BTC.`,
      ],
    },
  };
}
