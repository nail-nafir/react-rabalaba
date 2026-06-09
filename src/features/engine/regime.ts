/**
 * Regime engine (Layer 1) — classifies the market's behavioral state so the
 * signal engine can weight indicator categories appropriately and avoid trading
 * chop. Pure function, no side effects.
 *
 * The four states:
 * - low_volatility  → compression/squeeze (weak ADX + tight Bollinger bands)
 * - trending        → strong directional move (ADX >= strong-trend threshold)
 * - high_volatility → non-directional volatility expansion (ATR% elevated)
 * - ranging         → default: weak trend, normal volatility
 *
 * Priority order is deliberate: squeeze takes priority over everything (it is a
 * no-trade pre-breakout state), then trending takes priority over
 * high_volatility so a clean strong trend is not mislabeled.
 */
export type MarketRegimeKind =
  | "trending"
  | "ranging"
  | "high_volatility"
  | "low_volatility";

export interface RegimeInput {
  adx: number;
  atrPercent: number;
  bbBandwidthPercent: number;
  strongAdx: number;
  highVolAtrPercent: number;
  squeezeBandwidthPercent: number;
  squeezeMaxAdx: number;
}

export function classifyRegime(params: RegimeInput): MarketRegimeKind {
  const {
    adx,
    atrPercent,
    bbBandwidthPercent,
    strongAdx,
    highVolAtrPercent,
    squeezeBandwidthPercent,
    squeezeMaxAdx,
  } = params;

  // Bollinger bandwidth is always >= 0 (upper >= lower), so `< threshold`
  // alone captures the full compression range [0, threshold). A fully collapsed
  // band (bandwidth 0 — from a perfectly flat series or the insufficient-data
  // fallback) is MAXIMUM compression, the most squeeze-y state of all, so it
  // must be treated as low-volatility (which lets the chop filter stay flat)
  // rather than being excluded by a `> 0` guard.
  const isSqueeze =
    bbBandwidthPercent < squeezeBandwidthPercent && adx < squeezeMaxAdx;
  if (isSqueeze) return "low_volatility";

  if (adx >= strongAdx) return "trending";
  if (atrPercent >= highVolAtrPercent) return "high_volatility";
  return "ranging";
}
