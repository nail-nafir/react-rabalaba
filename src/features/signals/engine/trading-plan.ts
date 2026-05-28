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

  const { atr, support, resistance, adx } = outlook.indicators;

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

  // ── Dynamic R:R based on ADX ────────────────────────────────────────
  // In strong trends (high ADX), the first target can stretch further
  // because momentum is more likely to follow through. In choppy/ranging
  // markets (low ADX), keep conservative TP targets.
  const baseRR = adx > 30 ? 2.0 : adx > 25 ? 1.75 : 1.5;

  if (outlook.signal === "long") {
    // Visual trade plan only, not an automatic order recommendation.
    // Stop loss uses the wider of ATR-based invalidation and structural
    // support-buffer invalidation, then clamps plans with extreme risk
    // instead of discarding them entirely.
    const atrStop = currentPrice - effectiveAtr * atrMultiplier;
    const structureStop =
      support > 0 && support < currentPrice
        ? support - structureBuffer
        : atrStop;
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

    return {
      entry: currentPrice,
      stopLoss,
      takeProfit1: currentPrice + riskAmount * baseRR,
      takeProfit2: currentPrice + riskAmount * (baseRR + 1.0),
      takeProfit3: currentPrice + riskAmount * (baseRR + 2.0),
      riskRewardRatio: baseRR,
    };
  } else {
    // SHORT: inverted logic, using resistance-buffer invalidation.
    const atrStop = currentPrice + effectiveAtr * atrMultiplier;
    const structureStop =
      resistance > currentPrice
        ? resistance + structureBuffer
        : atrStop;
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

    return {
      entry: currentPrice,
      stopLoss,
      takeProfit1: currentPrice - riskAmount * baseRR,
      takeProfit2: currentPrice - riskAmount * (baseRR + 1.0),
      takeProfit3: currentPrice - riskAmount * (baseRR + 2.0),
      riskRewardRatio: baseRR,
    };
  }
}
