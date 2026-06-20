import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
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
import { formatRatio } from "@/lib/formatters";
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

function ChartCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="flex flex-1 flex-col gap-3">
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

export function JournalDashboard() {
  const { t } = useTranslation();
  const { history, openTrades, isLoading } = useJournalTrades();
  const openCount = openTrades.length;

  const stats = useMemo(
    () => buildTrackerStats(history, openCount),
    [history, openCount],
  );

  const chartData = useMemo(() => {
    return stats.dailySeries.map((item) => ({
      ...item,
      dayPctWin: item.dayPct >= 0 ? item.dayPct : null,
      dayPctLoss: item.dayPct < 0 ? item.dayPct : null,
    }));
  }, [stats.dailySeries]);

  const todayStats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    // Filter trades closed today
    const closedToday = history.filter(
      (t) => t.status !== "open" && t.closedAt && t.closedAt >= startOfTodayMs
    );

    let totalProfitPct = 0;
    let totalLossPct = 0;
    let totalProfitR = 0;
    let totalLossR = 0;
    let winsCount = 0;
    let lossesCount = 0;

    closedToday.forEach((t) => {
      const { pct, r } = computePnl(t, t.closePrice ?? t.entryPrice);
      if (pct > 0) {
        totalProfitPct += pct;
        winsCount++;
      } else if (pct < 0) {
        totalLossPct += pct;
        lossesCount++;
      }
      if (r > 0) {
        totalProfitR += r;
      } else if (r < 0) {
        totalLossR += r;
      }
    });

    return {
      tradesCount: closedToday.length,
      profitPct: totalProfitPct,
      lossPct: totalLossPct,
      profitR: totalProfitR,
      lossR: totalLossR,
      winsCount,
      lossesCount,
    };
  }, [history]);







  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("journal.chart_equity")}
        </h2>
        <ChartCard>
          {/* Mock KPI header skeleton */}
          <div className="flex justify-between items-center pb-3 border-b border-border/40">
            <div className="flex gap-8">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4.5 w-24" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4.5 w-24" />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <Skeleton className="h-3 w-12 ml-auto" />
              <Skeleton className="h-4.5 w-8 ml-auto" />
            </div>
          </div>
          {/* Chart area skeleton */}
          <Skeleton className="h-55 w-full rounded-xl" />
        </ChartCard>
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
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
        {t("journal.chart_equity")}
      </h2>
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
            {/* Daily P/L bars + cumulative R line */}
            <ChartCard>
              {/* Core KPIs Row */}
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-3 border-b border-border/40 text-xs">
                {/* Left KPIs */}
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  {/* KPI 1: Rasio Sukses */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {t("journal.stat_winrate")}
                    </span>
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className={cn(
                        "font-mono font-extrabold text-sm",
                        stats.winRate >= 50 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {stats.winRate.toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({`${stats.winLoss.wins} ${t("journal.win_abbr")} / ${stats.winLoss.losses} ${t("journal.loss_abbr")}`})
                      </span>
                    </div>
                  </div>

                  {/* KPI: Hari Ini */}
                  <div className="flex flex-col gap-0.5 pl-0 sm:border-l sm:border-border sm:pl-6">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      {t("journal.today_label")}
                    </span>
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className="font-mono font-extrabold text-sm text-emerald-500">
                        {todayStats.profitPct > 0 ? "+" : ""}{todayStats.profitPct.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        /
                      </span>
                      <span className="font-mono font-extrabold text-sm text-rose-500">
                        {todayStats.lossPct.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono ml-0.5">
                        ({todayStats.profitR > 0 ? "+" : ""}{formatRatio(todayStats.profitR)} {t("journal.r_suffix")} / {formatRatio(todayStats.lossR)} {t("journal.r_suffix")})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right KPI: Transaksi */}
                <div className="flex flex-col gap-0.5 items-end text-right">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {t("journal.trades")}
                  </span>
                  <span className="font-mono font-extrabold text-sm text-foreground">
                    {stats.closed}
                  </span>
                </div>
              </div>

              <ChartContainer
                config={equityConfig}
                className="aspect-auto h-55 w-full"
              >
                <ComposedChart data={chartData} margin={CHART_MARGIN}>
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

                            const dotColor = isWin
                              ? POS
                              : isLoss
                                ? NEG
                                : "var(--color-cumPct)";

                            const displayName = isWin
                              ? t("journal.wins")
                              : isLoss
                                ? t("journal.losses")
                                : t("journal.cumulative");

                            return (
                              <>
                                <div
                                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                  style={{
                                    backgroundColor: dotColor,
                                  }}
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
                </ComposedChart>
              </ChartContainer>
            </ChartCard>
          </>
        )}
    </div>
  );
}
