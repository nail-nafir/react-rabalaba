import type { Accumulation, SmartMoney, UnifiedAsset } from "@/types/asset";
import type { IdxContext, MarketContext } from "@/types/market";
import { applyMarketContext } from "./market-context";
import { applyIdxContext } from "./idx-context";
import { applySmartMoney } from "./smart-money";
import {
  applyAccumulation,
  deriveAccumulation,
  supportsAccumulation,
} from "./accumulation";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/services/adapters/yahoo-candles";

/** Cross-asset inputs for the enrichment chain. marketContext/idxContext are
 *  universe-wide (computed once); smartMoney is this asset's own positioning
 *  (the call site does the per-symbol lookup). */
export interface EnrichmentInputs {
  marketContext?: MarketContext;
  idxContext?: IdxContext;
  smartMoney?: SmartMoney;
}

/**
 * Shared post-signal enrichment chain — the ONE place the apply-layer order
 * lives, consumed by both the screener table and the detail dialog so the
 * conviction/tier they show never drifts apart.
 *
 * ORDER (load-bearing — change it and the math changes):
 *  1) Top-down context de-rate (BTC for crypto / IHSG for id-stock —
 *     mutually exclusive by assetType). The macro regime caps conviction
 *     BEFORE any flow read fine-tunes it.
 *  2) Flow nudge (smart-money positioning for crypto / accumulation for
 *     equities — US & ID stocks) — bounded ±15%, never flips a signal.
 *  3) [Phase 2] relative strength — display-only attach, no outlook change.
 *  4) [Phase 2] speculative-risk LAST — a warning layer on top of the final
 *     state (escalates risk only, never touches signal/strength/tier).
 *
 * Pure & immutable: computeSignal stays per-asset, cache data is never
 * mutated, and the SAME asset reference comes back when nothing applied.
 * For equities the accumulation read is derived here from the asset's own
 * candles (normalize → resample to daily → derive; zero network, sub-ms).
 */
export function enrichAsset(
  asset: UnifiedAsset,
  inputs: EnrichmentInputs,
): UnifiedAsset {
  if (!asset.outlook) return asset;

  const { marketContext, idxContext, smartMoney } = inputs;
  let outlook = asset.outlook;
  let accumulation: Accumulation | undefined;

  // 1) Context de-rate, top-down.
  if (asset.assetType === "crypto" && marketContext) {
    outlook = applyMarketContext(outlook, asset, marketContext);
  } else if (asset.assetType === "id-stock" && idxContext) {
    outlook = applyIdxContext(outlook, asset, idxContext);
  }

  // 2) Flow nudge.
  const attachSmartMoney =
    asset.assetType === "crypto" ? smartMoney : undefined;
  if (attachSmartMoney) {
    outlook = applySmartMoney(outlook, attachSmartMoney);
  } else if (supportsAccumulation(asset.assetType)) {
    const daily = resampleCandlesToDaily(
      normalizeYahooCandles(asset.quoteIndicators, asset.timestamps),
    );
    // Attached even when the outlook is neutral — flow context is useful
    // pre-signal (the dialog shows the panel without a signal gate).
    accumulation = deriveAccumulation(daily) ?? undefined;
    if (accumulation) outlook = applyAccumulation(outlook, accumulation);
  }

  if (outlook === asset.outlook && !attachSmartMoney && !accumulation) {
    return asset;
  }

  return {
    ...asset,
    outlook,
    ...(attachSmartMoney ? { smartMoney: attachSmartMoney } : {}),
    ...(accumulation ? { accumulation } : {}),
  };
}
