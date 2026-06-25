import type {
  Accumulation,
  Fundamentals,
  RelativeStrength,
  SmartMoney,
  UnifiedAsset,
} from "@/types/asset";
import type { CryptoContext, IdxContext, UsContext } from "@/types/market";
import { applyCryptoContext } from "./crypto-context";
import { applyIdxContext } from "./idx-context";
import { applyUsContext } from "./us-context";
import { applyFundamentals } from "./fundamentals";
import { applySmartMoney } from "./smart-money";
import {
  applyAccumulation,
  deriveAccumulation,
  supportsAccumulation,
} from "./accumulation";
import {
  applyRelativeStrength,
  deriveRelativeStrength,
  type WindowReturns,
} from "./relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/services/adapters/yahoo-candles";

/** The window returns + display name of the benchmark an asset answers to
 *  (id→IHSG, us→S&P, crypto→BTC), or null when no context covers its class. */
function benchmarkReturnsFor(
  assetType: UnifiedAsset["assetType"],
  inputs: Pick<EnrichmentInputs, "cryptoContext" | "idxContext" | "usContext">,
): { returns: WindowReturns; name: string } | null {
  if (assetType === "crypto" && inputs.cryptoContext?.btcReturns) {
    return { returns: inputs.cryptoContext.btcReturns, name: "BTC" };
  }
  if (assetType === "id-stock" && inputs.idxContext?.ihsgReturns) {
    return { returns: inputs.idxContext.ihsgReturns, name: "IHSG" };
  }
  if (assetType === "us-stock" && inputs.usContext?.spxReturns) {
    return { returns: inputs.usContext.spxReturns, name: "S&P 500" };
  }
  return null;
}

/** Cross-asset inputs for the enrichment chain. crypto/idx/usContext are
 *  universe-wide (computed once); smartMoney & fundamentals are this asset's own
 *  reads (the call site does the per-symbol lookup). fundamentals is browser-
 *  only (one extra fetch per asset) — the cron leaves it undefined. */
export interface EnrichmentInputs {
  cryptoContext?: CryptoContext;
  idxContext?: IdxContext;
  usContext?: UsContext;
  smartMoney?: SmartMoney;
  fundamentals?: Fundamentals;
}

/**
 * Shared post-signal enrichment chain — the ONE place the apply-layer order
 * lives, consumed by both the screener table and the detail dialog so the
 * conviction/tier they show never drifts apart.
 *
 * ORDER (load-bearing — change it and the math changes):
 *  1) Top-down context de-rate (BTC for crypto / IHSG for id-stock / S&P 500
 *     for us-stock — mutually exclusive by assetType). The macro regime caps
 *     conviction BEFORE any flow read fine-tunes it.
 *  2) Flow nudge (smart-money positioning for crypto / accumulation for
 *     equities — US & ID stocks) — bounded ±15%, never flips a signal.
 *  3) Relative strength vs the asset's own benchmark (id→IHSG, us→S&P,
 *     crypto→BTC) — a bounded ±10% leadership nudge + display read; never
 *     flips a signal. Only runs when the context carries benchmark returns.
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

  const { cryptoContext, idxContext, usContext, smartMoney, fundamentals } =
    inputs;
  let outlook = asset.outlook;
  let accumulation: Accumulation | undefined;

  // 1) Context de-rate, top-down (each asset reads its OWN index — BTC for
  //    crypto, IHSG for ID stocks, S&P 500 for US stocks; mutually exclusive).
  if (asset.assetType === "crypto" && cryptoContext) {
    outlook = applyCryptoContext(outlook, asset, cryptoContext);
  } else if (asset.assetType === "id-stock" && idxContext) {
    outlook = applyIdxContext(outlook, asset, idxContext);
  } else if (asset.assetType === "us-stock" && usContext) {
    outlook = applyUsContext(outlook, asset, usContext);
  }

  // The asset's daily candles feed BOTH the flow read (equities) and the
  // relative-strength read (any benchmarked class) — resample once.
  const daily = asset.quoteIndicators
    ? resampleCandlesToDaily(
        normalizeYahooCandles(asset.quoteIndicators, asset.timestamps),
      )
    : [];

  // 2) Flow nudge.
  const attachSmartMoney =
    asset.assetType === "crypto" ? smartMoney : undefined;
  if (attachSmartMoney) {
    outlook = applySmartMoney(outlook, attachSmartMoney);
  } else if (supportsAccumulation(asset.assetType)) {
    // Attached even when the outlook is neutral — flow context is useful
    // pre-signal (the dialog shows the panel without a signal gate).
    accumulation = deriveAccumulation(daily) ?? undefined;
    if (accumulation) outlook = applyAccumulation(outlook, accumulation);
  }

  // 3) Relative strength vs the asset's OWN benchmark — a bounded leadership
  //    nudge (leader strengthens an aligned trade, laggard dampens it) plus a
  //    display read. Only runs when its context carries benchmark returns.
  let relativeStrength: RelativeStrength | undefined;
  const bench = benchmarkReturnsFor(asset.assetType, {
    cryptoContext,
    idxContext,
    usContext,
  });
  if (bench && daily.length > 0) {
    relativeStrength =
      deriveRelativeStrength(
        daily.map((c) => c.close),
        bench.returns,
        bench.name,
      ) ?? undefined;
    if (relativeStrength) {
      outlook = applyRelativeStrength(outlook, relativeStrength);
    }
  }

  // 4) Fundamentals + analyst overlay (stocks only) — earnings-blackout
  //    de-rate, a small analyst-consensus nudge, and valuation caution flags.
  //    Browser-only (per-asset fetch); the cron leaves `fundamentals` undefined.
  const isStock =
    asset.assetType === "us-stock" || asset.assetType === "id-stock";
  const attachFundamentals = isStock ? fundamentals : undefined;
  if (attachFundamentals) {
    outlook = applyFundamentals(outlook, attachFundamentals);
  }

  if (
    outlook === asset.outlook &&
    !attachSmartMoney &&
    !accumulation &&
    !relativeStrength &&
    !attachFundamentals
  ) {
    return asset;
  }

  return {
    ...asset,
    outlook,
    ...(attachFundamentals ? { fundamentals: attachFundamentals } : {}),
    ...(attachSmartMoney ? { smartMoney: attachSmartMoney } : {}),
    ...(accumulation ? { accumulation } : {}),
    ...(relativeStrength ? { relativeStrength } : {}),
  };
}
