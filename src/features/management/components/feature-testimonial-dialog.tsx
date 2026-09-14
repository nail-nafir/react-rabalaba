import { useMemo, useState, type MouseEvent, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Check, Pin } from "lucide-react";
import { toast } from "sonner";

import { ActionButtonContent } from "@/components/shared/action-button-content";
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
import { Badge } from "@/components/ui/badge";
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
import { useAdminTestimonials } from "@/features/management/hooks/use-admin-testimonials";
import { cn } from "@/lib/utils";
import type { TestimonialSubmissionRow } from "@/services/supabase/database.types";

interface FeatureTestimonialDialogProps {
  submission: TestimonialSubmissionRow;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FeatureTestimonialDialog({
  submission,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: FeatureTestimonialDialogProps) {
  const { t } = useTranslation();
  const { featured, feature, unfeature, maxSlots } = useAdminTestimonials();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const [replacementOpen, setReplacementOpen] = useState(false);
  const [isConfirmingReplacement, setIsConfirmingReplacement] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const featureSlots = useMemo(
    () => Array.from({ length: maxSlots }, (_, i) => i + 1),
    [maxSlots],
  );

  const currentFeatured = featured.find(
    (item) => item.submission_id === submission.id,
  );
  const firstAvailable =
    currentFeatured?.slot ??
    featureSlots.find(
      (slot) => !featured.some((item) => item.slot === slot),
    ) ??
    1;
  const [selectedSlot, setSelectedSlot] = useState(String(firstAvailable));

  const selectedSlotNumber = Number(selectedSlot);
  const occupiedSlot = featured.find(
    (item) => item.slot === selectedSlotNumber,
  );
  const replacementRequired = Boolean(
    occupiedSlot && occupiedSlot.submission_id !== submission.id,
  );

  const isUnselectMode = Boolean(currentFeatured && selectedSlotNumber === 0);
  const hasSlotChanged = currentFeatured
    ? selectedSlotNumber !== currentFeatured.slot
    : selectedSlotNumber > 0;

  const isReplacementWorking = isSaving || isConfirmingReplacement;

  const handleSave = async () => {
    if (isSaving || !hasSlotChanged) return;

    if (isUnselectMode) {
      setIsSaving(true);
      try {
        await unfeature(submission.id);
        toast.success(t("toasts.testimonial_admin.unfeature_success"));
        setOpen(false);
      } catch {
        toast.error(t("toasts.testimonial_admin.action_error"));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (replacementRequired) {
      setReplacementOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      await feature(submission.id, selectedSlotNumber);
      toast.success(t("toasts.testimonial_admin.feature_success"));
      setOpen(false);
    } catch {
      toast.error(t("toasts.testimonial_admin.action_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReplacementAction = async (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    setIsConfirmingReplacement(true);
    try {
      await feature(submission.id, selectedSlotNumber);
      toast.success(t("toasts.testimonial_admin.feature_success"));
      setReplacementOpen(false);
      setOpen(false);
    } catch {
      toast.error(t("toasts.testimonial_admin.action_error"));
    } finally {
      setIsConfirmingReplacement(false);
    }
  };

  const submitLabel = isUnselectMode
    ? t("admin.action_unfeature")
    : replacementRequired
      ? t("admin.testimonials.action_move")
      : t("admin.testimonials.action_save");

  const actionButton = (
    <Button
      type="button"
      size="lg"
      variant={isUnselectMode ? "destructive" : "default"}
      disabled={!hasSlotChanged || isReplacementWorking}
      aria-busy={isReplacementWorking}
      onClick={
        !isUnselectMode && replacementRequired
          ? undefined
          : () => void handleSave()
      }
    >
      <ActionButtonContent
        label={submitLabel}
        pending={isSaving}
      />
    </Button>
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isReplacementWorking) {
      if (nextOpen) setSelectedSlot(String(firstAvailable));
      setOpen(nextOpen);
    }
  };

  const occupiedCount = featured.length;
  const emptyCount = Math.max(0, maxSlots - occupiedCount);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-md border border-border text-foreground"
        showCloseButton={!isReplacementWorking}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.testimonials.feature_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("admin.testimonials.feature_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* Status Summary Pill Bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
            <div className="flex items-center gap-3 font-semibold">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                {t("admin.testimonials.summary_occupied", { count: occupiedCount })}
              </span>
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/40" />
                {t("admin.testimonials.summary_empty", { count: emptyCount })}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              {t("admin.testimonials.summary_total", { count: maxSlots })}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("admin.testimonials.slot_label")}
            </label>

            {/* Interactive Custom Slot Cards (Single Column Row List + Scrollable) */}
            <div className="max-h-[360px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-2">
                {featureSlots.map((slot) => {
                  const occupant = featured.find((item) => item.slot === slot);
                  const isOccupiedBySelf =
                    currentFeatured && currentFeatured.slot === slot;
                  const isSelected = selectedSlotNumber === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isReplacementWorking}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSlot("0");
                        } else {
                          setSelectedSlot(String(slot));
                        }
                      }}
                      className={cn(
                        "group relative flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer min-h-[52px]",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
                          : "border-border/60 bg-card/60 hover:border-primary/40 hover:bg-accent/40 text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-xs"
                              : "border-muted-foreground/30 bg-transparent group-hover:border-primary/50",
                          )}
                        >
                          {isSelected && (
                            <Check className="size-2.5 stroke-[3]" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {t("admin.testimonials.slot_value", { slot })}
                          </span>
                          <span className="text-xs truncate mt-0.5">
                            {occupant ? (
                              <span
                                className={cn(
                                  "font-medium",
                                  isOccupiedBySelf
                                    ? "text-primary font-semibold"
                                    : "text-foreground",
                                )}
                              >
                                {occupant.display_name}
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground/70 font-normal">
                                {t("admin.testimonials.slot_empty")}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {isOccupiedBySelf && (
                        <Badge
                          variant="outline"
                          className="w-fit shrink-0 ml-2 rounded-md text-[10px] font-bold uppercase tracking-wider border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          {t("admin.testimonials.slot_active_badge")}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Replacement Context Banner */}
            {!isUnselectMode && replacementRequired && occupiedSlot && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 mt-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-semibold">{t("admin.testimonials.slot_replace_title")}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {t("admin.testimonials.slot_replace_hint", { name: occupiedSlot.display_name })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {!isUnselectMode && replacementRequired ? (
            <AlertDialog
              open={replacementOpen}
              onOpenChange={(nextOpen) => {
                if (!isReplacementWorking) setReplacementOpen(nextOpen);
              }}
            >
              <AlertDialogTrigger asChild>{actionButton}</AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <Pin />
                  </AlertDialogMedia>
                  <AlertDialogTitle>
                    {t("admin.testimonials.replace_title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("admin.testimonials.replace_desc", {
                      slot: selectedSlotNumber,
                      name: occupiedSlot?.display_name ?? t("admin.testimonials.another_testimonial"),
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isReplacementWorking}>
                    {t("common.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isReplacementWorking}
                    aria-busy={isReplacementWorking}
                    onClick={handleConfirmReplacementAction}
                  >
                    <ActionButtonContent
                      label={t("common.actions.replace")}
                      pending={isReplacementWorking}
                    />
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            actionButton
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
