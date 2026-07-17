import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  RefreshCw,
  LogIn,
  LogOut,
  Hourglass,
} from "lucide-react";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import {
  buildTradeWinrateSnapshots,
  computePnl,
  deriveFollowProgress,
  type FollowedTrade,
  type FollowProgress,
  type FollowSignal,
  type LifecycleStatus,
  type TradeWinrateSnapshot,
  LIFECYCLE_STATUSES,
  FOLLOW_SIGNALS,
} from "@/features/follow-trade/lib/follow-trade-model";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import { LifecycleBadge, TpProgress } from "./follow-status";
import {
  formatPrice,
  formatRatio,
  formatDayMonth,
  formatClock,
} from "@/lib/formatters";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { SkeletonFollowHistoryRow } from "@/components/shared/skeleton-card";
import { StrengthBar } from "@/components/charts/strength-bar";
import { SuccessRateBar } from "@/components/charts/success-rate-bar";
import {
  FilterGroup,
  type FilterOption,
} from "@/components/shared/filter-group";
import {
  SIGNAL_COLORS,
  TIER_COLORS,
  SIGNAL_LABEL_KEYS,
  LIFECYCLE_LABEL_KEYS,
  ASSET_TYPE_OPTIONS,
  PALETTE,
  PNL_FILTERS,
  PNL_FILTER_LABEL_KEYS,
  type PnlFilter,
} from "@/constants";
import type { AssetFilterType } from "@/types/asset";
import { cn } from "@/lib/utils";

const BADGE_CLASS = "font-bold tracking-wider uppercase text-[10px] rounded-md";


// Filter unions = the taxonomy value + the UI-only "all" sentinel. `PnlFilter`
// already bakes in "all" (it's purely a UI grouping), so it comes straight from
// the taxonomy.
type DirFilter = "all" | FollowSignal;
type LifecycleFilter = "all" | LifecycleStatus;

/** PnL filters that only make sense for CLOSED trades — an open position hasn't
 *  stopped out or reversal-closed yet, so picking one of these forces lifecycle
 *  off "open" (and vice-versa). */
const CLOSED_ONLY_PNL: PnlFilter[] = ["sl", "reversal_profit", "reversal_loss"];

function SortIcon({ column }: { column: Column<FollowedTrade, unknown> }) {
  const isSorted = column.getIsSorted();
  if (isSorted === "asc")
    return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
  if (isSorted === "desc")
    return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
}

function SortButton({
  label,
  column,
}: {
  label: string;
  column: Column<FollowedTrade, unknown>;
}) {
  return (
    <Button
      variant="link"
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
    >
      {label} <SortIcon column={column} />
    </Button>
  );
}

interface FollowHistoryTableProps {
  openTrades: FollowedTrade[];
  history: FollowedTrade[];
  isLoading: boolean;
  isFetching: boolean;
  onRefresh: () => void;
  onTradeSelect: (tradeId: string) => void;
}

