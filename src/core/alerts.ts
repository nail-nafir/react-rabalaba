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
  /** Close price for an outcome (TP/SL/reversal). */
  price?: number | null;
  /** TP milestone (1/2/3) for a tp_hit. */
  tpLevel?: number;
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
    });
  }

  for (const c of plan.closures) {
    if (c.status === "sl") {
      alerts.push({ kind: "sl_hit", symbol: c.symbol, price: c.close_price });
    } else if (/^tp[123]$/.test(c.status)) {
      alerts.push({
        kind: "tp_hit",
        symbol: c.symbol,
        price: c.close_price,
        tpLevel: Number(c.status.slice(2)),
      });
    } else {
      alerts.push({ kind: "reversed", symbol: c.symbol, price: c.close_price });
    }
  }

  return alerts;
}

/** Discord `content` is capped at 2000 chars; stay under to avoid 400s. */
const DISCORD_MAX = 1900;

/** "RabaLaba Sensei" persona intro — the in-character framing for every drop. */
const SENSEI_HEADER =
  "🥋 RabaLaba Sensei memanggil....\n\n" +
  "Wahai para muridku....\n\n" +
  "Semalam aku bermeditasi di depan chart.\n" +
  "Saat dupa terakhir padam, beberapa wangsit muncul.";

const DIVIDER = "━━━━━━━━━━━━━━━━━━";

/** Price suffix " @<num>" (omitted when there's no price). */
function priceSuffix(price?: number | null): string {
  return price != null ? ` @${formatNum(price)}` : "";
}

/**
 * Render alerts into a single in-character "RabaLaba Sensei" Discord message:
 * header → SINYAL (new entries) → HASIL (outcomes grouped TP / SL / reversal).
 * Dividers separate header / SINYAL / HASIL. Returns null when there's nothing
 * to say so the caller can skip the POST entirely.
 */
export function formatAlertsForDiscord(alerts: JournalAlert[]): string | null {
  if (alerts.length === 0) return null;

  const renderSignal = (a: JournalAlert) => {
    const emoji = a.kind === "new_long" ? "🟢" : "🔴";
    const dir = a.kind === "new_long" ? "LONG" : "SHORT";
    const parts = [`**${a.symbol}**`, dir];
    if (a.grade) parts.push(`Grade ${a.grade}`);
    if (a.entry != null) parts.push(`Entry @${formatNum(a.entry)}`);
    return `${emoji} ${parts.join(" • ")}`;
  };
  // Grouped by direction: all LONG together, then SHORT, split by a blank line.
  const longLines = alerts.filter((a) => a.kind === "new_long").map(renderSignal);
  const shortLines = alerts
    .filter((a) => a.kind === "new_short")
    .map(renderSignal);
  const signalBody = [longLines, shortLines]
    .filter((g) => g.length > 0)
    .map((g) => g.join("\n"))
    .join("\n\n");

  const tpLines = alerts
    .filter((a) => a.kind === "tp_hit")
    .map((a) => `🎯 **${a.symbol}** → TP${a.tpLevel ?? ""}${priceSuffix(a.price)}`);

  const slLines = alerts
    .filter((a) => a.kind === "sl_hit")
    .map((a) => `⛔ **${a.symbol}** → SL${priceSuffix(a.price)}`);

  const reversedLines = alerts
    .filter((a) => a.kind === "reversed")
    .map((a) => `🔄 **${a.symbol}** → Reversed${priceSuffix(a.price)}`);

  const blocks: string[] = [SENSEI_HEADER];

  // SINYAL section (new entries), LONG / SHORT groups split by a blank line.
  if (signalBody) {
    blocks.push(DIVIDER);
    blocks.push("SINYAL:\n" + signalBody);
  }

  // HASIL section (outcomes), TP / SL / reversal groups split by a blank line.
  const outcomeBody = [tpLines, slLines, reversedLines]
    .filter((g) => g.length > 0)
    .map((g) => g.join("\n"))
    .join("\n\n");
  if (outcomeBody) {
    blocks.push(DIVIDER);
    blocks.push("HASIL:\n" + outcomeBody);
  }

  let msg = blocks.join("\n\n");
  if (msg.length > DISCORD_MAX) {
    msg = msg.slice(0, DISCORD_MAX - 20) + "\n… (truncated)";
  }
  return msg;
}

/** Compact price formatting that works for both BTC (65,713) and a 0.0824 alt. */
function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
