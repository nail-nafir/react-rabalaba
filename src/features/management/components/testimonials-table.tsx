import { useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import {
  AlertCircle,
  Check,
  Loader2,
  MessageSquareQuote,
  Pin,
  PinOff,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminTestimonials } from "@/features/management/hooks/use-admin-testimonials";
import { formatDateNumeric, formatClock } from "@/lib/formatters";
import type {
  FeaturedTestimonialRow,
  TestimonialStatus,
  TestimonialSubmissionRow,
} from "@/services/supabase/database.types";
import { RejectTestimonialDialog } from "./reject-testimonial-dialog";
import { FeatureTestimonialDialog } from "./feature-testimonial-dialog";



type WorkingAction =
  | "approve"
  | "reject"
  | "feature"
  | "unfeature"
  | "delete"
  | null;

function StatusBadge({ status }: { status: TestimonialStatus }) {
  const { t } = useTranslation();

  const config = {
    approved: {
      label: t("admin.testimonials.status_approved", "Disetujui"),
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    pending: {
      label: t("admin.testimonials.status_pending", "Menunggu"),
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    rejected: {
      label: t("admin.testimonials.status_rejected", "Ditolak"),
      cls: "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-400",
    },
  }[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
        config.cls,
      )}
    >
      {config.label}
    </Badge>
  );
}

function TierBadge({ verified }: { verified: boolean }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
        verified
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      {verified
        ? t("admin.users_tier_premium", "Premium")
        : t("admin.users_tier_free", "Gratis")}
    </Badge>
  );
}

function Rating({ value }: { value: number }) {
  const { t } = useTranslation();

  return (
    <span
      className="inline-flex items-center gap-1 font-medium"
      aria-label={t("admin.testimonials.rating_accessible", {
        value,
        defaultValue: "{{value}} dari 5 bintang",
      })}
    >
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span>{value}/5</span>
    </span>
  );
}



