/**
 * Per-indicator categorical readouts shown in the asset detail dialog. These
 * mirror the inline string unions the engine emits on `Outlook.indicators`; the
 * value lists here are the display-side source. The status→color map
 * (INDICATOR_STATUS_COLORS) lives in ./colors so this stays pure data.
 */

/** OBV slope. */
export const OBV_TRENDS = ["rising", "falling", "flat"] as const;
export type ObvTrend = (typeof OBV_TRENDS)[number];

/** RSI divergence read. */
export const RSI_DIVERGENCES = ["bullish", "bearish", "none"] as const;
export type RsiDivergence = (typeof RSI_DIVERGENCES)[number];

/** Generic indicator status used by the IndicatorItem row. */
export const INDICATOR_STATUSES = [
  "bullish",
  "bearish",
  "overbought",
  "oversold",
  "normal",
] as const;
export type IndicatorStatus = (typeof INDICATOR_STATUSES)[number];

/** Relative-strength label vs the benchmark (display-only). */
export const RELATIVE_STRENGTH_LABELS = [
  "outperform",
  "underperform",
  "inline",
] as const;
export type RelativeStrengthLabel = (typeof RELATIVE_STRENGTH_LABELS)[number];

/** Accumulation/distribution engine labels (English, emitted by the engine) →
 *  i18n keys (dialog.acc_label_*). Centralized so the engine's label strings and
 *  the UI's translation keys share one table. */
export const ACCUMULATION_LABEL_KEYS: Record<string, string> = {
  "Strong accumulation": "dialog.acc_label_strong_accumulation",
  Accumulation: "dialog.acc_label_accumulation",
  "Neutral flow": "dialog.acc_label_neutral",
  Distribution: "dialog.acc_label_distribution",
  "Strong distribution": "dialog.acc_label_strong_distribution",
};
