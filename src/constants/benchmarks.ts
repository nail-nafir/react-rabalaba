import type { AssetType } from "@/constants/taxonomy/asset";
import { IDX_BENCHMARK_SYMBOL, USDIDR_SYMBOL } from "./idx";
import { US_BENCHMARK_SYMBOL, VIX_SYMBOL, DXY_SYMBOL } from "./us";

/** BTC is the macro driver for the crypto card. */
const BTC_SYMBOL = "BTC-USD";

/** The benchmark/context symbols each asset class needs fetched to compute its
 *  top-down context (each asset reads its OWN index). Commodity & forex have no
 *  single benchmark, so they get none. */
const BENCHMARKS_BY_TYPE: Record<AssetType, string[]> = {
  crypto: [BTC_SYMBOL],
  "id-stock": [IDX_BENCHMARK_SYMBOL, USDIDR_SYMBOL],
  "us-stock": [US_BENCHMARK_SYMBOL, VIX_SYMBOL, DXY_SYMBOL],
  commodity: [],
  forex: [],
};

/** Context symbols a given asset class needs fetched for its top-down context. */
export function benchmarkSymbolsFor(assetType: AssetType): string[] {
  return BENCHMARKS_BY_TYPE[assetType] ?? [];
}

/** Every benchmark/context symbol across all classes, de-duplicated. The cron
 *  fetches these IN ADDITION to the journaled universe; the ones not already in
 *  the universe (^JKSE, ^GSPC, ^VIX, DX-Y.NYB) are context-only and must NOT be
 *  journaled themselves. */
export const ALL_BENCHMARK_SYMBOLS: string[] = [
  ...new Set(Object.values(BENCHMARKS_BY_TYPE).flat()),
];
