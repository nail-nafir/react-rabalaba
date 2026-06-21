import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Shield, Sparkles } from "lucide-react";

import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import { computePnl } from "@/features/follow-trade/lib/follow-trade-model";
import { FilterGroup } from "@/components/shared/filter-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TradeDetailDialog } from "@/features/follow-trade/components/trade-detail-dialog";
import { cn } from "@/lib/utils";
import { formatDateNumeric } from "@/lib/formatters";
import { SIGNAL_COLORS, SIGNAL_LABEL_KEYS } from "@/constants";
import type { FollowedTrade } from "@/features/follow-trade/lib/follow-trade-model";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

export function TopPerformers() {
  const { t } = useTranslation();
  const { history, isLoading } = useJournalTrades();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedTrade, setSelectedTrade] = useState<FollowedTrade | null>(
    null,
  );

  const periodOptions = [
    { value: "daily" as const, label: t("journal.period_daily") },
    { value: "weekly" as const, label: t("journal.period_weekly") },
    { value: "monthly" as const, label: t("journal.period_monthly") },
  ];

  // Calculate start timestamp for each period in client timezone
  const getPeriodStart = (selectedPeriod: "daily" | "weekly" | "monthly") => {
    const now = new Date();
    if (selectedPeriod === "daily") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    } else if (selectedPeriod === "weekly") {
      const d = new Date(now);
      const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday is start of week
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    } else {
      // monthly
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
  };

  const { gainers, losers, allProfitStats, allLossStats } = useMemo(() => {
    const periodStart = getPeriodStart(period);

    // Filter closed trades in the selected period
    const filteredTrades = history.filter(
      (t) => t.status !== "open" && (t.closedAt ?? t.followedAt) >= periodStart,
    );

    // Compute P/L for each trade
    const tradesWithPnl = filteredTrades.map((t) => {
      const { pct, r } = computePnl(t, t.closePrice ?? t.entryPrice);
      return { trade: t, pct, r };
    });

    const allProfitTrades = tradesWithPnl.filter((item) => item.pct > 0);
    const allLossTrades = tradesWithPnl.filter((item) => item.pct < 0);

    const allProfitStats = {
      count: allProfitTrades.length,
      totalPct: allProfitTrades.reduce((sum, item) => sum + item.pct, 0),
    };

    const allLossStats = {
      count: allLossTrades.length,
      totalPct: allLossTrades.reduce((sum, item) => sum + item.pct, 0),
    };

    // Top 3 Gainers: pct > 0, sorted descending
    const sortedGainers = [...tradesWithPnl]
      .filter((item) => item.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    // Top 3 Losers: pct < 0, sorted ascending (most negative first)
    const sortedLosers = [...tradesWithPnl]
      .filter((item) => item.pct < 0)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);

    return {
      gainers: sortedGainers,
      losers: sortedLosers,
      allProfitStats,
      allLossStats,
    };
  }, [history, period]);

  const gainerStats = useMemo(() => {
    if (gainers.length === 0) return null;
    const totalPct = gainers.reduce((sum, item) => sum + item.pct, 0);
    const totalR = gainers.reduce((sum, item) => sum + item.r, 0);
    return { totalPct, totalR, count: gainers.length };
  }, [gainers]);

  const loserStats = useMemo(() => {
    if (losers.length === 0) return null;
    const totalPct = losers.reduce((sum, item) => sum + item.pct, 0);
    const totalR = losers.reduce((sum, item) => sum + item.r, 0);
    return { totalPct, totalR, count: losers.length };
  }, [losers]);

  const renderList = (
    items: { trade: FollowedTrade; pct: number; r: number }[],
    isGainer: boolean,
  ) => {
    if (items.length === 0) {
      if (isGainer) {
        return (
          <EmptyState
            title={t("journal.empty_gainers_title")}
            description={t("journal.empty_gainers_desc")}
            icon={
              <Shield className="h-14 w-14 text-muted-foreground" />
            }
            className="py-8"
          />
        );
      } else {
        const emptyLosersDescKey =
          period === "daily"
            ? "journal.empty_losers_desc_daily"
            : period === "weekly"
              ? "journal.empty_losers_desc_weekly"
              : "journal.empty_losers_desc_monthly";
        return (
          <EmptyState
            title={t("journal.empty_losers_title")}
            description={t(emptyLosersDescKey)}
            icon={
              <Sparkles className="h-14 w-14 text-muted-foreground" />
            }
            className="py-8"
          />
        );
      }
    }

    return (
      <div className="space-y-2.5">
        {items.map(({ trade, pct }, index) => {
          const signalColor = SIGNAL_COLORS[trade.signal];
          const dateSecs = (trade.closedAt ?? trade.followedAt) / 1000;
          return (
            <Card
              key={trade.id}
              onClick={() => setSelectedTrade(trade)}
              size="sm"
              className="hover:bg-muted/40 border border-border transition-all duration-200 cursor-pointer group hover:scale-[1.005] hover:shadow-xs"
            >
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center p-0 font-mono font-black shrink-0 text-xs",
                      isGainer ? SIGNAL_COLORS.long.bg : SIGNAL_COLORS.short.bg,
                      isGainer
                        ? SIGNAL_COLORS.long.text
                        : SIGNAL_COLORS.short.text,
                      isGainer
                        ? SIGNAL_COLORS.long.border
                        : SIGNAL_COLORS.short.border,
                    )}
                  >
                    {index + 1}
                  </Badge>
                  <div className="min-w-0">
                    <div className="font-bold text-sm tracking-tight text-foreground flex flex-wrap items-center gap-1.5">
                      <span>{trade.symbol}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-bold tracking-wider uppercase text-[8px] px-1 h-3.5 rounded-lg leading-none shrink-0",
                          signalColor.bg,
                          signalColor.text,
                          signalColor.border,
                        )}
                      >
                        {t(SIGNAL_LABEL_KEYS[trade.signal])}
                      </Badge>
                    </div>
                    <div className="text-xs truncate text-muted-foreground mt-0.5">
                      {trade.name}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      "font-mono text-sm font-bold leading-none tabular-nums",
                      isGainer
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {pct >= 0 ? "+" : ""}
                    {pct.toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono leading-none mt-1">
                    {formatDateNumeric(dateSecs)}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderSkeleton = () => (
    <div className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} size="sm" className="border border-border bg-card/30">
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="space-y-1.5 text-right flex flex-col items-end">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header and selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("journal.top_performers")}
        </h2>
        <FilterGroup
          value={period}
          options={periodOptions}
          onChange={setPeriod}
          className="self-start sm:self-auto"
        />
      </div>

      {/* Grid of gainers and losers */}
      {gainers.length === 0 && losers.length === 0 && !isLoading ? (
        <Card className="border border-border">
          <CardContent>
            <EmptyState
              title={t("journal.empty_performers_title")}
              description={t("journal.empty_performers_desc")}
              icon={
                <Activity className="h-14 w-14 text-muted-foreground" />
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Gainers Card */}
          <Card className="border border-border shadow-xs">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/40 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {t("journal.top_gainers")}
                  </span>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span
                      className={cn(
                        "font-mono font-extrabold text-xs",
                        gainerStats && gainerStats.totalPct > 0
                          ? "text-emerald-500"
                          : "text-muted-foreground",
                      )}
                    >
                      {gainerStats
                        ? `+${gainerStats.totalPct.toFixed(2)}%`
                        : "0.00%"}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {gainerStats
                        ? t("journal.from_n_data", { count: gainerStats.count })
                        : t("journal.from_n_data", { count: 0 })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-xs font-mono font-extrabold text-emerald-500">
                    {allProfitStats.totalPct > 0 ? `+${allProfitStats.totalPct.toFixed(2)}%` : "0.00%"}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono leading-none">
                    {t("journal.from_n_data", { count: allProfitStats.count })}
                  </span>
                </div>
              </div>
              {isLoading ? renderSkeleton() : renderList(gainers, true)}
            </CardContent>
          </Card>

          {/* Top Losers Card */}
          <Card className="border border-border shadow-xs">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/40 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {t("journal.top_losers")}
                  </span>
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span
                      className={cn(
                        "font-mono font-extrabold text-xs",
                        loserStats && loserStats.totalPct < 0
                          ? "text-rose-500"
                          : "text-muted-foreground",
                      )}
                    >
                      {loserStats
                        ? `${loserStats.totalPct.toFixed(2)}%`
                        : "0.00%"}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {loserStats
                        ? t("journal.from_n_data", { count: loserStats.count })
                        : t("journal.from_n_data", { count: 0 })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-xs font-mono font-extrabold text-rose-500">
                    {allLossStats.totalPct < 0 ? `${allLossStats.totalPct.toFixed(2)}%` : "0.00%"}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono leading-none">
                    {t("journal.from_n_data", { count: allLossStats.count })}
                  </span>
                </div>
              </div>
              {isLoading ? renderSkeleton() : renderList(losers, false)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Shared detail modal */}
      <TradeDetailDialog
        trade={selectedTrade}
        open={selectedTrade !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTrade(null);
        }}
      />
    </div>
  );
}
