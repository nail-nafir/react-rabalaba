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
