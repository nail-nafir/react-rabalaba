import type { TFunction } from "i18next";
import type { ExitReason } from "@/constants/taxonomy/status";

export function tradeOutcomeLabel(
  t: TFunction,
  exitReason: ExitReason | undefined,
  secured: number,
  total: number,
  pnlTone: "profit" | "loss" | "flat",
): string {
  const tpLabel = () => t("journal.tp_progress", { reached: secured, total });
  switch (exitReason) {
    case "initial_stop":
      return t("journal.outcome_initial_stop");
    case "breakeven_stop":
    case "progressive_stop":
      if (pnlTone === "loss") return t("journal.outcome_initial_stop");
      if (pnlTone === "flat") return t("journal.outcome_breakeven");
      return tpLabel();
    case "final_take_profit":
      return tpLabel();
    case "reversal":
      return t("journal.outcome_reversal");
    default:
      return t("journal.outcome_closed");
  }
}

/** Close-marker pill: how the last part of the position left, so a v7
 *  "TP 2/3" trade stopped at TP1 reads "SL TP1" on the TP1 line instead of a
 *  bare "CLOSED". The stop follows `activeStopFor`: entry after TP1, then the
 *  previous TP. */
export function closeMarkerLabel(
  t: TFunction,
  exitReason: ExitReason | undefined,
  reached: number,
): string {
  switch (exitReason) {
    case "initial_stop":
      return t("journal.close_marker_sl");
    case "breakeven_stop":
    case "progressive_stop":
      return t("journal.close_marker_sl_at", {
        level: reached >= 2 ? `TP${reached - 1}` : t("journal.entry_marker"),
      });
    case "final_take_profit":
      return t("journal.close_marker_tp", { level: reached });
    case "reversal":
      return t("journal.close_marker_reversal");
    default:
      return t("journal.close_marker");
  }
}
