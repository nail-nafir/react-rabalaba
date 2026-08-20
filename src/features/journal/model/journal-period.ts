import type { JournalPeriodMonths } from "@/services/supabase/database.types";

export type JournalScope = "active" | "history";

export interface JournalPeriodBounds {
  /** Inclusive realized-trade boundary; null means all recorded history. */
  startMs: number | null;
  /** Exclusive calendar boundary; null means no automatic rollover. */
  endMs: number | null;
  /** Same as endMs for scheduled modes; exposed for timer/status copy. */
  nextRolloverMs: number | null;
}

const validResetMs = (resetAt: string | null, nowMs: number) => {
  if (!resetAt) return null;
  const parsed = Date.parse(resetAt);
  return Number.isFinite(parsed) && parsed <= nowMs ? parsed : null;
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1_000;

function calendarWindow(months: JournalPeriodMonths, nowMs: number) {
  const wib = new Date(nowMs + WIB_OFFSET_MS);
  const year = wib.getUTCFullYear();
  const startMonth = Math.floor(wib.getUTCMonth() / months) * months;
  return {
    startMs: Date.UTC(year, startMonth, 1) - WIB_OFFSET_MS,
    endMs: Date.UTC(year, startMonth + months, 1) - WIB_OFFSET_MS,
  };
}

/**
 * Resolve the authoritative active reporting window.
 *
 * Periods are fixed 1/3/6/12-month WIB calendar blocks. A manual reset inside
 * the current block temporarily overrides its start; its next boundary
 * naturally supersedes the reset.
 */
export function resolveJournalPeriod(
  months: JournalPeriodMonths,
  resetAt: string | null,
  nowMs: number,
): JournalPeriodBounds {
  const resetMs = validResetMs(resetAt, nowMs);
  const window = calendarWindow(months, nowMs);
  const resetInsideWindow =
    resetMs !== null && resetMs >= window.startMs && resetMs < window.endMs;

  return {
    startMs: resetInsideWindow ? resetMs : window.startMs,
    endMs: window.endMs,
    nextRolloverMs: window.endMs,
  };
}

/** Realized rows use an inclusive start and exclusive end. */
export function isClosedTradeInPeriod(
  closedAtMs: number,
  bounds: JournalPeriodBounds,
) {
  if (bounds.startMs !== null && closedAtMs < bounds.startMs) return false;
  if (bounds.endMs !== null && closedAtMs >= bounds.endMs) return false;
  return true;
}
