import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/constants";
import type { ExitReason } from "@/core/trade/follow-trade-model";
import { tradeOutcomeLabel } from "@/features/follow-trade/model/follow-outcome";

/**
 * Status visuals for a followed trade, kept deliberately SEPARATE so the two
 * orthogonal dimensions never get conflated:
 *  - `LifecycleBadge` — is the position RUNNING or CLOSED (server truth)
 *  - `TpProgress`     — running protection or closed outcome + journey
 * Plain DOM (no recharts) keeps large tables cheap and identity-stable.
 */

export function LifecycleBadge({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit gap-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
        open
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
          : cn(
              PALETTE.neutral.bg,
              PALETTE.neutral.border,
              PALETTE.neutral.text,
            ),
        className,
      )}
    >
      {open ? t("journal.lifecycle_open") : t("journal.lifecycle_closed")}
    </Badge>
  );
}

interface TpProgressProps {
  /** TP levels touched (0..total). */
  reached: number;
  /** TP levels secured by the realized close price. */
  secured: number;
  total: number;
  exitReason?: ExitReason;
  pnlTone?: "profit" | "loss" | "flat";
  size?: "xs" | "sm";
  className?: string;
  isClosed?: boolean;
  variant?: "text" | "badge";
  showJourney?: boolean;
}

export function TpProgress({
  reached,
  secured,
  total,
  exitReason,
  pnlTone = "flat",
  size = "xs",
  className,
  isClosed = false,
  variant = "text",
  showJourney = false,
}: TpProgressProps) {
  const { t } = useTranslation();

  if (total === 0 && !isClosed) {
    if (variant === "badge") return null;
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  if (variant === "badge") {
    const tone =
      pnlTone === "profit"
        ? PALETTE.positive
        : pnlTone === "loss"
          ? PALETTE.negative
          : PALETTE.neutral;
    const badgeClass =
      "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider";
    if (!isClosed) {
      const progressTone = reached > 0 ? PALETTE.positive : PALETTE.neutral;
      return (
        <Badge
          variant="outline"
          className={cn(
            badgeClass,
            progressTone.bg,
            progressTone.text,
            progressTone.border,
            className,
          )}
        >
          {t("journal.tp_progress", { reached, total })}
        </Badge>
      );
    }

    const hasJourney =
      showJourney && reached > 0 && exitReason !== "final_take_profit";
    return (
      <>
        <Badge
          variant="outline"
          className={cn(
            badgeClass,
            tone.bg,
            tone.text,
            tone.border,
            className,
          )}
        >
          {tradeOutcomeLabel(t, exitReason, secured, total, pnlTone)}
        </Badge>
        {hasJourney && (
          <Badge
            variant="outline"
            className={cn(
              badgeClass,
              PALETTE.neutral.bg,
              PALETTE.neutral.text,
              PALETTE.neutral.border,
              className,
            )}
          >
            {t("journal.reached_tp", { level: reached })}
          </Badge>
        )}
      </>
    );
  }

  const labelCls = size === "sm" ? "text-[11px]" : "text-xs";
  if (!isClosed) {
    return (
      <span
        className={cn(
          "text-muted-foreground flex items-baseline gap-1",
          labelCls,
          className,
        )}
      >
        <span>{t("journal.tp_progress", { reached, total })}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-muted-foreground flex items-baseline gap-1",
        labelCls,
        className,
      )}
    >
      <span>{tradeOutcomeLabel(t, exitReason, secured, total, pnlTone)}</span>
    </span>
  );
}
