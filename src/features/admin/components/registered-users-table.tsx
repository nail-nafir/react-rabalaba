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
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import { UserDialog } from "./user-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { SkeletonAdminUserRow } from "@/components/shared/skeleton-card";
import {
  FilterGroup,
  type FilterOption,
} from "@/components/shared/filter-group";
import { useAdminUsers } from "@/hooks/use-admin-users";
import type { AdminUserRow } from "@/services/supabase/database.types";
import { formatDateNumeric, formatClock } from "@/lib/formatters";
import { cn } from "@/lib/utils";


/* ── Tiny helpers (same style as journal-asset-manager) ──────────────── */

type TierFilter = "all" | "premium" | "trial" | "free";
type RoleFilter = "all" | "member" | "admin" | "owner";

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

/** Tier badge with colour coding: premium=emerald, trial=amber, free=muted. */
function TierBadge({ tier }: { tier: string }) {
  const { t } = useTranslation();
  const isPremium = tier === "premium" || tier === "trial";
  const cls =
    tier === "premium"
      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
      : tier === "trial"
        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
        : "bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground";

  const label = isPremium
    ? t("admin.users_tier_premium", "Premium")
    : t(`admin.users_tier_${tier}`, tier);

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold tracking-wider uppercase text-[10px] rounded-md",
        cls,
      )}
    >
      {label}
    </Badge>
  );
}




/** Format a timestamptz ISO string to DD-MM-YYYY + HH:MM; returns null if missing. */
function formatTs(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const ts = Date.parse(iso) / 1000;
  if (!Number.isFinite(ts)) return null;
  return { date: formatDateNumeric(ts), time: formatClock(ts) };
}

