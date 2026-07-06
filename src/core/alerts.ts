/**
 * Pure alert derivation for the auto-journal cron. Turns the decision core's
 * plan (new emissions + closures) into event alerts and a single in-character
 * "RabaLaba Sensei" Discord broadcast (new signals + TP/SL/reversal outcomes).
 *
 * PURE: no fetch, no DB, no Date — the edge function does the actual HTTP POST.
 * Bundled into the edge engine so the app and cron share one source.
 */
import type { AutoJournalPlan } from "./auto-journal-core";

export interface JournalAlert {
  kind: "new_long" | "new_short" | "tp_hit" | "sl_hit" | "reversed";
  symbol: string;
  grade?: string | null;
  /** Entry price for a new signal. */
  entry?: number;
  /** TP target prices (TP1..TP3) for a new signal. */
  takeProfits?: number[];
  /** Stop-loss price for a new signal. */
  stopLoss?: number;
  /** Close price for an outcome (TP/SL/reversal). */
  price?: number | null;
  /** TP milestone (1/2/3) for a tp_hit — INCLUDING a secured-TP reversal, which
   *  is now reported AS its TP. A bare `reversed` outcome is always a no-TP flip
   *  (tpLevel 0). */
  tpLevel?: number;
  /** Total TP levels the plan had. Retained for back-compat; the reversal label
   *  no longer prints it. */
  tpTotal?: number;
  /** Realized P&L % for an outcome (signed). */
  pnlPct?: number;
  /** Hold time in ms for an outcome (entry → close), for the DURATION line. */
  durationMs?: number;
  signal?: "long" | "short" | null;
}

/**
 * Map an auto-journal plan into discrete alert events. New emissions become
 * new_long / new_short (carrying grade + entry); closures become tp_hit /
 * sl_hit / reversed based on the recorded status.
 */
export function buildAutoJournalAlerts(plan: AutoJournalPlan): JournalAlert[] {
  const alerts: JournalAlert[] = [];

  for (const ins of plan.inserts) {
    alerts.push({
      kind: ins.signal === "short" ? "new_short" : "new_long",
      symbol: ins.symbol,
      grade: ins.grade,
      entry: ins.entry_price,
      takeProfits: ins.take_profits,
      stopLoss: ins.stop_loss,
    });
  }

  for (const c of plan.closures) {
    const base = {
      symbol: c.symbol,
      price: c.close_price,
      pnlPct: c.pnl_pct,
      durationMs: c.duration_ms,
      grade: c.grade,
      signal: c.signal,
    };
    // Mirror the donut/table buckets: a reversal that SECURED a TP folds into
    // that TP outcome (🎯 TP{n}), exactly like a price TP hit; only a NO-TP
    // reversal stays a "reversed" event (🔄), later split into PROFIT / LOSS by
    // realized P&L. A clean stop / TP is a pure sl_hit / tp_hit.
    const securedTp = c.highest_tp_reached ?? 0;
    if (c.reversed && securedTp >= 1) {
      alerts.push({ kind: "tp_hit", ...base, tpLevel: securedTp });
    } else if (c.reversed) {
      alerts.push({ kind: "reversed", ...base, tpLevel: 0, tpTotal: c.tp_total });
    } else if (c.status === "sl") {
      alerts.push({ kind: "sl_hit", ...base });
    } else if (/^tp[123]$/.test(c.status)) {
      alerts.push({
        kind: "tp_hit",
        ...base,
        tpLevel: Number(c.status.slice(2)),
      });
    } else {
      alerts.push({ kind: "reversed", ...base, tpLevel: 0, tpTotal: c.tp_total });
    }
  }

  return alerts;
}

/** Discord `content` is capped at 2000 chars; stay under to avoid 400s.
 *  Exported so every sensei broadcast (alerts, recap, discovery) shares it. */
export const DISCORD_MAX = 1900;

/** Light horizontal rule dividing the message into sections. */
export const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━";

/** Signed P&L like " (+120%)", " (-15%)", " (+0.28%)" — precision scales with
 *  magnitude, trailing zeros dropped. Empty when there's no value. */
function pctSuffix(pct?: number): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  const abs = Math.abs(pct);
  const digits = abs >= 10 ? 0 : abs >= 1 ? 1 : 2;
  const v = abs.toLocaleString("en-US", { maximumFractionDigits: digits });
  return ` \`(${pct >= 0 ? "+" : "-"}${v}%)\``;
}

/** Price tag " @`<num>`" (omitted when there's no price). The layout puts the
 *  backtick flush against the @: "Entry @`65713`". */
function atPrice(price?: number | null): string {
  return price != null ? ` \`@${formatNum(price)}\`` : "";
}

/** Hold time as an uppercase Indonesian span, scoped by the largest unit so the
 *  precision stays proportional to the magnitude:
 *    ≥ 1 day  → "3 HARI 8 JAM"     (days + hours)
 *    ≥ 1 hour → "5 JAM 17 MENIT"   (hours + minutes)
 *    ≥ 1 min  → "42 MENIT"         (minutes only)
 *    < 1 min  → "18 DETIK"         (seconds only)
 *  Empty when there's no duration. Pure arithmetic (no Date) so this module
 *  stays edge-bundle safe. */
