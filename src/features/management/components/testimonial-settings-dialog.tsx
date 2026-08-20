import { useState, type ReactElement } from "react";
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
import { Input } from "@/components/ui/input";
import { useAdminTestimonials } from "@/features/management/hooks/use-admin-testimonials";
import { SettingRow } from "./setting-row";

interface TestimonialSettingsDialogProps {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TestimonialSettingsDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: TestimonialSettingsDialogProps) {
  const { t } = useTranslation();
  const { maxSlots, updateMaxSlots } = useAdminTestimonials();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const [slotCount, setSlotCount] = useState(maxSlots);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = slotCount !== maxSlots;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isSaving) {
      if (nextOpen) setSlotCount(maxSlots);
      setOpen(nextOpen);
    }
  };

  const handleSave = async () => {
    if (isSaving || !hasChanges) return;
    setIsSaving(true);
    try {
      await updateMaxSlots(slotCount);
      toast.success(t("toasts.testimonial_admin.feature_success"));
      setOpen(false);
    } catch {
      toast.error(t("toasts.testimonial_admin.action_error"));
    } finally {
      setIsSaving(false);
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
            {t("admin.testimonials.settings_title", "Pengaturan Slot Ulasan")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t(
              "admin.testimonials.settings_desc",
              "Atur kapasitas maksimal slot publik yang dapat ditampilkan di halaman utama.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1 divide-y divide-border/60">
            <SettingRow
              title={t(
                "admin.testimonials.max_slots_label",
                "Kapasitas Maksimal Slot",
              )}
              desc={t(
                "admin.testimonials.max_slots_hint",
                "Tentukan jumlah slot publik (1 s/d 12 slot). Kapasitas bawaan sistem adalah 6.",
              )}
            >
              <Input
                type="number"
                min={1}
                max={12}
                value={slotCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setSlotCount(Math.max(1, Math.min(12, val)));
                  }
                }}
                className="w-24 h-8 text-xs font-semibold text-center"
              />
            </SettingRow>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="lg"
            disabled={!hasChanges || isSaving}
            aria-busy={isSaving}
            onClick={() => void handleSave()}
          >
            <ActionButtonContent
              label={t("common.actions.save", "Simpan")}
              pending={isSaving}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
