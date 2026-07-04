import { MAX_CANDLES } from "@/features/trading-plan/lib/trade-setup-model";
import {
  resampleCandles,
  type NormalizedYahooCandle,
} from "@/services/adapters/yahoo-candles";

/**
 * Fetch window for charting a CLOSED trade over its own period (instead of
 * the rolling "last month" used for live signals).
 *
 * The frame is sized in CANDLES, not wall-clock time: session-bound assets
 * (stocks) produce far fewer intraday candles per calendar day than 24/7
 * crypto, so the fetch grabs a generous calendar window and
 * `fitTradeWindowCandles` then trims it to exactly MAX_CANDLES around the
 * trade — the same frame density as the open-position chart, for any asset.
 *
 * `period1`/`period2`/`focusStart`/`focusEnd` are epoch SECONDS (Yahoo
 * convention).
 */
export interface TradeChartWindow {
  period1: number;
  period2: number;
  fetchInterval: string;
  /** Trade bounds the trimmed frame is centered on. */
  focusStart: number;
  focusEnd: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Calendar padding per side that guarantees ≥ MAX_CANDLES even for assets
 *  trading ~5-6 hourly candles a day (21d ≈ 15 sessions ≈ 90+ candles/side). */
const PAD_1H_MS = 21 * DAY_MS;
/** Same guarantee for daily bars (90d ≈ 60+ sessions per side). */
const PAD_1D_MS = 90 * DAY_MS;

/**
 * Compute the fetch window for a closed trade: from a padded lead-in before
 * entry all the way to NOW — one continuous series, so panning right from the
 * trade era reaches the current market (there is no separate "current" mode).
 * 1h bars unless the window start is beyond Yahoo's ~730-day intraday reach
 * (checked with a buffer) — then daily bars. Pure; `now` is injectable. The
 * end is rounded down to the hour so the react-query key stays stable across
 * re-opens within the same hour.
 */
export function computeTradeChartWindow(
  followedAt: number,
  closedAt: number,
  now = Date.now(),
): TradeChartWindow {
  const durationMs = Math.max(closedAt - followedAt, HOUR_MS);
  // Daily bars only when 1h can't reach back far enough (or the duration is
  // absurd — zombie-trade guard, keeps the payload sane).
  const useDaily =
    durationMs > 180 * DAY_MS ||
    now - (followedAt - PAD_1H_MS) > 700 * DAY_MS;
  const padMs = useDaily ? PAD_1D_MS : PAD_1H_MS;

  const startMs = followedAt - padMs;
  const endMs = Math.floor(now / HOUR_MS) * HOUR_MS;

  const period1 = Math.floor(startMs / 1000);
  return {
    period1,
    // Never let the now-clamp collapse the window below a single day.
    period2: Math.max(Math.ceil(endMs / 1000), period1 + DAY_MS / 1000),
    fetchInterval: useDaily ? "1d" : "1h",
    focusStart: Math.floor(followedAt / 1000),
    focusEnd: Math.floor(closedAt / 1000),
  };
}

/** Index of the candle whose timestamp is closest to `ts` (epoch seconds). */
function nearestIndex(candles: NormalizedYahooCandle[], ts: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const dist = Math.abs(candles[i].timestamp - ts);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Trim fetched candles to the chart frame: exactly MAX_CANDLES (when the data
 * allows) with the trade centered. If the trade alone would overflow ~80% of
 * the frame, candles are bucketed into coarser bars first (Yahoo has no 2h/4h
 * granularity, so this is client-side via resampleCandles). Pure.
 */
export function fitTradeWindowCandles(
  candles: NormalizedYahooCandle[],
  focusStart: number,
  focusEnd: number,
): NormalizedYahooCandle[] {
  if (candles.length === 0) return candles;

  let view = candles;
  let entryIdx = nearestIndex(view, focusStart);
  let closeIdx = nearestIndex(view, focusEnd);

  const span = closeIdx - entryIdx + 1;
  const factor = Math.ceil(span / (MAX_CANDLES * 0.8));
  if (factor > 1) {
    view = resampleCandles(view, factor);
    entryIdx = nearestIndex(view, focusStart);
    closeIdx = nearestIndex(view, focusEnd);
  }

  if (view.length <= MAX_CANDLES) return view;
  const center = (entryIdx + closeIdx) / 2;
  const start = Math.min(
    Math.max(Math.round(center - MAX_CANDLES / 2), 0),
    view.length - MAX_CANDLES,
  );
  return view.slice(start, start + MAX_CANDLES);
}
