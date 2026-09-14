import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  AlertCircle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { PercentageChange } from "@/components/shared/percentage-change";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { usePublicJournalSuccessRates } from "@/features/market/hooks/use-public-journal-success-rates";
import { PUBLIC_JOURNAL_SUCCESS_RATES_QUERY_KEY } from "@/features/market/model/public-journal-success-rates";
import { useAppSelector, useFilterActions } from "@/store/hooks";
import { type SignalFilterType } from "@/store/slices/filter-slice";
import { useFavorites } from "@/features/market/hooks/use-favorites";
import { useDebounce } from "@/hooks/use-debounce";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { useMarketData } from "@/services/queries/use-market-data";
import { useCryptoContext } from "@/services/queries/use-crypto-context";
import { useIdxContext } from "@/services/queries/use-idx-context";
import { useUsContext } from "@/services/queries/use-us-context";
import { enrichAsset } from "@/core/engine/enrichment";
import type { AssetFilterType, UnifiedAsset } from "@/types/asset";
import {
  DEFAULT_COMMODITY_TICKERS,
  DEFAULT_FOREX_TICKERS,
} from "@/constants/assets";
import { Button } from "@/components/ui/button";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { useScreenerUniverse } from "@/features/market/hooks/use-screener-universe";
import {
  SIGNAL_EPISODE_STATES_QUERY_KEY,
  useSignalEpisodeStates,
} from "@/features/market/hooks/use-signal-episode-states";
import {
  applySignalEpisode,
  signalEpisodeKey,
  type TerminalAsset,
} from "@/core/automation/signal-episode";
import { formatPrice, formatVolume } from "@/lib/formatters";
import type { Column } from "@tanstack/react-table";
import { SignalAssetDialog } from "./signal-asset-dialog";
import { AssetDetailDialog } from "@/features/trading-plan/components/asset-detail-dialog";
import { LicenseAccessDialog } from "@/components/shared/license-access-dialog";

import { FilterGroup } from "@/components/shared/filter-group";

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";

