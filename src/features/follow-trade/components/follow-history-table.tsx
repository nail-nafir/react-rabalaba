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
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useFollowStore } from "@/store/follow-store";
import {
  computePnl,
  type FollowStatus,
  type FollowedTrade,
} from "@/features/follow-trade/lib/follow-trade-model";
import { formatPrice, formatRatio, formatDateTime } from "@/lib/formatters";
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
import { SignalStrengthMeter } from "@/components/shared/signal-strength-meter";
import {
  FilterGroup,
  type FilterOption,
} from "@/components/shared/filter-group";
import { SIGNAL_COLORS, TIER_COLORS } from "@/constants/signals";
import { cn } from "@/lib/utils";

const BADGE_CLASS = "font-bold tracking-wider uppercase text-[10px] rounded-md";

type DirFilter = "all" | "long" | "short";
type StatusFilter = "all" | "tp1" | "tp2" | "tp3" | "sl" | "manual";

const STATUS_BADGE: Record<
  FollowStatus,
  { bg: string; text: string; border: string }
> = {
  open: SIGNAL_COLORS.neutral,
  tp1: SIGNAL_COLORS.long,
  tp2: SIGNAL_COLORS.long,
  tp3: SIGNAL_COLORS.long,
  sl: SIGNAL_COLORS.short,
  manual: SIGNAL_COLORS.neutral,
};

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
  const history = useFollowStore((s) => s.history);
  const removeHistory = useFollowStore((s) => s.removeHistory);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<DirFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(
      (tr) =>
        (dirFilter === "all" || tr.signal === dirFilter) &&
        (statusFilter === "all" || tr.status === statusFilter) &&
        (!q ||
          tr.symbol.toLowerCase().includes(q) ||
          tr.name.toLowerCase().includes(q)),
    );
  }, [history, search, dirFilter, statusFilter]);

  const dirOptions: FilterOption<DirFilter>[] = [
    { value: "all", label: t("common.signals.all") },
    { value: "long", label: t("common.signals.long") },
    { value: "short", label: t("common.signals.short") },
  ];
  const statusOptions: FilterOption<StatusFilter>[] = [
    { value: "all", label: t("journal.filter_all_status") },
    { value: "tp1", label: t("journal.status_tp1") },
    { value: "tp2", label: t("journal.status_tp2") },
    { value: "tp3", label: t("journal.status_tp3") },
    { value: "sl", label: t("journal.status_sl") },
    { value: "manual", label: t("journal.status_manual") },
  ];

  const columns = useMemo<ColumnDef<FollowedTrade>[]>(
    () => [
      {
        id: "date",
        accessorFn: (tr) => tr.closedAt ?? tr.followedAt,
        header: ({ column }) => (
          <SortButton label={t("journal.col_date")} column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDateTime(
              (row.original.closedAt ?? row.original.followedAt) / 1000,
            )}
          </span>
        ),
      },
      {
        accessorKey: "symbol",
        header: ({ column }) => (
          <SortButton label={t("table.symbol")} column={column} />
        ),
        cell: ({ row }) => (
          <div className="py-1">
            <div className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
              {row.original.symbol}
            </div>
            <div className="text-xs truncate max-w-44 text-muted-foreground">
              {row.original.name}
            </div>
          </div>
        ),
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
        accessorKey: "entryPrice",
        header: ({ column }) => (
          <SortButton label={t("journal.col_entry")} column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-mono-data">
            {formatPrice(row.original.entryPrice, row.original.assetType)}
          </span>
        ),
      },
      {
        id: "close",
        accessorFn: (tr) => tr.closePrice ?? 0,
        header: ({ column }) => (
          <SortButton label={t("journal.col_close")} column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-mono-data">
            {row.original.closePrice != null
              ? formatPrice(row.original.closePrice, row.original.assetType)
              : "—"}
          </span>
        ),
      },
      {
        id: "pnl",
        accessorFn: (tr) => computePnl(tr, tr.closePrice ?? tr.entryPrice).r,
        header: ({ column }) => (
          <SortButton label={t("journal.col_pnl")} column={column} />
        ),
        cell: ({ row }) => {
          const tr = row.original;
          const { pct, r } = computePnl(tr, tr.closePrice ?? tr.entryPrice);
          return (
            <span
              className={`font-medium text-mono-data ${
                r >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}% · {r >= 0 ? "+" : ""}
              {formatRatio(r)}R
            </span>
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
          <SignalStrengthMeter value={row.original.strengthAtEntry} size="sm" />
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
              {t(`journal.${row.original.signal}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("journal.col_status")}
          </span>
        ),
        cell: ({ row }) => {
          const c = STATUS_BADGE[row.original.status];
          return (
            <Badge
              variant="outline"
              className={cn(BADGE_CLASS, c.bg, c.text, c.border)}
            >
              {t(`journal.status_${row.original.status}`)}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="link"
            size="icon"
            className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-rose-400 hover:bg-muted"
            onClick={() => removeHistory(row.original.id)}
            aria-label={`Delete ${row.original.symbol}`}
          >
            <Trash2 />
          </Button>
        ),
      },
    ],
    [t, removeHistory],
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
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
        {t("journal.history")}
      </h2>

      {/* Filters + total count */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FilterGroup
            value={dirFilter}
            options={dirOptions}
            onChange={setDirFilter}
            className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
          />
          <Separator orientation="vertical" className="mx-1" />
          <FilterGroup
            value={statusFilter}
            options={statusOptions}
            onChange={setStatusFilter}
            className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
          />
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
          {filtered.length} {t("journal.trades")}
        </div>
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
            {table.getRowModel().rows.length === 0 ? (
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
            {table.getState().pagination.pageIndex + 1}
          </span>{" "}
          {t("table.of")}{" "}
          <span className="font-medium text-foreground">
            {table.getPageCount()}
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
  );
}
