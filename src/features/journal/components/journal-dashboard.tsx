import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { fetchYahooChart } from "@/services/api/yahoo-finance";
import type { YahooChartResult } from "@/services/api/yahoo-finance";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import {
  buildTrackerStats,
  computePnl,
} from "@/features/follow-trade/lib/follow-trade-model";
import { PALETTE } from "@/constants";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterGroup } from "@/components/shared/filter-group";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const POS = PALETTE.positive.fill;
const NEG = PALETTE.negative.fill;
// Hoisted so the charts' margin prop keeps a stable identity — recharts
// restarts mount animations (with setState in effect cleanup) whenever
// data/layout prop identity changes, which can cascade into "Maximum update
// depth exceeded" under re-render bursts (see components/charts/sparkline.tsx).
const CHART_MARGIN = { left: 4, right: 8, top: 8 };
const BACKGROUND_RING = [{ value: 100 }];

function ChartCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("border border-border h-full flex flex-col", className)}
    >
      <CardContent className="flex flex-1 flex-col gap-3 h-full">
        {title && (
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {title}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function getDatesRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Pick the Yahoo `range` for the "ALL" timeframe benchmark fetch.
 *
 * Yahoo silently coarsens `range=max&interval=1d` into MONTHLY (BTC, ^JKSE) or
 * even QUARTERLY (^GSPC) buckets. Over a short journal span that leaves only one
 * data point inside the displayed window, so the benchmark anchors to itself and
 * flatlines at +0.00%. To keep TRUE daily candles we never ask for `max`;
 * instead we return the smallest range that still covers the oldest trade
 * (every range up to 10y returns daily). `max` is used only past ~10y, where
 * monthly resolution over a decade-plus window is acceptable anyway.
 */
function dailyRangeForSpan(oldestMs: number, nowMs: number): string {
  const days = Math.max(0, (nowMs - oldestMs) / 86_400_000);
  if (days <= 80) return "3mo";
  if (days <= 170) return "6mo";
  if (days <= 350) return "1y";
  if (days <= 700) return "2y";
  if (days <= 1750) return "5y";
  if (days <= 3600) return "10y";
  return "max";
}

type TimeframeOption = "1D" | "1W" | "1M" | "ALL";

export function JournalDashboard() {
  const { t } = useTranslation();
  const { history, openTrades, isLoading } = useJournalTrades();
  const openCount = openTrades.length;
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1D");
  const [activeBenchmarks] = useState<string[]>(["BTC-USD", "IHSG", "S&P 500"]);

  // Timestamp of the earliest trade — defines the span of the "ALL" timeframe
  // for both the displayed window and the benchmark fetch range.
  const oldestTradeMs = useMemo(() => {
    const now = new Date().getTime();
    if (history.length === 0) return now;
    return history.reduce(
      (oldest, t) => Math.min(oldest, t.closedAt ?? t.followedAt),
      now,
    );
  }, [history]);

  const timeframeOptions = useMemo(
    () =>
      [
        { value: "1D" as TimeframeOption, label: t("journal.timeframe_1d") },
        { value: "1W" as TimeframeOption, label: t("journal.timeframe_1w") },
        { value: "1M" as TimeframeOption, label: t("journal.timeframe_1m") },
        { value: "ALL" as TimeframeOption, label: t("journal.timeframe_all") },
      ] as const,
    [t],
  );

  const filteredHistory = useMemo(() => {
    const today = new Date();
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    let start = 0;

    switch (timeframe) {
      case "1D": {
        start = d.getTime();
        break;
      }
      case "1W": {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        start = d.getTime();
        break;
      }
      case "1M": {
        d.setDate(d.getDate() - 29);
        start = d.getTime();
        break;
      }
      case "ALL":
      default: {
        start = history.length > 0 ? oldestTradeMs : 0;
        break;
      }
    }

    return history.filter((t) => {
      const time = t.closedAt ?? t.followedAt;
      return time >= start;
    });
  }, [history, timeframe, oldestTradeMs]);

  const stats = useMemo(
    () => buildTrackerStats(filteredHistory, openCount),
    [filteredHistory, openCount],
  );

  const timeframeConfig = useMemo(() => {
    switch (timeframe) {
      case "1D":
        return { range: "2d", interval: "30m" };
      case "1W":
        return { range: "1mo", interval: "1d" };
      case "1M":
        return { range: "1mo", interval: "1d" };
      case "ALL":
      default:
        return {
          range: dailyRangeForSpan(oldestTradeMs, new Date().getTime()),
          interval: "1d",
        };
    }
  }, [timeframe, oldestTradeMs]);

  const { data: btcRawData } = useQuery({
    queryKey: [
      "benchmark-pnl",
      "BTC-USD",
      timeframeConfig.range,
      timeframeConfig.interval,
    ],
    queryFn: () =>
      fetchYahooChart(
        "BTC-USD",
        timeframeConfig.range,
        timeframeConfig.interval,
      ),
    staleTime: 300_000,
  });

  const { data: ihsgRawData } = useQuery({
    queryKey: [
      "benchmark-pnl",
      "^JKSE",
      timeframeConfig.range,
      timeframeConfig.interval,
    ],
    queryFn: () =>
      fetchYahooChart("^JKSE", timeframeConfig.range, timeframeConfig.interval),
    staleTime: 300_000,
  });

  const { data: sp500RawData } = useQuery({
    queryKey: [
      "benchmark-pnl",
      "^GSPC",
      timeframeConfig.range,
      timeframeConfig.interval,
    ],
    queryFn: () =>
      fetchYahooChart("^GSPC", timeframeConfig.range, timeframeConfig.interval),
    staleTime: 300_000,
  });

  // Nasdaq benchmark query removed

  const computedChartData = useMemo(() => {
    const today = new Date();

    const getBenchmarkDataFor1D = (
      rawData: YahooChartResult | null | undefined,
      startMs: number,
    ) => {
      const priceByHour = new Map<string, number>();
      let firstPrice = 0;
      if (rawData?.timestamp && rawData?.indicators?.quote?.[0]?.close) {
        const closes = rawData.indicators.quote[0].close;
        rawData.timestamp.forEach((t: number, idx: number) => {
          const ms = t * 1000;
          if (ms >= startMs) {
            const price = closes[idx];
            if (price !== null && price !== undefined) {
              const hKey = `${String(new Date(ms).getHours()).padStart(2, "0")}:00`;
              priceByHour.set(hKey, price);
              if (firstPrice === 0) {
                firstPrice = price;
              }
            }
          }
        });
      }
      return { priceByHour, firstPrice };
    };

    const getBenchmarkDataForRange = (
      rawData: YahooChartResult | null | undefined,
      firstDateStr: string,
    ) => {
      const priceByDate = new Map<string, number>();
      let startPrice = 0;
      if (rawData?.timestamp && rawData?.indicators?.quote?.[0]?.close) {
        const closes = rawData.indicators.quote[0].close;
        rawData.timestamp.forEach((t: number, idx: number) => {
          const price = closes[idx];
          if (price !== null && price !== undefined) {
            const dStr = dayKey(t * 1000);
            priceByDate.set(dStr, price);
            if (startPrice === 0) {
              startPrice = price;
            }
          }
        });

        const sortedTicks = rawData.timestamp
          .map((t: number, idx: number) => ({
            dateStr: dayKey(t * 1000),
            price: closes[idx],
          }))
          .filter(
            (tick): tick is { dateStr: string; price: number } =>
              tick.price !== null && tick.price !== undefined,
          )
          .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

        const startTick = sortedTicks.find((t) => t.dateStr >= firstDateStr);
        if (startTick) {
          startPrice = startTick.price!;
        } else if (sortedTicks.length > 0) {
          startPrice = sortedTicks[sortedTicks.length - 1].price!;
        }
      }
      return { priceByDate, startPrice };
    };

    let startOfTimeframe = new Date(today);

    if (timeframe === "1D") {
      const hours: string[] = [];
      for (let h = 0; h < 24; h++) {
        hours.push(`${String(h).padStart(2, "0")}:00`);
      }

      const hourToPct = new Map<string, number>();

      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayMs = startOfToday.getTime();

      history.forEach((t) => {
        if (t.status === "open" || !t.closedAt || t.closedAt < startOfTodayMs)
          return;
        const pct = computePnl(t, t.closePrice ?? t.entryPrice).pct;
        const hour = `${String(new Date(t.closedAt).getHours()).padStart(2, "0")}:00`;
        hourToPct.set(hour, (hourToPct.get(hour) ?? 0) + pct);
      });

      const btcInfo = getBenchmarkDataFor1D(btcRawData, startOfTodayMs);
      const ihsgInfo = getBenchmarkDataFor1D(ihsgRawData, startOfTodayMs);
      const sp500Info = getBenchmarkDataFor1D(sp500RawData, startOfTodayMs);

      let runningCum = 0;
      let lastBtcPrice = btcInfo.firstPrice;
      let lastIhsgPrice = ihsgInfo.firstPrice;
      let lastSp500Price = sp500Info.firstPrice;

      return hours.map((hour) => {
        const dayPct = hourToPct.get(hour) ?? 0;
        const dayPctWin = dayPct >= 0 ? dayPct : null;
        const dayPctLoss = dayPct < 0 ? dayPct : null;
        runningCum += dayPct;

        const btcPrice = btcInfo.priceByHour.get(hour);
        if (btcPrice !== undefined) lastBtcPrice = btcPrice;
        const btcPct =
          btcInfo.firstPrice > 0
            ? ((lastBtcPrice - btcInfo.firstPrice) / btcInfo.firstPrice) * 100
            : 0;

        const ihsgPrice = ihsgInfo.priceByHour.get(hour);
        if (ihsgPrice !== undefined) lastIhsgPrice = ihsgPrice;
        const ihsgPct =
          ihsgInfo.firstPrice > 0
            ? ((lastIhsgPrice - ihsgInfo.firstPrice) / ihsgInfo.firstPrice) *
              100
            : 0;

        const sp500Price = sp500Info.priceByHour.get(hour);
        if (sp500Price !== undefined) lastSp500Price = sp500Price;
        const sp500Pct =
          sp500Info.firstPrice > 0
            ? ((lastSp500Price - sp500Info.firstPrice) / sp500Info.firstPrice) *
              100
            : 0;

        return {
          date: hour,
          dayPct,
          dayPctWin,
          dayPctLoss,
          cumPct: runningCum,
          btcPct,
          ihsgPct,
          sp500Pct,
        };
      });
    }

    let endOfRange = today;

    if (timeframe === "1W") {
      const day = today.getDay();
      startOfTimeframe.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      startOfTimeframe.setHours(0, 0, 0, 0);

      const endOfTimeframe = new Date(startOfTimeframe);
      endOfTimeframe.setDate(startOfTimeframe.getDate() + 6);
      endOfTimeframe.setHours(23, 59, 59, 999);
      endOfRange = endOfTimeframe;
    } else if (timeframe === "1M") {
      startOfTimeframe.setDate(today.getDate() - 29);
    } else if (history.length > 0) {
      startOfTimeframe = new Date(oldestTradeMs);
    } else {
      startOfTimeframe.setDate(today.getDate() - 29);
    }

    const dateList = getDatesRange(startOfTimeframe, endOfRange);

    const dateToPct = new Map<string, number>();

    history.forEach((t) => {
      if (t.status === "open") return;
      const { pct } = computePnl(t, t.closePrice ?? t.entryPrice);
      const day = dayKey(t.closedAt ?? t.followedAt);
      dateToPct.set(day, (dateToPct.get(day) ?? 0) + pct);
    });

    const firstDateStr = dateList[0];

    const btcInfo = getBenchmarkDataForRange(btcRawData, firstDateStr);
    const ihsgInfo = getBenchmarkDataForRange(ihsgRawData, firstDateStr);
    const sp500Info = getBenchmarkDataForRange(sp500RawData, firstDateStr);

    let runningCumPct = 0;
    let lastKnownBtc = btcInfo.startPrice;
    let lastKnownIhsg = ihsgInfo.startPrice;
    let lastKnownSp500 = sp500Info.startPrice;

    return dateList.map((date) => {
      const dayPct = dateToPct.get(date) ?? 0;
      const dayPctWin = dayPct >= 0 ? dayPct : null;
      const dayPctLoss = dayPct < 0 ? dayPct : null;
      runningCumPct += dayPct;

      const btcPrice = btcInfo.priceByDate.get(date);
      if (btcPrice !== undefined) lastKnownBtc = btcPrice;
      const btcPct =
        btcInfo.startPrice > 0
          ? ((lastKnownBtc - btcInfo.startPrice) / btcInfo.startPrice) * 100
          : 0;

      const ihsgPrice = ihsgInfo.priceByDate.get(date);
      if (ihsgPrice !== undefined) lastKnownIhsg = ihsgPrice;
      const ihsgPct =
        ihsgInfo.startPrice > 0
          ? ((lastKnownIhsg - ihsgInfo.startPrice) / ihsgInfo.startPrice) * 100
          : 0;

      const sp500Price = sp500Info.priceByDate.get(date);
      if (sp500Price !== undefined) lastKnownSp500 = sp500Price;
      const sp500Pct =
        sp500Info.startPrice > 0
          ? ((lastKnownSp500 - sp500Info.startPrice) / sp500Info.startPrice) *
            100
          : 0;

      return {
        date,
        dayPct,
        dayPctWin,
        dayPctLoss,
        cumPct: runningCumPct,
        btcPct,
        ihsgPct,
        sp500Pct,
      };
    });
  }, [
    timeframe,
    history,
    oldestTradeMs,
    btcRawData,
    ihsgRawData,
    sp500RawData,
  ]);

  const outcomeData = useMemo(() => {
    let sl = 0;
    let tp1 = 0;
    let tp2 = 0;
    let tp3 = 0;
    // A no-TP reversal close still realizes a P/L, so split it by R-sign into a
    // win/loss bucket — this is what buildTrackerStats already counts in the
    // center win-rate. Use r >= 0 (vs the model's r > 0) so the slice total
    // stays equal to stats.closed; a flat r === 0 (effectively impossible with
    // float prices) lands in the profit bucket rather than being dropped.
    let reversedWin = 0;
    let reversedLoss = 0;

    filteredHistory.forEach((t) => {
      if (t.status === "sl") sl++;
      else if (t.status === "tp1") tp1++;
      else if (t.status === "tp2") tp2++;
      else if (t.status === "tp3") tp3++;
      else if (t.status === "reversed") {
        const { r } = computePnl(t, t.closePrice ?? t.entryPrice);
        if (r >= 0) reversedWin++;
        else reversedLoss++;
      }
    });

    // Ordered so the loss family (red) and win family (green) read cohesively
    // around the donut, with reversals hatched to stay distinct from clean
    // TP/SL exits.
    const data: {
      name: string;
      value: number;
      fill: string;
      patternId?: string;
      striped?: boolean;
    }[] = [
      { name: t("journal.outcome_sl"), value: sl, fill: NEG },
      {
        name: t("journal.outcome_reversed_loss"),
        value: reversedLoss,
        fill: NEG,
        patternId: "reversal-loss",
        striped: true,
      },
      {
        name: t("journal.outcome_reversed_win"),
        value: reversedWin,
        fill: POS,
        patternId: "reversal-win",
        striped: true,
      },
      {
        name: t("journal.outcome_tp1"),
        value: tp1,
        fill: "rgba(16, 185, 129, 0.4)",
      },
      {
        name: t("journal.outcome_tp2"),
        value: tp2,
        fill: "rgba(16, 185, 129, 0.7)",
      },
      {
        name: t("journal.outcome_tp3"),
        value: tp3,
        fill: "rgba(16, 185, 129, 1)",
      },
    ];
    return data;
  }, [filteredHistory, t]);

  const pieData = useMemo(
    () => outcomeData.filter((d) => d.value > 0),
    [outcomeData],
  );

  const totalOutcomes = useMemo(() => {
    return outcomeData.reduce((acc, curr) => acc + curr.value, 0);
  }, [outcomeData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("journal.portfolio_stats")}
          </h2>
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard>
            <Skeleton className="h-3 w-32 mb-3" />
            <Skeleton className="h-55 w-full rounded-xl" />
          </ChartCard>
          <ChartCard>
            <Skeleton className="h-3 w-32 mb-3" />
            <Skeleton className="h-55 w-full rounded-xl" />
          </ChartCard>
          <ChartCard>
            <Skeleton className="h-3 w-32 mb-3" />
            <Skeleton className="h-55 w-full rounded-xl" />
          </ChartCard>
        </div>
      </div>
    );
  }

  if (stats.totalFollowed === 0) {
    return (
      <Card className="border border-border">
        <CardContent>
          <EmptyState
            title={t("journal.empty_dashboard_title")}
            description={t("journal.empty_dashboard")}
          />
        </CardContent>
      </Card>
    );
  }

  const equityConfig: ChartConfig = {
    dayPctWin: { label: t("journal.wins"), color: POS },
    dayPctLoss: { label: t("journal.losses"), color: NEG },
    cumPct: { label: t("journal.cumulative"), color: "var(--color-primary)" },
    btcPct: { label: t("journal.benchmark_btc"), color: "#F7931A" },
    ihsgPct: { label: t("journal.benchmark_ihsg"), color: "#818CF8" },
    sp500Pct: { label: t("journal.benchmark_sp500"), color: "#3B82F6" },
  };

  const outcomeConfig: ChartConfig = {
    [t("journal.outcome_sl")]: { label: t("journal.outcome_sl"), color: NEG },
    [t("journal.outcome_tp1")]: {
      label: t("journal.outcome_tp1"),
      color: "rgba(16, 185, 129, 0.4)",
    },
    [t("journal.outcome_tp2")]: {
      label: t("journal.outcome_tp2"),
      color: "rgba(16, 185, 129, 0.7)",
    },
    [t("journal.outcome_tp3")]: {
      label: t("journal.outcome_tp3"),
      color: "rgba(16, 185, 129, 1)",
    },
    [t("journal.outcome_reversed_win")]: {
      label: t("journal.outcome_reversed_win"),
      color: POS,
    },
    [t("journal.outcome_reversed_loss")]: {
      label: t("journal.outcome_reversed_loss"),
      color: NEG,
    },
  };

  const fmtDay = (d: string) => {
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    const [, mm, dd] = parts;
    return `${dd}-${mm}`;
  };

  const fmtFullDate = (d: string) => {
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    const [yy, mm, dd] = parts;
    return `${dd}-${mm}-${yy}`;
  };

  return (
    <div className="space-y-4">
      {stats.closed === 0 ? (
        <Card className="border border-border">
          <CardContent>
            <EmptyState
              title={t("journal.empty_dashboard_title")}
              description={t("journal.empty_dashboard")}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("journal.portfolio_stats")}
            </h2>
            <FilterGroup
              value={timeframe}
              options={timeframeOptions}
              onChange={setTimeframe}
              className="self-start sm:self-auto"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard
              title={t("journal.chart_equity_benchmark")}
              className="h-full flex flex-col"
            >
              <ChartContainer
                config={equityConfig}
                className="aspect-auto h-65 w-full mt-2"
              >
                <ComposedChart data={computedChartData} margin={CHART_MARGIN}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    minTickGap={24}
                    tickFormatter={fmtDay}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    fontSize={11}
                  />
                  <ChartTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null;
                      const filteredPayload = payload.filter(
                        (item) =>
                          item.value !== null && item.value !== undefined,
                      );
                      return (
                        <ChartTooltipContent
                          active={active}
                          payload={filteredPayload}
                          label={label}
                          className="min-w-45"
                          labelFormatter={(l) => fmtFullDate(String(l))}
                          formatter={(value, name, item) => {
                            const isWin =
                              item.dataKey === "dayPctWin" ||
                              name === "dayPctWin";
                            const isLoss =
                              item.dataKey === "dayPctLoss" ||
                              name === "dayPctLoss";

                            const valNum = Number(value);
                            const formattedValue = `${valNum >= 0 ? "+" : ""}${valNum.toFixed(2)}%`;

                            let dotColor = "var(--color-cumPct)";
                            let displayName = t("journal.cumulative");

                            if (isWin) {
                              dotColor = POS;
                              displayName = t("journal.wins");
                            } else if (isLoss) {
                              dotColor = NEG;
                              displayName = t("journal.losses");
                            } else if (
                              item.dataKey === "btcPct" ||
                              name === "btcPct"
                            ) {
                              dotColor = "#F7931A";
                              displayName = t("journal.benchmark_btc");
                            } else if (
                              item.dataKey === "ihsgPct" ||
                              name === "ihsgPct"
                            ) {
                              dotColor = "#818CF8";
                              displayName = t("journal.benchmark_ihsg");
                            } else if (
                              item.dataKey === "sp500Pct" ||
                              name === "sp500Pct"
                            ) {
                              dotColor = "#3B82F6";
                              displayName = t("journal.benchmark_sp500");
                            }

                            return (
                              <>
                                <div
                                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                  style={{ backgroundColor: dotColor }}
                                />
                                <div className="flex flex-1 justify-between leading-none items-center gap-8">
                                  <span className="text-muted-foreground">
                                    {displayName}
                                  </span>
                                  <span className="font-mono font-medium text-foreground tabular-nums">
                                    {formattedValue}
                                  </span>
                                </div>
                              </>
                            );
                          }}
                        />
                      );
                    }}
                  />

                  <Bar dataKey="dayPctWin" stackId="a" radius={4} fill={POS} />
                  <Bar dataKey="dayPctLoss" stackId="a" radius={4} fill={NEG} />
                  <Line
                    type="monotone"
                    dataKey="cumPct"
                    stroke="var(--color-cumPct)"
                    strokeWidth={2}
                    dot={false}
                  />
                  {activeBenchmarks.includes("BTC-USD") && (
                    <Line
                      type="monotone"
                      dataKey="btcPct"
                      stroke="#F7931A"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  )}
                  {activeBenchmarks.includes("IHSG") && (
                    <Line
                      type="monotone"
                      dataKey="ihsgPct"
                      stroke="#818CF8"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  )}
                  {activeBenchmarks.includes("S&P 500") && (
                    <Line
                      type="monotone"
                      dataKey="sp500Pct"
                      stroke="#3B82F6"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  )}
                </ComposedChart>
              </ChartContainer>
            </ChartCard>

            {/* Card 2: Distribusi Hasil Akhir Trade */}
            <ChartCard title={t("journal.chart_outcome_distribution")}>
              <div className="flex-1 h-65 flex items-center justify-center relative mt-2">
                {pieData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-medium select-none">
                    {t("journal.chart_no_closed_trades")}
                  </div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    {/* Centered Donut Chart */}
                    <div className="h-48 w-full relative">
                      <ChartContainer
                        config={outcomeConfig}
                        className="h-full w-full"
                      >
                        <PieChart>
                          <defs>
                            <pattern
                              id="reversal-win"
                              patternUnits="userSpaceOnUse"
                              width="6"
                              height="6"
                              patternTransform="rotate(45)"
                            >
                              <rect
                                width="6"
                                height="6"
                                fill="rgba(16, 185, 129, 0.3)"
                              />
                              <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="6"
                                stroke="rgba(16, 185, 129, 1)"
                                strokeWidth={2.5}
                              />
                            </pattern>
                            <pattern
                              id="reversal-loss"
                              patternUnits="userSpaceOnUse"
                              width="6"
                              height="6"
                              patternTransform="rotate(45)"
                            >
                              <rect
                                width="6"
                                height="6"
                                fill="rgba(239, 68, 68, 0.3)"
                              />
                              <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="6"
                                stroke={NEG}
                                strokeWidth={2.5}
                              />
                            </pattern>
                          </defs>
                          <Pie
                            data={BACKGROUND_RING}
                            cx="50%"
                            cy="50%"
                            innerRadius="65%"
                            outerRadius="85%"
                            dataKey="value"
                            strokeWidth={0}
                            fill="var(--color-zinc-400)"
                            opacity={0.15}
                          />
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius="65%"
                            outerRadius="85%"
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {pieData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.patternId
                                    ? `url(#${entry.patternId})`
                                    : entry.fill
                                }
                              />
                            ))}
                          </Pie>
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                hideLabel
                                className="min-w-40"
                              />
                            }
                          />
                        </PieChart>
                      </ChartContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold text-foreground font-mono mt-1 leading-none">
                          {stats.winRate.toFixed(0)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-1 leading-none">
                          <span className="font-mono">
                            {stats.winLoss.wins}
                          </span>{" "}
                          {t("journal.profit_abbr")} /{" "}
                          <span className="font-mono">
                            {stats.winLoss.losses}
                          </span>{" "}
                          {t("journal.loss_abbr")}
                        </span>
                        <span className="text-[10px] text-foreground mt-0.5">
                          <span className="font-mono">{stats.closed}</span>{" "}
                          {t("journal.transactions")}
                        </span>
                      </div>
                    </div>

                    {/* Premium Legend at the Bottom */}
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground font-normal px-2 mt-3 w-full">
                      {outcomeData.map((d, i) => {
                        const pct =
                          totalOutcomes > 0
                            ? (d.value / totalOutcomes) * 100
                            : 0;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-1.5 transition-colors group",
                              d.value === 0 && "opacity-40",
                            )}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                              style={
                                d.striped
                                  ? {
                                      backgroundImage: `repeating-linear-gradient(45deg, ${d.fill} 0 1.5px, transparent 1.5px 3px)`,
                                      backgroundColor: "transparent",
                                    }
                                  : { backgroundColor: d.fill }
                              }
                            />
                            <span className="transition-colors dark:opacity-60">
                              {d.name}
                            </span>
                            <span className="font-mono dark:opacity-60">
                              {d.value}
                            </span>
                            <span className="font-mono dark:opacity-60">
                              ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ChartCard>

            {/* Card 3: Performa Per Kategori Aset */}
            <ChartCard title={t("journal.chart_asset_performance")}>
              <div className="h-65 w-full flex items-center justify-center mt-2">
                {stats.byAssetType.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-medium select-none">
                    {t("journal.chart_no_category_data")}
                  </div>
                ) : (
                  <ChartContainer
                    config={{ pct: { label: t("journal.total_pnl") } }}
                    className="h-full w-full"
                  >
                    <BarChart data={stats.byAssetType} margin={CHART_MARGIN}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="assetType"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(v) => {
                          return t(`common.asset_types.${v}`, v) as string;
                        }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        fontSize={11}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <ChartTooltip
                        cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length)
                            return null;
                          return (
                            <ChartTooltipContent
                              active={active}
                              payload={payload}
                              label={label}
                              className="min-w-40"
                              labelFormatter={(l) =>
                                (
                                  t(`common.asset_types.${l}`, l) as string
                                ).toUpperCase()
                              }
                              formatter={(value) => {
                                const valNum = Number(value);
                                const isZero = valNum === 0;
                                return (
                                  <>
                                    <div
                                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                      style={{
                                        backgroundColor: isZero
                                          ? "var(--color-zinc-500)"
                                          : valNum > 0
                                            ? POS
                                            : NEG,
                                      }}
                                    />
                                    <div className="flex flex-1 justify-between leading-none items-center gap-8">
                                      <span className="text-muted-foreground">
                                        {t("journal.total_pnl")}
                                      </span>
                                      <span
                                        className={cn(
                                          "font-mono font-medium tabular-nums",
                                          isZero
                                            ? "text-foreground"
                                            : valNum > 0
                                              ? "text-emerald-400"
                                              : "text-rose-400",
                                        )}
                                      >
                                        {valNum > 0 ? "+" : ""}
                                        {valNum.toFixed(2)}%
                                      </span>
                                    </div>
                                  </>
                                );
                              }}
                            />
                          );
                        }}
                      />
                      <Bar dataKey="pct" radius={4}>
                        {stats.byAssetType.map((entry, index) => {
                          const fill =
                            entry.pct === 0
                              ? "var(--color-zinc-500)"
                              : entry.pct > 0
                                ? POS
                                : NEG;
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
