/**
 * Signal direction — the actionable lean of a setup. `neutral` = no trade.
 * Value list is the source of truth; the badge colors live in ./colors
 * (SIGNAL_COLORS) so this stays pure data and is safe for the edge bundle.
 */
export const SIGNAL_DIRECTIONS = ["long", "short", "neutral"] as const;
export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

/** i18n keys for the direction label (en.json/id.json common.signals.*). */
export const SIGNAL_LABEL_KEYS: Record<SignalDirection, string> = {
  long: "common.signals.long",
  short: "common.signals.short",
  neutral: "common.signals.neutral",
};

/** Screener signal filter: "all" + the three directions, derived from the
 *  value list. `labelKey` is resolved with `t()` at the call site. */
export const SIGNAL_FILTER_OPTIONS = [
  { value: "all" as const, labelKey: "common.signals.all" },
  ...SIGNAL_DIRECTIONS.map((value) => ({
    value,
    labelKey: SIGNAL_LABEL_KEYS[value],
  })),
];
