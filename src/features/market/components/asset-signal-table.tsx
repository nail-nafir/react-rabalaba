import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonAssetSignalRow } from "@/components/shared/skeleton-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { PercentageChange } from "@/components/shared/percentage-change";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { StrengthBar } from "@/components/charts/strength-bar";
import { Sparkline } from "@/components/charts/sparkline";
import { SuccessRateBar } from "@/components/charts/success-rate-bar";
import {
  TIER_COLORS,
  SIGNAL_COLORS,
  SIGNAL_LABEL_KEYS,
  SIGNAL_FILTER_OPTIONS,
  ASSET_TYPE_OPTIONS,
} from "@/constants";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import { computePnl } from "@/features/follow-trade/lib/follow-trade-model";
import { useAppSelector, useUIActions, useFilterActions } from "@/store/hooks";
import { type SignalFilterType } from "@/store/slices/filter-slice";
import { useFavorites } from "@/hooks/use-favorites";
import { useDebounce } from "@/hooks/use-debounce";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { useCryptoContext } from "@/services/queries/use-crypto-context";
import { useIdxContext } from "@/services/queries/use-idx-context";
import { useUsContext } from "@/services/queries/use-us-context";
import { useSmartMoney } from "@/services/queries/use-smart-money";
import { enrichAsset } from "@/features/engine/enrichment";
import type { AssetFilterType, UnifiedAsset } from "@/types/asset";
import {
  DEFAULT_COMMODITY_TICKERS,
  DEFAULT_FOREX_TICKERS,
} from "@/constants/assets";
import { Button } from "@/components/ui/button";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useScreenerUniverse } from "@/hooks/use-screener-universe";
import { formatPrice, formatVolume } from "@/lib/formatters";
import type { Column } from "@tanstack/react-table";
import { AssetDetailDialog } from "@/features/trading-plan/components/asset-detail-dialog";
import { AddTickerDialog } from "./add-ticker-dialog";

import { FilterGroup } from "@/components/shared/filter-group";

function SortIcon({ column }: { column: Column<UnifiedAsset, unknown> }) {
  const isSorted = column.getIsSorted();
  if (isSorted === "asc")
    return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
  if (isSorted === "desc")
    return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
}



