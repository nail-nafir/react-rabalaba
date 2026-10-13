import { recapWindow } from "@/core/automation/period-summary";
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

/** Values are null outside the data span: before the journal period or not reached yet. */
export interface JournalPerformancePoint {
  date: string;
  dayPctWin: number | null;
  dayPctLoss: number | null;
  cumPct: number | null;
  btcPct: number | null;
  goldPct: number | null;
}

/** Chart axis [startMs, endMs) of a tab; data is drawn from dataStartMs until now. */
export interface JournalWindow {
  startMs: number;
  endMs: number;
  dataStartMs: number;
}

export interface AssetTypePercent {
  assetType: string;
  pct: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** WIB is a fixed UTC+7, so bucket keys need no Intl. */
const WIB_OFFSET_MS = 7 * HOUR_MS;
const BENCHMARK_KEYS = ["btcPct", "goldPct"] as const;
const CALENDAR_PERIODS = { "1D": "daily", "1W": "weekly", "1M": "monthly" } as const;

/**
 * The WIB calendar window behind a tab: today, the Monday-start week or the
 * month. Data never starts before the journal period, so a week that began last
 * month is drawn from the 1st. ALL runs from the period start until now; before
 * the period is known (trades load after it) it is an empty span ending now.
 */
export function journalWindow(
  timeframe: JournalChartTimeframe,
  periodStartMs: number | null,
  nowMs = Date.now(),
): JournalWindow {
  if (timeframe === "ALL") {
    const startMs = periodStartMs ?? nowMs;
    return { startMs, endMs: nowMs, dataStartMs: startMs };
  }
  const { startMs, endMs } = recapWindow(CALENDAR_PERIODS[timeframe], nowMs);
  return { startMs, endMs, dataStartMs: Math.max(startMs, periodStartMs ?? startMs) };
}

/** "HH:00" on the day view, "YYYY-MM-DD" otherwise, both in WIB. */
const bucketKey = (ms: number, hourly: boolean) => {
  const wib = new Date(ms + WIB_OFFSET_MS).toISOString();
  return hourly ? `${wib.slice(11, 13)}:00` : wib.slice(0, 10);
};

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
  axisStartMs: number,
  nowMs = Date.now(),
): { range: string; interval: string } {
  if (timeframe === "1D") return { range: "2d", interval: "30m" };
  if (timeframe === "ALL") {
    return {
      range: dailyRangeForSpan(axisStartMs, nowMs),
      interval: "1d",
    };
  }
  return { range: "1mo", interval: "1d" };
}

/** % change from the first close inside the data span; null wherever the journal draws nothing. */
function benchmarkReturns(
  result: YahooChartResult | null | undefined,
  points: Omit<JournalPerformancePoint, BenchmarkDataKey>[],
  hourly: boolean,
  nowMs: number,
): (number | null)[] {
  const close = result?.indicators.quote[0]?.close ?? [];
  const today = bucketKey(nowMs, false);
  const prices = new Map<string, number>();
  result?.timestamp.forEach((timestamp, index) => {
    const price = close[index];
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return;
    }
    const ms = timestamp * 1000;
    // The 1D query spans two days and hour keys repeat, so only today's candles count.
    if (hourly && bucketKey(ms, false) !== today) return;
    prices.set(bucketKey(ms, hourly), price);
  });

  const returns: (number | null)[] = [];
  let baseline: number | null = null;
  let latest: number | null = null;
  for (const { date, cumPct } of points) {
    if (cumPct === null) {
      returns.push(null);
      continue;
    }
    latest = prices.get(date) ?? latest;
    baseline ??= latest;
    returns.push(
      baseline !== null && latest !== null
        ? ((latest - baseline) / baseline) * 100
        : null,
    );
  }
  return returns;
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
  span,
  nowMs = Date.now(),
  benchmarkData = {},
}: {
  history: FollowedTrade[];
  timeframe: JournalChartTimeframe;
  span: JournalWindow;
  nowMs?: number;
  benchmarkData?: BenchmarkChartData;
}): JournalPerformancePoint[] {
  const hourly = timeframe === "1D";
  const step = hourly ? HOUR_MS : DAY_MS;
  const pctByBucket = new Map<string, number>();
  for (const trade of history) {
    const closedMs = trade.closedAt ?? trade.followedAt;
    if (trade.status === "open" || closedMs < span.dataStartMs) continue;
    const key = bucketKey(closedMs, hourly);
    const { pct } = computePnl(trade, trade.closePrice ?? trade.entryPrice);
    pctByBucket.set(key, (pctByBucket.get(key) ?? 0) + pct);
  }

  const points: Omit<JournalPerformancePoint, BenchmarkDataKey>[] = [];
  let cumulative = 0;
  // Buckets start on WIB midnight, so ALL (opened by a possibly mid-day reset) keys like every tab.
  for (
    let ms = span.startMs - ((span.startMs + WIB_OFFSET_MS) % DAY_MS);
    ms < span.endMs;
    ms += step
  ) {
    const date = bucketKey(ms, hourly);
    // Before the journal period or not reached yet: the axis stays empty there.
    if (ms + step <= span.dataStartMs || ms > nowMs) {
      points.push({ date, dayPctWin: null, dayPctLoss: null, cumPct: null });
      continue;
    }
    const dayPct = pctByBucket.get(date) ?? 0;
    cumulative += dayPct;
    points.push({
      date,
      dayPctWin: dayPct >= 0 ? dayPct : null,
      dayPctLoss: dayPct < 0 ? dayPct : null,
      cumPct: cumulative,
    });
  }

  const [btcPct, goldPct] = BENCHMARK_KEYS.map((key) =>
    benchmarkReturns(benchmarkData[key], points, hourly, nowMs),
  );
  return points.map((point, i) => ({
    ...point,
    btcPct: btcPct[i],
    goldPct: goldPct[i],
  }));
}
