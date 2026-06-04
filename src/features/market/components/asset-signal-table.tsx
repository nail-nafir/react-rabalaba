import { useMemo, useState, useEffect } from "react";
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
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Info,
  Star,
  Plus,
  Sparkles,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { PercentageChange } from "@/components/shared/percentage-change";
import { SignalStrengthMeter } from "@/components/shared/signal-strength-meter";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonTableRow } from "@/components/shared/skeleton-card";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import {
  TIER_COLORS,
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  SIGNAL_FILTER_OPTIONS,
} from "@/constants/signals";
import { useUIStore } from "@/store/ui-store";
import { useFilterStore, type SignalFilterType } from "@/store/filter-store";
import { useFavoriteStore } from "@/store/favorite-store";
import { useDebounce } from "@/hooks/use-debounce";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import type { AssetFilterType, UnifiedAsset } from "@/types/asset";
import {
  DEFAULT_COMMODITY_TICKERS,
  DEFAULT_CRYPTO_TICKERS,
  DEFAULT_ID_STOCK_TICKERS,
  DEFAULT_US_STOCK_TICKERS,
  DEFAULT_FOREX_TICKERS,
  TOP_CRYPTO_TICKERS,
  TOP_ID_STOCK_TICKERS,
  TOP_US_STOCK_TICKERS,
  ASSET_TYPE_OPTIONS,
} from "@/constants/assets";
import { Button } from "@/components/ui/button";
import { PremiumAccessDialog } from "./premium-access-dialog";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { formatPrice, formatVolume } from "@/lib/formatters";
import type { Column } from "@tanstack/react-table";
import { AssetDetailDialog } from "@/features/trading-plan/components/asset-detail-dialog";
import { AddTickerDialog } from "./add-ticker-dialog";
import { FilterGroup } from "@/components/shared/filter-group";

