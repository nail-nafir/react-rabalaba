import {
  formatResearchTimestamp,
  type MarketResearchContext,
  type ResearchCandle,
  type TerminalResearchContext,
} from "@/features/chat/terminal-context";

export type ChartSpec = {
  type: "price" | "relativePerformance" | "setup";
  symbols: string[];
};

export function parseChartSpec(source: string): ChartSpec | null {
  try {
    const value: unknown = JSON.parse(source);
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => key !== "type" && key !== "symbols") ||
      !("type" in value) ||
      !("symbols" in value) ||
      (value.type !== "price" &&
        value.type !== "relativePerformance" &&
        value.type !== "setup") ||
      !Array.isArray(value.symbols) ||
      value.symbols.length > 3 ||
      (value.type === "relativePerformance"
        ? value.symbols.length < 2
        : value.symbols.length !== 1) ||
      !value.symbols.every(
        (symbol) =>
          typeof symbol === "string" && /^[A-Za-z0-9._^=-]{1,64}$/.test(symbol),
      ) ||
      new Set(value.symbols.map((symbol: string) => symbol.toUpperCase())).size !==
        value.symbols.length
    ) {
      return null;
    }
    return value as ChartSpec;
  } catch {
    return null;
  }
}

type ChartAsset = {
  symbol: string;
  timeframe: string;
  stale: boolean;
  recentCandles: ResearchCandle[];
};

export function buildChartData(
  spec: ChartSpec,
  terminalContext: TerminalResearchContext | null,
  marketContexts: MarketResearchContext[],
) {
  const assets: ChartAsset[] = [
    ...(terminalContext
      ? [
          {
            ...terminalContext,
            stale:
              Date.now() -
                (terminalContext.quoteTime ?? terminalContext.capturedAt) >
              (terminalContext.assetType === "crypto" ? 6 : 72) * 60 * 60_000,
          },
        ]
      : []),
    ...marketContexts,
  ];
  const selected = spec.symbols.map((symbol) =>
    assets.find((asset) => asset.symbol.toUpperCase() === symbol.toUpperCase()),
  );
  if (selected.some((asset) => !asset || asset.recentCandles.length < 2)) {
    return null;
  }
  const resolved = selected as ChartAsset[];
  if (
    spec.type === "relativePerformance" &&
    new Set(resolved.map((asset) => asset.timeframe)).size !== 1
  )
    return null;

  const closesByTimestamp = resolved.map(
    (asset) =>
      new Map(
        asset.recentCandles.map((candle) => [candle.timestamp, candle.close]),
      ),
  );
  const timestamps = resolved[0].recentCandles
    .map((candle) => candle.timestamp)
    .filter(
      (timestamp) =>
        spec.type === "price" ||
        closesByTimestamp.every((series) => series.has(timestamp)),
    );
  if (timestamps.length < 2) return null;

  const baselines = closesByTimestamp.map(
    (series) => series.get(timestamps[0])!,
  );
  const data = timestamps.map((timestamp, index) => {
    const point: Record<string, string | number> = {
      index: index + 1,
      time: formatResearchTimestamp(timestamp * 1_000),
    };
    resolved.forEach((asset, assetIndex) => {
      const value = closesByTimestamp[assetIndex].get(timestamp)!;
      point[asset.symbol] =
        spec.type === "relativePerformance"
          ? (value / baselines[assetIndex] - 1) * 100
          : value;
    });
    return point;
  });
  return {
    assets: resolved,
    data,
    stale: resolved.some((asset) => asset.stale),
  };
}

type SetupAsset = TerminalResearchContext | MarketResearchContext;
type SetupLevel = {
  key: "entry" | "stop_loss" | "tp1" | "tp2" | "tp3";
  price: number;
  kind: "entry" | "risk" | "profit";
};

