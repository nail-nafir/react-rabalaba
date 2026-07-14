import { useId, useMemo, useState } from "react";
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
  MoreHorizontal,
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { useAdminTestimonials } from "@/hooks/use-admin-testimonials";
import type {
  FeaturedTestimonialRow,
  TestimonialStatus,
  TestimonialSubmissionRow,
} from "@/services/supabase/database.types";

type StatusFilter = "all" | TestimonialStatus;
type WorkingAction =
  | "approve"
  | "reject"
  | "feature"
  | "unfeature"
  | "delete"
  | null;

const FEATURE_SLOTS = [1, 2, 3, 4, 5, 6] as const;

function StatusBadge({ status }: { status: TestimonialStatus }) {
  const { t } = useTranslation();

  const labels: Record<TestimonialStatus, string> = {
    pending: t("admin.testimonials.status_pending", "Menunggu"),
    approved: t("admin.testimonials.status_approved", "Disetujui"),
    rejected: t("admin.testimonials.status_rejected", "Ditolak"),
  };

  const variant =
    status === "approved"
      ? "default"
      : status === "rejected"
        ? "destructive"
        : "secondary";

  return <Badge variant={variant}>{labels[status]}</Badge>;
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
      <Star className="size-4 fill-current text-primary" aria-hidden="true" />
      <span>{value}/5</span>
    </span>
  );
}

function formatSubmissionDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type TestimonialActionsProps = {
  submission: TestimonialSubmissionRow;
  featured: FeaturedTestimonialRow[];
  onApprove: (submissionId: string) => Promise<unknown>;
  onReject: (submissionId: string, reason?: string) => Promise<unknown>;
  onFeature: (submissionId: string, slot: number) => Promise<unknown>;
  onUnfeature: (submissionId: string) => Promise<unknown>;
  onDelete: (submissionId: string) => Promise<unknown>;
};

