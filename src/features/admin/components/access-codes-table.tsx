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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import { AddAccessCodeDialog } from "./add-access-code-dialog";
import { DeleteAccessCodeDialog } from "./delete-access-code-dialog";
import { ValidatePasswordDialog } from "./validate-password-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonAccessCodeRow } from "@/components/shared/skeleton-card";
import { useAdminUsers } from "@/hooks/use-admin-users";
import type { AccessCodeRow } from "@/services/supabase/database.types";
import { formatDateNumeric, formatClock } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/* ── Tiny helpers ────────────────────────────────────────────────────── */

function SortIcon<T>({ column }: { column: Column<T, unknown> }) {
  const isSorted = column.getIsSorted();
  if (isSorted === "asc")
    return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
  if (isSorted === "desc")
    return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
}

function SortButton<T>({
  label,
  column,
}: {
  label: string;
  column: Column<T, unknown>;
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

function CodeKindBadge({ kind }: { kind: string }) {
  const cls =
    kind === "full"
      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
      : "bg-amber-500/15 border-amber-500/30 text-amber-400";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold tracking-wider uppercase text-[10px] rounded-md",
        cls,
      )}
    >
      {kind}
    </Badge>
  );
}

/** Mask an access code, showing only the last 4 characters. */
function maskCode(code: string): string {
  if (code.length <= 4) return code;
  return "●".repeat(code.length - 4) + code.slice(-4);
}

/** Format a timestamptz ISO string to DD-MM-YYYY + HH:MM; returns null if missing. */
function formatTs(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const ts = Date.parse(iso) / 1000;
  if (!Number.isFinite(ts)) return null;
  return { date: formatDateNumeric(ts), time: formatClock(ts) };
}
/* ── Access codes table ──────────────────────────────────────────────── */

export function AccessCodesTable() {
  "use no memo";
  const { accessCodes, isLoadingCodes, deleteAccessCode } = useAdminUsers();
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>(
    {},
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [codeToReveal, setCodeToReveal] = useState<string | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const columns = useMemo<ColumnDef<AccessCodeRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <SortButton label={t("admin.codes_col_created")} column={column} />
        ),
        cell: ({ row }) => {
          const ts = formatTs(row.original.created_at);
          if (!ts)
            return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="py-1">
              <div className="font-bold text-sm tracking-tight text-foreground">
                {ts.date}
              </div>
              <div className="text-xs text-muted-foreground">{ts.time}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "code",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_code")}
          </span>
        ),
        cell: ({ row }) => {
          const isRevealed = !!revealedCodes[row.original.code];
          return (
            <Badge
              variant="outline"
              className="font-mono text-xs font-bold uppercase rounded-md bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground tracking-wider px-1.5 py-0.5"
            >
              {isRevealed ? row.original.code : maskCode(row.original.code)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "kind",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_type")}
          </span>
        ),
        cell: ({ row }) => <CodeKindBadge kind={row.original.kind} />,
      },
      {
        accessorKey: "note",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_note")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-40 block">
            {row.original.note || "—"}
          </span>
        ),
      },
      {
        accessorKey: "max_redemptions",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_max_uses")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-foreground">
            {row.original.max_redemptions ?? "∞"}
          </span>
        ),
      },
      {
        accessorKey: "redemption_count",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_used")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-foreground">
            {row.original.redemption_count}
          </span>
        ),
      },
      {
        accessorKey: "trial_days",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_trial_days")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.trial_days ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const isRevealed = !!revealedCodes[row.original.code];
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="link"
                size="icon"
                onClick={() => {
                  if (isRevealed) {
                    setRevealedCodes((prev) => ({
                      ...prev,
                      [row.original.code]: false,
                    }));
                  } else {
                    setCodeToReveal(row.original.code);
                    setIsPasswordDialogOpen(true);
                  }
                }}
                className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer"
                title={isRevealed ? "Sembunyikan" : "Tampilkan"}
              >
                {isRevealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <DeleteAccessCodeDialog
                code={row.original}
                onDelete={deleteAccessCode}
              />
            </div>
          );
        },
      },
    ],
    [
      t,
      deleteAccessCode,
      revealedCodes,
      setCodeToReveal,
      setIsPasswordDialogOpen,
    ],
  );

  const table = useReactTable({
    data: accessCodes,
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
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("admin.codes_list_title")}
          </h2>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
            {isLoadingCodes ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span>
                {accessCodes.length} {t("admin.codes_col_code").toLowerCase()}
              </span>
            )}
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
          className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0 h-8"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t("admin.codes_add_btn", "Tambah Kode")}</span>
        </Button>
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
            {isLoadingCodes ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <SkeletonAccessCodeRow />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <EmptyState
                    title={t("admin.codes_empty_title")}
                    description={t("admin.codes_empty_desc")}
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
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
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
      )}

      <AddAccessCodeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      <ValidatePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
        onSuccess={() => {
          if (codeToReveal) {
            setRevealedCodes((prev) => ({
              ...prev,
              [codeToReveal]: true,
            }));
            setCodeToReveal(null);
          }
        }}
      />
    </div>
  );
}
