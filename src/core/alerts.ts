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
  /** TP milestone (1/2/3) for a tp_hit. */
  tpLevel?: number;
  /** Realized P&L % for an outcome (signed). */
  pnlPct?: number;
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
    const base = { symbol: c.symbol, price: c.close_price, pnlPct: c.pnl_pct };
    // A reversal (with OR without a secured TP) is reported as "reversed" first,
    // mirroring the journal's reversed marker. Otherwise it's a pure TP/SL hit.
    if (c.reversed) {
      alerts.push({ kind: "reversed", ...base });
    } else if (c.status === "sl") {
      alerts.push({ kind: "sl_hit", ...base });
    } else if (/^tp[123]$/.test(c.status)) {
      alerts.push({
        kind: "tp_hit",
        ...base,
        tpLevel: Number(c.status.slice(2)),
      });
    } else {
      alerts.push({ kind: "reversed", ...base });
    }
  }

  return alerts;
}

/** Discord `content` is capped at 2000 chars; stay under to avoid 400s. */
const DISCORD_MAX = 1900;

/** Light horizontal rule dividing the message into sections. */
const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━";

/** "Wangsit Raba Laba Sensei" persona header — the in-character framing. */
const SENSEI_HEADER = "🥋 WANGSIT RABALABA SENSEI";

/** Closing wisdom, in character — plain quote, padded inside the quotes. */
const SENSEI_QUOTE =
  '"Bersemedi di depan chart mengajarkan kita: yang patah bisa tumbuh, yang floating loss belum tentu rebound. "';

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

/** Direction-aware % of a target price from entry: a TP reads positive and an SL
 *  negative for BOTH longs and shorts (a short profits as price falls). */
function pctFrom(entry: number, target: number, isLong: boolean): number {
  const raw = ((target - entry) / entry) * 100;
  return isLong ? raw : -raw;
}

/**
 * Render alerts into a single in-character "Wangsit Raba Laba Sensei" Discord
 * message: header → 🚨 SINYAL (new entries) → 📢 HASIL (TP / SL / REVERSED
 * outcomes with realized %) → 🧘‍♂️ PETUAH SENSEI (closing wisdom), each section
 * split by a divider rule. Each signal/outcome spans two lines (headline + ↳
 * detail). Returns null when there's nothing to say so the caller can skip POST.
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
    if (a.entry != null) lines.push(`↳ Entry:${atPrice(a.entry)}`);
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

  // Outcomes: "<emoji> **SYM**" then "↳ <result> @ `price` (±%)".
  const renderOutcome = (
    emoji: string,
    symbol: string,
    result: string,
    price?: number | null,
    pnl?: number,
  ) => `${emoji} **${symbol}**\n↳ ${result}:${atPrice(price)}${pctSuffix(pnl)}`;

  // TP, then SL, then REVERSED — blocks separated by a blank line.
  const outcomeBody = [
    ...alerts
      .filter((a) => a.kind === "tp_hit")
      .map((a) =>
        renderOutcome(
          "🎯",
          a.symbol,
          `TP${a.tpLevel ?? ""}`,
          a.price,
          a.pnlPct,
        ),
      ),
    ...alerts
      .filter((a) => a.kind === "sl_hit")
      .map((a) => renderOutcome("⛔", a.symbol, "SL", a.price, a.pnlPct)),
    ...alerts
      .filter((a) => a.kind === "reversed")
      .map((a) => renderOutcome("🔄", a.symbol, "REVERSED", a.price, a.pnlPct)),
  ].join("\n\n");

  const blocks: string[] = [SENSEI_HEADER];
  if (signalBody) blocks.push(DIVIDER, "🚨 SINYAL:\n\n" + signalBody);
  if (outcomeBody) blocks.push(DIVIDER, "📢 HASIL:\n\n" + outcomeBody);
  blocks.push(DIVIDER, "🧘 PETUAH SENSEI\n\n" + SENSEI_QUOTE);

  let msg = blocks.join("\n\n");
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