export type SetupChartModel = {
  asset: SetupAsset;
  candles: ResearchCandle[];
  levels: SetupLevel[];
  min: number;
  max: number;
  quoteTime: number;
  stale: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validCandle(value: unknown): value is ResearchCandle {
  if (!record(value)) return false;
  const { open, high, low, close, volume, timestamp } = value;
  return (
    positive(open) &&
    positive(high) &&
    positive(low) &&
    positive(close) &&
    high >= Math.max(open, close) &&
    low <= Math.min(open, close) &&
    typeof volume === "number" &&
    Number.isFinite(volume) &&
    volume >= 0 &&
    positive(timestamp)
  );
}

function setupLevels(
  entry: unknown,
  stop: unknown,
  targets: unknown[],
  signal: unknown,
): SetupLevel[] {
  if (
    !positive(entry) ||
    !positive(stop) ||
    entry === stop ||
    targets.length < 1 ||
    targets.length > 3
  ) return [];
  const direction = stop < entry ? "long" : "short";
  if (signal === "long" || signal === "short") {
    if (signal !== direction) return [];
  } else if (signal !== undefined && signal !== null) {
    return [];
  }
  const validTarget = (value: unknown) =>
    positive(value) && (direction === "long" ? value > entry : value < entry);
  if (!targets.every(validTarget)) return [];
  const prices = targets as number[];
  if (prices.some((price, index) => index > 0 && (
    direction === "long" ? price <= prices[index - 1] : price >= prices[index - 1]
  ))) return [];
  return [
    { key: "entry", price: entry, kind: "entry" },
    { key: "stop_loss", price: stop, kind: "risk" },
    ...prices.map((price, index) => ({
      key: `tp${index + 1}` as SetupLevel["key"],
      price,
      kind: "profit" as const,
    })),
  ];
}

function levelsFromAsset(asset: SetupAsset): SetupLevel[] {
  if ("kind" in asset && asset.kind === "trade" && asset.position) {
    const position = asset.position;
    if (!Array.isArray(position.takeProfits)) return [];
    return setupLevels(
      position.entryPrice,
      position.stopLoss,
      position.takeProfits,
      position.signal,
    );
  }
  const plan = asset.tradingPlan;
  if (!record(plan)) return [];
  const targets = [plan.takeProfit1, plan.takeProfit2];
  if (plan.takeProfit3 !== undefined) targets.push(plan.takeProfit3);
  const signal = record(asset.outlook) ? asset.outlook.signal : undefined;
  return setupLevels(plan.entry, plan.stopLoss, targets, signal);
}

export function buildSetupChartModel(
  symbol: string,
  terminalContext: TerminalResearchContext | null,
  marketContexts: MarketResearchContext[],
): SetupChartModel | null {
  const asset: SetupAsset | undefined =
    (terminalContext?.symbol.toUpperCase() === symbol.toUpperCase()
      ? terminalContext
      : undefined) ??
    marketContexts.find(
      (context) => context.symbol.toUpperCase() === symbol.toUpperCase(),
    );
  if (!asset || !Array.isArray(asset.recentCandles)) return null;

  const candles = [
    ...new Map(
      asset.recentCandles
        .filter(validCandle)
        .map((candle) => [candle.timestamp, candle] as const),
    ).values(),
  ].sort((a, b) => a.timestamp - b.timestamp);
  if (candles.length < 2) return null;

  const levels = levelsFromAsset(asset);
  const prices = [
    ...candles.flatMap((candle) => [candle.low, candle.high]),
    ...levels.map((level) => level.price),
  ];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const padding = (high - low) * 0.05 || high * 0.01;
  const quoteTime = asset.quoteTime ?? candles.at(-1)!.timestamp * 1_000;
  const staleAfter = (asset.assetType === "crypto" ? 6 : 72) * 60 * 60_000;
  return {
    asset,
    candles,
    levels,
    min: Math.max(0, low - padding),
    max: high + padding,
    quoteTime,
    stale:
      ("stale" in asset && asset.stale) || Date.now() - quoteTime > staleAfter,
  };
}
