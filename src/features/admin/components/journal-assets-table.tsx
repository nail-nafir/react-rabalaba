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
  type Column,
} from "@tanstack/react-table";
import {
  Plus,
  Trash2,
  Power,
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Settings,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonJournalAssetRow } from "@/components/shared/skeleton-card";
import {
  FilterGroup,
  type FilterOption,
} from "@/components/shared/filter-group";
import { useJournalAssets } from "@/hooks/use-journal-assets";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import type { JournalAssetRow } from "@/services/supabase/database.types";
import { ASSET_TYPE_OPTIONS } from "@/constants";
import type { AssetFilterType, UnifiedAsset } from "@/types/asset";
import { formatDateNumeric, formatClock, formatPrice } from "@/lib/formatters";
import { PercentageChange } from "@/components/shared/percentage-change";
import { cn } from "@/lib/utils";
import { AddJournalAssetDialog } from "./add-journal-asset-dialog";
import { JournalSettingsDialog } from "./journal-settings-dialog";

type StatusFilter = "all" | "active" | "inactive";

function SortIcon({ column }: { column: Column<JournalAssetRow, unknown> }) {
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
  column: Column<JournalAssetRow, unknown>;
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

/** Static status pill badge. */
function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted/30 text-muted-foreground"
      )}
    >
      {active ? t("admin.status_active") : t("admin.status_inactive")}
    </Badge>
  );
}

