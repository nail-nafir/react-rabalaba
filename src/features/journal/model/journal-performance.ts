import {
  computePnl,
  type FollowedTrade,
} from "@/core/trade/follow-trade-model";
import type { YahooChartResult } from "@/services/api/yahoo-finance";

export type JournalChartTimeframe = "1D" | "1W" | "1M" | "ALL";
export type BenchmarkDataKey = "btcPct" | "goldPct";

export type BenchmarkChartData = Partial<
  Record<BenchmarkDataKey, YahooChartResult | null | undefined>
>;

export interface JournalPerformancePoint {
  date: string;
  dayPct: number;
  dayPctWin: number | null;
  dayPctLoss: number | null;
  cumPct: number;
  btcPct: number | null;
  goldPct: number | null;
}

export interface AssetTypePercent {
  assetType: string;
  pct: number;
}

const DAY_MS = 86_400_000;
const BENCHMARK_KEYS = ["btcPct", "goldPct"] as const;

const dayKey = (ms: number) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function datesBetween(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(dayKey(current.getTime()));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function dailyRangeForSpan(
  oldestTradeMs: number,
  nowMs = Date.now(),
): string {
  const days = Math.max(1, (nowMs - oldestTradeMs) / DAY_MS);
  if (days <= 31) return "1mo";
  if (days <= 93) return "3mo";
  if (days <= 186) return "6mo";
  if (days <= 366) return "1y";
  if (days <= 732) return "2y";
  if (days <= 1_830) return "5y";
  if (days <= 3_660) return "10y";
  return "max";
}

export function benchmarkQueryWindow(
  timeframe: JournalChartTimeframe,
  oldestTradeMs: number,
  nowMs = Date.now(),
): { range: string; interval: string } {
  if (timeframe === "1D") return { range: "2d", interval: "30m" };
  if (timeframe === "ALL") {
    return {
      range: dailyRangeForSpan(oldestTradeMs, nowMs),
      interval: "1d",
    };
  }
  return { range: "1mo", interval: "1d" };
}

function benchmarkReturnsForDates(
  result: YahooChartResult | null | undefined,
  dates: string[],
  timeframe: JournalChartTimeframe,
  nowMs: number,
): Map<string, number | null> {
  const close = result?.indicators.quote[0]?.close ?? [];
  const prices = new Map<string, number>();

  result?.timestamp.forEach((timestamp, index) => {
    const price = close[index];
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return;
    }
    const date = new Date(timestamp * 1000);
    if (timeframe === "1D" && dayKey(date.getTime()) !== dayKey(nowMs)) {
      return;
    }
    const bucket =
      timeframe === "1D"
        ? `${String(date.getHours()).padStart(2, "0")}:00`
        : dayKey(date.getTime());
    prices.set(bucket, price);
  });

  const returns = new Map<string, number | null>();
  let baseline: number | null = null;
  let latest: number | null = null;

  for (const date of dates) {
    latest = prices.get(date) ?? latest;
    baseline ??= latest;
    returns.set(
      date,
      baseline !== null && latest !== null
        ? ((latest - baseline) / baseline) * 100
        : null,
    );
  }

  return returns;
}

function withBenchmarkReturns(
  points: Omit<JournalPerformancePoint, BenchmarkDataKey>[],
  timeframe: JournalChartTimeframe,
  benchmarkData: BenchmarkChartData,
  nowMs: number,
): JournalPerformancePoint[] {
  const dates = points.map(({ date }) => date);
  const returns = Object.fromEntries(
    BENCHMARK_KEYS.map((key) => [
      key,
      benchmarkReturnsForDates(benchmarkData[key], dates, timeframe, nowMs),
    ]),
  ) as Record<BenchmarkDataKey, Map<string, number | null>>;

  return points.map((point) => ({
    ...point,
    btcPct: returns.btcPct.get(point.date) ?? null,
    goldPct: returns.goldPct.get(point.date) ?? null,
  }));
}

/** Arithmetic sum of direction-aware trade returns, matching the legacy chart. */
export function buildAssetTypePercentSeries(
  history: FollowedTrade[],
  assetTypes: string[],
): AssetTypePercent[] {
  const totals = new Map<string, number>();
  for (const trade of history) {
    if (trade.status === "open") continue;
    const { pct } = computePnl(trade, trade.closePrice ?? trade.entryPrice);
    totals.set(trade.assetType, (totals.get(trade.assetType) ?? 0) + pct);
  }
  return assetTypes.map((assetType) => ({
    assetType,
    pct: totals.get(assetType) ?? 0,
  }));
}

export function buildJournalPerformanceSeries({
  history,
  timeframe,
  oldestTradeMs,
  nowMs = Date.now(),
  benchmarkData = {},
}: {
  history: FollowedTrade[];
  timeframe: JournalChartTimeframe;
  oldestTradeMs: number;
  nowMs?: number;
  benchmarkData?: BenchmarkChartData;
}): JournalPerformancePoint[] {
  const now = new Date(nowMs);

  if (timeframe === "1D") {
    const hours = Array.from(
      { length: 24 },
      (_, hour) => `${String(hour).padStart(2, "0")}:00`,
    );
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    const pctByHour = new Map<string, number>();

    for (const trade of history) {
      if (
        trade.status === "open" ||
        !trade.closedAt ||
        trade.closedAt < startMs
      ) {
        continue;
      }
      const hour = `${String(new Date(trade.closedAt).getHours()).padStart(2, "0")}:00`;
      const { pct } = computePnl(trade, trade.closePrice ?? trade.entryPrice);
      pctByHour.set(hour, (pctByHour.get(hour) ?? 0) + pct);
    }

    let cumulative = 0;

    const points = hours.map((date) => {
      const dayPct = pctByHour.get(date) ?? 0;
      cumulative += dayPct;
      return {
        date,
        dayPct,
        dayPctWin: dayPct >= 0 ? dayPct : null,
        dayPctLoss: dayPct < 0 ? dayPct : null,
        cumPct: cumulative,
      };
    });

    return withBenchmarkReturns(points, timeframe, benchmarkData, nowMs);
  }

  const start = new Date(now);
  let end = now;
  if (timeframe === "1W") {
    const day = now.getDay();
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (timeframe === "1M") {
    start.setDate(now.getDate() - 29);
  } else if (history.length > 0) {
    start.setTime(oldestTradeMs);
  } else {
    start.setDate(now.getDate() - 29);
  }

  const dates = datesBetween(start, end);
  const pctByDate = new Map<string, number>();
  for (const trade of history) {
    if (trade.status === "open") continue;
    const { pct } = computePnl(trade, trade.closePrice ?? trade.entryPrice);
    const date = dayKey(trade.closedAt ?? trade.followedAt);
    pctByDate.set(date, (pctByDate.get(date) ?? 0) + pct);
  }

  let cumulative = 0;

  const points = dates.map((date) => {
    const dayPct = pctByDate.get(date) ?? 0;
    cumulative += dayPct;
    return {
      date,
      dayPct,
      dayPctWin: dayPct >= 0 ? dayPct : null,
      dayPctLoss: dayPct < 0 ? dayPct : null,
      cumPct: cumulative,
    };
  });

  return withBenchmarkReturns(points, timeframe, benchmarkData, nowMs);
}
