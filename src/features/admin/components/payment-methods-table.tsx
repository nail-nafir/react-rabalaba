/**
 * Admin list for payment_methods — add / edit / toggle-active / delete. Drives
 * the PaymentDialog account list on /subscription. Terminal-style data table
 * (columnDef + useReactTable + skeleton loading) — same visual language as the
 * registered-users / journal-assets / access-codes tables.
 */
import { useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Power, Play, Pause } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { SkeletonPaymentMethodRow } from "@/components/shared/skeleton-card";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import type { PaymentMethodRow } from "@/services/supabase/database.types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PaymentMethodDialog } from "./payment-method-dialog";
import { ActionButtonContent } from "@/components/shared/action-button-content";

function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted/30 text-muted-foreground",
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
  onToggle: () => Promise<boolean>;
  name: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const confirmToggle = async () => {
    const success = await onToggle();
    if (success) toast.success(t("toasts.payment_method.status_success"));
    else toast.error(t("toasts.payment_method.status_error"));
    return success;
  };
  const handleAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isPending) return;
    setIsPending(true);
    try {
      if (await confirmToggle()) setOpen(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="link"
          size="icon"
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
      </AlertDialogTrigger>
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
            {active ? `Nonaktifkan ${name}?` : `Aktifkan ${name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? `Apakah Anda yakin ingin menonaktifkan metode pembayaran ${name}?`
              : `Apakah Anda yakin ingin mengaktifkan metode pembayaran ${name}?`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            aria-busy={isPending}
            onClick={handleAction}
          >
            <ActionButtonContent
              label={t(
                active
                  ? "common.actions.deactivate"
                  : "common.actions.activate",
              )}
              pending={isPending}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeletePaymentMethodButton({
  method,
  onDelete,
}: {
  method: PaymentMethodRow;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const confirmDelete = async () => {
    const success = await onDelete(method.id);
    if (success) toast.success(t("toasts.payment_method.delete_success"));
    else toast.error(t("toasts.payment_method.delete_error"));
    return success;
  };
  const handleAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isPending) return;
    setIsPending(true);
    try {
      if (await confirmDelete()) setOpen(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="link"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-muted"
          title={t("admin.delete_btn", "Hapus")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t("admin.billing.method_delete_title", "Hapus metode ini?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "admin.billing.method_delete_desc",
              "Metode akan hilang dari dialog pembayaran.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("common.cancel", "Batal")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            aria-busy={isPending}
            onClick={handleAction}
          >
            <ActionButtonContent
              label={t("common.actions.delete")}
              pending={isPending}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PaymentMethodsTable() {
  "use no memo";
  const { t } = useTranslation();
  const { methods, isLoading, toggleActive, removeMethod } =
    usePaymentMethods();
  const columns = useMemo<ColumnDef<PaymentMethodRow>[]>(
    () => [
      {
        accessorKey: "name",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_method", "Metode")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm tracking-tight text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "category",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_category", "Tipe")}
          </span>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="font-bold tracking-wider uppercase text-[10px] rounded-md bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground"
          >
            {t(
              `admin.billing.cat_${row.original.category}`,
              row.original.category,
            )}
          </Badge>
        ),
      },
      {
        accessorKey: "account_no",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_account", "Nomor / Alamat")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-sm text-foreground">
            {row.original.account_no}
          </span>
        ),
      },
      {
        accessorKey: "active",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_active", "Status")}
          </span>
        ),
        cell: ({ row }) => <StatusBadge active={row.original.active} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <ToggleStatusButton
                active={m.active}
                onToggle={() => toggleActive(m.id, !m.active)}
                name={m.name}
              />
              <PaymentMethodDialog
                method={m}
                trigger={
                  <Button
                    variant="link"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-muted"
                    title={t("common.edit", "Ubah")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <DeletePaymentMethodButton method={m} onDelete={removeMethod} />
            </div>
          );
        },
      },
    ],
    [t, toggleActive, removeMethod],
  );

  const table = useReactTable({
    data: methods,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            {t("admin.billing.methods_title", "Metode Pembayaran")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              "admin.billing.methods_desc",
              "Rekening, e-wallet, dan alamat kripto di dialog pembayaran.",
            )}
          </p>
        </div>
        <PaymentMethodDialog
          trigger={
            <Button
              size="lg"
              className="font-bold text-xs cursor-pointer items-center gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("admin.billing.add_method_btn", "Tambah Metode")}
              </span>
            </Button>
          }
        />
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
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <SkeletonPaymentMethodRow />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <EmptyState
                    title={t(
                      "admin.billing.methods_empty_title",
                      "Belum ada metode",
                    )}
                    description={t(
                      "admin.billing.methods_empty_desc",
                      "Tambahkan metode pembayaran pertama.",
                    )}
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
    </div>
  );
}
