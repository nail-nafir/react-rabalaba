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
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
} from "lucide-react";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import {
  computePnl,
  deriveFollowProgress,
  type FollowedTrade,
  type FollowProgress,
  type FollowSignal,
  type LifecycleStatus,
  LIFECYCLE_STATUSES,
  FOLLOW_SIGNALS,
} from "@/features/follow-trade/lib/follow-trade-model";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import { LifecycleBadge, TpProgress } from "./follow-status";
import {
  formatPrice,
  formatRatio,
  formatDateNumeric,
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
import { SkeletonTableRow } from "@/components/shared/skeleton-card";
import { StrengthBar } from "@/components/charts/strength-bar";
import { TradeDetailDialog } from "./trade-detail-dialog";
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

export function FollowHistoryTable() {
  "use no memo";
  const { t } = useTranslation();
  const { openTrades, history, isLoading, isFetching, refetch } =
    useJournalTrades();
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

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilterType>("all");
  const [dirFilter, setDirFilter] = useState<DirFilter>("all");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>("all");
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>("all");

  const [selectedTrade, setSelectedTrade] = useState<FollowedTrade | null>(
    null,
  );

  const handleLifecycleChange = (val: LifecycleFilter) => {
    setLifecycleFilter(val);
    if (val === "open" && (pnlFilter === "sl" || pnlFilter === "reversed")) {
      setPnlFilter("all");
    }
  };

  const handlePnlChange = (val: PnlFilter) => {
    setPnlFilter(val);
    if ((val === "sl" || val === "reversed") && lifecycleFilter === "open") {
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

        // "reversed" is its own bucket spanning a no-TP reversal AND a
        // reversal-after-TP. Partition: a reversed close belongs ONLY here, so
        // "tp" keeps just the clean TP outcomes (every closed trade lands in
        // exactly one of tp / sl / reversed).
        const isReversed = tr.status !== "open" && !!tr.reversed;
        const isTp =
          tr.status === "open"
            ? progress.tpReached > 0
            : (tr.status === "tp1" ||
                tr.status === "tp2" ||
                tr.status === "tp3") &&
              !isReversed;
        const isSl = tr.status === "open" ? progress.slHit : tr.status === "sl";

        if (pnlFilter === "tp" && !isTp) return false;
        if (pnlFilter === "sl" && !isSl) return false;
        if (pnlFilter === "reversed" && !isReversed) return false;
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

  const activeLifecycleOptions =
    pnlFilter === "sl" || pnlFilter === "reversed"
      ? lifecycleOptions.filter((opt) => opt.value !== "open")
      : lifecycleOptions;

  const activePnlOptions =
    lifecycleFilter === "open"
      ? pnlOptions.filter((opt) => opt.value === "all" || opt.value === "tp")
      : pnlOptions;

  const columns = useMemo<ColumnDef<FollowedTrade>[]>(
    () => [
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) => {
          const tr = row.original;
          return (
            <Button
              variant="link"
              size="icon"
              className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
              onClick={() => setSelectedTrade(tr)}
              aria-label={`${t("journal.view_detail")} ${tr.symbol}`}
            >
              <Info className="h-4 w-4" />
            </Button>
          );
        },
      },
      {
        id: "date",
        // Sort by closedAt only — open trades (null) naturally float to bottom.
        accessorFn: (tr) => tr.closedAt ?? 0,
        header: ({ column }) => (
          <SortButton label={t("journal.col_date")} column={column} />
        ),
        cell: ({ row }) => {
          const tr = row.original;
          const entrySec = tr.followedAt / 1000;
          const closeSec =
            tr.closedAt != null ? (tr.closedAt as number) / 1000 : null;
          const nowSec = Date.now() / 1000;

          const labelCls = "text-xs text-muted-foreground w-14 shrink-0";
          const rowCls =
            "text-sm font-semibold tracking-tight flex items-center gap-3";

          return (
            <div className="py-1 space-y-1">
              {/* Row 1: entry date */}
              <div className={`${rowCls} text-foreground`}>
                <span className={labelCls}>{t("journal.entry_price")}</span>
                <div className="flex items-baseline gap-1 font-mono">
                  <span>{formatDateNumeric(entrySec)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-[10px] font-normal text-muted-foreground/70">
                    {formatClock(entrySec)}
                  </span>
                </div>
              </div>

              {/* Row 2: close date (emerald) or live now (amber) */}
              {closeSec != null ? (
                <div className={`${rowCls} text-emerald-400`}>
                  <span className={labelCls}>{t("journal.close_short")}</span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span>{formatDateNumeric(closeSec)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[10px] font-normal opacity-70">
                      {formatClock(closeSec)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={`${rowCls} text-amber-400`}>
                  <span className={labelCls}>{t("journal.now_short")}</span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span>{formatDateNumeric(nowSec)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[10px] font-normal opacity-70">
                      {formatClock(nowSec)}
                    </span>
                  </div>
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
          // - closed → always emerald (mirrors Period column closed color)
          // - open   → dynamic: green if live > entry, red if live < entry
          let secondColor = "text-muted-foreground";
          if (isClosed) {
            secondColor = "text-emerald-400";
          } else if (secondPrice != null) {
            secondColor =
              secondPrice > tr.entryPrice
                ? "text-emerald-400"
                : secondPrice < tr.entryPrice
                  ? "text-rose-400"
                  : "text-muted-foreground";
          }

          const labelCls = "text-xs text-muted-foreground w-14 shrink-0";
          const rowCls =
            "text-sm font-semibold tracking-tight flex items-baseline gap-3";

          return (
            <div className="py-1 space-y-1">
              {/* Row 1: entry price */}
              <div className={`${rowCls} text-foreground`}>
                <span className={labelCls}>{t("journal.entry_price")}</span>
                <span className="font-mono">
                  {formatPrice(tr.entryPrice, tr.assetType)}
                </span>
              </div>

              {/* Row 2: close or live price */}
              <div className={`${rowCls} ${secondColor}`}>
                <span className={labelCls}>
                  {isClosed ? t("journal.close_short") : t("journal.now_short")}
                </span>
                <span className="font-mono">
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
            <div className="py-1 space-y-0.5">
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-sm font-semibold font-mono leading-none",
                    isWin
                      ? PALETTE.positive.textStrong
                      : PALETTE.negative.textStrong,
                  )}
                >
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
                <span className="text-muted-foreground font-mono">·</span>
                <span
                  className={cn(
                    "text-[10px] font-mono leading-none",
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
    [t],
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
            onClick={() => refetch()}
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
          {filtered.length} {t("journal.trades")}
        </div>
      </div>

      {/* Filters — asset tab and the dropdowns share one row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Asset type — segmented tabs, like the market screener */}
        <FilterGroup
          value={assetFilter}
          options={assetOptions}
          onChange={setAssetFilter}
          className="flex-1 sm:flex-none"
        />
        <Separator orientation="vertical" className="mx-1" />
        <FilterGroup
          value={dirFilter}
          options={dirOptions}
          onChange={setDirFilter}
          variant="select"
          className="flex-1 sm:flex-none"
        />
        <FilterGroup
          value={lifecycleFilter}
          options={activeLifecycleOptions}
          onChange={handleLifecycleChange}
          variant="select"
          className="flex-1 sm:flex-none"
        />
        <FilterGroup
          value={pnlFilter}
          options={activePnlOptions}
          onChange={handlePnlChange}
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
                  <SkeletonTableRow />
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
                <TableRow key={row.id}>
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
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {t("table.page")}{" "}
          <span className="font-medium text-foreground">
            {table.getPageCount() > 0
              ? table.getState().pagination.pageIndex + 1
              : 0}
          </span>{" "}
          {t("table.of")}{" "}
          <span className="font-medium text-foreground">
            {table.getPageCount() || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