type PendingAction =
  | { type: "ANALYZE"; symbol: string }
  | { type: "FAVORITE" }
  | { type: "ADD_TICKER" }
  | null;

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const { openDetailDialog } = useUIStore();
  const {
    assetType,
    setAssetType,
    searchQuery,
    setSearchQuery,
    signalFilter,
    setSignalFilter,
  } = useFilterStore();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { hasAccess } = usePremiumAccess();

  // Access Pending Action
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // Favorite integration
  const { favoriteSymbols, removeSymbol } = useFavoriteStore();
  const [showFavorites, setShowFavorites] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Access Dialog States
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

  const { data: cryptoAssets, isFetching: cryptoFetching } = useMarketData(
    hasAccess ? TOP_CRYPTO_TICKERS : DEFAULT_CRYPTO_TICKERS,
  );
  const { data: usStocks, isFetching: usFetching } = useMarketData(
    hasAccess ? TOP_US_STOCK_TICKERS : DEFAULT_US_STOCK_TICKERS,
  );
  const { data: idStocks, isFetching: idFetching } = useMarketData(
    hasAccess ? TOP_ID_STOCK_TICKERS : DEFAULT_ID_STOCK_TICKERS,
  );
  const { data: commodities, isFetching: comFetching } = useMarketData(
    DEFAULT_COMMODITY_TICKERS,
  );
  const { data: forexAssets, isFetching: forexFetching } = useMarketData(
    DEFAULT_FOREX_TICKERS,
  );

  // Fetch favorite data
  const { data: favoriteAssets, isFetching: favoriteFetching } =
    useMarketData(favoriteSymbols);

  const translatedAssetOptions = ASSET_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    label: t(`common.asset_types.${opt.value}`),
  }));

  const translatedSignalOptions = SIGNAL_FILTER_OPTIONS.map((opt) => ({
    ...opt,
    label: t(`common.signals.${opt.value}`),
  }));

  const isFetching =
    cryptoFetching ||
    usFetching ||
    idFetching ||
    comFetching ||
    forexFetching ||
    favoriteFetching;

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

  const isLoading = isFetching && allAssets.length === 0;

  const displayFavCount = useMemo(() => {
    if (assetType === "all") return favoriteSymbols.length;
    return allAssets.filter(
      (a) => a.assetType === assetType && favoriteSymbols.includes(a.symbol),
    ).length;
  }, [allAssets, assetType, favoriteSymbols]);

  const filteredData = useMemo(() => {
    let data = [...allAssets];
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
  }, [allAssets, assetType, showFavorites, favoriteSymbols, debouncedSearch, signalFilter]);

  const columns = useMemo<ColumnDef<UnifiedAsset>[]>(
    () => [
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          return (
            <Button
              variant="link"
              size="icon"
              className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
              onClick={() => {
                if (hasAccess) {
                  openDetailDialog(row.original.symbol);
                } else {
                  setPendingAction({
                    type: "ANALYZE",
                    symbol: row.original.symbol,
                  });
                  setIsAccessDialogOpen(true);
                }
              }}
              title={t("common.analyze")}
            >
              <Info className="h-4 w-4" />
            </Button>
          );
        },
        enableSorting: false,
      },
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
            <span className="text-sm font-semibold text-mono-data">
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
            <span className="text-xs text-mono-data text-muted-foreground">
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
          return row.original.outlook ? (
            <SignalStrengthMeter
              value={row.original.outlook.strength}
              size="sm"
            />
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
          const tier = row.original.outlook.tier;
          const colors = TIER_COLORS[tier];
          return (
            <Badge
              variant="outline"
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
              {SIGNAL_LABELS[signal]}
            </Badge>
          );
        },
      },
      {
        id: "sparkline",
        header: "",
        cell: ({ row }) => {
          const sparklineData = row.original.quoteIndicators?.close
            ?.filter((p): p is number => p !== null)
            .slice(-30);

          return sparklineData && sparklineData.length > 1 ? (
            <div className="flex justify-end pr-4">
              <MiniSparkline data={sparklineData} width={60} height={20} />
            </div>
          ) : null;
        },
        enableSorting: false,
      },
    ],
    [hasAccess, openDetailDialog, t],
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("market.screener")}
          </h2>
          {hasAccess && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-bold animate-shimmer rounded-md">
              <Sparkles className="h-2.5 w-2.5 fill-primary/50" />
              PREMIUM
            </Badge>
          )}
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary opacity-50" />
          )}
        </div>
      </div>

      {/* Control bar section */}
      <div className="flex flex-col gap-3">
        {/* Filters Header at the top */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
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
              className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
            />
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
                  setPendingAction({ type: "FAVORITE" });
                  setIsAccessDialogOpen(true);
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
              <span className={cn("hidden sm:inline text-xs font-bold tracking-tight", showFavorites && "text-amber-500")}>
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
                  setPendingAction({ type: "ADD_TICKER" });
                  setIsAccessDialogOpen(true);
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
            {isLoading && allAssets.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <SkeletonTableRow />
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
                      title="No assets found"
                      description="Try adjusting your filters."
                    />
                  )}
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

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {t("table.page")}{" "}
          <span className="font-medium text-foreground">
            {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0}
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

      {/* Detail dialog */}
      <AssetDetailDialog />

      {/* Add Ticker Dialog Popup */}
      <AddTickerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* Access Premium Dialog Popup */}
      <PremiumAccessDialog
        open={isAccessDialogOpen}
        onOpenChange={setIsAccessDialogOpen}
        onSuccess={() => {
          if (!pendingAction) return;

          switch (pendingAction.type) {
            case "ANALYZE":
              openDetailDialog(pendingAction.symbol);
              break;
            case "FAVORITE":
              setShowFavorites(true);
              break;
            case "ADD_TICKER":
              setIsAddDialogOpen(true);
              break;
          }
          setPendingAction(null);
        }}
      />
    </>
  );
}
