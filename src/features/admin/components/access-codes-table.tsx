import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Eye,
  EyeOff,
} from "lucide-react";
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
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { SkeletonAccessCodeRow } from "@/components/shared/skeleton-card";
import { useAdminUsers } from "@/hooks/use-admin-users";
import type { AccessCodeRow } from "@/services/supabase/database.types";
import { formatDateNumeric, formatClock } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/* ── Tiny helpers ────────────────────────────────────────────────────── */

function CodeKindBadge({ kind }: { kind: string }) {
  const isFull = kind === "full";
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
        isFull
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>(
    {},
  );
  const [codeToReveal, setCodeToReveal] = useState<string | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const columns = useMemo<ColumnDef<AccessCodeRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.codes_col_created")}
          </span>
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
              className="font-mono text-xs font-bold uppercase rounded-md bg-muted/50 border-border text-muted-foreground tracking-wider px-1.5 py-0.5"
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
          <span className="text-xs font-semibold text-foreground font-mono">
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
          <span className="text-xs font-semibold text-foreground font-mono">
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
          <span className="text-xs text-muted-foreground font-mono">
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
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
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
      <DataTablePagination
        table={table}
        hideWhenSinglePage
        className="pt-3 border-t border-border/60"
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
