import type { Outlook } from "./signal-engine";
import type { TradingPlan, AssetType } from "@/types/asset";

export function computeTradingPlan(
  outlook: Outlook,
  currentPrice: number,
  assetType: AssetType
): TradingPlan | null {
  if (!outlook || !currentPrice) return null;
  // No actionable plan for NEUTRAL signals
  if (outlook.signal === "neutral") return null;

  const { atr, support, resistance, adx, recentSwingHigh, recentSwingLow } =
    outlook.indicators;

  // ── ATR fallback ────────────────────────────────────────────────────
  // When ATR is 0 or missing (thin data, new listings, etc.) we fall
  // back to a percentage-of-price estimate so that an actionable signal
  // always produces a visual trading plan.
  const effectiveAtr =
    atr > 0 ? atr : currentPrice * (assetType === "crypto" ? 0.03 : 0.015);

  const atrMultiplier = 1.5; // Standard ATR multiplier for stop placement
  const structureBuffer = Math.max(effectiveAtr * 0.25, currentPrice * 0.001);
  const maxRiskPct = assetType === "crypto" ? 0.12 : 0.08;
  const minRiskPct = 0.0005;

  // ── Adaptive R:R ────────────────────────────────────────────────────
  // Prefer the distance to the opposing structural level (recent swing /
  // liquidity), clamped to a sane band. Fall back to an ADX-based estimate
  // only when no structural target exists. Markets are not linear, so a flat
  // "ADX > 30 ? 2.0" ladder is a weak proxy for follow-through.
  const MIN_RR = 1.0;
  const MAX_RR = 4.0;
  const baseRR = adx > 30 ? 2.0 : adx > 25 ? 1.75 : 1.5;
  const structuralRR = (target: number, risk: number): number => {
    if (target <= 0 || risk <= 0) return baseRR;
    const rr = target / risk;
    if (!Number.isFinite(rr) || rr < MIN_RR) return baseRR;
    return Math.min(MAX_RR, rr);
  };

  if (outlook.signal === "long") {
    // Visual trade plan only, not an automatic order recommendation.
    // Stop loss uses the wider of ATR-based invalidation and structural
    // (recent swing low, else pivot support) invalidation.
    const atrStop = currentPrice - effectiveAtr * atrMultiplier;
    const structureRef =
      recentSwingLow > 0 && recentSwingLow < currentPrice
        ? recentSwingLow
        : support > 0 && support < currentPrice
          ? support
          : 0;
    const structureStop =
      structureRef > 0 ? structureRef - structureBuffer : atrStop;
    let stopLoss = Math.min(atrStop, structureStop);
    let riskAmount = currentPrice - stopLoss;

    // Guard: stop above entry is invalid → force ATR-based stop
    if (riskAmount <= 0) {
      stopLoss = currentPrice - effectiveAtr * atrMultiplier;
      riskAmount = currentPrice - stopLoss;
      if (riskAmount <= 0) return null; // truly degenerate data
    }

    // Clamp risk to acceptable range instead of rejecting outright
    const riskPct = riskAmount / currentPrice;
    if (riskPct < minRiskPct) {
      riskAmount = currentPrice * minRiskPct;
      stopLoss = currentPrice - riskAmount;
    } else if (riskPct > maxRiskPct) {
      riskAmount = currentPrice * maxRiskPct;
      stopLoss = currentPrice - riskAmount;
    }

    // Target distance from the opposing structural level (swing high / liquidity).
    const structuralTarget =
      recentSwingHigh > currentPrice
        ? recentSwingHigh - currentPrice
        : resistance > currentPrice
          ? resistance - currentPrice
          : 0;
    const rr = structuralRR(structuralTarget, riskAmount);

    return {
      entry: currentPrice,
      stopLoss,
      takeProfit1: currentPrice + riskAmount * rr,
      takeProfit2: currentPrice + riskAmount * (rr + 1.0),
      takeProfit3: currentPrice + riskAmount * (rr + 2.0),
      riskRewardRatio: rr,
    };
  } else {
    // SHORT: inverted logic, using swing high / pivot resistance invalidation.
    const atrStop = currentPrice + effectiveAtr * atrMultiplier;
    const structureRef =
      recentSwingHigh > currentPrice
        ? recentSwingHigh
        : resistance > currentPrice
          ? resistance
          : 0;
    const structureStop =
      structureRef > 0 ? structureRef + structureBuffer : atrStop;
    let stopLoss = Math.max(atrStop, structureStop);
    let riskAmount = stopLoss - currentPrice;

    // Guard: stop below entry is invalid → force ATR-based stop
    if (riskAmount <= 0) {
      stopLoss = currentPrice + effectiveAtr * atrMultiplier;
      riskAmount = stopLoss - currentPrice;
      if (riskAmount <= 0) return null; // truly degenerate data
    }

    // Clamp risk to acceptable range instead of rejecting outright
    const riskPct = riskAmount / currentPrice;
    if (riskPct < minRiskPct) {
      riskAmount = currentPrice * minRiskPct;
      stopLoss = currentPrice + riskAmount;
    } else if (riskPct > maxRiskPct) {
      riskAmount = currentPrice * maxRiskPct;
      stopLoss = currentPrice + riskAmount;
    }

    const structuralTarget =
      recentSwingLow > 0 && recentSwingLow < currentPrice
        ? currentPrice - recentSwingLow
        : support > 0 && support < currentPrice
          ? currentPrice - support
          : 0;
    const rr = structuralRR(structuralTarget, riskAmount);

    return {
      entry: currentPrice,
      stopLoss,
      takeProfit1: currentPrice - riskAmount * rr,
      takeProfit2: currentPrice - riskAmount * (rr + 1.0),
      takeProfit3: currentPrice - riskAmount * (rr + 2.0),
      riskRewardRatio: rr,
    };
  }
}
