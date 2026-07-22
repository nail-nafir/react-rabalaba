/**
 * Pure server-side equivalent of the three React context hooks
 * (useCryptoContext / useIdxContext / useUsContext). Given the already-fetched
 * benchmark assets, it builds the same top-down contexts the browser does — the
 * SAME derive* functions — so the auto-journal cron de-rates identically to the
 * app. No fetch, no DB, no React → fully unit-testable and edge-bundle-safe.
 */
import type { AssetType, UnifiedAsset } from "@/types/asset";
import type { CryptoContext, IdxContext, UsContext } from "@/types/market";
import { deriveCryptoContext } from "@/features/engine/crypto-context";
import { deriveIdxContext } from "@/features/engine/idx-context";
import { deriveUsContext } from "@/features/engine/us-context";
import { fightsBenchmark } from "@/features/engine/benchmark-derate";
import { computeWindowReturns } from "@/features/engine/relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/services/adapters/yahoo-candles";
import { IDX_BENCHMARK_SYMBOL, USDIDR_SYMBOL } from "@/constants/idx";
import { US_BENCHMARK_SYMBOL, VIX_SYMBOL, DXY_SYMBOL } from "@/constants/us";
import { JOURNAL_EMISSION } from "@/constants/signals";
import type { RiskState } from "@/types/market";

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
    normalizeYahooCandles(asset.quoteIndicators, asset.timestamps),
  ).map((c) => c.close);
}

/** Build all three contexts from already-fetched, already-adapted benchmark
 *  assets keyed by symbol. */
export function buildEngineContexts(
  assetBySymbol: Map<string, UnifiedAsset>,
): EngineContexts {
  const contexts: EngineContexts = {};

  const btc = assetBySymbol.get(BTC_SYMBOL);
  if (btc?.outlook) {
    const btcReturns = computeWindowReturns(dailyCloses(btc));
    contexts.cryptoContext = deriveCryptoContext(
      btc.outlook,
      undefined,
      btcReturns,
    );
  }

  const ihsg = assetBySymbol.get(IDX_BENCHMARK_SYMBOL);
  if (ihsg?.outlook) {
    const ihsgReturns = computeWindowReturns(dailyCloses(ihsg));
    const usdIdr = assetBySymbol.get(USDIDR_SYMBOL);
    let usdIdrInput: Parameters<typeof deriveIdxContext>[1] = {
      trend: "sideways",
    };
    if (usdIdr?.outlook) {
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
  if (spx?.outlook) {
    const spxReturns = computeWindowReturns(dailyCloses(spx));
    const vix = assetBySymbol.get(VIX_SYMBOL);
    const dxy = assetBySymbol.get(DXY_SYMBOL);
    const tiebreak: Parameters<typeof deriveUsContext>[1] = {};
    if (vix) {
      tiebreak.vixLevel = vix.price;
      tiebreak.vix1wChangePercent = computeWindowReturns(dailyCloses(vix)).r1w;
    }
    if (dxy) {
      tiebreak.dxy1wChangePercent = computeWindowReturns(dailyCloses(dxy)).r1w;
    }
    contexts.usContext = deriveUsContext(spx.outlook, tiebreak, spxReturns);
  }

  return contexts;
}

/** Risk state of the benchmark this asset answers to, or undefined when no
 *  context covers its class (commodity/forex). */
function riskStateFor(
  assetType: AssetType,
  contexts: EngineContexts,
): RiskState | undefined {
  if (assetType === "crypto") return contexts.cryptoContext?.riskState;
  if (assetType === "id-stock") return contexts.idxContext?.riskState;
  if (assetType === "us-stock") return contexts.usContext?.riskState;
  return undefined;
}

/**
 * Auto-journal emission gate. A counter-trend call (one that fights its
 * benchmark risk state) is only journaled when its POST-context strength still
 * clears COUNTER_TREND_MIN_STRENGTH — i.e. only exceptional setups get called
 * against the index. Aligned calls, and classes with no benchmark
 * (commodity/forex), always pass. `strengthAtEntry` is the already-de-rated
 * strength from the enriched outlook (see buildFollowedTrade).
 */
export function passesEmissionGate(
  trade: { assetType: AssetType; signal: "long" | "short"; strengthAtEntry: number },
  contexts: EngineContexts,
): boolean {
  const riskState = riskStateFor(trade.assetType, contexts);
  if (!riskState) return true;
  if (!fightsBenchmark(trade.signal, riskState)) return true;
  return trade.strengthAtEntry >= JOURNAL_EMISSION.COUNTER_TREND_MIN_STRENGTH;
}
