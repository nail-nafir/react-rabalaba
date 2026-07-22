import type { Outlook } from "./signals";
import type { UnifiedAsset } from "@/types/asset";
import type { CryptoContext, RiskState } from "@/types/market";
import { CRYPTO_CONTEXT } from "@/constants/signals";
import { applyBenchmarkDerate, fightsBenchmark } from "./benchmark-derate";

/**
 * Top-down crypto context layer (formerly market-context).
 *
 * The per-asset signal engine (computeSignal) is deliberately isolated — it only
 * sees one asset's candles. But in crypto, ~90% of alts are leveraged beta to
 * BTC: a technically clean "LONG alt" while BTC is dumping is contextually wrong
 * ("ngawur"). This module derives a BTC-led risk state once, then DE-RATES (not
 * hides) any setup that fights it, adding a transparent warning. All functions
 * are pure; applyCryptoContext returns a NEW outlook (the input lives in the
 * react-query cache and must not be mutated).
 */

/** Derive the net crypto risk posture from BTC's regime-weighted score. */
export function deriveCryptoRiskState(
  btcDirectionScore: number,
): RiskState {
  const { RISK_SCORE_THRESHOLD } = CRYPTO_CONTEXT;
  if (btcDirectionScore <= -RISK_SCORE_THRESHOLD) return "risk_off";
  if (btcDirectionScore >= RISK_SCORE_THRESHOLD) return "risk_on";
  return "neutral";
}

/** Package BTC's computed outlook (+ optional dominance / returns)
 *  into the shared CryptoContext consumed by the screener, summary row, and
 *  dialog. btcReturns feeds relative-strength (alt vs BTC). */
export function deriveCryptoContext(
  btcOutlook: Outlook,
  dominance?: CryptoContext["dominance"],
  btcReturns?: CryptoContext["btcReturns"],
): CryptoContext {
  return {
    btcTrend: btcOutlook.trend,
    btcRegime: btcOutlook.regime,
    btcDirectionScore: btcOutlook.directionScore,
    riskState: deriveCryptoRiskState(btcOutlook.directionScore),
    dominance,
    btcReturns,
    lastUpdated: Date.now(),
  };
}

/** Detects BTC's own symbol so the context isn't applied to itself. */
function isBitcoin(symbol: string): boolean {
  return /^BTC[-/]?USD/i.test(symbol);
}

/**
 * Apply top-down crypto context to a per-asset crypto outlook.
 *
 * When a crypto setup fights the BTC-led risk state (LONG in risk-off / SHORT in
 * risk-on), DE-RATE its directionScore & strength and add a warning. The signal
 * still shows (transparent) — it just reads weaker and ranks lower. Aligned
 * setups, BTC itself, neutral signals, and non-crypto assets pass through
 * unchanged. Returns a NEW outlook; never mutates the input.
 */
export function applyCryptoContext(
  outlook: Outlook,
  asset: Pick<UnifiedAsset, "assetType" | "symbol">,
  ctx: CryptoContext,
): Outlook {
  if (
    asset.assetType !== "crypto" ||
    isBitcoin(asset.symbol) ||
    outlook.signal === "neutral" ||
    !fightsBenchmark(outlook.signal, ctx.riskState)
  ) {
    return outlook;
  }

  const riskLabel = ctx.riskState === "risk_off" ? "risk-off" : "risk-on";
  return applyBenchmarkDerate(outlook, {
    factor: CRYPTO_CONTEXT.COUNTER_MARKET_DERATE,
    warning: `Market context: BTC is ${riskLabel} (score ${ctx.btcDirectionScore.toFixed(
      2,
    )}), conflicting with this ${outlook.signal.toUpperCase()} setup — conviction de-rated. Most alts are leveraged beta to BTC.`,
  });
}
