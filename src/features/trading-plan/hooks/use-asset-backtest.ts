import { queryOptions, useQuery } from "@tanstack/react-query";
import type { BacktestMetrics } from "@/core/engine/backtest";
import type { NormalizedYahooCandle } from "@/core/market/candles";
import type { UnifiedAsset } from "@/types/asset";
import { canonicalTimeframe } from "@/constants/timeframes";
import type {
  BacktestRequest,
  BacktestResponse,
} from "../model/backtest.worker";

export function runBacktestInWorker(
  input: BacktestRequest,
  signal: AbortSignal,
) {
  return new Promise<BacktestMetrics>((resolve, reject) => {
    signal.throwIfAborted();
    const worker = new Worker(
      new URL("../model/backtest.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<BacktestResponse>) => {
      cleanup();
      if ("error" in data) reject(new Error(data.error));
      else resolve(data.metrics);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      cleanup();
      reject(new Error(event.message || "Backtest worker failed"));
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("Unable to read backtest result"));
    };
    try {
      worker.postMessage(input);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export function assetBacktestOptions(
  asset: UnifiedAsset | undefined,
  candles: NormalizedYahooCandle[],
  dataUpdatedAt: number,
) {
  const timeframe = canonicalTimeframe(asset?.timeframe);
  return queryOptions({
    queryKey: ["asset-backtest", asset?.symbol, timeframe, dataUpdatedAt],
    queryFn: ({ signal }) => {
      if (!asset) throw new Error("Missing asset for backtest");
      return runBacktestInWorker(
        { candles, assetType: asset.assetType, timeframe },
        signal,
      );
    },
    enabled: !!asset && candles.length >= 150,
    staleTime: Infinity,
    refetchInterval: false,
    retry: false,
    meta: { silent: true },
  });
}

export function useAssetBacktest(
  asset: UnifiedAsset | undefined,
  candles: NormalizedYahooCandle[],
  dataUpdatedAt: number,
) {
  return useQuery(assetBacktestOptions(asset, candles, dataUpdatedAt));
}
