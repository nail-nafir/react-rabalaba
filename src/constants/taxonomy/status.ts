/**
 * Followed-trade status taxonomy. Two orthogonal dimensions the UI shows:
 * LIFECYCLE (open/closed — server truth) and OUTCOME (which terminal level was
 * hit). PURE value arrays + types + label keys — the auto-journal edge bundle
 * imports these, so the badge colors deliberately live in ./colors instead.
 */

/** Outcome status: `open` while live, the rest terminal. Exact v4 close cause
 *  lives in `exit_reason`; `reversed` always records a signal-reversal exit. */
export const FOLLOW_STATUSES = [
  "open",
  "tp1",
  "tp2",
  "tp3",
  "sl",
  "reversed",
] as const;
export type FollowStatus = (typeof FOLLOW_STATUSES)[number];

/** Exact terminal event. `status` stays backward-compatible while this field
 *  tells audit/UI/alerts how the position actually ended. */
export const EXIT_REASONS = [
  "initial_stop",
  "breakeven_stop",
  "progressive_stop",
  "final_take_profit",
  "reversal",
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

/** Position lifecycle — open vs done. */
export const LIFECYCLE_STATUSES = ["open", "closed"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/** Followable directions (you cannot follow a neutral signal). */
export const FOLLOW_SIGNALS = ["long", "short"] as const;
export type FollowSignal = (typeof FOLLOW_SIGNALS)[number];

/** UI outcome filter. The table and donut share these exact audit buckets. */
export const PNL_FILTERS = [
  "all",
  "tp",
  "sl",
  "breakeven",
  "reversal_profit",
  "reversal_loss",
] as const;
export type PnlFilter = (typeof PNL_FILTERS)[number];

/** i18n keys (journal.status_*) for the outcome label. */
export const STATUS_LABEL_KEYS: Record<FollowStatus, string> = {
  open: "journal.status_open",
  tp1: "journal.status_tp1",
  tp2: "journal.status_tp2",
  tp3: "journal.status_tp3",
  sl: "journal.status_sl",
  reversed: "journal.status_reversed",
};

/** i18n keys (journal.lifecycle_*). */
export const LIFECYCLE_LABEL_KEYS: Record<LifecycleStatus, string> = {
  open: "journal.lifecycle_open",
  closed: "journal.lifecycle_closed",
};

/** i18n keys for the PnL filter pills. */
export const PNL_FILTER_LABEL_KEYS: Record<PnlFilter, string> = {
  all: "journal.filter_all_pnl",
  tp: "journal.pnl_tp",
  sl: "journal.status_sl",
  breakeven: "journal.breakevens",
  reversal_profit: "journal.outcome_reversed_win",
  reversal_loss: "journal.outcome_reversed_loss",
};
