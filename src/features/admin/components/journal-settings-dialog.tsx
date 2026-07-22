import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectGroup,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Radar, Zap, FileText } from "lucide-react";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";
import {
  useJournalSettings,
  type JournalSettingsPatch,
} from "@/hooks/use-journal-settings";
import { useMarketScan } from "@/hooks/use-market-scan";
import { useAssetDiscovery } from "@/hooks/use-asset-discovery";
import type { JournalSettingsRow } from "@/services/supabase/database.types";
import { cn } from "@/lib/utils";

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

// Finest = 30 min (the cron base tick is */30). Longer options run CLOCK-ALIGNED
// to WIB midnight in the edge function: 360 → 00/06/12/18 WIB, 720 → 00/12 WIB.
const INTERVAL_OPTIONS = [30, 60, 360, 720];

// WIB hours offered for the end-of-day recap (late evening → midnight). 0 =
// midnight, which recaps the FULL previous day (true end of day).
const SUMMARY_HOUR_OPTIONS = [22, 23, 0];

// Auto-discovery: max NEW symbols per market per run, and how long an auto
// asset may go unrediscovered before it is deactivated (DB checks allow 1-20
// and 3-90; these are the sane presets).
const SELECTION_CAP_OPTIONS = [3, 5, 10];
const SELECTION_PRUNE_OPTIONS = [7, 14, 30];
type SettingsTab = "journal" | "summary" | "selection";

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

/** The one dropdown look every option row shares (width, casing, size). */
function SettingSelect({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  renderLabel: (value: number) => string;
}) {
  const items = options.map((option) => ({
    value: String(option),
    label: renderLabel(option),
  }));

  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(Number(nextValue));
      }}
    >
      <SelectTrigger className="w-28 h-8 uppercase tracking-wider text-[10px] cursor-pointer">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="p-1">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="uppercase tracking-wider text-[10px] cursor-pointer"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Shared "manual trigger" card: title/desc + action button, last-run badge in
 *  the footer. One per tab, so each tab owns exactly one primary action. */
function ManualActionCard({
  title,
  desc,
  icon,
  buttonLabel,
  loadingLabel,
  onRun,
  running,
  disabled,
  disabledHint,
  lastRunTitle,
  lastRunValue,
  badgeClassName,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  buttonLabel: string;
  loadingLabel: string;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
  disabledHint?: string;
  lastRunTitle: string;
  lastRunValue: string;
  badgeClassName: string;
}) {
  return (
    <Card className="w-full border border-border shadow-xs bg-muted/50">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider">
              {title}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-52">
              {desc}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRun}
            disabled={disabled || running}
            title={disabled ? disabledHint : undefined}
            className="text-[10px] font-bold h-8 cursor-pointer shrink-0 gap-1.5"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : icon}
            <span>{running ? loadingLabel : buttonLabel}</span>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 px-4 py-2.5">
        <span>{lastRunTitle}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold rounded-md py-0.5 px-2",
            badgeClassName,
          )}
        >
          {lastRunValue}
        </Badge>
      </CardFooter>
    </Card>
  );
}

interface JournalSettingsFormProps {
  settings: JournalSettingsRow;
  onClose: () => void;
  update: (patch: JournalSettingsPatch) => Promise<void>;
  isSaving: boolean;
  setIsSaving: (pending: boolean) => void;
}

/** Pure settings form component that initializes drafts directly from settings
 *  props (no useEffect setState). Settings are grouped into three tabs — auto
 *  journal / daily recap / asset discovery — so each concern reads as one short
 *  screen instead of one endless scroll; drafts live here (above the tabs), so
 *  switching tabs never loses unsaved edits and the single Save commits all. */
