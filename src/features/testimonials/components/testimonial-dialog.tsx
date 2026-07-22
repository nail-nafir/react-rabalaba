import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/use-auth";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import type {
  TestimonialStatus,
  TestimonialSubmissionRow,
} from "@/services/supabase/database.types";
import { useMyTestimonial } from "@/features/testimonials/hooks/use-testimonials";
import {
  createTestimonialSchema,
  TESTIMONIAL_LIMITS,
  type TestimonialFormValues,
} from "@/features/testimonials/schemas/testimonial-schema";

interface TestimonialDialogProps {
  trigger: ReactElement;
}

const EMPTY_FORM: TestimonialFormValues = {
  body: "",
  rating: 0,
};

function statusVariant(status: TestimonialStatus) {
  if (status === "approved")
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" as const;
  if (status === "rejected")
    return "bg-destructive/10 text-destructive border-destructive/20" as const;
  return "bg-amber-500/10 text-amber-500 border-amber-500/20" as const;
}

function valuesFromSubmission(
  submission: TestimonialSubmissionRow | null,
): TestimonialFormValues {
  if (!submission) return EMPTY_FORM;
  return {
    body: submission.body,
    rating: submission.rating,
  };
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return letters || "RL";
}

export function TestimonialDialog({ trigger }: TestimonialDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <TestimonialDialogContent
        onClose={() => setOpen(false)}
        isPending={isPending}
        setIsPending={setIsPending}
      />
    </Dialog>
  );
}