function DeleteTestimonialDialog({
  open,
  onOpenChange,
  submission,
  working,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: TestimonialSubmissionRow;
  working: WorkingAction;
  onConfirm: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);
  const isWorking = working !== null || isPending;

  const handleAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isWorking) return;

    setIsPending(true);
    try {
      if (await onConfirm()) onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isWorking) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t("admin.testimonials.delete_title", "Hapus ulasan permanen?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.testimonials.delete_desc", {
              name: submission.display_name,
              defaultValue:
                "Ulasan milik {{name}} akan dihapus permanen, termasuk dari landing. Tindakan ini tidak dapat dibatalkan.",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isWorking}>
            {t("common.cancel", "Batal")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isWorking}
            aria-busy={isWorking}
            onClick={handleAction}
          >
            <ActionButtonContent
              label={t("common.actions.delete")}
              pending={isWorking}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type TestimonialActionsProps = {
  submission: TestimonialSubmissionRow;
  featured: FeaturedTestimonialRow[];
  onApprove: (submissionId: string) => Promise<unknown>;
  onDelete: (submissionId: string) => Promise<unknown>;
};

function TestimonialActions({
  submission,
  featured,
  onApprove,
  onDelete,
}: TestimonialActionsProps) {
  const { t } = useTranslation();
  const { feature, maxSlots } = useAdminTestimonials();
  const [working, setWorking] = useState<WorkingAction>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const currentFeatured = featured.find(
    (item) => item.submission_id === submission.id,
  );

  const showError = () => {
    toast.error(t("toasts.testimonial_admin.action_error"));
  };

  const handleApprove = async () => {
    setWorking("approve");
    try {
      await onApprove(submission.id);
      const availableSlots = Array.from({ length: maxSlots }, (_, i) => i + 1);
      const firstAvailable = availableSlots.find(
        (slot) => !featured.some((item) => item.slot === slot),
      );
      if (!currentFeatured && firstAvailable) {
        await feature(submission.id, firstAvailable);
        toast.success(
          t("toasts.testimonial_admin.approve_feature_success", {
            slot: firstAvailable,
            defaultValue: "Mantep, ulasan lolos ke Slot {{slot}}",
          }),
        );
      } else {
        toast.success(t("toasts.testimonial_admin.approve_success"));
      }
    } catch {
      showError();
    } finally {
      setWorking(null);
    }
  };

  const handleDelete = async (): Promise<boolean> => {
    setWorking("delete");
    try {
      await onDelete(submission.id);
      toast.success(t("toasts.testimonial_admin.delete_success"));
      return true;
    } catch {
      showError();
      return false;
    } finally {
      setWorking(null);
    }
  };

  const isWorking = working !== null;

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {submission.status !== "approved" && (
          <Button
            variant="link"
            size="icon"
            disabled={isWorking}
            onClick={() => void handleApprove()}
            className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-emerald-500 hover:bg-muted cursor-pointer"
            title={t("admin.testimonials.action_approve", "Setujui")}
          >
            {working === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        )}
        {submission.status !== "rejected" && (
          <RejectTestimonialDialog
            submission={submission}
            trigger={
              <Button
                variant="link"
                size="icon"
                disabled={isWorking}
                className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-destructive hover:bg-muted cursor-pointer"
                title={t("admin.testimonials.action_reject", "Tolak")}
              >
                <X className="h-4 w-4" />
              </Button>
            }
          />
        )}
        {submission.status === "approved" && (
          <FeatureTestimonialDialog
            submission={submission}
            trigger={
              <Button
                variant="link"
                size="icon"
                disabled={isWorking}
                className={cn(
                  "h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:bg-muted cursor-pointer",
                  currentFeatured ? "hover:text-amber-500" : "hover:text-primary",
                )}
                title={
                  currentFeatured
                    ? t("admin.testimonials.action_move", "Kelola slot landing")
                    : t("admin.testimonials.action_feature", "Pilih slot landing")
                }
              >
                {currentFeatured ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
            }
          />
        )}
        <Button
          variant="link"
          size="icon"
          disabled={isWorking}
          onClick={() => setDeleteOpen(true)}
          className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-destructive hover:bg-muted cursor-pointer"
          title={t("admin.testimonials.action_delete", "Hapus permanen")}
        >
          {working === "delete" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      <DeleteTestimonialDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        submission={submission}
        working={working}
        onConfirm={handleDelete}
      />
    </>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-9 w-36" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-12 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="ml-auto size-8" />
      </TableCell>
    </TableRow>
  ));
}

export function TestimonialsTable() {
  "use no memo";
  const { t } = useTranslation();
  const {
    submissions,
    featured,
    isLoading,
    isError,
    refetch,
    approve,
    deleteSubmission,
  } = useAdminTestimonials();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo<ColumnDef<TestimonialSubmissionRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_date", "Ditambahkan")}
          </span>
        ),
        cell: ({ row }) => {
          const ts = Date.parse(row.original.created_at) / 1000;
          return (
            <div className="py-0.5">
              <div className="font-semibold text-xs tracking-tight text-foreground">
                {formatDateNumeric(ts)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatClock(ts)}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "display_name",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_user", "Pengguna")}
          </span>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground whitespace-nowrap">
            {row.original.display_name}
          </span>
        ),
      },
      {
        accessorKey: "verified_purchase",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_tier", "Kasta")}
          </span>
        ),
        cell: ({ row }) => (
          <TierBadge verified={row.original.verified_purchase} />
        ),
      },
      {
        accessorKey: "body",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_testimonial", "Ulasan")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-col gap-2 whitespace-normal">
            <p className="line-clamp-3 leading-relaxed text-foreground">
              {row.original.body}
            </p>
            {row.original.rejection_reason && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {t("admin.testimonials.private_note", "Privat")}
                </Badge>
                <span className="line-clamp-2">
                  {row.original.rejection_reason}
                </span>
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "rating",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_rating", "Penilaian")}
          </span>
        ),
        cell: ({ row }) => <Rating value={row.original.rating} />,
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_status", "Status")}
          </span>
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "slot",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("admin.testimonials.col_slot", "Slot")}
          </span>
        ),
        cell: ({ row }) => {
          const item = featured.find(
            (candidate) => candidate.submission_id === row.original.id,
          );
          return item ? (
            <Badge
              variant="outline"
              className="w-fit rounded-md text-[10px] font-bold uppercase tracking-wider border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              {t("admin.testimonials.slot_value", {
                slot: item.slot,
                defaultValue: "Slot {{slot}}",
              })}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <span className="sr-only">
            {t("admin.testimonials.col_actions", "Tindakan")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TestimonialActions
              submission={row.original}
              featured={featured}
              onApprove={approve}
              onDelete={deleteSubmission}
            />
          </div>
        ),
      },
    ],
    [approve, deleteSubmission, featured, t],
  );

  const table = useReactTable({
    data: submissions,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="rounded-md border overflow-hidden shadow-sm">
        {isError ? (
          <EmptyState
            icon={<AlertCircle className="size-12 text-destructive" />}
            title={t("admin.testimonials.error_title", "Ulasan gagal dimuat")}
            description={t(
              "admin.testimonials.error_desc",
              "Periksa koneksi atau izin admin, lalu coba lagi.",
            )}
            action={
              <Button variant="outline" onClick={() => void refetch()}>
                <RefreshCw data-icon="inline-start" />
                {t("common.retry", "Coba lagi")}
              </Button>
            }
          />
        ) : (
          <Table>
            <TableCaption className="sr-only">
              {t(
                "admin.testimonials.table_caption",
                "Daftar ulasan pengguna untuk dimoderasi.",
              )}
            </TableCaption>
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
                <SkeletonRows />
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <EmptyState
                      icon={
                        <MessageSquareQuote className="size-12 text-muted-foreground" />
                      }
                      title={t(
                        "admin.testimonials.empty_title",
                        "Belum ada ulasan",
                      )}
                      description={t(
                        "admin.testimonials.empty_desc",
                        "Ulasan pengguna akan muncul di antrean ini.",
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
        )}
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