function JournalSettingsForm({
  settings,
  onClose,
  update,
  isSaving,
  setIsSaving,
}: JournalSettingsFormProps) {
  const { t } = useTranslation();

  const enabled = settings.enabled ?? true;
  const interval = settings.interval_minutes ?? 60;
  const marketHoursOnly = settings.market_hours_only ?? false;
  const summaryEnabled = settings.daily_summary_enabled ?? false;
  const summaryHour = settings.daily_summary_hour ?? 23;
  const weeklyEnabled = settings.weekly_summary_enabled ?? false;
  const monthlyEnabled = settings.monthly_summary_enabled ?? false;
  const selectionEnabled = settings.discovery_enabled ?? false;
  const selectionCap = settings.discovery_max_per_market ?? 5;
  const selectionPruneDays = settings.discovery_prune_days ?? 14;

  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [draftInterval, setDraftInterval] = useState(interval);
  const [draftMarketHoursOnly, setDraftMarketHoursOnly] =
    useState(marketHoursOnly);
  const [draftSummaryEnabled, setDraftSummaryEnabled] =
    useState(summaryEnabled);
  const [draftSummaryHour, setDraftSummaryHour] = useState(summaryHour);
  const [draftWeeklyEnabled, setDraftWeeklyEnabled] = useState(weeklyEnabled);
  const [draftMonthlyEnabled, setDraftMonthlyEnabled] =
    useState(monthlyEnabled);
  const [draftSelectionEnabled, setDraftSelectionEnabled] =
    useState(selectionEnabled);
  const [draftSelectionCap, setDraftSelectionCap] = useState(selectionCap);
  const [draftSelectionPruneDays, setDraftSelectionPruneDays] =
    useState(selectionPruneDays);
  const [activeTab, setActiveTab] = useState<SettingsTab>("summary");
  // Drafts live ABOVE the tab switch, so hopping between tabs never loses
  // unsaved edits and the single Save commits everything at once.
  const { runScan, isScanning } = useMarketScan();
  const { runDiscovery, isDiscovering } = useAssetDiscovery();
  // Seeded once (lazy) so the relative "last run" reads without an impure
  // Date.now() in the render body; staleness across this ephemeral dialog is fine.
  const [nowMs] = useState(() => Date.now());

  const hasChanges =
    draftEnabled !== enabled ||
    draftInterval !== interval ||
    draftMarketHoursOnly !== marketHoursOnly ||
    draftSummaryEnabled !== summaryEnabled ||
    draftSummaryHour !== summaryHour ||
    draftWeeklyEnabled !== weeklyEnabled ||
    draftMonthlyEnabled !== monthlyEnabled ||
    draftSelectionEnabled !== selectionEnabled ||
    draftSelectionCap !== selectionCap ||
    draftSelectionPruneDays !== selectionPruneDays;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await update({
        enabled: draftEnabled,
        interval_minutes: draftInterval,
        market_hours_only: draftMarketHoursOnly,
        daily_summary_enabled: draftSummaryEnabled,
        daily_summary_hour: draftSummaryHour,
        weekly_summary_enabled: draftWeeklyEnabled,
        monthly_summary_enabled: draftMonthlyEnabled,
        discovery_enabled: draftSelectionEnabled,
        discovery_max_per_market: draftSelectionCap,
        discovery_prune_days: draftSelectionPruneDays,
      });
      toast.success(t("toasts.journal_settings.save_success"));
      onClose();
    } catch {
      toast.error(t("toasts.journal_settings.save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const wibLabel = (h: number) => `${String(h).padStart(2, "0")}:00 WIB`;

  const tabOptions = [
    { value: "summary" as const, label: t("admin.settings_tab_summary") },
    { value: "journal" as const, label: t("admin.settings_tab_journal") },
    { value: "selection" as const, label: t("admin.settings_tab_selection") },
  ] as const;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-6 py-4 select-none">
        {/* Sidebar Navigation with icons + text labels */}
        <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 border-b sm:border-b-0 sm:border-r border-border/60 pr-0 sm:pr-4 shrink-0 w-full sm:w-44 select-none">
          {tabOptions.map((tab) => {
            const isActive = activeTab === tab.value;
            let Icon = Zap;
            if (tab.value === "summary") Icon = FileText;
            if (tab.value === "selection") Icon = Radar;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex items-center gap-3 px-3 h-8 text-sm font-medium transition-all duration-200 cursor-pointer shrink-0 sm:w-full select-none rounded-md text-left",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium shadow-md shadow-primary/10 hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Content Pane */}
        <div className="flex-1 min-h-75 flex flex-col justify-between">
          {activeTab === "journal" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1 divide-y divide-border/60">
                <SettingRow
                  title={t("admin.settings_auto_journal_label")}
                  desc={t("admin.settings_auto_journal_desc")}
                >
                  <Switch
                    checked={draftEnabled}
                    onCheckedChange={setDraftEnabled}
                    aria-label="Aktif atau jeda auto-journal"
                    className="cursor-pointer data-checked:bg-emerald-500"
                  />
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

                <SettingRow
                  title={t("admin.settings_interval_label")}
                  desc={t("admin.settings_interval_desc")}
                >
                  <SettingSelect
                    value={draftInterval}
                    options={INTERVAL_OPTIONS}
                    onChange={setDraftInterval}
                    renderLabel={(val) =>
                      val >= 60
                        ? t("admin.settings_interval_hours", {
                            count: val / 60,
                          })
                        : t("admin.settings_interval_minutes", { count: val })
                    }
                  />
                </SettingRow>
              </div>

              <ManualActionCard
                title={t("admin.scan_manual_title")}
                desc={t("admin.scan_manual_desc")}
                icon={<Zap className="size-3.5" />}
                buttonLabel={t("admin.scan_btn")}
                loadingLabel={t("admin.scan_loading")}
                onRun={runScan}
                running={isScanning}
                disabled={!draftEnabled || hasChanges || isSaving}
                disabledHint={
                  !draftEnabled
                    ? t("admin.scan_paused_hint")
                    : t("admin.scan_unsaved_hint")
                }
                lastRunTitle={t("admin.scan_last_run_title")}
                lastRunValue={
                  settings.last_run_at
                    ? t("admin.scan_last_run", {
                        ago: formatAgo(settings.last_run_at, nowMs),
                      })
                    : t("admin.scan_never")
                }
                badgeClassName="bg-amber-500/15 border-amber-500/30 text-amber-400"
              />
            </div>
          )}

          {activeTab === "summary" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1 divide-y divide-border/60">
                <SettingRow
                  title={t("admin.settings_summary_time_label")}
                  desc={t("admin.settings_summary_time_desc")}
                >
                  <SettingSelect
                    value={draftSummaryHour}
                    options={SUMMARY_HOUR_OPTIONS}
                    onChange={setDraftSummaryHour}
                    renderLabel={wibLabel}
                  />
                </SettingRow>

                <SettingRow
                  title={t("admin.settings_summary_label")}
                  desc={t("admin.settings_summary_desc")}
                >
                  <Switch
                    checked={draftSummaryEnabled}
                    onCheckedChange={setDraftSummaryEnabled}
                    aria-label="Kirim rangkuman harian ke Discord"
                    className="cursor-pointer data-checked:bg-emerald-500"
                  />
                </SettingRow>

                <SettingRow
                  title={t("admin.settings_weekly_label")}
                  desc={t("admin.settings_weekly_desc")}
                >
                  <Switch
                    checked={draftWeeklyEnabled}
                    onCheckedChange={setDraftWeeklyEnabled}
                    aria-label="Kirim rangkuman mingguan ke Discord"
                    className="cursor-pointer data-checked:bg-emerald-500"
                  />
                </SettingRow>

                <SettingRow
                  title={t("admin.settings_monthly_label")}
                  desc={t("admin.settings_monthly_desc")}
                >
                  <Switch
                    checked={draftMonthlyEnabled}
                    onCheckedChange={setDraftMonthlyEnabled}
                    aria-label="Kirim rangkuman bulanan ke Discord"
                    className="cursor-pointer data-checked:bg-emerald-500"
                  />
                </SettingRow>
              </div>

              <Card className="w-full border border-border shadow-xs bg-muted/50">
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {t("admin.summary_last_sent_title")}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold rounded-md bg-emerald-500/15 border-emerald-500/30 text-emerald-400 py-0.5 px-2"
                  >
                    {settings.daily_summary_last_sent_at
                      ? t("admin.scan_last_run", {
                          ago: formatAgo(
                            settings.daily_summary_last_sent_at,
                            nowMs,
                          ),
                        })
                      : t("admin.scan_never")}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "selection" && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1 divide-y divide-border/60">
                <SettingRow
                  title={t("admin.settings_selection_label")}
                  desc={t("admin.settings_selection_desc")}
                >
                  <Switch
                    checked={draftSelectionEnabled}
                    onCheckedChange={setDraftSelectionEnabled}
                    aria-label="Aktif atau jeda seleksi aset otomatis"
                    className="cursor-pointer data-checked:bg-emerald-500"
                  />
                </SettingRow>

                <SettingRow
                  title={t("admin.settings_selection_cap_label")}
                  desc={t("admin.settings_selection_cap_desc")}
                >
                  <SettingSelect
                    value={draftSelectionCap}
                    options={SELECTION_CAP_OPTIONS}
                    onChange={setDraftSelectionCap}
                    renderLabel={(val) =>
                      t("admin.settings_selection_cap_value", { count: val })
                    }
                  />
                </SettingRow>

                <SettingRow
                  title={t("admin.settings_selection_prune_label")}
                  desc={t("admin.settings_selection_prune_desc")}
                >
                  <SettingSelect
                    value={draftSelectionPruneDays}
                    options={SELECTION_PRUNE_OPTIONS}
                    onChange={setDraftSelectionPruneDays}
                    renderLabel={(val) =>
                      t("admin.settings_selection_days", { count: val })
                    }
                  />
                </SettingRow>
              </div>

              <ManualActionCard
                title={t("admin.selection_manual_title")}
                desc={t("admin.selection_manual_desc")}
                icon={<Radar className="size-3.5" />}
                buttonLabel={t("admin.selection_btn")}
                loadingLabel={t("admin.selection_loading")}
                onRun={runDiscovery}
                running={isDiscovering}
                disabled={!draftSelectionEnabled || hasChanges || isSaving}
                disabledHint={
                  !draftSelectionEnabled
                    ? t("admin.selection_paused_hint")
                    : t("admin.scan_unsaved_hint")
                }
                lastRunTitle={t("admin.selection_last_run_title")}
                lastRunValue={
                  settings.discovery_last_run_at
                    ? t("admin.scan_last_run", {
                        ago: formatAgo(settings.discovery_last_run_at, nowMs),
                      })
                    : t("admin.scan_never")
                }
                badgeClassName="bg-sky-500/15 border-sky-500/30 text-sky-400"
              />
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          onClick={handleSave}
          size="lg"
          disabled={isSaving || !hasChanges}
          aria-busy={isSaving}
        >
          <ActionButtonContent
            label={t("common.actions.save")}
            pending={isSaving}
          />
        </Button>
      </DialogFooter>
    </>
  );
}

interface JournalSettingsDialogProps {
  trigger: ReactElement;
}

/** Settings Dialog container styled same as AddSignalAssetDialog/AddJournalAssetDialog */
export function JournalSettingsDialog({ trigger }: JournalSettingsDialogProps) {
  const { t } = useTranslation();
  const { settings, isLoading, update } = useJournalSettings();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSaving) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto border border-border text-foreground"
        showCloseButton={!isSaving}
      >
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
              onClose={() => setOpen(false)}
              update={update}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
