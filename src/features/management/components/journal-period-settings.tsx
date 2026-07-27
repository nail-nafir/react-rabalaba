import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
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
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { resolveJournalPeriod } from "@/features/journal/lib/journal-period";
import type {
  JournalPeriodMonths,
  JournalSettingsRow,
} from "@/services/supabase/database.types";
import { formatAgo, getTimeBadgeClassName } from "../lib/admin-utils";
import { ManualActionCard } from "./manual-action-card";
import { SettingRow } from "./setting-row";
import { SettingSelect } from "./setting-select";

const PERIOD_MONTH_OPTIONS: JournalPeriodMonths[] = [1, 3, 6, 12];

interface JournalPeriodSettingsProps {
  settings: JournalSettingsRow;
  months: JournalPeriodMonths;
  onMonthsChange: (months: JournalPeriodMonths) => void;
  hasChanges: boolean;
  isSaving: boolean;
  startNewPeriod: () => Promise<string | null>;
}

export function JournalPeriodSettings({
  settings,
  months,
  onMonthsChange,
  hasChanges,
  isSaving,
  startNewPeriod,
}: JournalPeriodSettingsProps) {
  const { t, i18n } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const bounds = resolveJournalPeriod(
    months,
    settings.journal_period_reset_at ?? null,
    nowMs,
  );
  const rangeSeparator = i18n.language.startsWith("id") ? "s.d." : "to";

  const formatWibNumeric = (ms: number) => {
    const parts = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(ms);
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const year = parts.find((p) => p.type === "year")?.value ?? "2026";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${day}-${month}-${year}, ${hour}:${minute}`;
  };

  const resetDisabled = hasChanges || isSaving || isResetting;
  const lastReset = formatAgo(settings.journal_period_reset_at, nowMs);

  const resetPeriod = async (): Promise<boolean> => {
    try {
      const resetAt = await startNewPeriod();
      setNowMs(resetAt ? Date.parse(resetAt) : Date.now());
      toast.success(t("toasts.journal_period.reset_success"));
      return true;
    } catch {
      toast.error(t("toasts.journal_period.reset_error"));
      return false;
    }
  };

  const handleResetAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isResetting) return;
    setIsResetting(true);
    try {
      if (await resetPeriod()) setConfirmOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
      <div className="flex flex-col gap-1 divide-y divide-border/60">
        <SettingRow
          title={t("admin.period_duration_title")}
          desc={t("admin.period_duration_desc")}
        >
          <SettingSelect
            value={months}
            options={PERIOD_MONTH_OPTIONS}
            onChange={(value) => onMonthsChange(value as JournalPeriodMonths)}
            renderLabel={(value) =>
              t("admin.period_duration_months", { count: value })
            }
          />
        </SettingRow>

        <SettingRow
          title={t("admin.period_current_range")}
          desc={t("admin.period_current_range_desc")}
        >
          <div className="text-right text-xs font-semibold tabular-nums text-foreground">
            <span>{formatWibNumeric(bounds.startMs!)}</span>
            <span className="mx-1.5 font-normal text-muted-foreground/70">{rangeSeparator}</span>
            <span>{formatWibNumeric(bounds.endMs!)}</span>
            <span className="ml-1 text-[10px] font-medium text-muted-foreground/70">WIB</span>
          </div>
        </SettingRow>

        <SettingRow
          title={t("admin.period_next_rollover")}
          desc={t("admin.period_next_rollover_desc")}
        >
          <div className="text-right text-xs font-semibold tabular-nums text-foreground">
            <span>{formatWibNumeric(bounds.nextRolloverMs!)}</span>
            <span className="ml-1 text-[10px] font-medium text-muted-foreground/70">WIB</span>
          </div>
        </SettingRow>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isResetting) setConfirmOpen(open);
        }}
      >
        <ManualActionCard
          title={t("admin.period_reset_title")}
          desc={t("admin.period_reset_desc")}
          icon={<RotateCcw data-icon="inline-start" />}
          buttonLabel={t("admin.period_reset_button")}
          loadingLabel={t("admin.period_reset_loading")}
          onRun={() => setConfirmOpen(true)}
          running={isResetting}
          disabled={resetDisabled}
          disabledHint={
            hasChanges ? t("admin.period_reset_unsaved_hint") : undefined
          }
          lastRunTitle={t("admin.period_last_reset_title")}
          lastRunValue={lastReset ?? t("admin.period_never_reset")}
          badgeClassName={getTimeBadgeClassName(
            Boolean(settings.journal_period_reset_at),
          )}
          requiresConfirmation
        />

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <RotateCcw aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t("admin.period_reset_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.period_reset_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isResetting}
              aria-busy={isResetting}
              onClick={handleResetAction}
            >
              <ActionButtonContent
                label={t("common.actions.confirm")}
                pending={isResetting}
              />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
