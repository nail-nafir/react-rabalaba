import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Rectangle,
  Sector,
  XAxis,
  YAxis,
  type BarShapeProps,
  type PieSectorShapeProps,
} from "recharts";
import { useFollowStore } from "@/store/follow-store";
import {
  buildTrackerStats,
  type FollowStatus,
} from "@/features/follow-trade/lib/follow-trade-model";
import { formatRatio } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const POS = "#34d399";
const NEG = "#fb7185";
const STATUS_COLOR: Record<FollowStatus, string> = {
  open: "#a1a1aa",
  tp1: "#34d399",
  tp2: "#34d399",
  tp3: "#34d399",
  sl: "#fb7185",
  manual: "#a1a1aa",
};

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums text-mono-data",
            className,
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="space-y-3">
        <p className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {title}
        </p>
        {children}
      </CardContent>
    </Card>
  );
}

export function JournalDashboard() {
  const { t } = useTranslation();
  const history = useFollowStore((s) => s.history);
  const openCount = useFollowStore((s) => s.openTrades.length);

  const stats = useMemo(
    () => buildTrackerStats(history, openCount),
    [history, openCount],
  );

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

  const statusData = stats.statusDistribution.map((s) => ({
    key: s.status,
    name: t(`journal.status_${s.status}`),
    value: s.count,
    fill: STATUS_COLOR[s.status],
  }));
  const dirData = stats.longVsShort.map((d) => ({
    name: t(`journal.${d.signal}`),
    r: d.r,
    fill: d.signal === "long" ? POS : NEG,
  }));

  const rFmt = (v: number | string | readonly (number | string)[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return `${n >= 0 ? "+" : ""}${formatRatio(n)}R`;
  };
  const equityConfig: ChartConfig = {
    cumR: { label: t("journal.stat_avg_r"), color: POS },
  };
  const barConfig: ChartConfig = { r: { label: t("journal.col_pnl") } };

  return (
    <>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
        {t("journal.summary")}
      </h2>
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
            {/* Equity curve */}
            <ChartCard title={t("journal.chart_equity")}>
              <ChartContainer
                config={equityConfig}
                className="aspect-auto h-55 w-full"
              >
                <AreaChart
                  data={stats.equitySeries}
                  margin={{ left: 4, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="index"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    fontSize={11}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(l) => `#${l}`}
                        formatter={(v) => rFmt(v)}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cumR"
                    stroke="var(--color-cumR)"
                    fill="var(--color-cumR)"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Status distribution */}
              <ChartCard title={t("journal.chart_status")}>
                <ChartContainer config={{}} className="aspect-auto h-50 w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      shape={(props: PieSectorShapeProps) => (
                        <Sector
                          {...props}
                          fill={props.payload?.fill}
                          stroke="var(--background)"
                        />
                      )}
                    />
                  </PieChart>
                </ChartContainer>
              </ChartCard>

              {/* P/L by asset */}
              <ChartCard title={t("journal.chart_per_asset")}>
                <ChartContainer
                  config={barConfig}
                  className="aspect-auto h-50 w-full"
                >
                  <BarChart
                    data={stats.perAsset}
                    margin={{ left: 4, right: 8, top: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="symbol"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      fontSize={11}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(v) => rFmt(v)} />
                      }
                    />
                    <Bar
                      dataKey="r"
                      radius={4}
                      shape={(props: BarShapeProps) => (
                        <Rectangle
                          {...props}
                          fill={(props.payload?.r ?? 0) >= 0 ? POS : NEG}
                        />
                      )}
                    />
                  </BarChart>
                </ChartContainer>
              </ChartCard>

              {/* Long vs short */}
              <ChartCard title={t("journal.chart_direction")}>
                <ChartContainer
                  config={barConfig}
                  className="aspect-auto h-50 w-full"
                >
                  <BarChart
                    data={dirData}
                    margin={{ left: 4, right: 8, top: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      fontSize={11}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(v) => rFmt(v)} />
                      }
                    />
                    <Bar
                      dataKey="r"
                      radius={4}
                      shape={(props: BarShapeProps) => (
                        <Rectangle {...props} fill={props.payload?.fill} />
                      )}
                    />
                  </BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          </>
        )}

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("journal.stat_total")}
            value={String(stats.totalFollowed)}
          />
          <StatCard label={t("journal.stat_open")} value={String(stats.open)} />
          <StatCard
            label={t("journal.stat_winrate")}
            value={`${Math.round(stats.winRate)}%`}
          />
          <StatCard
            label={t("journal.stat_avg_r")}
            value={`${stats.avgR >= 0 ? "+" : ""}${formatRatio(stats.avgR)}R`}
            className={stats.avgR >= 0 ? "text-emerald-400" : "text-rose-400"}
          />
        </div>
      </div>
    </>
  );
}
