/**
 * Pure server-side equivalent of the three React context hooks
 * (useCryptoContext / useIdxContext / useUsContext). Given the already-fetched
 * benchmark assets, it builds the same top-down contexts the browser does — the
 * SAME derive* functions — so the auto-journal cron de-rates identically to the
 * app. No fetch, no DB, no React → fully unit-testable and edge-bundle-safe.
 */
import type { UnifiedAsset } from "@/types/asset";
import type { CryptoContext, IdxContext, UsContext } from "@/types/market";
import { deriveCryptoContext } from "@/core/engine/crypto-context";
import { deriveIdxContext } from "@/core/engine/idx-context";
import { deriveUsContext } from "@/core/engine/us-context";
import { computeWindowReturns } from "@/core/engine/relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/core/market/candles";
import { IDX_BENCHMARK_SYMBOL, USDIDR_SYMBOL } from "@/constants/idx";
import { US_BENCHMARK_SYMBOL, VIX_SYMBOL, DXY_SYMBOL } from "@/constants/us";

const BTC_SYMBOL = "BTC-USD";

/** The three top-down contexts, computed once per cron cycle. A context is
 *  omitted when its benchmark wasn't fetched (graceful). Shape is a subset of
 *  EnrichmentInputs so it can be passed straight to enrichAsset. */
export interface EngineContexts {
  cryptoContext?: CryptoContext;
  idxContext?: IdxContext;
  usContext?: UsContext;
}

function dailyCloses(asset: UnifiedAsset): number[] {
  return resampleCandlesToDaily(
    normalizeYahooCandles(asset.quoteIndicators, asset.timestamps, {
      requireTimestamps: true,
      requirePhysical: true,
    }),
  ).map((c) => c.close);
}

/** Build all three contexts from already-fetched, already-adapted benchmark
 *  assets keyed by symbol. */
export function buildEngineContexts(
  assetBySymbol: Map<string, UnifiedAsset>,
): EngineContexts {
  const contexts: EngineContexts = {};

  const btc = assetBySymbol.get(BTC_SYMBOL);
  if (btc?.outlook?.dataQuality?.ready) {
    const btcReturns = computeWindowReturns(dailyCloses(btc));
    contexts.cryptoContext = deriveCryptoContext(
      btc.outlook,
      undefined,
      btcReturns,
    );
  }

  const ihsg = assetBySymbol.get(IDX_BENCHMARK_SYMBOL);
  if (ihsg?.outlook?.dataQuality?.ready) {
    const ihsgReturns = computeWindowReturns(dailyCloses(ihsg));
    const usdIdr = assetBySymbol.get(USDIDR_SYMBOL);
    let usdIdrInput: Parameters<typeof deriveIdxContext>[1] = {
      trend: "sideways",
    };
    if (usdIdr?.outlook?.dataQuality?.ready) {
      usdIdrInput = {
        trend: usdIdr.outlook.trend,
        oneWeekChangePercent: computeWindowReturns(dailyCloses(usdIdr)).r1w,
      };
    }
    contexts.idxContext = deriveIdxContext(
      ihsg.outlook,
      usdIdrInput,
      ihsgReturns,
    );
  }

  const spx = assetBySymbol.get(US_BENCHMARK_SYMBOL);
  if (spx?.outlook?.dataQuality?.ready) {
    const spxReturns = computeWindowReturns(dailyCloses(spx));
    const vix = assetBySymbol.get(VIX_SYMBOL);
    const dxy = assetBySymbol.get(DXY_SYMBOL);
    const tiebreak: Parameters<typeof deriveUsContext>[1] = {};
    if (vix?.outlook?.dataQuality?.ready) {
      tiebreak.vixLevel = vix.price;
      tiebreak.vix1wChangePercent = computeWindowReturns(dailyCloses(vix)).r1w;
    }
    if (dxy?.outlook?.dataQuality?.ready) {
      tiebreak.dxy1wChangePercent = computeWindowReturns(dailyCloses(dxy)).r1w;
    }
    contexts.usContext = deriveUsContext(spx.outlook, tiebreak, spxReturns);
  }

  return contexts;
}
