import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import { Loader2, Zap } from "lucide-react";
import {
  useJournalSettings,
  type JournalSettingsPatch,
} from "@/hooks/use-journal-settings";
import { useMarketScan } from "@/hooks/use-market-scan";
import type { JournalSettingsRow } from "@/services/supabase/database.types";

/** Compact relative-time token (e.g. "12m", "3h", "2d") for the last-run line. */
function formatAgo(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// Finest = 15 min (the cron base tick); coarser options are gated in-app.
const INTERVAL_OPTIONS = [15, 30, 60, 120, 240];

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
  const [draftMarketHoursOnly, setDraftMarketHoursOnly] =
    useState(marketHoursOnly);
  const [isSaving, setIsSaving] = useState(false);

  const { runScan, isScanning } = useMarketScan();
  // Seeded once (lazy) so the relative "last run" reads without an impure
  // Date.now() in the render body; staleness across this ephemeral dialog is fine.
  const [nowMs] = useState(() => Date.now());

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
      <div className="space-y-5 py-4">
        {/* Settings Configuration Rows */}
        <div className="space-y-1 divide-y divide-border/60">
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
              <SelectTrigger className="w-28 h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                position="popper"
                className="p-1"
              >
                {INTERVAL_OPTIONS.map((val) => {
                  const label =
                    val >= 60
                      ? t("admin.settings_interval_hours", { count: val / 60 })
                      : t("admin.settings_interval_minutes", { count: val });
                  return (
                    <SelectItem
                      key={val}
                      value={String(val)}
                      className="uppercase tracking-wider text-[10px] cursor-pointer"
                    >
                      {label}
                    </SelectItem>
                  );
                })}
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

        {/* Manual Action Section - Premium UI Card */}
        <Card className="w-full border border-border shadow-xs bg-muted/50">
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t("admin.scan_manual_title")}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-52">
                  {t("admin.scan_manual_desc")}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={runScan}
                disabled={!draftEnabled || hasChanges || isScanning || isSaving}
                title={
                  !draftEnabled
                    ? t("admin.scan_paused_hint")
                    : hasChanges
                      ? t("admin.scan_unsaved_hint")
                      : undefined
                }
                className="text-[10px] font-bold h-8 cursor-pointer shrink-0 gap-1.5"
              >
                {isScanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                <span>
                  {isScanning ? t("admin.scan_loading") : t("admin.scan_btn")}
                </span>
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 px-4 py-2.5">
            <span>{t("admin.scan_last_run_title")}</span>
            <Badge
              variant="outline"
              className="font-mono text-[10px] font-bold rounded-md bg-amber-500/15 border-amber-500/30 text-amber-400 py-0.5 px-2"
            >
              {settings.last_run_at
                ? t("admin.scan_last_run", {
                    ago: formatAgo(settings.last_run_at, nowMs),
                  })
                : t("admin.scan_never")}
            </Badge>
          </CardFooter>
        </Card>
      </div>

      <DialogFooter className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="text-xs font-bold cursor-pointer h-9 px-4 shrink-0"
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