function TestimonialActions({
  submission,
  featured,
  onApprove,
  onReject,
  onFeature,
  onUnfeature,
  onDelete,
}: TestimonialActionsProps) {
  const { t } = useTranslation();
  const rejectionReasonId = useId();
  const featureSlotId = useId();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("1");
  const [working, setWorking] = useState<WorkingAction>(null);

  const currentFeatured = featured.find(
    (item) => item.submission_id === submission.id,
  );
  const selectedSlotNumber = Number(selectedSlot);
  const occupiedSlot = featured.find(
    (item) => item.slot === selectedSlotNumber,
  );
  const replacementRequired = Boolean(
    occupiedSlot && occupiedSlot.submission_id !== submission.id,
  );

  const showError = () => {
    toast.error(
      t(
        "admin.testimonials.action_error",
        "Tindakan gagal. Silakan coba lagi.",
      ),
    );
  };

  const handleApprove = async () => {
    setWorking("approve");
    try {
      await onApprove(submission.id);
      toast.success(
        t("admin.testimonials.approve_success", "Ulasan disetujui."),
      );
    } catch {
      showError();
    } finally {
      setWorking(null);
    }
  };

  const handleReject = async () => {
    setWorking("reject");
    try {
      await onReject(submission.id, rejectionReason);
      toast.success(
        t("admin.testimonials.reject_success", "Ulasan ditolak."),
      );
      setRejectOpen(false);
      setRejectionReason("");
    } catch {
      showError();
    } finally {
      setWorking(null);
    }
  };

  const handleFeature = async () => {
    setWorking("feature");
    try {
      await onFeature(submission.id, selectedSlotNumber);
      toast.success(
        t(
          "admin.testimonials.feature_success",
          "Slot ulasan berhasil diperbarui.",
        ),
      );
      setReplacementOpen(false);
      setFeatureOpen(false);
    } catch {
      showError();
    } finally {
      setWorking(null);
    }
  };

  const handleUnfeature = async () => {
    setWorking("unfeature");
    try {
      await onUnfeature(submission.id);
      toast.success(
        t(
          "admin.testimonials.unfeature_success",
          "Ulasan dihapus dari landing.",
        ),
      );
    } catch {
      showError();
    } finally {
      setWorking(null);
    }
  };

  const handleDelete = async () => {
    setWorking("delete");
    try {
      await onDelete(submission.id);
      toast.success(
        t("admin.testimonials.delete_success", "Ulasan dihapus permanen."),
      );
      setDeleteOpen(false);
    } catch {
      showError();
    } finally {
      setWorking(null);
    }
  };

  const openFeatureDialog = () => {
    const firstAvailable =
      currentFeatured?.slot ??
      FEATURE_SLOTS.find(
        (slot) => !featured.some((item) => item.slot === slot),
      ) ??
      1;

    setSelectedSlot(String(firstAvailable));
    setFeatureOpen(true);
  };

  const requestFeature = () => {
    if (replacementRequired) {
      setFeatureOpen(false);
      setReplacementOpen(true);
      return;
    }

    void handleFeature();
  };

  const isWorking = working !== null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:size-8"
            aria-label={t("admin.testimonials.open_actions", {
              name: submission.display_name,
              defaultValue: "Buka tindakan untuk ulasan {{name}}",
            })}
          >
            {isWorking ? (
              <Loader2 className="animate-spin" />
            ) : (
              <MoreHorizontal />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            {submission.status !== "approved" && (
              <DropdownMenuItem
                disabled={isWorking}
                className="min-h-11 sm:min-h-8"
                onSelect={() => void handleApprove()}
              >
                <Check />
                {t("admin.testimonials.action_approve", "Setujui")}
              </DropdownMenuItem>
            )}
            {submission.status !== "rejected" && (
              <DropdownMenuItem
                disabled={isWorking}
                className="min-h-11 sm:min-h-8"
                onSelect={() => setRejectOpen(true)}
              >
                <X />
                {t("admin.testimonials.action_reject", "Tolak")}
              </DropdownMenuItem>
            )}
            {submission.status === "approved" && (
              <DropdownMenuItem
                disabled={isWorking}
                className="min-h-11 sm:min-h-8"
                onSelect={openFeatureDialog}
              >
                <Pin />
                {currentFeatured
                  ? t("admin.testimonials.action_move", "Ubah slot")
                  : t("admin.testimonials.action_feature", "Tampilkan")}
              </DropdownMenuItem>
            )}
            {currentFeatured && (
              <DropdownMenuItem
                disabled={isWorking}
                className="min-h-11 sm:min-h-8"
                onSelect={() => void handleUnfeature()}
              >
                <PinOff />
                {t("admin.testimonials.action_unfeature", "Hapus dari landing")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={isWorking}
              className="min-h-11 sm:min-h-8"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 />
              {t("admin.testimonials.action_delete", "Hapus permanen")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!isWorking) setRejectOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("admin.testimonials.reject_title", "Tolak ulasan")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin.testimonials.reject_desc",
                "Alasan bersifat opsional dan hanya dapat dilihat oleh pengguna serta admin.",
              )}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={rejectionReasonId}>
                {t(
                  "admin.testimonials.rejection_reason_label",
                  "Alasan penolakan (opsional)",
                )}
              </FieldLabel>
              <Textarea
                id={rejectionReasonId}
                value={rejectionReason}
                maxLength={500}
                disabled={isWorking}
                placeholder={t(
                  "admin.testimonials.rejection_reason_placeholder",
                  "Contoh: mohon hindari informasi pribadi.",
                )}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isWorking}
              className="text-xs font-bold cursor-pointer shrink-0"
              onClick={() => setRejectOpen(false)}
            >
              {t("common.cancel", "Batal")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={isWorking}
              className="text-xs font-bold cursor-pointer shrink-0"
              onClick={() => void handleReject()}
            >
              {working === "reject" ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <X data-icon="inline-start" className="h-3.5 w-3.5" />
              )}
              {t("admin.testimonials.action_reject", "Tolak")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={featureOpen}
        onOpenChange={(open) => {
          if (!isWorking) setFeatureOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("admin.testimonials.feature_title", "Pilih slot landing")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin.testimonials.feature_desc",
                "Ulasan yang disetujui dapat menempati salah satu dari enam slot publik.",
              )}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={featureSlotId}>
                {t("admin.testimonials.slot_label", "Slot")}
              </FieldLabel>
              <Select
                value={selectedSlot}
                disabled={isWorking}
                onValueChange={setSelectedSlot}
              >
                <SelectTrigger
                  id={featureSlotId}
                  className="h-11 w-full sm:h-8"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FEATURE_SLOTS.map((slot) => {
                      const occupant = featured.find(
                        (item) => item.slot === slot,
                      );
                      return (
                        <SelectItem key={slot} value={String(slot)}>
                          {occupant
                            ? t("admin.testimonials.slot_occupied", {
                                slot,
                                name: occupant.display_name,
                                defaultValue: "Slot {{slot}} — {{name}}",
                              })
                            : t("admin.testimonials.slot_available", {
                                slot,
                                defaultValue: "Slot {{slot}} — kosong",
                              })}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {replacementRequired && occupiedSlot && (
                <FieldDescription>
                  {t("admin.testimonials.slot_replace_hint", {
                    name: occupiedSlot.display_name,
                    defaultValue:
                      "Slot ini sedang ditempati {{name}}. Penggantian memerlukan konfirmasi.",
                  })}
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isWorking}
              className="text-xs font-bold cursor-pointer shrink-0"
              onClick={() => setFeatureOpen(false)}
            >
              {t("common.cancel", "Batal")}
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={isWorking}
              className="text-xs font-bold cursor-pointer shrink-0"
              onClick={requestFeature}
            >
              {working === "feature" ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : currentFeatured ? (
                <Check data-icon="inline-start" className="h-3.5 w-3.5" />
              ) : (
                <Star data-icon="inline-start" className="h-3.5 w-3.5" />
              )}
              {currentFeatured
                ? t("admin.testimonials.action_move", "Ubah slot")
                : t("admin.testimonials.action_feature", "Tampilkan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={replacementOpen} onOpenChange={setReplacementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Pin />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t("admin.testimonials.replace_title", "Ganti ulasan di slot?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.testimonials.replace_desc", {
                slot: selectedSlotNumber,
                name:
                  occupiedSlot?.display_name ??
                  t("admin.testimonials.another_testimonial", "ulasan lain"),
                defaultValue:
                  "Slot {{slot}} sedang ditempati {{name}}. Ulasan tersebut akan langsung digantikan.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>
              {t("common.cancel", "Batal")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isWorking}
              onClick={() => void handleFeature()}
            >
              {working === "feature" && (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              )}
              {t("admin.testimonials.replace_confirm", "Ganti slot")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
              onClick={() => void handleDelete()}
            >
              {working === "delete" && (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              )}
              {t("admin.testimonials.action_delete", "Hapus permanen")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-9 w-36" /></TableCell>
      <TableCell><Skeleton className="h-12 w-72" /></TableCell>
      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
      <TableCell><Skeleton className="ml-auto size-8" /></TableCell>
    </TableRow>
  ));
}

export function TestimonialsTable() {
  "use no memo";
  const { t, i18n } = useTranslation();
  const {
    submissions,
    featured,
    isLoading,
    isFetching,
    isError,
    refetch,
    approve,
    reject,
    feature,
    unfeature,
    deleteSubmission,
  } = useAdminTestimonials();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const filteredSubmissions = useMemo(
    () =>
      statusFilter === "all"
        ? submissions
        : submissions.filter((item) => item.status === statusFilter),
    [statusFilter, submissions],
  );

  const columns = useMemo<ColumnDef<TestimonialSubmissionRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: t("admin.testimonials.col_date", "Tanggal"),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatSubmissionDate(row.original.created_at, i18n.language)}
          </span>
        ),
      },
      {
        accessorKey: "display_name",
        header: t("admin.testimonials.col_user", "Pengguna"),
        cell: ({ row }) => (
          <div className="flex max-w-48 flex-col gap-1 whitespace-normal items-start">
            <span className="font-medium text-foreground">
              {row.original.display_name}
            </span>
            {row.original.verified_purchase ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-[9px] font-bold text-emerald-500 border-emerald-500/20 px-1.5 py-0 uppercase">
                {t("testimonials.membership.member_premium", "anggota premium")}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-[9px] font-bold text-muted-foreground border-transparent px-1.5 py-0 uppercase">
                {t("testimonials.membership.member_free", "anggota gratis")}
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "body",
        header: t("admin.testimonials.col_testimonial", "Ulasan"),
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
        header: t("admin.testimonials.col_rating", "Rating"),
        cell: ({ row }) => <Rating value={row.original.rating} />,
      },
      {
        accessorKey: "status",
        header: t("admin.testimonials.col_status", "Status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "slot",
        header: t("admin.testimonials.col_slot", "Slot"),
        cell: ({ row }) => {
          const item = featured.find(
            (candidate) => candidate.submission_id === row.original.id,
          );
          return item ? (
            <Badge variant="outline">
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
              onReject={reject}
              onFeature={feature}
              onUnfeature={unfeature}
              onDelete={deleteSubmission}
            />
          </div>
        ),
      },
    ],
    [
      approve,
      deleteSubmission,
      feature,
      featured,
      i18n.language,
      reject,
      t,
      unfeature,
    ],
  );

  const table = useReactTable({
    data: filteredSubmissions,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    {
      value: "all",
      label: t("admin.testimonials.filter_all", "Semua status"),
    },
    {
      value: "pending",
      label: t("admin.testimonials.status_pending", "Menunggu"),
    },
    {
      value: "approved",
      label: t("admin.testimonials.status_approved", "Disetujui"),
    },
    {
      value: "rejected",
      label: t("admin.testimonials.status_rejected", "Ditolak"),
    },
  ];

  return (
    <Card>
      <CardHeader className="has-data-[slot=card-action]:grid-cols-1 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <CardTitle>
          {t("admin.testimonials.list_title", "Antrean moderasi")}
        </CardTitle>
        <CardDescription>
          {t("admin.testimonials.list_desc", {
            filtered: filteredSubmissions.length,
            total: submissions.length,
            defaultValue:
              "{{filtered}} dari {{total}} ulasan ditampilkan.",
          })}
        </CardDescription>
        <CardAction className="col-start-1 row-start-3 mt-2 w-full justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:justify-self-end">
          <div className="flex w-full items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger
                className="h-11 min-w-0 flex-1 sm:h-8 sm:w-40"
                aria-label={t(
                  "admin.testimonials.filter_label",
                  "Filter status ulasan",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 sm:size-8"
              disabled={isFetching}
              aria-label={t("admin.testimonials.refresh", "Muat ulang ulasan")}
              onClick={() => void refetch()}
            >
              <RefreshCw className={isFetching ? "animate-spin" : undefined} />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        {isError ? (
          <EmptyState
            icon={<AlertCircle className="size-12 text-destructive" />}
            title={t(
              "admin.testimonials.error_title",
              "Ulasan gagal dimuat",
            )}
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
          <Table className="min-w-5xl">
            <TableCaption className="sr-only">
              {t(
                "admin.testimonials.table_caption",
                "Daftar ulasan pengguna untuk dimoderasi.",
              )}
            </TableCaption>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
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
                  <TableCell colSpan={columns.length}>
                    <EmptyState
                      icon={
                        <MessageSquareQuote className="size-12 text-muted-foreground" />
                      }
                      title={t(
                        "admin.testimonials.empty_title",
                        "Belum ada ulasan",
                      )}
                      description={
                        statusFilter === "all"
                          ? t(
                              "admin.testimonials.empty_desc",
                              "Ulasan pengguna akan muncul di antrean ini.",
                            )
                          : t(
                              "admin.testimonials.empty_filter_desc",
                              "Tidak ada ulasan dengan status yang dipilih.",
                            )
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
        )}
      </CardContent>

      {!isLoading && !isError && filteredSubmissions.length > 10 && (
        <CardFooter>
          <DataTablePagination table={table} />
        </CardFooter>
      )}
    </Card>
  );
}