function formatDuration(ms?: number): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days} HARI ${hours} JAM`;
  if (hours > 0) return `${hours} JAM ${minutes} MENIT`;
  if (minutes > 0) return `${minutes} MENIT`;
  return `${seconds} DETIK`;
}

/** Outcome label for a NO-TP signal-reversal close — split by realized P&L into
 *  "REVERSED PROFIT" / "REVERSED LOSS" (flat → PROFIT, matching the donut's
 *  r ≥ 0 rule). A reversal that SECURED a TP is reported AS that TP (TP{n}), so
 *  it never reaches this label. */
function reversedResultLabel(pnlPct?: number): string {
  return (pnlPct ?? 0) >= 0 ? "REVERSED PROFIT" : "REVERSED LOSS";
}

/** Direction-aware % of a target price from entry: a TP reads positive and an SL
 *  negative for BOTH longs and shorts (a short profits as price falls). */
function pctFrom(entry: number, target: number, isLong: boolean): number {
  const raw = ((target - entry) / entry) * 100;
  return isLong ? raw : -raw;
}

/**
 * Render alerts into a single Discord message: 🚨 SINYAL (new entries) → 📢
 * HASIL (TP / SL / REVERSED outcomes with realized %), each section split by a
 * divider rule. Each signal/outcome spans two lines (headline + ↳ detail).
 * Returns null when there's nothing to say so the caller can skip POST.
 */
export function formatAlertsForDiscord(alerts: JournalAlert[]): string | null {
  if (alerts.length === 0) return null;

  // New signals: "<emoji> **SYM** • DIR • GRADE" then the Entry / TP1..TP3 / SL
  // ladder, each on its own "↳" line with a direction-aware % from entry.
  const renderSignal = (a: JournalAlert) => {
    const isLong = a.kind === "new_long";
    const emoji = isLong ? "🟢" : "🔴";
    const dir = isLong ? "LONG" : "SHORT";
    const head = [`**${a.symbol}**`, dir];
    if (a.grade) head.push(a.grade);
    const lines = [`${emoji} ${head.join(" • ")}`];
    if (a.entry != null) lines.push(`↳ ENTRY:${atPrice(a.entry)}`);
    (a.takeProfits ?? []).forEach((tp, i) => {
      const pnl = a.entry != null ? pctFrom(a.entry, tp, isLong) : undefined;
      lines.push(`↳ TP${i + 1}:${atPrice(tp)}${pctSuffix(pnl)}`);
    });
    if (a.stopLoss != null && a.entry != null) {
      const pnl = pctFrom(a.entry, a.stopLoss, isLong);
      lines.push(`↳ SL:${atPrice(a.stopLoss)}${pctSuffix(pnl)}`);
    }
    return lines.join("\n");
  };
  // LONG first, then SHORT — blocks separated by a blank line.
  const signalBody = [
    ...alerts.filter((a) => a.kind === "new_long"),
    ...alerts.filter((a) => a.kind === "new_short"),
  ]
    .map(renderSignal)
    .join("\n\n");

  // Outcomes: "<emoji> **SYM** • DIR • GRADE" then "↳ <result> @ `price` (±%)".
  const renderOutcome = (emoji: string, a: JournalAlert, result: string) => {
    const head = [`**${a.symbol}**`];
    if (a.signal) head.push(a.signal.toUpperCase());
    if (a.grade) head.push(a.grade);
    const lines = [
      `${emoji} ${head.join(" • ")}`,
      `↳ ${result}:${atPrice(a.price)}${pctSuffix(a.pnlPct)}`,
    ];
    const duration = formatDuration(a.durationMs);
    if (duration) lines.push(`↳ DURATION: \`${duration}\``);
    return lines.join("\n");
  };

  // TP, then SL, then REVERSED — blocks separated by a blank line.
  const outcomeBody = [
    ...alerts
      .filter((a) => a.kind === "tp_hit")
      .map((a) => renderOutcome("🎯", a, `TP${a.tpLevel ?? ""}`)),
    ...alerts
      .filter((a) => a.kind === "sl_hit")
      .map((a) => renderOutcome("⛔", a, "SL")),
    ...alerts
      .filter((a) => a.kind === "reversed")
      .map((a) => renderOutcome("🔄", a, reversedResultLabel(a.pnlPct))),
  ].join("\n\n");

  const sections: string[] = [];
  if (signalBody) sections.push("🚨 SINYAL:\n\n" + signalBody);
  if (outcomeBody) sections.push("📢 HASIL:\n\n" + outcomeBody);

  let msg = sections.join(`\n\n${DIVIDER}\n\n`);
  if (msg.length > DISCORD_MAX) {
    msg = msg.slice(0, DISCORD_MAX - 20) + "\n… (truncated)";
  }
  return msg;
}

