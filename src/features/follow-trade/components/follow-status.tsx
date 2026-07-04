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
  total: number;
  /** Stopped out (no TP secured). */
  slHit?: boolean;
  /** Exited on a signal reversal — appends a "· Reversed" marker to the TP. */
  reversed?: boolean;
  /** For a NO-TP reversal close, whether it realized a profit or loss — colors
   *  the standalone REVERSED marker green/red to match the donut's Reversal
   *  Profit / Loss slices. Omit for the neutral (uncolored) marker. */
  reversedPnl?: "profit" | "loss";
  size?: "xs" | "sm";
  className?: string;
  isClosed?: boolean;
  variant?: "text" | "badge";
}

export function TpProgress({
  reached,
  total,
  slHit = false,
  reversed = false,
  reversedPnl,
  size = "xs",
  className,
  isClosed = false,
  variant = "text",
}: TpProgressProps) {
  if (total === 0 && !slHit) {
    if (variant === "badge") return null;
    return (
      <span className="text-xs text-mono-data text-muted-foreground">—</span>
    );
  }

  if (variant === "badge") {
    // Closed reversal with no TP secured (status `reversed`): the outcome badge
    // is empty here — the separate <ReversedBadge> beside it carries the marker,
    // so render nothing to avoid a duplicate "Reversed" pill.
    if (!slHit && reached === 0 && isClosed) return null;
    let colorCls: string;
    let content: string;
    if (slHit) {
      colorCls = cn(
        PALETTE.negative.bg,
        PALETTE.negative.text,
        PALETTE.negative.border,
      );
      content = "SL";
    } else if (reached > 0) {
      // Keep the TP badge clean — the reversal is shown as its OWN badge.
      colorCls = cn(
        PALETTE.positive.bg,
        PALETTE.positive.text,
        PALETTE.positive.border,
      );
      content = `TP ${reached}/${total}`;
    } else {
      colorCls = cn(
        PALETTE.neutral.bg,
        PALETTE.neutral.text,
        PALETTE.neutral.border,
      );
      content = `TP 0/${total}`;
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
          "font-semibold text-mono-data uppercase tracking-wider flex items-baseline gap-1",
          labelCls,
          className,
        )}
      >
        <span className={PALETTE.positive.textStrong}>
          TP {reached}/{total}
        </span>
        {reversed && (
          <>
            <span className="text-muted-foreground">·</span>
            {/* Match the R/risk value above it (emerald) so the TP-secured row
                reads as one uniform-toned line. The standalone no-TP REVERSED
                below stays neutral/white. */}
            <span className="text-emerald-600/70 dark:text-emerald-400/70">
              REVERSED
            </span>
          </>
        )}
      </span>
    );
  }

  // No-TP reversal close → REVERSED, tinted green/red by its realized P/L so it
  // reads as the donut's Reversal Profit / Loss. Open & still flat → muted.
  const reversedTone =
    reversedPnl === "profit"
      ? PALETTE.positive.textStrong
      : reversedPnl === "loss"
        ? PALETTE.negative.textStrong
        : "text-muted-foreground/60";
  return (
    <span
      className={cn(
        "font-semibold text-mono-data uppercase tracking-wider",
        isClosed ? reversedTone : "text-foreground",
        labelCls,
        className,
      )}
    >
      {isClosed ? "REVERSED" : `TP 0/${total}`}
    </span>
  );
}

/**
 * Standalone "Reversed" pill — shown NEXT TO the TP/SL outcome badge (not merged)
 * so a reversal-after-TP reads as two distinct facts: it secured a TP *and* it
 * exited on the flip. Neutral-toned to mirror the no-TP reversed-close color.
 */
export function ReversedBadge({
  reversedPnl,
  className,
}: {
  /** Tints the pill green/red by the reversal's realized P/L, mirroring the
   *  donut's Reversal Profit / Loss. Omit for the neutral pill. */
  reversedPnl?: "profit" | "loss";
  className?: string;
}) {
  const tone =
    reversedPnl === "profit"
      ? PALETTE.positive
      : reversedPnl === "loss"
        ? PALETTE.negative
        : PALETTE.neutral;
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
        tone.bg,
        tone.text,
        tone.border,
        className,
      )}
    >
      REVERSED
    </Badge>
  );
}
