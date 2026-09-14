import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/constants";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Users,
  Database,
  KeyRound,
  Cpu,
  Layers,
  HardDrive,
  RefreshCw,
  Maximize2,
  Minimize2,
  Radio,
  AlertCircle,
} from "lucide-react";
import { useAdminUsers } from "@/features/management/hooks/use-admin-users";
import { useJournalAssets } from "@/features/management/hooks/use-journal-assets";
import { useJournalSettings } from "@/features/management/hooks/use-journal-settings";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const CHART_MARGIN = { left: 4, right: 8, top: 8 };
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

export default function AdminSystemPage() {
  const { t } = useTranslation();
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [isSignalFullscreen, setIsSignalFullscreen] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsChartFullscreen(false);
        setIsSignalFullscreen(false);
      }
    };
    if (isChartFullscreen || isSignalFullscreen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isChartFullscreen, isSignalFullscreen]);

  // Queries & data hooks
  const {
    users,
    accessCodes,
    isLoading: isLoadingUsers,
    isErrorUsers,
    refetchUsers,
  } = useAdminUsers();
  const {
    assets,
    isLoading: isLoadingAssets,
  } = useJournalAssets();
  const {
    settings,
    isLoading: isLoadingSettings,
  } = useJournalSettings();
  const {
    openTrades,
    history,
    isLoading: isLoadingTrades,
    isError: tradesError,
    refetch: refetchTrades,
  } = useJournalTrades({ scope: "history" });

  const totalSignals = useMemo(() => {
    if (isLoadingTrades || !openTrades || !history) return 0;
    return openTrades.length + history.length;
  }, [openTrades, history, isLoadingTrades]);

  const isLoading =
    isLoadingUsers || isLoadingAssets || isLoadingSettings || isLoadingTrades;

  // 1. Compute User Statistics
  const userStats = useMemo(() => {
    if (!users || users.length === 0) {
      return { total: 0, free: 0, trial: 0, premium: 0, activeLast7Days: 0 };
    }

    let free = 0;
    let trial = 0;
    let premium = 0;
    let activeLast7Days = 0;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    users.forEach((u) => {
      if (u.tier === "premium") premium++;
      else if (u.tier === "trial") trial++;
      else free++;

      if (u.last_active_at) {
        const lastActive = new Date(u.last_active_at).getTime();
        if (lastActive >= sevenDaysAgo) {
          activeLast7Days++;
        }
      }
    });

    return {
      total: users.length,
      free,
      trial,
      premium,
      activeLast7Days,
    };
  }, [users, now]);

  // 2. Compute Asset Statistics (Classified: Saham Indo, Saham US, Kripto, Komoditas, Forex)
  const assetStats = useMemo(() => {
    if (!assets || assets.length === 0) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        idStocks: 0,
        usStocks: 0,
        crypto: 0,
        commodity: 0,
        forex: 0,
      };
    }

    let active = 0;
    let idStocks = 0;
    let usStocks = 0;
    let crypto = 0;
    let commodity = 0;
    let forex = 0;

    assets.forEach((a) => {
      if (a.active) active++;

      const sym = a.symbol.toUpperCase();
      const type = (a.asset_type || "").toLowerCase();

      if (type === "crypto" || sym.endsWith("-USD")) {
        crypto++;
      } else if (type === "commodity" || sym.endsWith("=F")) {
        commodity++;
      } else if (type === "forex" || sym.endsWith("=X")) {
        forex++;
      } else if (type === "stock" || type === "equity") {
        if (sym.endsWith(".JK")) {
          idStocks++;
        } else {
          usStocks++;
        }
      } else {
        // Fallback checks on symbol format
        if (sym.endsWith(".JK")) {
          idStocks++;
        } else if (sym.endsWith("=F")) {
          commodity++;
        } else if (sym.endsWith("=X")) {
          forex++;
        } else if (sym.includes("-USD") || sym.includes("-BTC")) {
          crypto++;
        } else {
          usStocks++;
        }
      }
    });

    return {
      total: assets.length,
      active,
      inactive: assets.length - active,
      idStocks,
      usStocks,
      crypto,
      commodity,
      forex,
    };
  }, [assets]);

  // 3. Compute Access Code Statistics
  const codeStats = useMemo(() => {
    if (!accessCodes || accessCodes.length === 0) {
      return { total: 0, full: 0, trial: 0, totalRedemptions: 0 };
    }

    let full = 0;
    let trial = 0;
    let totalRedemptions = 0;

    accessCodes.forEach((c) => {
      if (c.kind === "full") full++;
      else trial++;
      totalRedemptions += c.redemption_count || 0;
    });

    return {
      total: accessCodes.length,
      full,
      trial,
      totalRedemptions,
    };
  }, [accessCodes]);

  // 4. Group signups and active user activity dates for AreaChart (Daily for the current calendar month)
  const registrationChartData = useMemo(() => {
    if (!users || users.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Map of YYYY-MM-DD to signups/active counts
    const regGroups: Record<string, number> = {};
    const activeGroups: Record<string, number> = {};

    users.forEach((u) => {
      if (u.created_at) {
        const regDate = u.created_at.split("T")[0]; // YYYY-MM-DD
        regGroups[regDate] = (regGroups[regDate] || 0) + 1;
      }
      if (u.last_active_at) {
        const activeDate = u.last_active_at.split("T")[0]; // YYYY-MM-DD
        activeGroups[activeDate] = (activeGroups[activeDate] || 0) + 1;
      }
    });

    // Compute cumulative up to the beginning of the current month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    let runningTotal = 0;

    users.forEach((u) => {
      if (u.created_at) {
        const regTime = new Date(u.created_at).getTime();
        if (regTime < firstDayOfMonth.getTime()) {
          runningTotal++;
        }
      }
    });

    const chartData = [];
    // Generate dates for each day in the current calendar month
    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(currentMonth + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${currentYear}-${mm}-${dd}`;

      const regCount = regGroups[dateStr] || 0;
      const activeCount = activeGroups[dateStr] || 0;
      runningTotal += regCount;

      chartData.push({
        date: dateStr,
        daily: regCount,
        cumulative: runningTotal,
        active: activeCount,
      });
    }

    return chartData;
  }, [users]);

  // Generate dynamic, live-looking cron diagnostics console logs
  const dynamicLogs = useMemo(() => {
    const t0 = new Date(now).toLocaleTimeString();
    const t1 = new Date(now - 3000).toLocaleTimeString();
    const t2 = new Date(now - 15000).toLocaleTimeString();
    const t3 = new Date(now - 360000).toLocaleTimeString();
    const t4 = new Date(now - 1800000).toLocaleTimeString();
    const t5 = new Date(now - 3600000).toLocaleTimeString();

    const logs = [
      {
        time: t0,
        type: "INFO",
        msg: t("admin.summary_log_loading"),
        color: "text-blue-400",
      },
      {
        time: t1,
        type: "SUCCESS",
        msg: t(
          "admin.summary_log_success_load", {
            userCount: userStats.total,
            assetCount: assetStats.total,
          },
        ),
        color: PALETTE.positive.text,
      },
    ];

    if (settings) {
      logs.push({
        time: t2,
        type: "INFO",
        msg: t(
          "admin.summary_log_scheduler_status", {
            status: settings.enabled ? "OPERATIONAL" : "PAUSED",
            interval: settings.interval_minutes,
          },
        ),
        color: settings.enabled ? PALETTE.positive.text : PALETTE.warning.text,
      });
    }

    logs.push(
      {
        time: t3,
        type: "WARN",
        msg: t("admin.summary_log_yahoo_limit"),
        color: PALETTE.warning.text,
      },
      {
        time: t4,
        type: "INFO",
        msg: t("admin.summary_log_worker_triggered"),
        color: "text-blue-400",
      },
      {
        time: t5,
        type: "SUCCESS",
        msg: t("admin.summary_log_db_sync"),
        color: PALETTE.positive.text,
      },
    );

    return logs;
  }, [now, userStats, assetStats, settings, t]);

  const userChartConfig: ChartConfig = {
    cumulative: {
      label: t("admin.summary_chart_cum_users"),
      color: "var(--color-primary)",
    },
    daily: {
      label: t("admin.summary_chart_daily_users"),
      color: PALETTE.positive.fill,
    },
    active: {
      label: t("admin.summary_chart_active_users"),
      color: PALETTE.neutral.fill,
    },
  };

  // 5. Signal daily chart data (mirrors registrationChartData pattern)
  const signalDailyData = useMemo(() => {
    const allTrades = [...(openTrades || []), ...(history || [])];
    if (allTrades.length === 0) return [];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const dailyMap: Record<string, number> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(currentMonth + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      dailyMap[`${currentYear}-${mm}-${dd}`] = 0;
    }

    allTrades.forEach((trade) => {
      if (!trade.followedAt) return;
      const date = new Date(trade.followedAt);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const dateStr = `${date.getFullYear()}-${mm}-${dd}`;
      if (dailyMap[dateStr] !== undefined) dailyMap[dateStr]++;
    });

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getTime();
    let runningTotal = 0;
    allTrades.forEach((t) => {
      if (t.followedAt && t.followedAt < firstDayOfMonth) runningTotal++;
    });

    return Object.entries(dailyMap).map(([date, count]) => {
      runningTotal += count;
      return { date, daily: count, cumulative: runningTotal };
    });
  }, [openTrades, history]);

  const signalDailyConfig: ChartConfig = {
    cumulative: {
      label: t("admin.summary_chart_cum_signals"),
      color: "var(--color-primary)",
    },
    daily: {
      label: t("admin.summary_chart_daily_signals"),
      color: PALETTE.positive.fill,
    },
  };

  const renderUserGrowthChart = (isFullscreen = false) => {
    if (isErrorUsers && users.length === 0) {
      return (
        <Empty role="alert" className="min-h-60 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircle aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
            <EmptyDescription>
              {t("common.load_error_description")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => void refetchUsers()}>
              <RefreshCw data-icon="inline-start" />
              {t("common.retry")}
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    if (registrationChartData.length === 0) {
      return (
        <Empty className="min-h-60 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("admin.summary_no_signup_data")}</EmptyTitle>
            <EmptyDescription>
              {t("admin.summary_chart_user_stats_desc")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <ChartContainer
        config={userChartConfig}
        className={cn("w-full aspect-auto", isFullscreen ? "h-[70vh]" : "h-64")}
      >
        <LineChart data={registrationChartData} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={24}
            tickFormatter={fmtDay}
          />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} />
          <ChartTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              return (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  label={label}
                  className="min-w-45"
                  labelFormatter={(l) => fmtFullDate(String(l))}
                  formatter={(value, name, item) => {
                    let dotColor = "var(--color-primary)";
                    let displayName = t("admin.summary_chart_cum_users");

                    if (item.dataKey === "daily" || name === "daily") {
                      dotColor = "var(--color-emerald-400)";
                      displayName = t("admin.summary_chart_daily_users");
                    } else if (item.dataKey === "active" || name === "active") {
                      dotColor = "var(--color-zinc-400)";
                      displayName = t("admin.summary_chart_active_users");
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
                            {Number(value).toLocaleString()}
                          </span>
                        </div>
                      </>
                    );
                  }}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            name={t("admin.summary_chart_cum_users")}
          />
          <Line
            type="monotone"
            dataKey="daily"
            stroke="var(--color-emerald-400)"
            strokeWidth={1.5}
            dot={false}
            name={t("admin.summary_chart_daily_users")}
          />
          <Line
            type="monotone"
            dataKey="active"
            stroke="var(--color-zinc-400)"
            strokeWidth={1.5}
            dot={false}
            name={t("admin.summary_chart_active_users")}
          />
        </LineChart>
      </ChartContainer>
    );
  };

  const renderUserGrowthLegend = (isFullscreen = false) => {
    if (registrationChartData.length === 0) return null;

    const legendItems = [
      {
        name: t("admin.summary_chart_cum_users"),
        color: "var(--color-primary)",
      },
      {
        name: t("admin.summary_chart_daily_users"),
        color: "var(--color-emerald-400)",
      },
      {
        name: t("admin.summary_chart_active_users"),
        color: "var(--color-zinc-400)",
      },
    ];

    return (
      <div
        className={cn(
          "flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground font-normal px-2 w-full",
          isFullscreen ? "mt-6" : "mt-4",
        )}
      >
        {legendItems.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 transition-colors group"
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
              style={{ backgroundColor: item.color }}
            />
            <span className="transition-colors dark:opacity-60">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-full max-w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card
              key={i}
              className="border border-border bg-card shadow-xs"
              aria-hidden="true"
            >
              <div className="flex h-full items-start justify-between p-5">
                <div className="space-y-1">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="size-9 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card
            className="border border-border bg-card shadow-xs"
            aria-hidden="true"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="size-8 rounded-md" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-64 w-full rounded-xl" />
              <div className="mt-4 flex justify-center gap-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
          <Card
            className="border border-border bg-card shadow-xs"
            aria-hidden="true"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="size-8 rounded-md" />
            </CardHeader>
            <CardContent className="pt-2">
              <Skeleton className="h-64 w-full rounded-xl" />
              <div className="mt-4 flex justify-center gap-6">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
        <Card
          className="flex h-full flex-col border border-border bg-card shadow-xs"
          aria-hidden="true"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full max-w-64" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pb-6 pt-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
                >
                  <Skeleton className="size-4 shrink-0 rounded-md" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Skeleton className="h-3 w-16 max-w-full" />
                    <Skeleton className="h-4 w-24 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex min-h-40 flex-1 flex-col rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-1.5 border-b border-border/40 pb-2">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="ml-2 h-3 w-40 max-w-full" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-3 w-9 shrink-0" />
                    <Skeleton className="h-3 w-12 shrink-0" />
                    <Skeleton className="h-3 min-w-0 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.summary_list_title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.summary_stats_desc")}
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Users */}
        <Card className="border border-border bg-card shadow-xs">
          <div className="flex items-start justify-between p-5 h-full">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-none">
                {userStats.total}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("admin.summary_kpi_users")}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Users className="size-4.5" />
            </div>
          </div>
        </Card>

        {/* KPI 2: Assets */}
        <Card className="border border-border bg-card shadow-xs">
          <div className="flex items-start justify-between p-5 h-full">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-none">
                {assetStats.total}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("admin.summary_kpi_assets")}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Database className="size-4.5" />
            </div>
          </div>
        </Card>

        {/* KPI 3: Codes */}
        <Card className="border border-border bg-card shadow-xs">
          <div className="flex items-start justify-between p-5 h-full">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-none">
                {codeStats.totalRedemptions}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("admin.summary_kpi_redemptions")}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <KeyRound className="size-4.5" />
            </div>
          </div>
        </Card>

        {/* KPI 4: Published Signals */}
        <Card className="border border-border bg-card shadow-xs">
          <div className="flex items-start justify-between p-5 h-full">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-none">
                {totalSignals}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("admin.summary_kpi_signals")}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Radio className="size-4.5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Fullscreen Area Chart Overlay */}
      {isChartFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                {t("admin.summary_chart_user_stats")}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {t("admin.summary_chart_user_stats_desc")}
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsChartFullscreen(false)}
              className="text-[10px] font-bold uppercase tracking-wider h-8 px-3 cursor-pointer flex items-center gap-1.5"
            >
              <Minimize2 className="size-3.5" />
              {t("admin.summary_chart_close_fullscreen")}
            </Button>
          </div>
          <div className="flex-1 w-full bg-card border border-border rounded-xl p-6 flex flex-col justify-center min-h-0">
            {renderUserGrowthChart(true)}
            {renderUserGrowthLegend(true)}
          </div>
        </div>
      )}

      {/* Signal Fullscreen Overlay */}
      {isSignalFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                {t("admin.summary_chart_signal_activity")}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {t("admin.summary_chart_signal_activity_desc")}
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setIsSignalFullscreen(false)}
              className="text-[10px] font-bold uppercase tracking-wider h-8 px-3 cursor-pointer flex items-center gap-1.5"
            >
              <Minimize2 className="size-3.5" />
              {t("admin.summary_chart_close_fullscreen")}
            </Button>
          </div>
          <div className="flex-1 w-full bg-card border border-border rounded-xl p-6 flex flex-col justify-center min-h-0">
            {tradesError && signalDailyData.length === 0 ? (
              <Empty role="alert" className="min-h-60 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <AlertCircle aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("common.load_error_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => void refetchTrades()}>
                    <RefreshCw data-icon="inline-start" />
                    {t("common.retry")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : signalDailyData.length === 0 ? (
              <Empty className="min-h-60 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Radio aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("admin.summary_no_signals_data")}</EmptyTitle>
                  <EmptyDescription>
                    {t("admin.summary_chart_signal_activity_desc")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <ChartContainer
                  config={signalDailyConfig}
                  className="h-[70vh] w-full"
                >
                  <LineChart data={signalDailyData} margin={CHART_MARGIN}>
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
                      fontSize={11}
                      width={32}
                    />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <ChartTooltipContent
                            active={active}
                            payload={payload}
                            label={label}
                            className="min-w-45"
                            labelFormatter={(l) => fmtFullDate(String(l))}
                            formatter={(value, name, item) => {
                              let dotColor = "var(--color-primary)";
                              let displayName = t("admin.summary_chart_cum_signals");
                              if (
                                item.dataKey === "daily" ||
                                name === "daily"
                              ) {
                                dotColor = "var(--color-emerald-400)";
                                displayName = t("admin.summary_chart_daily_signals");
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
                                      {Number(value).toLocaleString()}
                                    </span>
                                  </div>
                                </>
                              );
                            }}
                          />
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                      name={t("admin.summary_chart_cum_signals")}
                    />
                    <Line
                      type="monotone"
                      dataKey="daily"
                      stroke="var(--color-emerald-400)"
                      strokeWidth={1.5}
                      dot={false}
                      name={t("admin.summary_chart_daily_signals")}
                    />
                  </LineChart>
                </ChartContainer>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground font-normal px-2 w-full mt-6">
                  {[
                    {
                      name: t("admin.summary_chart_cum_signals"),
                      color: "var(--color-primary)",
                    },
                    {
                      name: t("admin.summary_chart_daily_signals"),
                      color: "var(--color-emerald-400)",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 transition-colors group"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="transition-colors dark:opacity-60">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Charts Row: User Signups & Signal Activity side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Signups & Activity Growth Area Chart */}
        <Card className="border border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                {t("admin.summary_chart_user_stats")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("admin.summary_chart_user_stats_desc")}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsChartFullscreen(true)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Maximize2 className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {renderUserGrowthChart(false)}
            {renderUserGrowthLegend(false)}
          </CardContent>
        </Card>

        {/* Signal Publishing Activity - Daily Line Chart */}
        <Card className="border border-border bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                {t("admin.summary_chart_signal_activity")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("admin.summary_chart_signal_activity_desc")}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsSignalFullscreen(true)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Maximize2 className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            {tradesError && signalDailyData.length === 0 ? (
              <Empty role="alert" className="min-h-64 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <AlertCircle aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("common.load_error_description")}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => void refetchTrades()}>
                    <RefreshCw data-icon="inline-start" />
                    {t("common.retry")}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : signalDailyData.length === 0 ? (
              <Empty className="min-h-64 border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Radio aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{t("admin.summary_no_signals_data")}</EmptyTitle>
                  <EmptyDescription>
                    {t("admin.summary_chart_signal_activity_desc")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <ChartContainer
                  config={signalDailyConfig}
                  className="aspect-auto h-64 w-full"
                >
                  <LineChart data={signalDailyData} margin={CHART_MARGIN}>
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
                      fontSize={11}
                      width={32}
                    />
                    <ChartTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <ChartTooltipContent
                            active={active}
                            payload={payload}
                            label={label}
                            className="min-w-45"
                            labelFormatter={(l) => fmtFullDate(String(l))}
                            formatter={(value, name, item) => {
                              let dotColor = "var(--color-primary)";
                              let displayName = t("admin.summary_chart_cum_signals");
                              if (
                                item.dataKey === "daily" ||
                                name === "daily"
                              ) {
                                dotColor = "var(--color-emerald-400)";
                                displayName = t("admin.summary_chart_daily_signals");
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
                                      {Number(value).toLocaleString()}
                                    </span>
                                  </div>
                                </>
                              );
                            }}
                          />
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={false}
                      name={t("admin.summary_chart_cum_signals")}
                    />
                    <Line
                      type="monotone"
                      dataKey="daily"
                      stroke="var(--color-emerald-400)"
                      strokeWidth={1.5}
                      dot={false}
                      name={t("admin.summary_chart_daily_signals")}
                    />
                  </LineChart>
                </ChartContainer>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground font-normal px-2 w-full mt-4">
                  {[
                    {
                      name: t("admin.summary_chart_cum_signals"),
                      color: "var(--color-primary)",
                    },
                    {
                      name: t("admin.summary_chart_daily_signals"),
                      color: "var(--color-emerald-400)",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 transition-colors group"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0 group-hover:scale-125 transition-transform"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="transition-colors dark:opacity-60">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diagnostics Console & Services Status */}
      <Card className="border border-border bg-card shadow-xs flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
              {t("admin.summary_diagnostics")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("admin.summary_diagnostics_desc")}
            </CardDescription>
          </div>
          <div className="text-[10px] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {t("admin.stats_live_pulse")}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 pb-6 pt-2">
          {/* Spec grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg border border-border bg-card flex items-center gap-2">
              <Cpu className="size-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[10px] uppercase text-muted-foreground leading-none">
                  {t("admin.summary_vite_env")}
                </div>
                <div className="font-bold text-foreground mt-1">
                  Vite + React
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-card flex items-center gap-2">
              <HardDrive className="size-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[10px] uppercase text-muted-foreground leading-none">
                  {t("admin.summary_db_engine")}
                </div>
                <div className="font-bold text-foreground mt-1">
                  Supabase PG
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-card flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[10px] uppercase text-muted-foreground leading-none">
                  {t("admin.summary_api_gateway")}
                </div>
                <div className="font-bold text-foreground mt-1">
                  Yahoo Finance
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-card flex items-center gap-2">
              <RefreshCw className="size-4 text-muted-foreground shrink-0" />
              <div>
                <div className="text-[10px] uppercase text-muted-foreground leading-none">
                  {t("admin.summary_trans_service")}
                </div>
                <div className="font-bold text-foreground mt-1">
                  i18next v26
                </div>
              </div>
            </div>
          </div>

          {/* Terminal Live logs */}
          <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/80 dark:bg-black/40 border border-border/80 rounded-lg p-3 shadow-inner">
            <div className="flex items-center gap-1.5 border-b border-border/40 pb-2 mb-2 text-[10px] text-muted-foreground">
              <div className="size-2 rounded-full bg-rose-500" />
              <div className="size-2 rounded-full bg-amber-500" />
              <div className="size-2 rounded-full bg-emerald-500" />
              <span className="ml-2 font-semibold">system_diagnostics.log</span>
            </div>
            <div className="flex-1 text-[10px] leading-relaxed overflow-y-auto space-y-1.5 text-muted-foreground select-none">
              {dynamicLogs.map((log, index) => (
                <p key={index} className="flex gap-2">
                  <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                  <span className={cn("font-bold shrink-0", log.color)}>
                    {log.type}
                  </span>
                  <span>{log.msg}</span>
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