export function AssetSignalTable() {
  "use no memo";
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "strength", desc: true },
  ]);
  // Actions only — no UI-state subscription — so this expensive screener never
  // re-renders on unrelated UI changes (e.g. license-dialog open/close). That
  // decoupling is what kept a stray unstable reference from spiraling into a
  // page-unresponsive render loop.
  const { openDetailDialog, openLicenseDialog } = useUIActions();
  const assetType = useAppSelector((s) => s.filter.assetType);
  const signalFilter = useAppSelector((s) => s.filter.signalFilter);
  const searchQuery = useAppSelector((s) => s.filter.searchQuery);
  const { setAssetType, setSignalFilter, setSearchQuery } = useFilterActions();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { hasAccess } = usePremiumAccess();

  // Favorite integration
  const { favoriteSymbols, removeSymbol } = useFavorites();
  const [showFavorites, setShowFavorites] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Fetch journal trades to compute historical win rate per symbol
  const { openTrades, history } = useJournalTrades();
  const winrateBySymbol = useMemo(() => {
    const stat: Record<string, { wins: number; total: number }> = {};
    for (const tr of [...openTrades, ...history]) {
      if (tr.status === "open") continue;
      const s = (stat[tr.symbol] ??= { wins: 0, total: 0 });
      s.total += 1;
      if (computePnl(tr, tr.closePrice ?? tr.entryPrice).r >= 0) s.wins += 1;
    }
    return stat;
  }, [openTrades, history]);
  const winrateRef = useRef<Record<string, { wins: number; total: number }>>({});
  winrateRef.current = winrateBySymbol;

  // crypto / US / ID stocks come from the admin-managed DB universe for premium
  // (single source with the cron), DEFAULT_* for free — the hook handles the
  // premium gate + fallback. commodity & forex stay on constants (below).
  const universe = useScreenerUniverse();
  const { data: cryptoAssets, isLoading: cryptoLoading } = useMarketData(
    universe.crypto,
  );
  const { data: usStocks, isLoading: usLoading } = useMarketData(
    universe.usStock,
  );
  const { data: idStocks, isLoading: idLoading } = useMarketData(
    universe.idStock,
  );
  const { data: commodities, isLoading: comLoading } = useMarketData(
    DEFAULT_COMMODITY_TICKERS,
  );
  const { data: forexAssets, isLoading: forexLoading } = useMarketData(
    DEFAULT_FOREX_TICKERS,
  );

  // Fetch favorite data
  const {
    data: favoriteAssets,
    isFetching: favoriteFetching,
    isLoading: favoriteLoading,
  } = useMarketData(favoriteSymbols);

  // Top-down crypto context (BTC regime + sentiment), shared & cached.
  const { data: cryptoContext, isLoading: cryptoContextLoading } =
    useCryptoContext();

  // Top-down IDX context (IHSG regime + rupiah pressure) for id-stocks —
  // subscribes to the same ^JKSE/USDIDR=X cache entries, zero extra fetches.
  const { data: idxContext, isLoading: idxContextLoading } = useIdxContext();

  // Top-down US context (S&P 500 regime + VIX/DXY) for us-stocks — subscribes
  // to the same ^GSPC cache entry; only ^VIX/DX-Y.NYB are new fetches.
  const { data: usContext, isLoading: usContextLoading } = useUsContext();

  // Refresh the whole screener: invalidate every asset-data query at once
  // (all asset types + favorites share the ["asset-data", ...] key).
  const queryClient = useQueryClient();
  const refreshingCount = useIsFetching({ queryKey: ["asset-data"] });
  const handleRefresh = () =>
    queryClient.invalidateQueries({ queryKey: ["asset-data"] });

  const translatedAssetOptions = ASSET_TYPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  const translatedSignalOptions = SIGNAL_FILTER_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  // Monitor for symbols in favorites that failed to fetch
  useEffect(() => {
    if (!favoriteFetching && favoriteAssets && favoriteSymbols.length > 0) {
      favoriteSymbols.forEach((sym) => {
        if (!favoriteAssets.some((asset) => asset.symbol === sym)) {
          toast.error(t("market.ticker_not_found", { symbol: sym }));
          removeSymbol(sym);
        }
      });
    }
  }, [favoriteAssets, favoriteSymbols, favoriteFetching, removeSymbol, t]);

  const allAssets = useMemo<UnifiedAsset[]>(() => {
    const combined = [
      ...(cryptoAssets ?? []),
      ...(usStocks ?? []),
      ...(idStocks ?? []),
      ...(commodities ?? []),
      ...(forexAssets ?? []),
      ...(favoriteAssets ?? []),
    ];

    // De-duplicate by symbol
    const seen = new Set();
    return combined.filter((asset) => {
      if (seen.has(asset.symbol)) return false;
      seen.add(asset.symbol);
      return true;
    });
  }, [
    cryptoAssets,
    usStocks,
    idStocks,
    commodities,
    forexAssets,
    favoriteAssets,
  ]);

  // Crypto with an actionable signal → fetch smart-money only for the coins
  // where positioning actually matters (keeps Binance calls bounded).
  const cryptoForSmartMoney = useMemo(
    () =>
      allAssets.filter(
        (a) =>
          a.assetType === "crypto" &&
          a.outlook != null &&
          a.outlook.signal !== "neutral",
      ),
    [allAssets],
  );
  const { data: smartMoney, isPending: smartMoneyPending } =
    useSmartMoney(cryptoForSmartMoney);

  // Enrichment pass over the full universe (where cross-asset data exists),
  // via the shared enrichAsset chain (same one the detail dialog uses):
  // context de-rate (BTC for crypto / IHSG for id-stock / S&P 500 for us-stock)
  // → flow nudge (smart-money / accumulation). computeSignal stays pure &
  // per-asset; this layer never mutates cache data.
  const enrichedAssets = useMemo<UnifiedAsset[]>(() => {
    if (allAssets.length === 0) return allAssets;
    return allAssets.map((asset) =>
      enrichAsset(asset, {
        cryptoContext: cryptoContext ?? undefined,
        idxContext: idxContext ?? undefined,
        usContext: usContext ?? undefined,
        smartMoney: smartMoney[asset.symbol],
      }),
    );
  }, [allAssets, cryptoContext, idxContext, usContext, smartMoney]);

  // Tahan SATU skeleton sampai SEMUA sumber screener selesai initial load:
  // base assets (semua kategori) + market context BTC + smart-money crypto —
  // supaya table tampil sekaligus & sudah ter-sort, bukan nongol per-kategori
  // lalu re-sort. Pakai flag first-load (isLoading/isPending), bukan isFetching,
  // biar refetch background 30 menit update nilai di tempat tanpa nge-flash skeleton.
  const baseInitialLoading =
    cryptoLoading ||
    usLoading ||
    idLoading ||
    comLoading ||
    forexLoading ||
    favoriteLoading;
  // Smart money baru mount setelah ada crypto target; gate hanya saat ada target,
  // kalau tidak ia kebaca "not pending" sebelum sempat jalan (premature reveal).
  const smartMoneyGating = cryptoForSmartMoney.length > 0 && smartMoneyPending;
  const isLoading =
    baseInitialLoading ||
    cryptoContextLoading ||
    idxContextLoading ||
    usContextLoading ||
    smartMoneyGating;

  const displayFavCount = useMemo(() => {
    if (assetType === "all") return favoriteSymbols.length;
    return enrichedAssets.filter(
      (a) => a.assetType === assetType && favoriteSymbols.includes(a.symbol),
    ).length;
  }, [enrichedAssets, assetType, favoriteSymbols]);

  const filteredData = useMemo(() => {
    let data = [...enrichedAssets];
    if (assetType !== "all") {
      data = data.filter((a) => a.assetType === assetType);
    }

    if (showFavorites) {
      data = data.filter((a) => favoriteSymbols.includes(a.symbol));
    }

    if (signalFilter !== "all") {
      data = data.filter((a) => a.outlook?.signal === signalFilter);
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      );
    }
    return data;
  }, [
    enrichedAssets,
    assetType,
    showFavorites,
    favoriteSymbols,
    debouncedSearch,
    signalFilter,
  ]);

  const columns = useMemo<ColumnDef<UnifiedAsset>[]>(
    () => [
      {
        accessorKey: "symbol",
        header: ({ column }) => (
          <Button
            variant="link"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
          >
            {t("table.symbol")} <SortIcon column={column} />
          </Button>
        ),
        cell: ({ row }) => {
          return (
            <div className="py-1">
              <div className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
                {row.original.symbol}
              </div>
              <div className="text-xs truncate max-w-44 text-muted-foreground">
                {row.original.name}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "assetType",
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
        accessorKey: "price",
        header: ({ column }) => (
          <Button
            variant="link"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
          >
            {t("table.price")} <SortIcon column={column} />
          </Button>
        ),
        cell: ({ row }) => {
          return (
            <span className="text-sm font-semibold">
              {formatPrice(row.original.price, row.original.assetType)}
            </span>
          );
        },
      },
      {
        accessorKey: "changePercent",
        header: ({ column }) => (
          <Button
            variant="link"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
          >
            {t("table.change")} <SortIcon column={column} />
          </Button>
        ),
        cell: ({ row }) => {
          return <PercentageChange value={row.original.changePercent} />;
        },
      },
      {
        accessorKey: "volume",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.volume")}
          </span>
        ),
        cell: ({ row }) => {
          return (
            <span className="text-xs text-muted-foreground">
              {formatVolume(row.original.volume)}
            </span>
          );
        },
      },
      {
        accessorKey: "trend",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.trend")}
          </span>
        ),
        cell: ({ row }) => {
          return row.original.outlook ? (
            <TrendIndicator trend={row.original.outlook.trend} />
          ) : (
            "-"
          );
        },
      },
      {
        id: "strength",
        accessorFn: (row) => row.outlook?.strength,
        header: ({ column }) => (
          <Button
            variant="link"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
          >
            {t("table.strength")} <SortIcon column={column} />
          </Button>
        ),
        cell: ({ row }) => {
          const strength = row.original.outlook?.strength;
          return strength !== undefined ? (
            <StrengthBar value={strength} barWidth="w-16" />
          ) : (
            "-"
          );
        },
      },
      {
        id: "tier",
        accessorFn: (row) => row.outlook?.tier,
        header: ({ column }) => (
          <Button
            variant="link"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
          >
            {t("table.grade")} <SortIcon column={column} />
          </Button>
        ),
        cell: ({ row }) => {
          if (!row.original.outlook) return "-";
          const { tier, suppressed } = row.original.outlook;
          const colors = TIER_COLORS[tier];
          return (
            <Badge
              variant="outline"
              title={suppressed ? t("table.suppressed_hint") : undefined}
              className={cn(
                "text-[10px] font-bold rounded-md",
                colors.border,
                colors.bg,
                colors.text,
              )}
            >
              {tier}
            </Badge>
          );
        },
      },
      {
        id: "successrate",
        accessorFn: (row) => {
          const s = winrateRef.current[row.symbol];
          return s && s.total > 0 ? s.wins / s.total : -1;
        },
        header: ({ column }) => (
          <Button
            variant="link"
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
          >
            {t("table.successrate")} <SortIcon column={column} />
          </Button>
        ),
        cell: ({ row }) => {
          const s = winrateRef.current[row.original.symbol];
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
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.signal")}
          </span>
        ),
        cell: ({ row }) => {
          if (!row.original.outlook) return "-";
          const signal = row.original.outlook.signal;
          const colors = SIGNAL_COLORS[signal];
          return (
            <Badge
              variant="outline"
              className={cn(
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
                colors.bg,
                colors.text,
                colors.border,
              )}
            >
              {t(SIGNAL_LABEL_KEYS[signal])}
            </Badge>
          );
        },
      },

      {
        id: "sparkline",
        header: "",
        cell: ({ row }) => (
          <Sparkline
            className="flex justify-end pr-4"
            values={row.original.quoteIndicators?.close}
            width={60}
            height={20}
          />
        ),
        enableSorting: false,
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <>
      {/* Header section */}
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("market.screener")}
          </h2>
          <Button
            variant="link"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshingCount > 0}
            title={t("journal.refresh")}
            aria-label={t("journal.refresh")}
            className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
          >
            <RefreshCw
              className={cn("h-4 w-4", refreshingCount > 0 && "animate-spin")}
            />
          </Button>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span>
              {filteredData.length} {t("market.assets_found")}
            </span>
          )}
        </div>
      </div>

      {/* Control bar section */}
      <div className="flex flex-col gap-3">
        {/* Filters */}
        <div className="flex items-center gap-2 min-w-0">
          <FilterGroup
            value={assetType}
            options={translatedAssetOptions}
            onChange={(v) => setAssetType(v as AssetFilterType)}
            className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
          />

          <Separator orientation="vertical" className="mx-1" />

          <FilterGroup
            value={signalFilter}
            options={translatedSignalOptions}
            onChange={(v) => setSignalFilter(v as SignalFilterType)}
            variant="select"
            className="flex-1 sm:flex-none"
          />
        </div>

        {/* Search and Actions Group below */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder={t("market.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 text-sm placeholder:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Separator orientation="vertical" className="mx-2" />

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="lg"
              variant={showFavorites ? "default" : "secondary"}
              onClick={() => {
                if (showFavorites) {
                  setShowFavorites(false);
                  return;
                }

                if (hasAccess) {
                  setShowFavorites(true);
                } else {
                  openLicenseDialog(() => setShowFavorites(true));
                }
              }}
              className={cn(
                "cursor-pointer transition-all",
                showFavorites &&
                  "bg-amber-500/10 border-amber-500/50 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 hover:border-amber-500",
              )}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  showFavorites
                    ? "fill-amber-500 text-amber-500 scale-110"
                    : "text-muted-foreground/60",
                )}
              />
              <span
                className={cn(
                  "hidden sm:inline text-xs font-bold tracking-tight",
                  showFavorites && "text-amber-500",
                )}
              >
                {t("common.favorite")}
              </span>
              <Badge
                className={cn(
                  "text-xs rounded-md font-black leading-none transition-colors",
                  showFavorites
                    ? "bg-amber-500 text-background"
                    : "text-muted-foreground",
                )}
              >
                {displayFavCount}
              </Badge>
            </Button>

            <Button
              size="lg"
              onClick={() => {
                if (hasAccess) {
                  setIsAddDialogOpen(true);
                } else {
                  openLicenseDialog(() => setIsAddDialogOpen(true));
                }
              }}
              className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("market.add_ticker_btn")}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent"
              >
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
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <SkeletonAssetSignalRow />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-64 text-center"
                >
                  {showFavorites && favoriteSymbols.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 max-w-sm mx-auto space-y-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 animate-pulse">
                        <Star className="h-6 w-6 fill-amber-500/20" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground text-sm">
                          {t("market.favorite_empty")}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {t("market.favorite_empty_desc")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title={t("market.no_assets_found")}
                      description={t("market.no_assets_found_desc")}
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => openDetailDialog(row.original.symbol)}
                  className="cursor-pointer hover:bg-muted/50 active:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                  aria-label={t("common.analyze_symbol", { symbol: row.original.symbol })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetailDialog(row.original.symbol);
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

      {!isLoading && <DataTablePagination table={table} />}

      {/* Detail dialog */}
      <AssetDetailDialog />

      {/* Add Ticker Dialog Popup */}
      <AddTickerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </>
  );
}
