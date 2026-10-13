/**
 * Pure alert derivation for the auto-journal cron. Turns the decision core's
 * plan (new emissions + TP milestones + closures) into event alerts and a
 * single in-character "RabaLaba Sensei" Discord broadcast (new signals, TP
 * checkpoints, then TP/SL/reversal outcomes).
 *
 * PURE: no fetch, no DB, no Date — the edge function does the actual HTTP POST.
 * Bundled into the edge engine so the app and cron share one source.
 */
import type {
  AutoJournalPlan,
  JournalProgressUpdate,
} from "./auto-journal-core";
import type { ExitReason } from "@/constants/taxonomy/status";
import { SCALE_OUT_FRACTIONS } from "@/constants/signals";

export interface JournalAlert {
  kind:
    | "new_long"
    | "new_short"
    | "tp_checkpoint"
    | "tp_hit"
    | "sl_hit"
    | "protected_stop"
    | "reversed";
  symbol: string;
  grade?: string | null;
  /** Entry price for a new signal or checkpoint. */
  entry?: number;
  /** TP target prices (TP1..TP3) for a new signal or checkpoint. */
  takeProfits?: number[];
  /** Initial stop for a new signal; the raised stop for a checkpoint. */
  stopLoss?: number;
  /** Close price for an outcome (TP/SL/reversal). */
  price?: number | null;
  /** Highest TP milestone touched before the outcome (or reached now, for a
   *  checkpoint). */
  tpLevel?: number;
  /** Milestone stored before a checkpoint; it covers the levels above. */
  fromTpLevel?: number;
  /** Scale-out legs banked (engine-v7+); drives the PARTIAL line. */
  partialLegs?: number;
  /** TP levels secured at the close, by the dashboard badge's rule. */
  securedTpLevel?: number;
  /** Total TP levels the plan had. */
  tpTotal?: number;
  /** Realized P&L % for an outcome (signed). */
  pnlPct?: number;
  /** Hold time in ms for an outcome (entry → close), for the DURATION line. */
  durationMs?: number;
  signal?: "long" | "short" | null;
  exitReason?: ExitReason;
}

/**
 * Map an auto-journal plan into discrete alert events. New emissions become
 * new_long / new_short (carrying grade + entry); applied TP milestones of
 * still-open trades become tp_checkpoint; closures become tp_hit / sl_hit /
 * protected_stop / reversed based on the recorded exit.
 */
export function buildAutoJournalAlerts(
  plan: Pick<AutoJournalPlan, "inserts" | "closures"> & {
    progressUpdates?: JournalProgressUpdate[];
  },
): JournalAlert[] {
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

  // A trade that also closed this run reports once, in its outcome.
  const closedIds = new Set(plan.closures.map((c) => c.id));
  for (const p of plan.progressUpdates ?? []) {
    if (closedIds.has(p.id)) continue;
    alerts.push({
      kind: "tp_checkpoint",
      symbol: p.symbol,
      signal: p.signal,
      grade: p.grade,
      entry: p.entry_price,
      takeProfits: p.take_profits,
      stopLoss: p.stop_loss,
      tpLevel: p.highest_tp_reached,
      fromTpLevel: p.from_tp_reached,
      partialLegs: p.partial_legs,
    });
  }

  for (const c of plan.closures) {
    const reason =
      c.exit_reason ??
      (c.reversed || c.status === "reversed"
        ? "reversal"
        : c.status === "sl"
          ? "initial_stop"
          : "final_take_profit");
    const base = {
      symbol: c.symbol,
      price: c.close_price,
      pnlPct: c.pnl_pct,
      durationMs: c.duration_ms,
      grade: c.grade,
      signal: c.signal,
      exitReason: reason,
      tpLevel: c.highest_tp_reached ?? 0,
      securedTpLevel: c.secured_tp_level,
      tpTotal: c.tp_total,
      partialLegs: c.partial_legs,
    };
    if (reason === "reversal") {
      alerts.push({ kind: "reversed", ...base });
    } else if (reason === "initial_stop") {
      alerts.push({ kind: "sl_hit", ...base });
    } else if (
      reason === "breakeven_stop" ||
      reason === "progressive_stop"
    ) {
      alerts.push({ kind: "protected_stop", ...base });
    } else if (reason === "final_take_profit") {
      alerts.push({
        kind: "tp_hit",
        ...base,
        tpLevel:
          c.highest_tp_reached ??
          Number(/^tp([123])$/.exec(c.status)?.[1] ?? 0),
      });
    } else {
      alerts.push({ kind: "reversed", ...base });
    }
  }

  return alerts;
}

