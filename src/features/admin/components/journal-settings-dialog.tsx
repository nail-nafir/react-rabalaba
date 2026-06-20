import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useJournalSettings, type JournalSettingsPatch } from "@/hooks/use-journal-settings";
import type { JournalSettingsRow } from "@/services/supabase/database.types";

// Finest = 15 min (the cron base tick); coarser options are gated in-app.
const INTERVAL_OPTIONS = [
  { value: 15, label: "15 menit" },
  { value: 30, label: "30 menit" },
  { value: 60, label: "1 jam" },
  { value: 120, label: "2 jam" },
  { value: 240, label: "4 jam" },
];

interface SettingRowProps {
  title: string;
  desc: string;
  children: React.ReactNode;
}

function SettingRow({ title, desc, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground leading-snug">
          {desc}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface JournalSettingsFormProps {
  settings: JournalSettingsRow;
  onClose: () => void;
  update: (patch: JournalSettingsPatch) => Promise<void>;
}

/** Pure settings form component that initializes drafts directly from settings props.
 *  This avoids any useEffect setState calls. */
function JournalSettingsForm({
  settings,
  onClose,
  update,
}: JournalSettingsFormProps) {
  const { t } = useTranslation();

  const enabled = settings.enabled ?? true;
  const interval = settings.interval_minutes ?? 30;
  const marketHoursOnly = settings.market_hours_only ?? false;

  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [draftInterval, setDraftInterval] = useState(interval);
  const [draftMarketHoursOnly, setDraftMarketHoursOnly] = useState(marketHoursOnly);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges =
    draftEnabled !== enabled ||
    draftInterval !== interval ||
    draftMarketHoursOnly !== marketHoursOnly;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await update({
        enabled: draftEnabled,
        interval_minutes: draftInterval,
        market_hours_only: draftMarketHoursOnly,
      });
      toast.success(t("admin.settings_toast_success"));
      onClose();
    } catch {
      toast.error(t("admin.settings_toast_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4 py-4 divide-y divide-border/60">
        <SettingRow
          title={t("admin.settings_status_label")}
          desc={t("admin.settings_status_desc")}
        >
          <Switch
            checked={draftEnabled}
            onCheckedChange={setDraftEnabled}
            aria-label="Aktif atau jeda auto-journal"
            className="cursor-pointer data-[state=checked]:bg-emerald-500"
          />
        </SettingRow>

        <SettingRow
          title={t("admin.settings_interval_label")}
          desc={t("admin.settings_interval_desc")}
        >
          <Select
            value={String(draftInterval)}
            onValueChange={(v) => setDraftInterval(Number(v))}
          >
            <SelectTrigger className="w-28 h-8 uppercase tracking-wider text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="p-1">
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem
                  key={o.value}
                  value={String(o.value)}
                  className="uppercase tracking-wider text-[10px]"
                >
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          title={t("admin.settings_market_hours_label")}
          desc={t("admin.settings_market_hours_desc")}
        >
          <Switch
            checked={draftMarketHoursOnly}
            onCheckedChange={setDraftMarketHoursOnly}
            aria-label="Jurnal hanya saat jam market"
            className="cursor-pointer"
          />
        </SettingRow>
      </div>

      <DialogFooter>
        <Button
          type="button"
          onClick={handleSave}
          size="lg"
          disabled={isSaving || !hasChanges}
          className="text-xs font-bold cursor-pointer shrink-0"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            t("admin.settings_save_btn")
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

interface JournalSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Settings Dialog container styled same as AddTickerDialog/AddJournalAssetDialog */
export function JournalSettingsDialog({
  open,
  onOpenChange,
}: JournalSettingsDialogProps) {
  const { t } = useTranslation();
  const { settings, isLoading, update } = useJournalSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.settings_dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("admin.settings_dialog_desc")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : (
          settings && (
            <JournalSettingsForm
              settings={settings}
              onClose={() => onOpenChange(false)}
              update={update}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