/** One closed trade in the end-of-day recap (realized, direction-aware %). */
export interface DailySummaryClosed {
  symbol: string;
  signal?: "long" | "short" | null;
  grade?: string | null;
  /** tp1 | tp2 | tp3 | sl | reversed */
  status: string;
  /** Closed by a SIGNAL REVERSAL (vs a price TP/SL hit). A secured-TP reversal
   *  has status `tp{n}` AND reversed=true, so this flag — not status — is what
   *  marks it in the recap. */
  reversed?: boolean;
  /** TP level secured (highest_tp_reached) + plan's TP total. A secured-TP
   *  reversal is reported AS that TP (TP{n}); tpTotal is kept for back-compat. */
  tpReached?: number;
  tpTotal?: number;
  pnlPct: number;
  durationMs?: number;
}

/** A signal opened today. */
export interface DailySummaryEmitted {
  symbol: string;
  signal?: "long" | "short" | null;
  grade?: string | null;
}

/** A still-open position; `floatingPct` is omitted when no live price was had. */
export interface DailySummaryOpen {
  symbol: string;
  signal?: "long" | "short" | null;
  grade?: string | null;
  floatingPct?: number;
}

/** The fully-prepared payload for the daily recap. The caller (edge function)
 *  builds this from the DB + live prices; this module stays PURE (no Date —
 *  `dateLabel` is pre-formatted by the caller). */
export interface DailySummaryInput {
  /** WIB date label, pre-formatted by the caller, e.g. "29 Jun 2026". */
  dateLabel: string;
  closed: DailySummaryClosed[];
  emitted: DailySummaryEmitted[];
  open: DailySummaryOpen[];
}

/** Inline signed % like "`(+12%)`" (pctSuffix without its leading space). */
function inlinePct(pct?: number): string {
  return pctSuffix(pct).trim();
}

/**
 * Render the END-OF-DAY recap into one compact Discord message: just the 🗓️
 * REKAP scoreboard (total P&L, best/worst, counts, win-rate). The per-trade /
 * per-signal / per-open listings were intentionally dropped — the scoreboard
 * IS the recap. Returns null only when the day was completely empty (nothing
 * closed, emitted, or open) so the caller can skip the POST. PURE (no
 * fetch/DB/Date).
 */
export function formatDailySummaryForDiscord(
  input: DailySummaryInput,
): string | null {
  const { dateLabel, closed, emitted, open } = input;
  if (closed.length === 0 && emitted.length === 0 && open.length === 0) {
    return null;
  }

  const wins = closed.filter((c) => c.pnlPct > 0).length;
  const losses = closed.filter((c) => c.pnlPct < 0).length;
  const winRate =
    closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
  const totalPct = closed.reduce((s, c) => s + (c.pnlPct ?? 0), 0);
  const ranked = [...closed].sort((a, b) => b.pnlPct - a.pnlPct);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  // 🗓️ REKAP — the at-a-glance scoreboard (the whole recap). Total/best/worst &
  // win-rate only appear when something actually closed; the counts always do.
  const recap = [`🗓️ REKAP ${dateLabel}`, ""];
  if (closed.length > 0) {
    recap.push(`💰 TOTAL: ${inlinePct(totalPct)}`);
    recap.push(`👑 TERBAIK: **${best.symbol}** ${inlinePct(best.pnlPct)}`);
    recap.push(`🥀 TERBURUK: **${worst.symbol}** ${inlinePct(worst.pnlPct)}`);
  }
  recap.push(`🚨 SINYAL BARU: \`${emitted.length}\``);
  recap.push(`⏳ MASIH TERBUKA: \`${open.length}\``);
  recap.push(`🏁 SUDAH DITUTUP: \`${closed.length}\``);
  if (closed.length > 0) {
    recap.push(
      `🥇 RASIO LABA RUGI: \`${winRate}%\` \`(${wins} Laba / ${losses} Rugi)\``,
    );
  }

  let msg = recap.join("\n");
  if (msg.length > DISCORD_MAX) {
    msg = msg.slice(0, DISCORD_MAX - 20) + "\n… (truncated)";
  }
  return msg;
}

/**
 * Price formatting for the alert lines. Shows prices "as-is" without dropping
 * trailing-zero decimals: whole numbers stay clean (65713), prices ≥ 1 keep a
 * fixed 2 decimals (145.20, 28.40), and sub-1 alts scale to enough significant
 * decimals (0.006467) without padding extra zeros. No thousands separators —
 * they read awkwardly inside the inline-code spans.
 */
function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";

  let formatted: string;
  if (Number.isInteger(n)) {
    formatted = n.toLocaleString("en-US", { useGrouping: true });
  } else {
    const abs = Math.abs(n);
    if (abs >= 1) {
      formatted = n.toLocaleString("en-US", {
        useGrouping: true,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      // Sub-1: enough decimals to stay meaningful, trailing zeros NOT padded.
      const leadingZeros = Math.max(0, -Math.floor(Math.log10(abs)) - 1);
      formatted = n.toLocaleString("en-US", {
        useGrouping: true,
        maximumFractionDigits: Math.min(10, leadingZeros + 4),
      });
    }
  }
  return formatted.replace(/,/g, ".");
}
