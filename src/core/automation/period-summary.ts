/**
 * Pure WIB calendar-window math for the Discord recaps (daily / weekly /
 * monthly). The daily-summary edge function ticks hourly and asks, for each
 * enabled recap kind: "which period does this tick's reference moment fall in,
 * and is today that period's SEND day?" — weeks start MONDAY, months are WIB
 * calendar months, and the send day is the period's LAST WIB day, so with
 * send-hour 0 the recap fires right after the period completes (Monday 00:00
 * recaps the full previous week; the 1st at 00:00 recaps the full previous
 * month), mirroring how hour 0 already works for the daily recap.
 *
 * PURE: no Date.now, no Intl — fully unit-testable; the edge function wires
 * clock + queries + formatting around it.
 */

/** Indonesia (WIB) is a fixed UTC+7 with no DST — a constant offset is exact. */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RecapPeriod = "daily" | "weekly" | "monthly";

export interface RecapWindow {
  /** Period start as a UTC instant (WIB midnight), inclusive. */
  startMs: number;
  /** Period end as a UTC instant (WIB midnight), exclusive. */
  endMs: number;
  /** True when `refMs` falls on the period's LAST WIB day — the send day. */
  isSendDay: boolean;
}

/**
 * The WIB calendar window (day / Monday-start week / month) containing
 * `refMs`. Callers pass an already back-dated reference (now − a few minutes)
 * so an hour-0 send resolves to the period that JUST ended, exactly like the
 * daily recap's existing report-day math.
 */
export function recapWindow(period: RecapPeriod, refMs: number): RecapWindow {
  const wib = new Date(refMs + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const day = wib.getUTCDate();
  const dayStartMs = Date.UTC(y, m, day) - WIB_OFFSET_MS;

  if (period === "daily") {
    return { startMs: dayStartMs, endMs: dayStartMs + DAY_MS, isSendDay: true };
  }

  if (period === "weekly") {
    // getUTCDay(): 0=Sun..6=Sat → re-key to 0=Mon..6=Sun.
    const dowMon = (wib.getUTCDay() + 6) % 7;
    const startMs = Date.UTC(y, m, day - dowMon) - WIB_OFFSET_MS;
    return {
      startMs,
      endMs: startMs + 7 * DAY_MS,
      isSendDay: dowMon === 6, // Sunday closes the week
    };
  }

  // monthly — Date.UTC(y, m+1, 1) rolls the year over by itself.
  const startMs = Date.UTC(y, m, 1) - WIB_OFFSET_MS;
  const endMs = Date.UTC(y, m + 1, 1) - WIB_OFFSET_MS;
  return {
    startMs,
    endMs,
    isSendDay: dayStartMs + DAY_MS === endMs, // ref sits on the month's last day
  };
}
