import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/constants";

/**
 * Status visuals for a followed trade, kept deliberately SEPARATE so the two
 * orthogonal dimensions never get conflated:
 *  - `LifecycleBadge` — is the position RUNNING or CLOSED (server truth)
 *  - `TpProgress`     — how far OUTCOME got: TP pips touched (+ SL if stopped)
 * A trade can be running yet already have touched TP2; a closed trade can be a
 * stop-out. Both are shown for open and closed rows alike. Plain DOM (no
 * recharts) → cheap + identity-stable in big tables.
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
          : cn(PALETTE.neutral.bg, PALETTE.neutral.border, PALETTE.neutral.text),
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
  total: number;
  /** Stopped out (no TP secured). */
  slHit?: boolean;
  size?: "xs" | "sm";
  className?: string;
  isClosed?: boolean;
  variant?: "text" | "badge";
}

export function TpProgress({
  reached,
  total,
  slHit = false,
  size = "xs",
  className,
  isClosed = false,
  variant = "text",
}: TpProgressProps) {
  const { t } = useTranslation();
  if (total === 0 && !slHit) {
    if (variant === "badge") return null;
    return (
      <span className="text-xs text-mono-data text-muted-foreground">—</span>
    );
  }

  if (variant === "badge") {
    let colorCls: string;
    let content: string;
    if (slHit) {
      colorCls = cn(PALETTE.negative.bg, PALETTE.negative.text, PALETTE.negative.border);
      content = "SL";
    } else if (reached > 0) {
      colorCls = cn(PALETTE.positive.bg, PALETTE.positive.text, PALETTE.positive.border);
      content = `TP ${reached}/${total}`;
    } else {
      colorCls = cn(PALETTE.neutral.bg, PALETTE.neutral.text, PALETTE.neutral.border);
      content = isClosed ? t("journal.status_manual") : `TP 0/${total}`;
    }

    return (
      <Badge
        variant="outline"
        className={cn(
          "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
          colorCls,
          className,
        )}
      >
        {content}
      </Badge>
    );
  }

  const labelCls = size === "sm" ? "text-[11px]" : "text-[10px]";

  if (slHit) {
    return (
      <span
        className={cn(
          PALETTE.negative.textStrong,
          "font-semibold text-mono-data uppercase tracking-wider",
          labelCls,
          className,
        )}
      >
        SL
      </span>
    );
  }

  if (reached > 0) {
    return (
      <span
        className={cn(
          PALETTE.positive.textStrong,
          "font-semibold text-mono-data uppercase tracking-wider",
          labelCls,
          className,
        )}
      >
        TP {reached}/{total}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-muted-foreground/60 font-semibold text-mono-data uppercase tracking-wider",
        labelCls,
        className,
      )}
    >
      {isClosed ? t("journal.status_manual") : `TP 0/${total}`}
    </span>
  );
}
