/**
 * Admin list for subscription_plans — add / edit / toggle-active / delete. Drives
 * the public /subscription page. Terminal-style data table (columnDef +
 * useReactTable + skeleton loading) — same visual language as the
 * registered-users / journal-assets / access-codes tables.
 */
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
  Plus,
  Pencil,
  Trash2,
  Power,
  Play,
  Pause,
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { SkeletonSubscriptionPlanRow } from "@/components/shared/skeleton-card";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import { pickLocale } from "@/lib/localized";
import type { SubscriptionPlanRow } from "@/services/supabase/database.types";
import { cn } from "@/lib/utils";
import { PlanDialog } from "./plan-dialog";
import { TIER_COLORS } from "@/constants/taxonomy/colors";
import { badgeClass } from "@/constants/taxonomy/palette";

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
                ? `Apakah Anda yakin ingin menonaktifkan paket ${name}?`
                : `Apakah Anda yakin ingin mengaktifkan paket ${name}?`}
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

export function SubscriptionPlansTable() {
  "use no memo";
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { plans, isLoading, toggleActive, removePlan } = useSubscriptionPlans();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlanRow | null>(null);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (plan: SubscriptionPlanRow) => {
    setEditing(plan);
    setDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<SubscriptionPlanRow>[]>(
    () => [
      {
        accessorKey: "name",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_plan", "Paket")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="py-1">
            <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-foreground">
              {pickLocale(row.original.name, lang, row.original.slug) as string}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "slug",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_tier", "Tingkatan")}
          </span>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="font-bold tracking-wider uppercase text-[10px] rounded-md bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground"
          >
            {row.original.slug}
          </Badge>
        ),
      },
      {
        accessorKey: "price",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_price", "Harga")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-sm text-foreground text-mono-data">
            {pickLocale(row.original.price, lang, "—") as string}
          </span>
        ),
      },
      {
        accessorKey: "highlighted",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_highlight", "Highlight")}
          </span>
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
              row.original.highlighted
                ? badgeClass(TIER_COLORS.A)
                : badgeClass(TIER_COLORS.C)
            )}
          >
            {row.original.highlighted ? t("admin.billing.col_highlight", "Terlaris") : t("common.no", "Tidak")}
          </Badge>
        ),
      },
      {
        accessorKey: "active",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.col_active", "Aktif")}
          </span>
        ),
        cell: ({ row }) => <StatusBadge active={row.original.active} />,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const plan = row.original;
          const planName = pickLocale(plan.name, lang, plan.slug) as string;
          return (
            <div className="flex items-center justify-end gap-1">
              <ToggleStatusButton
                active={plan.active}
                onToggle={() => toggleActive(plan.slug, !plan.active)}
                name={planName}
              />
              <Button
                variant="link"
                size="icon"
                onClick={() => openEdit(plan)}
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-muted"
                title={t("common.edit", "Ubah")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
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
                      {t("admin.billing.plan_delete_title", {
                        name: planName,
                        defaultValue: `Hapus paket ${planName}?`,
                      })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("admin.billing.plan_delete_desc", {
                        name: planName,
                        defaultValue: `Apakah Anda yakin ingin menghapus paket ${planName}? Paket akan hilang dari halaman langganan.`,
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel", "Batal")}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => removePlan(plan.slug)}
                    >
                      {t("admin.delete_btn", "Hapus")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ],
    [t, lang, toggleActive, removePlan],
  );

  const table = useReactTable({
    data: plans,
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
            {t("admin.billing.plans_title", "Daftar Paket Langganan")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("admin.billing.plans_desc", "Kelola dan atur konfigurasi paket langganan aktif beserta harga dan fiturnya.")}
          </p>
        </div>
        <Button
          size="lg"
          onClick={openAdd}
          className="font-bold text-xs cursor-pointer items-center gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("admin.billing.add_plan_btn", "Tambah Paket")}</span>
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
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <SkeletonSubscriptionPlanRow />
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <EmptyState
                    title={t("admin.billing.plans_empty_title", "Belum ada paket")}
                    description={t("admin.billing.plans_empty_desc", "Tambahkan paket langganan pertama.")}
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

      <PlanDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={editing} />
    </div>
  );
}