/** Action button to toggle active status with confirmation dialog. */
function ToggleStatusButton({
  asset,
  onToggle,
}: {
  asset: JournalAssetRow;
  onToggle: (symbol: string, active: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const active = asset.active;
  return (
    <>
      <Button
        variant="link"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={active ? t("admin.deactivate_confirm_title", { symbol: asset.symbol }) : t("admin.activate_confirm_title", { symbol: asset.symbol })}
        className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted"
        title={active ? t("admin.action_pause") : t("admin.action_activate")}
      >
        {active ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia
              className={cn(
                active
                  ? "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
              )}
            >
              <Power />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {active
                ? t("admin.deactivate_confirm_title", { symbol: asset.symbol })
                : t("admin.activate_confirm_title", { symbol: asset.symbol })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {active
                ? t("admin.deactivate_confirm_desc", { symbol: asset.symbol })
                : t("admin.activate_confirm_desc", { symbol: asset.symbol })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onToggle(asset.symbol, !active)}>
              {active ? t("admin.action_deactivate") : t("admin.action_activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Delete with a destructive confirm dialog — same look as the old close-position
 *  dialog (destructive media + Trash2 + destructive action). */
function DeleteButton({
  symbol,
  onRemove,
}: {
  symbol: string;
  onRemove: (symbol: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="link"
          size="icon"
          aria-label={t("admin.delete_confirm_title", { symbol })}
          className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-destructive hover:bg-muted"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("admin.delete_confirm_title", { symbol })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.delete_confirm_desc", { symbol })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => onRemove(symbol)}
          >
            {t("admin.delete_btn")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** In-app management for the AUTO-JOURNAL universe (the symbols the cron
 *  journals). Add has Yahoo search suggestions (same as the screener's
 *  add-ticker dialog); the list is a terminal-style sortable/paginated table
 *  with asset-type + status filters. Changes hit the next cron run (≤30 min),
 *  NO rebuild/redeploy. */
export function JournalAssetsTable() {
  "use no memo";
  const { t } = useTranslation();
  const { assets, isLoading, toggleActive, removeAsset } = useJournalAssets();
  const { users } = useAdminUsers();

  const userEmailMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.user_id && u.email) {
        map.set(u.user_id, u.email);
      }
    });
    return map;
  }, [users]);

  // Load live asset metadata (specifically names) from Yahoo query cache / live data.
  // This populates names for seeded rows (which default to NULL in the migration script).
  const symbols = useMemo(() => assets.map((a) => a.symbol), [assets]);
  const { data: marketData } = useMarketData(symbols);

  const marketDataMap = useMemo(() => {
    const map = new Map<string, UnifiedAsset>();
    marketData?.forEach((asset) => {
      if (asset) {
        map.set(asset.symbol.toUpperCase(), asset);
      }
    });
    return map;
  }, [marketData]);

  // ── Add dialog (Yahoo search + suggestions live inside the dialog now) ──
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ── List filters ──
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilterType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Default sorting based on date added (created_at) descending.
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);

  const activeCount = useMemo(
    () => assets.filter((a) => a.active).length,
    [assets],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (assetFilter !== "all" && a.asset_type !== assetFilter) return false;
      if (statusFilter === "active" && !a.active) return false;
      if (statusFilter === "inactive" && a.active) return false;
      if (
          q &&
          !a.symbol.toLowerCase().includes(q) &&
          !(a.name?.toLowerCase().includes(q) ?? false)
      )
        return false;
      return true;
    });
  }, [assets, assetFilter, statusFilter, search]);

  // Asset-type tabs reuse the screener's taxonomy options (all + the 5 types).
  const assetOptions: FilterOption<AssetFilterType>[] = ASSET_TYPE_OPTIONS.map(
    (opt) => ({ value: opt.value, label: t(opt.labelKey) }),
  );
  const statusOptions: FilterOption<StatusFilter>[] = [
    { value: "all", label: t("admin.status_all") },
    { value: "active", label: t("admin.status_active") },
    { value: "inactive", label: t("admin.status_inactive") },
  ];

  const columns = useMemo<ColumnDef<JournalAssetRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <SortButton label={t("table.added")} column={column} />
        ),
        cell: ({ row }) => {
          const ts = Date.parse(row.original.created_at) / 1000;
          return (
            <div className="py-1">
              <div className="font-bold text-sm tracking-tight text-foreground">
                {formatDateNumeric(ts)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatClock(ts)}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "created_by",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.added_by")}
          </span>
        ),
        cell: ({ row }) => {
          const userId = row.original.created_by;
          const email = userId ? userEmailMap.get(userId) : null;
          return (
            <span className="text-xs text-muted-foreground">
              {email ?? "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "symbol",
        header: ({ column }) => <SortButton label={t("table.symbol")} column={column} />,
        cell: ({ row }) => {
          const liveAsset = marketDataMap.get(row.original.symbol.toUpperCase());
          const displayName = liveAsset?.name || row.original.name;
          return (
            <div className="py-1">
              <div className="font-bold text-sm tracking-tight text-foreground">
                {row.original.symbol}
              </div>
              {displayName && (
                <div className="text-xs truncate max-w-50 text-muted-foreground">
                  {displayName}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "asset_type",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.type")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.asset_type
              ? t(`common.asset_types.${row.original.asset_type}`)
              : "—"}
          </span>
        ),
      },
      {
        id: "live_price",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.price")}
          </span>
        ),
        cell: ({ row }) => {
          const liveAsset = marketDataMap.get(row.original.symbol.toUpperCase());
          if (!liveAsset || liveAsset.price === undefined) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="font-semibold text-sm text-foreground text-mono-data">
              {formatPrice(liveAsset.price, liveAsset.assetType)}
            </span>
          );
        },
      },
      {
        id: "live_change",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.change")}
          </span>
        ),
        cell: ({ row }) => {
          const liveAsset = marketDataMap.get(row.original.symbol.toUpperCase());
          if (!liveAsset || liveAsset.changePercent === undefined) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return <PercentageChange value={liveAsset.changePercent} />;
        },
      },
      {
        accessorKey: "active",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.status")}
          </span>
        ),
        cell: ({ row }) => (
          <StatusBadge active={row.original.active} />
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <ToggleStatusButton asset={row.original} onToggle={toggleActive} />
            <DeleteButton symbol={row.original.symbol} onRemove={removeAsset} />
          </div>
        ),
      },
    ],
    [t, toggleActive, removeAsset, marketDataMap, userEmailMap],
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
    <div className="space-y-4">
      {/* List — terminal-style table */}
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="space-y-3">
          {/* Row 1: Filters */}
          <div className="flex items-center gap-2 min-w-0">
            <FilterGroup
              value={assetFilter}
              options={assetOptions}
              onChange={setAssetFilter}
              className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
            />

            <Separator orientation="vertical" className="mx-1 h-8" />

            <FilterGroup
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
              variant="select"
              className="flex-1 sm:flex-none"
            />
            <div className="ml-auto text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>
                  {activeCount} {t("admin.status_active").toLowerCase()} / {assets.length} {t("market.assets_found")}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Search + actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder={t("market.search_placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9 text-sm placeholder:text-sm"
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

            <Separator orientation="vertical" className="mx-1 h-8" />

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsSettingsOpen(true)}
              className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("admin.settings_btn")}</span>
            </Button>

            <Button
              size="lg"
              onClick={() => setIsAddDialogOpen(true)}
              className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("admin.add_asset_btn")}</span>
            </Button>
          </div>
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
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <SkeletonJournalAssetRow />
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-40 text-center"
                  >
                    <EmptyState
                      title={t("admin.empty_title")}
                      description={
                        search ||
                        assetFilter !== "all" ||
                        statusFilter !== "all"
                          ? t("admin.empty_filter_desc")
                          : t("admin.empty_desc")
                      }
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
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
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
      </div>

      <AddJournalAssetDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      <JournalSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}
