import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  buildTrackerStats,
  tradeOutcomeBucket,
  type FollowedTrade,
} from "@/core/trade/follow-trade-model";
import { PALETTE } from "@/constants";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterGroup } from "@/components/shared/filter-group";
import {
  benchmarkQueryWindow,
  buildAssetTypePercentSeries,
  buildJournalPerformanceSeries,
  type BenchmarkDataKey,
  type JournalChartTimeframe,
} from "@/features/journal/model/journal-performance";
import { fetchYahooChart } from "@/services/api/yahoo-finance";

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
const CHART_YAXIS_WIDTH = 52;
const BACKGROUND_RING = [{ value: 100 }];
const BENCHMARKS = [
  {
    dataKey: "btcPct",
    symbol: "BTC-USD",
    labelKey: "journal.benchmark_btc",
    color: "#f7931a",
    dash: "4 4",
  },
  {
    dataKey: "goldPct",
    symbol: "GC=F",
    labelKey: "journal.benchmark_gold",
    color: "#d4af37",
    dash: "10 3 2 3",
  },
] as const satisfies readonly {
  dataKey: BenchmarkDataKey;
  symbol: string;
  labelKey: string;
  color: string;
  dash: string;
}[];

function ChartCard({
  title,
  methodology,
  children,
  className,
}: {
  title?: string;
  methodology?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("border border-border h-full flex flex-col", className)}
    >
      <CardContent className="flex flex-1 flex-col gap-3 h-full">
        {title && (
          <p
            title={methodology}
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest"
          >
            {title}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

const formatPercent = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const formatPercentTick = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 1000) return `${(value / 1000).toFixed(1)}k%`;
  return `${Number(value.toFixed(absolute < 10 ? 1 : 0))}%`;
};

interface JournalDashboardProps {
  history: FollowedTrade[];
  openTrades: FollowedTrade[];
  isLoading: boolean;
}

export function JournalDashboard({
  history,
  openTrades,
  isLoading,
}: JournalDashboardProps) {
  const { t } = useTranslation();
  const openCount = openTrades.length;
  // Default to 1D (1 hari).
  const [timeframe, setTimeframe] = useState<JournalChartTimeframe>("1D");

  // Timestamp of the earliest trade defines the "ALL" journal span.
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
        {
          value: "1D" as JournalChartTimeframe,
          label: t("journal.timeframe_1d"),
        },
        {
          value: "1W" as JournalChartTimeframe,
          label: t("journal.timeframe_1w"),
        },
        {
          value: "1M" as JournalChartTimeframe,
          label: t("journal.timeframe_1m"),
        },
        {
          value: "ALL" as JournalChartTimeframe,
          label: t("journal.timeframe_all"),
        },
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

  const benchmarkWindow = useMemo(
    () => benchmarkQueryWindow(timeframe, oldestTradeMs),
    [timeframe, oldestTradeMs],
  );
  const benchmarkQueries = useQueries({
    queries: BENCHMARKS.map(({ symbol }) => ({
      queryKey: [
        "journal-benchmark",
        symbol,
        benchmarkWindow.range,
        benchmarkWindow.interval,
      ],
      queryFn: () =>
        fetchYahooChart(
          symbol,
          benchmarkWindow.range,
          benchmarkWindow.interval,
        ),
      enabled: stats.closed > 0,
      staleTime: 300_000,
    })),
  });
  const btcBenchmark = benchmarkQueries[0]?.data;
  const goldBenchmark = benchmarkQueries[1]?.data;

  const computedChartData = useMemo(
    () =>
      buildJournalPerformanceSeries({
        history,
        timeframe,
        oldestTradeMs,
        benchmarkData: {
          btcPct: btcBenchmark,
          goldPct: goldBenchmark,
        },
      }),
    [history, timeframe, oldestTradeMs, btcBenchmark, goldBenchmark],
  );
  const assetTypePerformance = useMemo(
    () =>
      buildAssetTypePercentSeries(
        filteredHistory,
        stats.byAssetType.map(({ assetType }) => assetType),
      ),
    [filteredHistory, stats.byAssetType],
  );

  const outcomeData = useMemo(() => {
    let sl = 0;
    let breakeven = 0;
    let takeProfit = 0;
    let reversedWin = 0;
    let reversedLoss = 0;

    filteredHistory.forEach((t) => {
      switch (tradeOutcomeBucket(t)) {
        case "tp":
          takeProfit++;
          break;
        case "breakeven":
          breakeven++;
          break;
        case "reversal_profit":
          reversedWin++;
          break;
        case "reversal_loss":
          reversedLoss++;
          break;
        default:
          sl++;
      }
    });

    // Five result buckets keep the legend compact. Exact exit causes remain in
    // the transaction audit while profitable protected stops roll into TP.
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
        name: t("journal.breakevens"),
        value: breakeven,
        fill: PALETTE.neutral.fill,
      },
      {
        name: t("journal.outcome_reversed_win"),
        value: reversedWin,
        fill: POS,
        patternId: "reversal-win",
        striped: true,
      },
      {
        name: t("journal.outcome_take_profit"),
        value: takeProfit,
        fill: POS,
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

  const equityLegendItems = useMemo(() => {
    const lastData = computedChartData[computedChartData.length - 1];
    const total = stats.closed;
    const winPct = total > 0 ? (stats.winLoss.wins / total) * 100 : 0;
    const lossPct = total > 0 ? (stats.winLoss.losses / total) * 100 : 0;
    const breakevenPct =
      total > 0 ? (stats.winLoss.breakevens / total) * 100 : 0;

    return [
      {
        name: t("journal.wins"),
        value: stats.winLoss.wins,
        pct: `${winPct.toFixed(0)}%`,
        color: POS,
        type: "count",
        dash: undefined,
      },
      {
        name: t("journal.losses"),
        value: stats.winLoss.losses,
        pct: `${lossPct.toFixed(0)}%`,
        color: NEG,
        type: "count",
        dash: undefined,
      },
      ...(stats.winLoss.breakevens > 0
        ? [
            {
              name: t("journal.breakevens"),
              value: stats.winLoss.breakevens,
              pct: `${breakevenPct.toFixed(0)}%`,
              color: PALETTE.neutral.fill,
              type: "count",
              dash: undefined,
            },
          ]
        : []),
      ...BENCHMARKS.map((benchmark) => ({
        name: t(benchmark.labelKey),
        value: lastData?.[benchmark.dataKey] ?? null,
        pct: undefined,
        color: benchmark.color,
        type: "percent",
        dash: benchmark.dash,
      })),
      {
        name: t("journal.cumulative"),
        value: lastData?.cumPct ?? 0,
        pct: undefined,
        color: "var(--color-primary)",
        type: "percent",
        dash: undefined,
      },
    ];
  }, [computedChartData, stats.winLoss, stats.closed, t]);

  const assetTypeLegendItems = useMemo(() => {
    const total = stats.closed;
    return assetTypePerformance.map((d) => {
      const count = filteredHistory.filter(
        (t) => t.assetType === d.assetType,
      ).length;
      const pct = total > 0 ? (count / total) * 100 : 0;

      const valNum = d.pct;
      const isZero = valNum === 0;
      const color = isZero ? "var(--color-zinc-500)" : valNum > 0 ? POS : NEG;
      const displayName = t(`common.asset_types.${d.assetType.replaceAll("-", "_")}`, d.assetType);

      return {
        name: displayName,
        count,
        pct: `${pct.toFixed(0)}%`,
        color,
      };
    });
  }, [assetTypePerformance, stats.closed, filteredHistory, t]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("journal.portfolio_stats")}
          </h2>
          <FilterGroup
            value={timeframe}
            options={timeframeOptions}
            onChange={setTimeframe}
            disabled
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard>
            <Skeleton className="h-3 w-32 mb-3" />
            <div className="mt-2 flex min-h-72 flex-1 flex-col items-center justify-center">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="mt-3 flex w-full justify-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </ChartCard>
          <ChartCard>
            <Skeleton className="h-3 w-32 mb-3" />
            <div className="mt-2 flex min-h-72 flex-1 flex-col items-center justify-center">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="mt-3 flex w-full justify-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </ChartCard>
          <ChartCard>
            <Skeleton className="h-3 w-32 mb-3" />
            <div className="mt-2 flex min-h-72 flex-1 flex-col items-center justify-center">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="mt-3 flex w-full justify-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    );
  }

  const equityConfig: ChartConfig = {
    dayPctWin: { label: t("journal.wins"), color: POS },
    dayPctLoss: { label: t("journal.losses"), color: NEG },
    cumPct: { label: t("journal.cumulative"), color: "var(--color-primary)" },
    ...Object.fromEntries(
      BENCHMARKS.map((benchmark) => [
        benchmark.dataKey,
        { label: t(benchmark.labelKey), color: benchmark.color },
      ]),
    ),
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-row items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("journal.portfolio_stats")}
        </h2>
        <FilterGroup
          value={timeframe}
          options={timeframeOptions}
          onChange={setTimeframe}
          disabled={isLoading}
        />
      </div>

      {stats.totalFollowed === 0 || stats.closed === 0 ? (
        <Card className="border border-border">
          <CardContent>
            <EmptyState
              title={t("journal.empty_dashboard_title")}
              description={t("journal.empty_dashboard")}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard
            title={t("journal.chart_equity_benchmark")}
            methodology={t("journal.chart_equity_methodology")}
          >
            <div className="flex min-h-72 flex-1 items-center justify-center mt-2">
              <div className="h-full w-full flex flex-col items-center justify-center">
                <div className="h-48 w-full relative">
                  <ChartContainer
                    config={equityConfig}
                    className="h-full w-full"
                  >
                    <ComposedChart
                      accessibilityLayer
                      data={computedChartData}
                      margin={CHART_MARGIN}
                    >
                      <CartesianGrid vertical={false} />
                      <ReferenceLine y={0} stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        minTickGap={24}
                        tickFormatter={fmtDay}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={CHART_YAXIS_WIDTH}
                        fontSize={12}
                        tickFormatter={(value) =>
                          formatPercentTick(Number(value))
                        }
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
                                const benchmark = BENCHMARKS.find(
                                  ({ dataKey }) =>
                                    item.dataKey === dataKey ||
                                    name === dataKey,
                                );
                                const valNum = Number(value);
                                const formattedValue = formatPercent(valNum);

                                let dotColor = "var(--color-cumPct)";
                                let displayName = t("journal.cumulative");

                                if (isWin) {
                                  dotColor = POS;
                                  displayName = t("journal.wins");
                                } else if (isLoss) {
                                  dotColor = NEG;
                                  displayName = t("journal.losses");
                                } else if (benchmark) {
                                  dotColor = benchmark.color;
                                  displayName = t(benchmark.labelKey);
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
                                      <span className="font-medium text-foreground">
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

                      <Bar
                        dataKey="dayPctWin"
                        stackId="a"
                        radius={4}
                        fill={POS}
                      />
                      <Bar
                        dataKey="dayPctLoss"
                        stackId="a"
                        radius={4}
                        fill={NEG}
                      />
                      {BENCHMARKS.map((benchmark) => (
                        <Line
                          key={benchmark.dataKey}
                          type="monotone"
                          dataKey={benchmark.dataKey}
                          stroke={benchmark.color}
                          strokeWidth={1.5}
                          strokeDasharray={benchmark.dash}
                          dot={false}
                          connectNulls
                        />
                      ))}
                      <Line
                        type="monotone"
                        dataKey="cumPct"
                        stroke="var(--color-cumPct)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ChartContainer>
                </div>
                <div className="mt-3 flex w-full flex-wrap justify-center gap-x-4 gap-y-1.5 px-2 text-[12px] font-normal text-muted-foreground">
                  {equityLegendItems.map((d) => {
                    const isCount = d.type === "count";
                    const hasValue = d.value !== null;
                    const valNum = hasValue ? Number(d.value) : 0;
                    return (
                      <div
                        key={d.name}
                        className={cn(
                          "flex items-center gap-1.5",
                          ((isCount && d.value === 0) ||
                            (!isCount && !hasValue)) &&
                            "opacity-40",
                        )}
                      >
                        {isCount ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                        ) : (
                          <svg
                            aria-hidden="true"
                            className="shrink-0"
                            width="14"
                            height="6"
                            viewBox="0 0 14 6"
                          >
                            <line
                              x1="0"
                              y1="3"
                              x2="14"
                              y2="3"
                              stroke={d.color}
                              strokeWidth="2"
                              strokeDasharray={d.dash}
                            />
                          </svg>
                        )}
                        <span>{d.name}</span>
                        <span
                          className={cn(
                            !isCount &&
                              (valNum === 0
                                ? "text-muted-foreground"
                                : valNum > 0
                                  ? "text-emerald-400"
                                  : "text-rose-400"),
                          )}
                        >
                          {isCount
                            ? d.value
                            : hasValue
                              ? formatPercent(valNum)
                              : "—"}
                        </span>
                        {isCount && <span>({d.pct})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ChartCard>

          {/* Card 2: Distribusi Hasil Akhir Trade */}
          <ChartCard title={t("journal.chart_outcome_distribution")}>
            <div className="relative mt-2 flex min-h-72 flex-1 items-center justify-center">
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
                      <PieChart accessibilityLayer>
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
                      <span className="text-xl font-bold text-foreground mt-1 leading-none">
                        {stats.winRate.toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1 leading-none">
                        {stats.winLoss.wins} {t("journal.profit_abbr")} /{" "}
                        {stats.winLoss.losses} {t("journal.loss_abbr")}
                        {stats.winLoss.breakevens > 0 && (
                          <>
                            {" "}/ {stats.winLoss.breakevens}{" "}
                            {t("journal.breakeven_abbr")}
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-foreground mt-0.5">
                        {stats.closed} {t("journal.transactions")}
                      </span>
                    </div>
                  </div>

                  {/* Premium Legend at the Bottom */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground font-normal px-2 mt-3 w-full">
                    {outcomeData.map((d, i) => {
                      const pct =
                        totalOutcomes > 0 ? (d.value / totalOutcomes) * 100 : 0;
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
                          <span className="dark:opacity-60">{d.value}</span>
                          <span className="dark:opacity-60">
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
            <div className="flex min-h-72 flex-1 items-center justify-center mt-2">
              {assetTypePerformance.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-medium select-none">
                  {t("journal.chart_no_category_data")}
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center">
                  <div className="h-48 w-full relative">
                    <ChartContainer
                      config={{ pct: { label: t("journal.total_pnl") } }}
                      className="h-full w-full"
                    >
                      <ComposedChart
                        accessibilityLayer
                        data={assetTypePerformance}
                        margin={CHART_MARGIN}
                      >
                        <CartesianGrid vertical={false} />
                        <ReferenceLine y={0} stroke="var(--color-border)" />
                        <XAxis
                          dataKey="assetType"
                          interval={0}
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          tickFormatter={(v) => {
                            return t(`common.asset_types.${v.replaceAll("-", "_")}`, v) as string;
                          }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={CHART_YAXIS_WIDTH}
                          fontSize={12}
                          tickFormatter={(value) =>
                            formatPercentTick(Number(value))
                          }
                        />
                        <ChartTooltip
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
                                    t(`common.asset_types.${l.replaceAll("-", "_")}`, l) as string
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
                                            "font-medium",
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
                          {assetTypePerformance.map((entry, index) => {
                            const fill =
                              entry.pct === 0
                                ? "var(--color-zinc-500)"
                                : entry.pct > 0
                                  ? POS
                                  : NEG;
                            return <Cell key={`cell-${index}`} fill={fill} />;
                          })}
                        </Bar>
                      </ComposedChart>
                    </ChartContainer>
                  </div>
                  {/* Premium Legend at the Bottom */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground font-normal px-2 mt-3 w-full">
                    {assetTypeLegendItems.map((d, i) => {
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-1.5 transition-colors group",
                            d.count === 0 && "opacity-40",
                          )}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="transition-colors dark:opacity-60">
                            {d.name}
                          </span>
                          <span className="dark:opacity-60">{d.count}</span>
                          <span className="dark:opacity-60">({d.pct})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
