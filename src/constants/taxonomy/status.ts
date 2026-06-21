/**
 * Followed-trade status taxonomy. Two orthogonal dimensions the UI shows:
 * LIFECYCLE (open/closed — server truth) and OUTCOME (which terminal level was
 * hit). PURE value arrays + types + label keys — the auto-journal edge bundle
 * imports these, so the badge colors deliberately live in ./colors instead.
 */

/** Outcome status: `open` while live, the rest terminal. `reversed` = closed by
 *  a signal reversal with NO TP secured (a reversal that DID secure a TP keeps
 *  its tp{n} status + the `reversed` flag). */
export const FOLLOW_STATUSES = [
  "open",
  "tp1",
  "tp2",
  "tp3",
  "sl",
  "reversed",
] as const;
export type FollowStatus = (typeof FOLLOW_STATUSES)[number];

/** Position lifecycle — open vs done. */
export const LIFECYCLE_STATUSES = ["open", "closed"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/** Followable directions (you cannot follow a neutral signal). */
export const FOLLOW_SIGNALS = ["long", "short"] as const;
export type FollowSignal = (typeof FOLLOW_SIGNALS)[number];

/** UI PnL filter — `tp` aggregates tp1-3 and `reversed` matches any reversal
 *  close (no-TP reversal OR a reversal-after-TP), so both are their own grouping
 *  rather than a slice of FOLLOW_STATUSES. */
export const PNL_FILTERS = ["all", "tp", "sl", "reversed"] as const;
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
  reversed: "journal.status_reversed",
};
