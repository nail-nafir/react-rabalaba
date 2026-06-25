/**
 * Admin list for invitations — mint, copy the shareable /invite/:code link,
 * and revoke/un-revoke. Reads via the admin RPCs in
 * 20260625000003_invitations.sql. Terminal-style data table (columnDef +
 * useReactTable + skeleton loading) — same visual language as the access-codes table.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Copy,
  Power,
  Play,
  Pause,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonInvitationRow } from "@/components/shared/skeleton-card";
import { useAdminInvitations } from "@/hooks/use-admin-invitations";
import type { InvitationRow } from "@/services/supabase/database.types";
import { formatDateNumeric, formatClock } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function formatTs(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const ts = Date.parse(iso) / 1000;
  if (!Number.isFinite(ts)) return null;
  return { date: formatDateNumeric(ts), time: formatClock(ts) };
}

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

function ToggleStatusButton({
  active,
  onToggle,
  name,
}: {
  active: boolean;
  onToggle: () => void;
  name: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="link"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={active ? `Nonaktifkan ${name}` : `Aktifkan ${name}`}
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
                ? `Nonaktifkan ${name}?`
                : `Aktifkan ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {active
                ? `Apakah Anda yakin ingin menonaktifkan undangan ${name}?`
                : `Apakah Anda yakin ingin mengaktifkan undangan ${name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onToggle(); setOpen(false); }}>
              {active ? t("admin.action_deactivate") : t("admin.action_activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DeleteInvitationButton({
  code,
  onDelete,
}: {
  code: string;
  onDelete: (code: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    const ok = await onDelete(code);
    setOpen(false);
    if (ok) {
      toast.success(t("admin.invitations.delete_success", "Undangan dihapus"));
    } else {
      toast.error(t("admin.invitations.delete_error", "Gagal menghapus undangan"));
    }
  };

  return (
    <>
      <Button
        variant="link"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`Hapus undangan ${code}`}
        className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-destructive hover:bg-muted"
        title={t("admin.delete_btn", "Hapus")}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t("admin.invitations.delete_title", "Hapus undangan ini?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.invitations.delete_desc",
                "Link undangan langsung tidak bisa dipakai lagi.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t("admin.delete_btn", "Hapus")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function inviteUrl(origin: string, code: string) {
  return `${origin}/invite/${code}`;
}

export function InvitationsTable() {
  "use no memo";
  const { t } = useTranslation();
  const { invitations, isLoading, revokeInvitation, deleteInvitation } =
    useAdminInvitations();
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );

  const copy = (code: string) => {
    navigator.clipboard.writeText(inviteUrl(origin, code));
    toast.success(t("admin.invitations.link_copied", "Link undangan disalin"));
  };

  const columns = useMemo<ColumnDef<InvitationRow>[]>(
    () => [
      {
        accessorKey: "code",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.invitations.col_invite", "Undangan")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="py-1">
            <div className="font-bold text-sm tracking-tight text-foreground font-mono">
              {row.original.code}
            </div>
            {row.original.recipient_label && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {row.original.recipient_label}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "kind",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.invitations.col_type", "Tipe")}
          </span>
        ),
        cell: ({ row }) => {
          const inv = row.original;
          const isTrial = inv.kind === "trial";
          return (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider w-fit rounded-md",
                isTrial
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {isTrial
                ? `${inv.kind}${inv.trial_days ? ` ${inv.trial_days}` : ""}`
                : inv.kind}
            </Badge>
          );
        },
      },
      {
        accessorKey: "redemption_count",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.invitations.col_uses", "Pemakaian")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-foreground font-mono">
            {`${row.original.redemption_count}/${row.original.max_redemptions ?? "∞"}`}
          </span>
        ),
      },
      {
        accessorKey: "expires_at",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.invitations.col_expires", "Kadaluarsa")}
          </span>
        ),
        cell: ({ row }) => {
          const ts = formatTs(row.original.expires_at);
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
        id: "status",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.status", "Status")}
          </span>
        ),
        cell: ({ row }) => <StatusBadge active={!row.original.revoked} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <ToggleStatusButton
                active={!inv.revoked}
                onToggle={() => revokeInvitation(inv.code, !inv.revoked)}
                name={inv.code}
              />
              <Button
                variant="link"
                size="icon"
                onClick={() => copy(inv.code)}
                className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer"
                title={t("admin.invitations.copy_link", "Salin link")}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <DeleteInvitationButton
                code={inv.code}
                onDelete={deleteInvitation}
              />
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, revokeInvitation, deleteInvitation, origin],
  );

  const table = useReactTable({
    data: invitations,
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
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <SkeletonInvitationRow />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <EmptyState
                    title={t("admin.invitations.empty_title", "Belum ada undangan")}
                    description={t("admin.invitations.empty_desc", "Buat link undangan premium/trial pertama.")}
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
    </div>
  );
}