export function FollowHistoryTable({
  openTrades,
  history,
  isLoading,
  isFetching,
  onRefresh,
  onTradeSelect,
}: FollowHistoryTableProps) {
  "use no memo";
  const { t, i18n } = useTranslation();
  // Live prices for open ("running") trades so their P/L updates each refetch.
  // Kept in a ref so the (memoized) column defs read fresh prices WITHOUT being
  // recreated every render — that churn is what made recharts hang earlier.
  const openSymbols = useMemo(
    () => openTrades.map((tr) => tr.symbol),
    [openTrades],
  );
  const { data: liveAssets } = useMarketData(openSymbols);
  const livePriceRef = useRef<Record<string, number>>({});
  livePriceRef.current = Object.fromEntries(
    (liveAssets ?? []).map((a) => [a.symbol, a.price]),
  );

  // Live TP/SL milestone per OPEN trade, replayed off the same fetched candles
  // (the cron only persists `highestTpReached` on close, so the stored value is
  // a stale 0 while running). Kept in a ref so the memoized column defs read
  // fresh progress WITHOUT being recreated each render — same reason as prices.
  const progressBySymbol = useMemo(() => {
    const assetBySym = new Map((liveAssets ?? []).map((a) => [a.symbol, a]));
    const map: Record<string, FollowProgress> = {};
    for (const tr of openTrades) {
      const a = assetBySym.get(tr.symbol);
      const candles = a?.quoteIndicators
        ? normalizeYahooCandles(a.quoteIndicators, a.timestamps)
        : undefined;
      map[tr.symbol] = deriveFollowProgress(
        tr,
        a?.price ?? tr.entryPrice,
        candles,
      );
    }
    return map;
  }, [openTrades, liveAssets]);
  const progressRef = useRef<Record<string, FollowProgress>>({});
  progressRef.current = progressBySymbol;

  // Journal rows need the historical snapshot at that trade's point in time,
  // not the symbol's current aggregate. Kept in a ref so the memoized columns
  // read fresh stats without being recreated — same reason as prices/progress.
  const winrateByTradeId = useMemo(
    () => buildTradeWinrateSnapshots([...openTrades, ...history]),
    [openTrades, history],
  );
  const winrateRef = useRef<Record<string, TradeWinrateSnapshot>>({});
  winrateRef.current = winrateByTradeId;

  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilterType>("all");
  const [dirFilter, setDirFilter] = useState<DirFilter>("all");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>("all");
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>("all");

  const handleLifecycleChange = (val: LifecycleFilter) => {
    setLifecycleFilter(val);
    if (val === "open" && CLOSED_ONLY_PNL.includes(pnlFilter)) {
      setPnlFilter("all");
    }
  };

  const handlePnlChange = (val: PnlFilter) => {
    setPnlFilter(val);
    if (CLOSED_ONLY_PNL.includes(val) && lifecycleFilter === "open") {
      setLifecycleFilter("all");
    }
  };

  // One table = every trade. Open ("open") rows on top, then closed history.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...openTrades, ...history].filter((tr) => {
      if (assetFilter !== "all" && tr.assetType !== assetFilter) return false;
      if (dirFilter !== "all" && tr.signal !== dirFilter) return false;
      // Lifecycle (open/closed) and PnL/Laba-Rugi (terminal close reason) are two
      // independent axes — mirrors the table's lifecycle badge + TP/SL stepper.
      if (lifecycleFilter === "open" && tr.status !== "open") return false;
      if (lifecycleFilter === "closed" && tr.status === "open") return false;
      if (pnlFilter !== "all") {
        const progress =
          tr.status === "open"
            ? (progressBySymbol[tr.symbol] ??
              deriveFollowProgress(tr, tr.entryPrice))
            : deriveFollowProgress(tr, tr.closePrice ?? tr.entryPrice);

        // Mirror the donut's outcome buckets EXACTLY. A reversal-after-TP keeps
        // its tp{n} status, so it belongs to "tp" (it still secured a TP); only a
        // NO-TP reversal (status "reversed") is a reversal bucket, split by
        // realized P/L. Every closed trade lands in exactly one of
        // tp / sl / reversal_profit / reversal_loss.
        const isTp =
          tr.status === "open"
            ? progress.tpReached > 0
            : tr.status === "tp1" || tr.status === "tp2" || tr.status === "tp3";
        const isSl = tr.status === "open" ? progress.slHit : tr.status === "sl";
        const isReversal = tr.status === "reversed";
        const reversalR = isReversal
          ? computePnl(tr, tr.closePrice ?? tr.entryPrice).r
          : 0;

        if (pnlFilter === "tp" && !isTp) return false;
        if (pnlFilter === "sl" && !isSl) return false;
        if (pnlFilter === "reversal_profit" && !(isReversal && reversalR >= 0))
          return false;
        if (pnlFilter === "reversal_loss" && !(isReversal && reversalR < 0))
          return false;
      }

      if (
        q &&
        !tr.symbol.toLowerCase().includes(q) &&
        !tr.name.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    // liveAssets dep: re-run so open trades re-classify as live prices refresh.
  }, [
    openTrades,
    history,
    search,
    assetFilter,
    dirFilter,
    lifecycleFilter,
    pnlFilter,
    progressBySymbol,
  ]);

  const dirOptions: FilterOption<DirFilter>[] = [
    { value: "all", label: t("common.signals.all") },
    ...FOLLOW_SIGNALS.map((signal) => ({
      value: signal,
      label: t(SIGNAL_LABEL_KEYS[signal]),
    })),
  ];
  const lifecycleOptions: FilterOption<LifecycleFilter>[] = [
    { value: "all", label: t("journal.filter_all_status") },
    ...LIFECYCLE_STATUSES.map((status) => ({
      value: status,
      label: t(LIFECYCLE_LABEL_KEYS[status]),
    })),
  ];
  const pnlOptions: FilterOption<PnlFilter>[] = PNL_FILTERS.map((value) => ({
    value,
    label: t(PNL_FILTER_LABEL_KEYS[value]),
  }));
  const assetOptions: FilterOption<AssetFilterType>[] = ASSET_TYPE_OPTIONS.map(
    (opt) => ({
      value: opt.value,
      label: t(opt.labelKey),
    }),
  );

  const activeLifecycleOptions = CLOSED_ONLY_PNL.includes(pnlFilter)
    ? lifecycleOptions.filter((opt) => opt.value !== "open")
    : lifecycleOptions;

  const activePnlOptions =
    lifecycleFilter === "open"
      ? pnlOptions.filter((opt) => opt.value === "all" || opt.value === "tp")
      : pnlOptions;

  const columns = useMemo<ColumnDef<FollowedTrade>[]>(
    () => [
      {
        id: "date",
        // Sort by closedAt descending — open trades float to top, closed trades sort newest to oldest.
        accessorFn: (tr) => tr.closedAt ?? Infinity,
        header: ({ column }) => (
          <SortButton label={t("journal.col_date")} column={column} />
        ),
        cell: ({ row }) => {
          const tr = row.original;
          const entrySec = tr.followedAt / 1000;
          const closeSec =
            tr.closedAt != null ? (tr.closedAt as number) / 1000 : null;
          const nowSec = Date.now() / 1000;

          return (
            <div className="py-1 flex flex-col items-start text-xs gap-1 leading-none">
              {/* Row 1: entry date */}
              <div className="text-foreground flex items-center gap-1 font-medium">
                <LogIn className="h-3 w-3 text-foreground shrink-0" />
                <span>{formatDayMonth(entrySec, i18n.language)}</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-[10px] font-normal text-muted-foreground/75">
                  {formatClock(entrySec)}
                </span>
              </div>

              {/* Row 2: close date (emerald/rose) or live now (amber) */}
              {closeSec != null ? (
                <div className="text-muted-foreground flex items-center gap-1 font-medium">
                  <LogOut className="h-3 w-3 text-muted-foreground shrink-0" />
                <span>{formatDayMonth(closeSec, i18n.language)}</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-[10px] font-normal opacity-75">
                    {formatClock(closeSec)}
                  </span>
                </div>
              ) : (
                <div className="text-amber-400 flex items-center gap-1 font-medium">
                  <Hourglass className="h-3 w-3 text-amber-400 shrink-0" />
                <span>{formatDayMonth(nowSec, i18n.language)}</span>
                <span className="text-amber-500/40">•</span>
                <span className="text-[10px] font-normal opacity-75">
                    {formatClock(nowSec)}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "symbol",
        header: ({ column }) => (
          <SortButton label={t("table.symbol")} column={column} />
        ),
        cell: ({ row }) => {
          return (
            <div className="py-1">
              <div className="font-bold text-sm tracking-tight text-foreground">
                {row.original.symbol}
              </div>
              <div className="text-xs truncate max-w-50 text-muted-foreground">
                {row.original.name}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "assetType",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.type")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {t(`common.asset_types.${row.original.assetType}`)}
          </span>
        ),
      },
      {
        id: "lastPrice",
        accessorFn: (tr) =>
          tr.status === "open"
            ? (livePriceRef.current[tr.symbol] ?? 0)
            : (tr.closePrice ?? 0),
        header: ({ column }) => (
          <SortButton label={t("table.price")} column={column} />
        ),
        cell: ({ row }) => {
          const tr = row.original;
          const isClosed = tr.status !== "open" && tr.closePrice != null;
          const livePrice = livePriceRef.current[tr.symbol];

          // Row 2 value: close price if done, live price if open.
          const secondPrice = isClosed ? tr.closePrice : livePrice;

          // Color for row 2:
          // - closed -> text-muted-foreground (gray, like closed date)
          // - open -> dynamic: green (emerald) if floating profit, red (rose) if
          //   floating loss, and neutral text-foreground (matching row 1) when
          //   the live price still equals the entry — no direction to show yet.
          let secondColor = "text-muted-foreground";
          if (!isClosed && secondPrice != null) {
            const { pct } = computePnl(tr, secondPrice);
            secondColor =
              pct > 0
                ? "text-emerald-400"
                : pct < 0
                  ? "text-rose-400"
                  : "text-foreground";
          }

          return (
            <div className="py-1 flex flex-col items-start text-xs gap-1 leading-none">
              {/* Row 1: entry price */}
              <div className="text-foreground flex items-center gap-1 font-medium">
                <LogIn className="h-3 w-3 text-foreground shrink-0" />
                <span>{formatPrice(tr.entryPrice, tr.assetType)}</span>
              </div>

              {/* Row 2: close or live price */}
              <div
                className={cn(
                  "flex items-center gap-1 font-medium",
                  secondColor,
                )}
              >
                {isClosed ? (
                  <LogOut
                    className={cn("h-3 w-3 shrink-0", secondColor)}
                  />
                ) : (
                  <Hourglass className={cn("h-3 w-3 shrink-0", secondColor)} />
                )}
                <span>
                  {secondPrice != null
                    ? formatPrice(secondPrice, tr.assetType)
                    : "—"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "strength",
        accessorFn: (tr) => tr.strengthAtEntry,
        header: ({ column }) => (
          <SortButton label={t("table.strength")} column={column} />
        ),
        cell: ({ row }) => (
          <StrengthBar value={row.original.strengthAtEntry} barWidth="w-16" />
        ),
      },
      {
        id: "grade",
        accessorFn: (tr) => tr.grade ?? "",
        header: ({ column }) => (
          <SortButton label={t("table.grade")} column={column} />
        ),
        cell: ({ row }) => {
          const grade = row.original.grade;
          if (!grade) return "—";
          const c = TIER_COLORS[grade];
          return (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold rounded-md",
                c.border,
                c.bg,
                c.text,
              )}
            >
              {grade}
            </Badge>
          );
        },
      },
      {
        // Historical win rate snapshot for this exact trade row.
        id: "successrate",
        accessorFn: (tr) => {
          const s = winrateRef.current[tr.id];
          return s && s.total > 0 ? s.wins / s.total : -1;
        },
        header: ({ column }) => (
          <SortButton label={t("journal.col_successrate")} column={column} />
        ),
        cell: ({ row }) => {
          const s = winrateRef.current[row.original.id];
          return (
            <div className="py-1">
              <SuccessRateBar
                wins={s?.wins ?? 0}
                total={s?.total ?? 0}
                barWidth="w-16"
              />
            </div>
          );
        },
      },
      {
        accessorKey: "signal",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.signal")}
          </span>
        ),
        cell: ({ row }) => {
          const c = SIGNAL_COLORS[row.original.signal];
          return (
            <Badge
              variant="outline"
              className={cn(BADGE_CLASS, c.bg, c.text, c.border)}
            >
              {t(SIGNAL_LABEL_KEYS[row.original.signal])}
            </Badge>
          );
        },
      },
      {
        id: "pnl",
        accessorFn: (tr) => {
          const price =
            tr.status === "open"
              ? livePriceRef.current[tr.symbol]
              : (tr.closePrice ?? tr.entryPrice);
          return price == null ? 0 : computePnl(tr, price).pct;
        },
        header: ({ column }) => (
          <SortButton label={t("journal.col_pnl")} column={column} />
        ),
        cell: ({ row }) => {
          const tr = row.original;
          // Open → LIVE P/L (current price vs entry); closed → realized.
          const price =
            tr.status === "open"
              ? livePriceRef.current[tr.symbol]
              : (tr.closePrice ?? tr.entryPrice);
          if (price == null) {
            return <span className="text-muted-foreground">—</span>;
          }
          const { pct, r } = computePnl(tr, price);
          const isWin = r >= 0;
          // Target progress lives with P&L: the magnitude (%/R) + which TP/SL was
          // hit together = the full "how did this trade perform" picture. Open →
          // live milestone (ref, off candles); closed → stored.
          const progress =
            tr.status === "open"
              ? (progressRef.current[tr.symbol] ??
                deriveFollowProgress(tr, tr.entryPrice))
              : deriveFollowProgress(tr, tr.closePrice ?? tr.entryPrice);
          return (
            <div className="py-1 flex flex-col items-start gap-1 leading-none">
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight leading-none",
                    isWin
                      ? PALETTE.positive.textStrong
                      : PALETTE.negative.textStrong,
                  )}
                >
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
                <span
                  className={cn(
                    "opacity-40",
                    isWin
                      ? PALETTE.positive.textStrong
                      : PALETTE.negative.textStrong,
                  )}
                >
                  •
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    isWin
                      ? "text-emerald-600/70 dark:text-emerald-400/70"
                      : "text-rose-600/70 dark:text-rose-400/70",
                  )}
                >
                  {r >= 0 ? "+" : ""}
                  {formatRatio(r)}R
                </span>
              </div>
              <TpProgress
                reached={progress.tpReached}
                total={progress.tpTotal}
                slHit={progress.slHit}
                reversed={progress.reversed}
                reversedPnl={isWin ? "profit" : "loss"}
                isClosed={tr.status !== "open"}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </span>
        ),
        cell: ({ row }) => (
          // Lifecycle only — outcome (TP/SL + P&L) lives in the Performa column.
          <div className="py-1">
            <LifecycleBadge open={row.original.status === "open"} />
          </div>
        ),
      },
    ],
    [t, i18n.language],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("journal.transactions")}
          </h2>
          <Button
            variant="link"
            size="icon"
            onClick={onRefresh}
            disabled={isFetching}
            title={t("journal.refresh")}
            aria-label={t("journal.refresh")}
            className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
          </Button>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
          {filtered.length} {t("journal.transactions")}
        </div>
      </div>

      {/* Filters — asset tab and the dropdowns share one row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Asset type — segmented tabs, like the market screener */}
        <FilterGroup
          value={assetFilter}
          options={assetOptions}
          onChange={(v) => setAssetFilter(v as AssetFilterType)}
          className="flex-1 sm:flex-none"
        />
        <Separator orientation="vertical" className="mx-1" />
        <FilterGroup
          value={dirFilter}
          options={dirOptions}
          onChange={(v) => setDirFilter(v as DirFilter)}
          variant="select"
          className="flex-1 sm:flex-none"
        />
        <FilterGroup
          value={lifecycleFilter}
          options={activeLifecycleOptions}
          onChange={(v) => handleLifecycleChange(v as LifecycleFilter)}
          variant="select"
          className="flex-1 sm:flex-none"
        />
        <FilterGroup
          value={pnlFilter}
          options={activePnlOptions}
          onChange={(v) => handlePnlChange(v as PnlFilter)}
          variant="select"
          className="flex-1 sm:flex-none"
        />
      </div>

      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          type="text"
          placeholder={t("market.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9 h-9 text-sm focus:ring-primary/20 transition-all shadow-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <SkeletonFollowHistoryRow />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-48 text-center"
                >
                  <EmptyState
                    title={t("journal.no_history_title")}
                    description={t("journal.no_history")}
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onTradeSelect(row.original.id)}
                  className="cursor-pointer hover:bg-muted/50 active:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  aria-label={`${t("journal.view_detail")} ${row.original.symbol}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTradeSelect(row.original.id);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
}