function SortIcon<TData extends UnifiedAsset>({
  column,
}: {
  column: Column<TData, unknown>;
}) {
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
  const assetType = useAppSelector((s) => s.filter.assetType);
  const signalFilter = useAppSelector((s) => s.filter.signalFilter);
  const searchQuery = useAppSelector((s) => s.filter.searchQuery);
  const { setAssetType, setSignalFilter, setSearchQuery } = useFilterActions();
  const debouncedSearch = useDebounce(searchQuery, 100);
  const { hasAccess } = usePremiumAccess();

  // Favorite integration
  const {
    favoriteSymbols,
    isError: favoritesError,
    refetch: refetchFavorites,
  } = useFavorites();
  const [showFavorites, setShowFavorites] = useState(false);

  // Aggregate-only public track record. Raw journal rows remain premium-only,
  // while every tier sees the same wins/total for the screener.
  const {
    bySymbol: successRateBySymbol,
    isPending: successRatesPending,
    isError: successRatesError,
    isFetching: successRatesFetching,
  } = usePublicJournalSuccessRates();

  // crypto / US / ID stocks come from the admin-managed DB universe for premium
  // (single source with the cron), DEFAULT_* for free — the hook handles the
  // premium gate + fallback. commodity & forex stay on constants (below).
  const universe = useScreenerUniverse();
  const {
    byKey: signalStates,
    isLoading: signalStatesLoading,
    isSuccess: signalStatesAvailable,
    isFetching: signalStatesFetching,
  } = useSignalEpisodeStates();
  const {
    data: cryptoAssets,
    isLoading: cryptoLoading,
    isError: cryptoError,
  } = useMarketData(universe.crypto);
  const {
    data: usStocks,
    isLoading: usLoading,
    isError: usError,
  } = useMarketData(universe.usStock);
  const {
    data: idStocks,
    isLoading: idLoading,
    isError: idError,
  } = useMarketData(universe.idStock);
  const {
    data: commodities,
    isLoading: comLoading,
    isError: commoditiesError,
  } = useMarketData(DEFAULT_COMMODITY_TICKERS);
  const {
    data: forexAssets,
    isLoading: forexLoading,
    isError: forexError,
  } = useMarketData(DEFAULT_FOREX_TICKERS);

  // Fetch favorite data
  const {
    data: favoriteAssets,
    isLoading: favoriteLoading,
    isError: favoriteAssetsError,
  } = useMarketData(favoriteSymbols);

  // Top-down crypto context (BTC regime + score), shared & cached.
  const { data: cryptoContext, isLoading: cryptoContextLoading } =
    useCryptoContext();

  // Top-down IDX context (IHSG regime + rupiah pressure) for id-stocks —
  // subscribes to the same ^JKSE/USDIDR=X cache entries, zero extra fetches.
  const { data: idxContext, isLoading: idxContextLoading } = useIdxContext();

  // Top-down US context (S&P 500 regime + VIX/DXY) for us-stocks — subscribes
  // to the same ^GSPC cache entry; only ^VIX/DX-Y.NYB are new fetches.
  const { data: usContext, isLoading: usContextLoading } = useUsContext();

  // Refresh the whole screener: market data + its public track-record aggregate.
  const queryClient = useQueryClient();
  const assetRefreshingCount = useIsFetching({ queryKey: ["asset-data"] });
  const auxiliaryRefreshingCount =
    useIsFetching({ queryKey: ["favorites"] }) +
    useIsFetching({ queryKey: ["screener-universe"] });
  const isRefreshing =
    assetRefreshingCount > 0 ||
    auxiliaryRefreshingCount > 0 ||
    successRatesFetching ||
    signalStatesFetching;
  const handleRefresh = () => {
    void Promise.all([
      universe.refetch(),
      refetchFavorites(),
      queryClient.invalidateQueries({ queryKey: ["asset-data"] }),
      queryClient.invalidateQueries({ queryKey: ["journal-trades"] }),
      queryClient.invalidateQueries({
        queryKey: PUBLIC_JOURNAL_SUCCESS_RATES_QUERY_KEY,
      }),
      queryClient.invalidateQueries({
        queryKey: SIGNAL_EPISODE_STATES_QUERY_KEY,
      }),
    ]);
  };

  const translatedAssetOptions = ASSET_TYPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  const translatedSignalOptions = SIGNAL_FILTER_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

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

  // Enrichment pass over the full universe (where cross-asset data exists),
  // via the shared enrichAsset chain (same one the detail dialog uses):
  // benchmark context may de-rate; optional flow/fundamental reads are
  // display-only. computeSignal stays pure and this layer never mutates cache.
  const enrichedAssets = useMemo<TerminalAsset[]>(() => {
    return allAssets.map((asset) => {
      const enriched = enrichAsset(
        asset,
        {
          cryptoContext: cryptoContext ?? undefined,
          idxContext: idxContext ?? undefined,
          usContext: usContext ?? undefined,
        },
        { applyOptionalOverlays: false },
      );
      return applySignalEpisode(
        enriched,
        signalStates.get(signalEpisodeKey(asset.symbol, asset.timeframe)),
        signalStatesAvailable,
      );
    });
  }, [
    allAssets,
    cryptoContext,
    idxContext,
    usContext,
    signalStates,
    signalStatesAvailable,
  ]);

  // Wait only for initial table inputs. Optional detail overlays never hold up
  // the screener, and background refresh keeps the existing rows visible.
  const baseInitialLoading =
    cryptoLoading ||
    usLoading ||
    idLoading ||
    comLoading ||
    forexLoading ||
    favoriteLoading;
  const isLoading =
    universe.isLoading ||
    baseInitialLoading ||
    cryptoContextLoading ||
    idxContextLoading ||
    usContextLoading ||
    signalStatesLoading;

  const hasMarketDataError =
    universe.isError ||
    cryptoError ||
    usError ||
    idError ||
    commoditiesError ||
    forexError;
  const hasFavoriteDataError =
    showFavorites && (favoritesError || favoriteAssetsError);

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

  const columns = useMemo<ColumnDef<TerminalAsset>[]>(
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
            {t(
              `common.asset_types.${row.original.assetType.replaceAll("-", "_")}`,
            )}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="link"
                onClick={() => column.toggleSorting()}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors p-0 hover:no-underline h-auto"
              >
                {t("table.change")} <SortIcon column={column} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t("table.change_methodology")}
            </TooltipContent>
          </Tooltip>
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
          const stat = successRateBySymbol[row.symbol];
          return stat && stat.total > 0 ? stat.wins / stat.total : undefined;
        },
        sortUndefined: "last",
        header: ({ column }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="link"
                onClick={() => column.toggleSorting()}
                className="flex h-auto items-center gap-2 p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary hover:no-underline"
              >
                {t("table.successrate")} <SortIcon column={column} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t("table.successrate_methodology")}
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const stat = successRateBySymbol[row.original.symbol];
          return (
            <div className="py-1">
              {successRatesPending ? (
                <div
                  className="flex items-center gap-2"
                  role="status"
                  aria-label={t("table.successrate_loading")}
                >
                  <Skeleton className="h-2 w-16 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ) : successRatesError ? (
                <Badge
                  variant="outline"
                  className={cn(
                    COMPACT_SIGNAL_BADGE_CLASSNAME,
                    SIGNAL_COLORS.neutral.bg,
                    SIGNAL_COLORS.neutral.text,
                    SIGNAL_COLORS.neutral.border,
                  )}
                  title={t("table.successrate_load_error")}
                >
                  {t("table.successrate_unavailable")}
                </Badge>
              ) : (
                <SuccessRateBar
                  wins={stat?.wins ?? 0}
                  total={stat?.total ?? 0}
                  barWidth="w-16"
                />
              )}
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
          const { signalStatus } = row.original;
          const colors = SIGNAL_COLORS[signal];
          return (
            <Badge
              variant="outline"
              title={
                signalStatus === "pending" ||
                signalStatus === "blocked" ||
                signalStatus === "unavailable"
                  ? t(`dialog.signal_${signalStatus}_note`)
                  : undefined
              }
              className={cn(
                COMPACT_SIGNAL_BADGE_CLASSNAME,
                colors.bg,
                colors.text,
                colors.border,
              )}
            >
              {t(
                signalStatus === "unavailable"
                  ? "dialog.signal_unavailable"
                  : SIGNAL_LABEL_KEYS[signal],
              )}
            </Badge>
          );
        },
      },

      {
        id: "sparkline",
        header: "",
        cell: ({ row }) => (
          <Sparkline
            className="flex w-full justify-end"
            values={row.original.quoteIndicators?.close}
            width={64}
            height={32}
          />
        ),
        enableSorting: false,
      },
    ],
    [successRateBySymbol, successRatesError, successRatesPending, t],
  );

  const { pagination, onPaginationChange } = useTablePagination(
    filteredData.length,
    JSON.stringify([
      assetType,
      showFavorites,
      debouncedSearch,
      signalFilter,
      sorting,
    ]),
  );
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onPaginationChange,
    autoResetPageIndex: false,
    getRowId: (row) => row.symbol,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex flex-col gap-3">
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
            disabled={isRefreshing}
            title={t("journal.refresh")}
            aria-label={t("journal.refresh")}
            className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
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
            aria-label={t("table.type")}
            options={translatedAssetOptions}
            onChange={(v) => setAssetType(v as AssetFilterType)}
            className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
          />

          <Separator orientation="vertical" className="mx-1" />

          <FilterGroup
            value={signalFilter}
            aria-label={t("table.signal")}
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
              aria-label={t("market.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 text-sm placeholder:text-sm"
            />
            {searchQuery && (
              <button
                aria-label={t("common.clear_search")}
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
            {hasAccess || showFavorites ? (
              <Button
                size="lg"
                aria-label={t("common.favorite")}
                aria-pressed={showFavorites}
                variant={showFavorites ? "default" : "secondary"}
                onClick={() => {
                  if (showFavorites) {
                    setShowFavorites(false);
                    return;
                  }

                  setShowFavorites(true);
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
            ) : (
              <LicenseAccessDialog
                onSuccess={() => setShowFavorites(true)}
                trigger={
                  <Button
                    size="lg"
                    aria-label={t("common.favorite")}
                    variant="secondary"
                    className="cursor-pointer transition-all"
                  >
                    <Star className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="hidden sm:inline text-xs font-bold tracking-tight">
                      {t("common.favorite")}
                    </span>
                    <Badge className="text-xs rounded-md font-black leading-none transition-colors text-muted-foreground">
                      {displayFavCount}
                    </Badge>
                  </Button>
                }
              />
            )}

            {hasAccess ? (
              <SignalAssetDialog
                trigger={
                  <Button
                    size="lg"
                    aria-label={t("market.add_ticker_btn")}
                    className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {t("market.add_ticker_btn")}
                    </span>
                  </Button>
                }
              />
            ) : (
              <LicenseAccessDialog
                trigger={
                  <Button
                    size="lg"
                    aria-label={t("market.add_ticker_btn")}
                    className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {t("market.add_ticker_btn")}
                    </span>
                  </Button>
                }
              />
            )}
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
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="h-15 hover:bg-transparent">
                  <SkeletonAssetSignalRow />
                </TableRow>
              ))
            ) : filteredData.length === 0 &&
              ((hasMarketDataError && !enrichedAssets.length) ||
                (hasFavoriteDataError && !favoriteAssets?.length)) ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-64 text-center"
                >
                  <Empty role="alert" className="min-h-64 border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <AlertCircle aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>{t("market.data_unavailable")}</EmptyTitle>
                      <EmptyDescription>
                        {t("market.data_unavailable_desc")}
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        aria-busy={isRefreshing}
                      >
                        <RefreshCw data-icon="inline-start" />
                        {t("common.retry")}
                      </Button>
                    </EmptyContent>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-64 text-center"
                >
                  {showFavorites && favoriteSymbols.length === 0 ? (
                    <Empty className="min-h-64 border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Star aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>{t("market.favorite_empty")}</EmptyTitle>
                        <EmptyDescription>
                          {t("market.favorite_empty_desc")}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <Empty className="min-h-64 border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Search aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>{t("market.no_assets_found")}</EmptyTitle>
                        <EmptyDescription>
                          {t("market.no_assets_found_desc")}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <AssetDetailDialog
                  key={row.id}
                  symbol={row.original.symbol}
                  signalStateAvailable={signalStatesAvailable}
                  signalStateFetching={signalStatesFetching}
                  signalState={signalStates.get(
                    signalEpisodeKey(
                      row.original.symbol,
                      row.original.timeframe,
                    ),
                  )}
                  trigger={
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 active:bg-muted/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      role="button"
                      tabIndex={0}
                      aria-label={t("common.analyze_symbol", {
                        symbol: row.original.symbol,
                      })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.click();
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
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && <DataTablePagination table={table} />}
    </div>
  );
}