function DeleteUserButton({
  user,
  onDelete,
}: {
  user: AdminUserRow;
  onDelete: (userId: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete(user.user_id);
    setIsDeleting(false);
    if (success) {
      toast.success(
        t("admin.users_delete_success", {
          defaultValue: `Berhasil menghapus pengguna ${user.email}`,
        }),
      );
    } else {
      toast.error(
        t("admin.users_delete_error", {
          defaultValue: `Gagal menghapus pengguna ${user.email}`,
        }),
      );
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="link"
          size="icon"
          aria-label={t("admin.users_delete_confirm_title", {
            email: user.email,
          })}
          className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-destructive hover:bg-muted cursor-pointer"
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
            {t("admin.users_delete_confirm_title", {
              defaultValue: "Hapus Pengguna?",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.users_delete_confirm_desc", {
              email: user.email,
              defaultValue: `Apakah Anda yakin ingin menghapus pengguna ${user.email}? Semua data terkait pengguna ini akan terhapus permanen.`,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("admin.delete_btn", "Hapus")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── Main: Users table ───────────────────────────────────────────────── */

export function RegisteredUsersTable() {
  "use no memo";
  const { users, isLoadingUsers: isLoading, deleteUser } = useAdminUsers();
  const { t } = useTranslation();
  const { user } = useAuth();
  const currentUserEmail = user?.email?.toLowerCase();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AdminUserRow | null>(null);

  const roleOptions: FilterOption<RoleFilter>[] = [
    { value: "all", label: t("admin.users_role_all") },
    { value: "owner", label: t("admin.users_role_owner") },
    { value: "admin", label: t("admin.users_role_admin") },
    { value: "member", label: t("admin.users_role_member") },
  ];

  const tierOptions: FilterOption<TierFilter>[] = [
    { value: "all", label: t("admin.users_tier_all") },
    { value: "premium", label: t("admin.users_tier_premium_full") },
    { value: "trial", label: t("admin.users_tier_premium_trial") },
    { value: "free", label: t("admin.users_tier_free") },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (tierFilter !== "all" && u.tier !== tierFilter) return false;
      if (roleFilter !== "all") {
        const isOwner = u.is_owner;
        const isAdmin = u.is_admin;
        const role = isOwner ? "owner" : isAdmin ? "admin" : "member";
        if (role !== roleFilter) return false;
      }
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, tierFilter, roleFilter, search]);

  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <SortButton label={t("table.joined")} column={column} />
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
        accessorKey: "email",
        header: ({ column }) => (
          <SortButton label={t("table.email")} column={column} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 py-1">
            <span
              className={cn(
                "font-bold text-sm tracking-tight truncate max-w-56 block",
                row.original.is_blocked
                  ? "text-muted-foreground/60 line-through"
                  : "text-foreground",
              )}
            >
              {row.original.email}
            </span>
            {row.original.is_blocked && (
              <Badge
                variant="outline"
                className="rounded-md text-[9px] font-extrabold uppercase tracking-wider border-destructive/40 bg-destructive/10 text-destructive shrink-0"
              >
                Blocked
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "role",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.role")}
          </span>
        ),
        cell: ({ row }) => {
          const isOwner = row.original.is_owner;
          const isAdmin = row.original.is_admin;
          const role = isOwner ? "owner" : isAdmin ? "admin" : "member";
          const badgeClass =
            role === "owner"
              ? "bg-primary/15 border-primary/30 text-primary"
              : role === "admin"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground";
          return (
            <Badge
              variant="outline"
              className={`font-bold tracking-wider uppercase text-[10px] rounded-md ${badgeClass}`}
            >
              {t(`admin.users_role_${role}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "tier",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.tier")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="py-1">
            <TierBadge tier={row.original.tier} />
            {row.original.tier === "premium" && (
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium whitespace-nowrap">
                {t("admin.tier_lifetime")}
              </div>
            )}
            {row.original.tier === "trial" && row.original.trial_expires_at && (
              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium whitespace-nowrap">
                {t("admin.tier_expires")} {formatTs(row.original.trial_expires_at)?.date}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "last_active_at",
        header: ({ column }) => (
          <SortButton label={t("table.last_access")} column={column} />
        ),
        cell: ({ row }) => {
          const ts = formatTs(row.original.last_active_at);
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
        accessorKey: "disclaimer_agreed_at",
        enableSorting: false,
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("table.disclaimer", "Penafian Risiko")}
          </span>
        ),
        cell: ({ row }) => {
          const ts = formatTs(row.original.disclaimer_agreed_at);
          if (!ts)
            return (
              <Badge
                variant="outline"
                className="font-bold tracking-wider uppercase text-[10px] rounded-md bg-rose-500/15 border-rose-500/30 text-rose-400"
              >
                {t("admin.users_disclaimer_pending", "Belum")}
              </Badge>
            );
          return (
            <div className="py-1">
              <Badge
                variant="outline"
                className="font-bold tracking-wider uppercase text-[10px] rounded-md bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              >
                v{row.original.disclaimer_version ?? "?"}
              </Badge>
              <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                {ts.date}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const isSelf = row.original.email.toLowerCase() === currentUserEmail;
          if (isSelf) return null;

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="link"
                size="icon"
                onClick={() => {
                  setUserToEdit(row.original);
                  setIsEditDialogOpen(true);
                }}
                className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer"
                title={t("common.edit", "Edit")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <DeleteUserButton user={row.original} onDelete={deleteUser} />
            </div>
          );
        },
      },
    ],
    [t, deleteUser, currentUserEmail, setUserToEdit, setIsEditDialogOpen],
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
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="space-y-3">
          {/* Row 1: Filters */}
          <div className="flex items-center gap-2 min-w-0">
            <FilterGroup
              value={roleFilter}
              options={roleOptions}
              onChange={setRoleFilter}
              className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
            />

            <Separator orientation="vertical" className="mx-1 h-8" />

            <FilterGroup
              value={tierFilter}
              options={tierOptions}
              onChange={setTierFilter}
              variant="select"
              className="flex-1 sm:flex-none"
            />
          </div>

          {/* Row 2: Search + actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder={t("admin.users_search_placeholder")}
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
              size="lg"
              onClick={() => setIsAddDialogOpen(true)}
              className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("admin.users_add_btn", "Tambah Pengguna")}
              </span>
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
                    <SkeletonAdminUserRow />
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-40 text-center"
                  >
                    <EmptyState
                      title={t("admin.users_empty_title")}
                      description={
                        search || tierFilter !== "all"
                          ? t("admin.users_empty_filter_desc")
                          : t("admin.users_empty_desc")
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
        <DataTablePagination
          table={table}
          className="pt-3 border-t border-border/60"
        />
      </div>

      <UserDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
      <UserDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setUserToEdit(null);
        }}
        user={userToEdit}
      />
    </div>
  );
}