/** Discord `content` is capped at 2000 chars; stay under to avoid 400s.
 *  Exported so every sensei broadcast (alerts, recap, discovery) shares it. */
export const DISCORD_MAX = 1900;

export interface DiscordAlertBatch {
  content: string;
  alertCount: number;
}

/** Light horizontal rule dividing the message into sections. */
export const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━";

/** Signed P&L like " (+120%)", " (-15%)", " (+0.28%)" — precision scales with
 *  magnitude, trailing zeros dropped, and a value that rounds to zero reads
 *  " (0%)" (never "+0%" or "-0%"). Empty when there's no value. */
function pctSuffix(pct?: number): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  const abs = Math.abs(pct);
  const digits = abs >= 10 ? 0 : abs >= 1 ? 1 : 2;
  const v = abs.toLocaleString("en-US", { maximumFractionDigits: digits });
  const sign = v === "0" ? "" : pct > 0 ? "+" : "-";
  return ` \`(${sign}${v}%)\``;
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

/** Outcome label for a signal-reversal close, split by realized P&L. */
function reversedResultLabel(pnlPct?: number): string {
  if ((pnlPct ?? 0) > 0) return "REVERSED PROFIT";
  if ((pnlPct ?? 0) < 0) return "REVERSED LOSS";
  return "REVERSED FLAT";
}

/** Direction-aware % of a target price from entry: a TP reads positive and an SL
 *  negative for BOTH longs and shorts (a short profits as price falls). */
function pctFrom(entry: number, target: number, isLong: boolean): number {
  const raw = ((target - entry) / entry) * 100;
  return isLong ? raw : -raw;
}

type DiscordAlertBlock = {
  section: "signal" | "checkpoint" | "outcome";
  content: string;
};

/** "<emoji> **SYMBOL** • LONG • A" header shared by checkpoints and outcomes. */
function headline(emoji: string, alert: JournalAlert): string {
  const head = [`**${alert.symbol}**`];
  if (alert.signal) head.push(alert.signal.toUpperCase());
  if (alert.grade) head.push(alert.grade);
  return `${emoji} ${head.join(" • ")}`;
}

/** Banked scale-out legs above `from`, e.g. "TP1 50% + TP2 30%" ("" if none). */
function partialLabel(to = 0, from = 0): string {
  const legs: string[] = [];
  for (let i = from; i < to; i++) {
    legs.push(`TP${i + 1} ${Math.round(SCALE_OUT_FRACTIONS[i] * 100)}%`);
  }
  return legs.join(" + ");
}

function renderSignal(a: JournalAlert): string {
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
}

/** A still-open trade crossed a TP: the legs banked now and the raised stop. */
function renderCheckpoint(alert: JournalAlert): string {
  const level = alert.tpLevel ?? 0;
  const tp = alert.takeProfits?.[level - 1];
  const pnl =
    alert.entry != null && tp != null
      ? pctFrom(alert.entry, tp, alert.signal !== "short")
      : undefined;
  const lines = [
    headline("✅", alert),
    `↳ TP${level}:${atPrice(tp)}${pctSuffix(pnl)}`,
  ];
  const partial = partialLabel(alert.partialLegs, alert.fromTpLevel);
  if (partial) lines.push(`↳ PARTIAL: \`${partial}\``);
  const rung = level === 1 ? "ENTRY" : `TP${level - 1}`;
  lines.push(`↳ SL BARU:${atPrice(alert.stopLoss)} \`(${rung})\``);
  return lines.join("\n");
}

function renderOutcome(
  emoji: string,
  alert: JournalAlert,
  result: string,
): string {
  const lines = [
    headline(emoji, alert),
    `↳ ${result}:${atPrice(alert.price)}${pctSuffix(alert.pnlPct)}`,
  ];
  // engine-v7 rows name the legs already closed; older rows keep the TP the
  // price only touched before a non-final exit.
  const partial = partialLabel(alert.partialLegs);
  if (partial) {
    lines.push(`↳ PARTIAL: \`${partial}\``);
  } else if ((alert.tpLevel ?? 0) > 0 && alert.kind !== "tp_hit") {
    lines.push(`↳ SEMPAT: \`TP${alert.tpLevel}\``);
  }
  const duration = formatDuration(alert.durationMs);
  if (duration) lines.push(`↳ DURATION: \`${duration}\``);
  return lines.join("\n");
}

function tpResultLabel(alert: JournalAlert): string {
  const level = alert.securedTpLevel ?? alert.tpLevel ?? 0;
  const total = alert.tpTotal ?? alert.tpLevel ?? 0;
  return `TP ${level}/${total}`;
}

