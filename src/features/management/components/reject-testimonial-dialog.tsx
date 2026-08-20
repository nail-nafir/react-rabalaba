import { useId, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ActionButtonContent } from "@/components/shared/action-button-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useAdminTestimonials } from "@/features/management/hooks/use-admin-testimonials";
import type { TestimonialSubmissionRow } from "@/services/supabase/database.types";

interface RejectTestimonialDialogProps {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  submission: TestimonialSubmissionRow;
}

export function RejectTestimonialDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  submission,
}: RejectTestimonialDialogProps) {
  const { t } = useTranslation();
  const { reject } = useAdminTestimonials();
  const rejectionReasonId = useId();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await reject(submission.id, reason);
      toast.success(t("toasts.testimonial_admin.reject_success"));
      setReason("");
      setOpen(false);
    } catch {
      toast.error(t("toasts.testimonial_admin.action_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSaving) {
      if (!nextOpen) setReason("");
      setOpen(nextOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-md border border-border text-foreground"
        showCloseButton={!isSaving}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.testimonials.reject_title", "Tolak ulasan")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t(
              "admin.testimonials.reject_desc",
              "Alasan bersifat opsional dan hanya dapat dilihat oleh pengguna serta admin.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
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
                  value={reason}
                  maxLength={500}
                  disabled={isSaving}
                  placeholder={t(
                    "admin.testimonials.rejection_reason_placeholder",
                    "Contoh: mohon hindari informasi pribadi.",
                  )}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={() => void handleConfirm()}
          >
            <ActionButtonContent
              label={t("common.actions.reject")}
              pending={isSaving}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
