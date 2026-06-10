import type { SmartMoney } from "@/types/asset";
import type { Outlook } from "./signals";
import { TIER_THRESHOLDS, SMART_MONEY } from "@/constants/signals";

/** Labels that mean "no directional lean" — used to keep UI color in sync. */
export const NEUTRAL_POSITIONING_LABEL = "Neutral positioning";
export const NO_POSITIONING_DATA_LABEL = "No positioning data";

/** True when positioning has no directional read (color should be muted). */
export function isNeutralPositioning(label: string): boolean {
  return (
    label === NEUTRAL_POSITIONING_LABEL || label === NO_POSITIONING_DATA_LABEL
  );
}

/**
 * Crypto "smart money" = derivatives positioning, not pivots-with-a-fancy-name.
 *
 * Reads three public Binance signals and turns them into a bounded positioning
 * score in [-1..1]:
 *  - OI × price matrix: OI↑price↑ = new longs, OI↑price↓ = new shorts,
 *    OI↓price↑ = short covering, OI↓price↓ = long capitulation.
 *  - Funding extremes are CONTRARIAN: very positive funding = crowded longs =
 *    squeeze-DOWN risk (and vice-versa). Getting this backwards inverts signals.
 *  - Long/short account ratio extremes add mild contrarian weight.
 *
 * The score nudges conviction modestly (±MAX_CONVICTION_ADJ); it never flips a
 * technical signal on its own. All functions pure; applySmartMoney is immutable.
 */
export interface PositioningInput {
  openInterest?: number;
  openInterestDelta?: number;
  fundingRate?: number;
  longShortRatio?: number;
  /** Recent price direction (e.g. 24h % change) for the OI × price matrix. */
  priceChangePercent: number;
}

export function derivePositioning(input: PositioningInput): SmartMoney {
  const {
    openInterest,
    openInterestDelta,
    fundingRate,
    longShortRatio,
    priceChangePercent,
  } = input;

  let score = 0;
  let label: string = NEUTRAL_POSITIONING_LABEL;
  let flow: SmartMoney["flow"];
  // Tracks whether ANY source actually contributed. If nothing did, the read is
  // "no data" rather than a confident "neutral" — the label reflects that.
  let hasSignal = false;

  // 1. OI × price matrix — only when OI delta is actually available.
  if (openInterestDelta != null) {
    hasSignal = true;
    const oiUp = openInterestDelta > SMART_MONEY.OI_DELTA_THRESHOLD;
    const oiDown = openInterestDelta < -SMART_MONEY.OI_DELTA_THRESHOLD;
    const priceUp = priceChangePercent > 0;
    const priceDown = priceChangePercent < 0;
    if (oiUp && priceUp) {
      score += 0.4;
      label = "New longs";
      flow = { oi: "up", price: "up" };
    } else if (oiUp && priceDown) {
      score -= 0.4;
      label = "New shorts";
      flow = { oi: "up", price: "down" };
    } else if (oiDown && priceUp) {
      score -= 0.2;
      label = "Short covering";
      flow = { oi: "down", price: "up" };
    } else if (oiDown && priceDown) {
      score += 0.2;
      label = "Long capitulation";
      flow = { oi: "down", price: "down" };
    }
  }

  // 2. Funding extremes — contrarian (the crowded side gets squeezed).
  if (fundingRate != null) {
    hasSignal = true;
    if (fundingRate >= SMART_MONEY.FUNDING_EXTREME) {
      score -= 0.4;
      label = "Crowded longs, squeeze down risk";
      flow = undefined;
    } else if (fundingRate <= -SMART_MONEY.FUNDING_EXTREME) {
      score += 0.4;
      label = "Crowded shorts, squeeze up potential";
      flow = undefined;
    }
  }

  // 3. Long/short account-ratio crowding (mild contrarian).
  if (longShortRatio != null && longShortRatio > 0) {
    hasSignal = true;
    if (longShortRatio >= SMART_MONEY.LS_EXTREME) score -= 0.2;
    else if (longShortRatio <= 1 / SMART_MONEY.LS_EXTREME) score += 0.2;
  }

  if (!hasSignal) label = NO_POSITIONING_DATA_LABEL;

  return {
    openInterest,
    openInterestDelta,
    fundingRate,
    longShortRatio,
    positioningScore: clampUnit(score),
    label,
    flow,
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
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
 * Nudge a signal's conviction by how much positioning agrees with its direction
 * (bounded to ±MAX_CONVICTION_ADJ). Positioning that supports the trade boosts
 * it; positioning that opposes it (e.g. a LONG into crowded longs) dampens it
 * and adds a note. Never flips the signal. Returns a NEW outlook.
 */
export function applySmartMoney(outlook: Outlook, sm: SmartMoney): Outlook {
  if (outlook.signal === "neutral") return outlook;

  const dir = outlook.signal === "long" ? 1 : -1;
  // agreement ∈ [-1..1]: + when positioning supports the signal, − when against.
  const agreement =
    Math.sign(sm.positioningScore) === dir
      ? Math.abs(sm.positioningScore)
      : -Math.abs(sm.positioningScore);
  if (agreement === 0) return { ...outlook /* unchanged conviction */ };

  const factor = 1 + agreement * SMART_MONEY.MAX_CONVICTION_ADJ;
  const directionScore = clampUnit(outlook.directionScore * factor);
  const strength = Math.max(
    0,
    Math.min(100, Math.round(outlook.strength * factor)),
  );

  const note =
    agreement > 0
      ? `Smart money: ${sm.label} supports this ${outlook.signal.toUpperCase()} — conviction nudged up.`
      : `Smart money: ${sm.label} opposes this ${outlook.signal.toUpperCase()} — conviction dampened.`;

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