function protectedResultLabel(alert: JournalAlert): string {
  if ((alert.pnlPct ?? 0) < 0) return "SL";
  if ((alert.pnlPct ?? 0) === 0) return "BE";
  return tpResultLabel(alert);
}

const SECTION_TITLES: [DiscordAlertBlock["section"], string][] = [
  ["signal", "🚨 SINYAL:"],
  ["checkpoint", "📍 CHECKPOINT:"],
  ["outcome", "📢 HASIL:"],
];

function renderAlertBatch(blocks: DiscordAlertBlock[]): string {
  return SECTION_TITLES.flatMap(([section, title]) => {
    const body = blocks
      .filter((block) => block.section === section)
      .map((block) => block.content)
      .join("\n\n");
    return body ? [`${title}\n\n${body}`] : [];
  }).join(`\n\n${DIVIDER}\n\n`);
}

/**
 * Render every alert without truncation, packing complete blocks into
 * Discord-safe messages: signals, then checkpoints, then outcomes. LONG
 * precedes SHORT; TP precedes SL/reversal.
 */
export function formatAlertBatchesForDiscord(
  alerts: JournalAlert[],
): DiscordAlertBatch[] {
  const blocks: DiscordAlertBlock[] = [
    ...alerts
      .filter((alert) => alert.kind === "new_long")
      .map((alert) => ({ section: "signal" as const, content: renderSignal(alert) })),
    ...alerts
      .filter((alert) => alert.kind === "new_short")
      .map((alert) => ({ section: "signal" as const, content: renderSignal(alert) })),
    ...alerts
      .filter((alert) => alert.kind === "tp_checkpoint")
      .map((alert) => ({
        section: "checkpoint" as const,
        content: renderCheckpoint(alert),
      })),
    ...alerts
      .filter((alert) => alert.kind === "tp_hit")
      .map((alert) => ({
        section: "outcome" as const,
        content: renderOutcome("🎯", alert, tpResultLabel(alert)),
      })),
    ...alerts
      .filter((alert) => alert.kind === "sl_hit")
      .map((alert) => ({
        section: "outcome" as const,
        content: renderOutcome("⛔", alert, "SL"),
      })),
    ...alerts
      .filter((alert) => alert.kind === "protected_stop")
      .map((alert) => ({
        section: "outcome" as const,
        content: renderOutcome("🛡️", alert, protectedResultLabel(alert)),
      })),
    ...alerts
      .filter((alert) => alert.kind === "reversed")
      .map((alert) => ({
        section: "outcome" as const,
        content: renderOutcome(
          "🔄",
          alert,
          reversedResultLabel(alert.pnlPct),
        ),
      })),
  ];

  const batches: DiscordAlertBatch[] = [];
  let current: DiscordAlertBlock[] = [];
  for (const block of blocks) {
    const candidate = [...current, block];
    if (current.length > 0 && renderAlertBatch(candidate).length > DISCORD_MAX) {
      batches.push({
        content: renderAlertBatch(current),
        alertCount: current.length,
      });
      current = [block];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    const content = renderAlertBatch(current);
    if (content.length > DISCORD_MAX) {
      throw new RangeError("A single Discord alert exceeds the message limit");
    }
    batches.push({ content, alertCount: current.length });
  }
  return batches;
}

/** One closed trade in the end-of-day recap (realized, direction-aware %). */
export interface DailySummaryClosed {
  symbol: string;
  signal?: "long" | "short" | null;
  grade?: string | null;
  /** tp1 | tp2 | tp3 | sl | reversed */
  status: string;
  /** Closed by a SIGNAL REVERSAL (vs a price TP/SL hit). A reversal after TP
   *  keeps this legacy flag while v4 also stores status `reversed`. */
  reversed?: boolean;
  /** Highest TP reached before the close + plan's TP total. */
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
  const breakevens = closed.filter((c) => c.pnlPct === 0).length;
  const winRate =
    wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
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
      `🥇 RASIO LABA RUGI: \`${winRate}%\` \`(${wins} Laba / ${losses} Rugi / ${breakevens} Impas)\``,
    );
  }

  let msg = recap.join("\n");
  if (msg.length > DISCORD_MAX) {
    msg = msg.slice(0, DISCORD_MAX - 20) + "\n… (truncated)";
  }
  return msg;
}

/**
 * Price formatting for the alert lines, en-US like the terminal: whole numbers
 * grouped (65,713), prices ≥ 1 keep a fixed 2 decimals (84,762.79, 145.20),
 * and sub-1 alts scale to enough significant decimals (0.006467) without
 * padding extra zeros.
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
  return formatted;
}