function TestimonialDialogContent({
  onClose,
  isPending,
  setIsPending,
}: {
  onClose: () => void;
  isPending: boolean;
  setIsPending: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tier, isAdmin, isOwner } = usePremiumAccess();

  const getBadgeKey = () => {
    const role = isOwner ? "owner" : isAdmin ? "admin" : "member";
    const kasta = tier === "premium" || tier === "trial" ? "premium" : "free";
    return `testimonials.membership.${role}_${kasta}`;
  };

  const {
    submission,
    isLoading,
    isError,
    refetch,
    saveTestimonial,
    isSaving,
    deleteTestimonial,
    isDeleting,
  } = useMyTestimonial();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const schema = useMemo(() => createTestimonialSchema(t), [t]);
  const form = useForm<TestimonialFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
    mode: "onChange",
  });

  const fallbackName =
    (typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    user?.email?.split("@")[0] ||
    "";

  useEffect(() => {
    if (isLoading || isError) return;
    form.reset(valuesFromSubmission(submission));
  }, [form, isError, isLoading, submission]);

  const onSubmit = async (values: TestimonialFormValues) => {
    setIsPending(true);
    try {
      await saveTestimonial(values);
      toast.success(t("toasts.testimonial.save_success"));
      onClose();
    } catch {
      toast.error(t("toasts.testimonial.save_error"));
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (): Promise<boolean> => {
    try {
      await deleteTestimonial();
      toast.success(t("toasts.testimonial.delete_success"));
      return true;
    } catch {
      toast.error(t("toasts.testimonial.delete_error"));
      return false;
    }
  };

  const handleDeleteAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isConfirmingDelete) return;

    setIsConfirmingDelete(true);
    setIsPending(true);
    try {
      if (await handleDelete()) {
        setDeleteOpen(false);
        onClose();
      }
    } finally {
      setIsConfirmingDelete(false);
      setIsPending(false);
    }
  };

  const isBusy = isSaving || isDeleting || isPending;
  const canSubmit =
    form.formState.isValid && (!submission || form.formState.isDirty);

  return (
    <DialogContent
      className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md border border-border text-foreground"
      showCloseButton={!isBusy}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-foreground">
          {submission
            ? t("testimonials.form.edit_title", "Ulasan Pribadi")
            : t("testimonials.form.create_title", "Bagikan Ulasan")}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {t(
            "testimonials.form.description",
            "Ceritakan pengalaman menggunakan RabaLaba. Kutipan akan ditampilkan apa adanya setelah disetujui.",
          )}
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="flex flex-col gap-5" aria-hidden>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : isError ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              {t(
                "testimonials.form.load_error_title",
                "Ulasan belum bisa dimuat",
              )}
            </CardTitle>
            <CardDescription>
              {t(
                "testimonials.form.load_error_description",
                "Periksa koneksi lalu coba lagi sebelum membuat perubahan.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void refetch()}>
              {t("common.retry", "Coba lagi")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          {submission && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>
                  {t("testimonials.form.status_title", "Status ulasan")}
                </CardTitle>
                <CardDescription>
                  {submission.status === "approved"
                    ? t(
                        "testimonials.status.approved_description",
                        "Ulasan sudah disetujui. Admin dapat memilihnya untuk tampil di landing.",
                      )
                    : submission.status === "rejected"
                      ? t(
                          "testimonials.status.rejected_description",
                          "Ulasan perlu diperbaiki sebelum diajukan kembali.",
                        )
                      : t(
                          "testimonials.status.pending_description",
                          "Ulasan sedang menunggu peninjauan admin.",
                        )}
                </CardDescription>
                <CardAction>
                  <Badge
                    variant="outline"
                    className={statusVariant(submission.status)}
                  >
                    {submission.status === "approved"
                      ? t("testimonials.status.approved", "Disetujui")
                      : submission.status === "rejected"
                        ? t("testimonials.status.rejected", "Ditolak")
                        : t("testimonials.status.pending", "Menunggu")}
                  </Badge>
                </CardAction>
              </CardHeader>
              {(submission.status === "approved" ||
                submission.status === "rejected") && (
                <CardContent className="flex flex-col gap-1">
                  {submission.status === "approved" ? (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "testimonials.form.approved_edit_warning",
                        "Mengubah ulasan yang sudah disetujui akan mengirimnya kembali untuk ditinjau dan menghapusnya dari landing sementara.",
                      )}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        {t(
                          "testimonials.form.rejection_reason",
                          "Catatan privat dari admin",
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {submission.rejection_reason ||
                          t(
                            "testimonials.form.no_rejection_reason",
                            "Admin tidak menyertakan catatan tambahan.",
                          )}
                      </p>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>{initials(fallbackName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h4 className="font-semibold text-foreground text-sm flex flex-wrap items-center gap-1.5">
                  <span className="truncate">{fallbackName}</span>
                  <Badge
                    variant="outline"
                    className={`h-4.5 text-[9px] font-bold px-1.5 py-0 uppercase ${tier === "premium" || tier === "trial" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-transparent"}`}
                  >
                    {t(getBadgeKey())}
                  </Badge>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t(
                    "testimonials.form.automatic_profile_hint",
                    "Nama dan status verifikasi diambil dari data akun asli Anda.",
                  )}
                </p>
              </div>
            </div>
          </div>

          <FieldGroup>
            <Controller
              name="rating"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel id="testimonial-rating-label">
                    {t("testimonials.form.rating", "Penilaian")}
                  </FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    spacing={2}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) =>
                      field.onChange(value ? Number(value) : 0)
                    }
                    onBlur={field.onBlur}
                    aria-labelledby="testimonial-rating-label"
                    aria-invalid={fieldState.invalid}
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <ToggleGroupItem
                        key={rating}
                        value={String(rating)}
                        className="size-11 sm:size-8"
                        aria-label={t(
                          `testimonials.rating.${rating}`,
                          `${rating} dari 5 bintang`,
                        )}
                      >
                        <Star
                          aria-hidden
                          className={
                            rating <= field.value
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground hover:fill-amber-400/20 hover:text-amber-400"
                          }
                        />
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="body"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="testimonial-body">
                    {t("testimonials.form.body", "Ulasan")}
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="testimonial-body"
                    rows={5}
                    maxLength={TESTIMONIAL_LIMITS.body.max}
                    aria-invalid={fieldState.invalid}
                    placeholder={t(
                      "testimonials.form.body_placeholder",
                      "Ceritakan hal yang paling membantu dari RabaLaba...",
                    )}
                  />
                  <FieldDescription>
                    {(field.value ?? "").length}/{TESTIMONIAL_LIMITS.body.max}
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter
            className={submission ? "sm:justify-between" : undefined}
          >
            {submission && (
              <AlertDialog
                open={deleteOpen}
                onOpenChange={(nextOpen) => {
                  if (!isConfirmingDelete) setDeleteOpen(nextOpen);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    disabled={isBusy}
                    className="text-xs font-bold cursor-pointer shrink-0"
                  >
                    {t("testimonials.form.delete", "Hapus")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("testimonials.form.delete_title", "Hapus ulasan?")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        "testimonials.form.delete_description",
                        "Tindakan ini permanen dan ulasan akan langsung hilang dari landing jika sedang ditampilkan.",
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isConfirmingDelete}>
                      {t("common.cancel", "Batal")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isConfirmingDelete}
                      aria-busy={isConfirmingDelete}
                      onClick={handleDeleteAction}
                    >
                      <ActionButtonContent
                        label={t("common.actions.delete")}
                        pending={isConfirmingDelete}
                      />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={isBusy || !canSubmit}
              aria-busy={isSaving}
            >
              <ActionButtonContent
                label={t("common.actions.submit")}
                pending={isSaving}
              />
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}
