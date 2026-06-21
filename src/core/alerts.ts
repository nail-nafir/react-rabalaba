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
      alerts.push({ kind: "tp_hit", ...base, tpLevel: Number(c.status.slice(2)) });
    } else {
      alerts.push({ kind: "reversed", ...base });
    }
  }

  return alerts;
}

/** Discord `content` is capped at 2000 chars; stay under to avoid 400s. */
const DISCORD_MAX = 1900;

/** "Wangsit Raba Laba Sensei" persona header — the in-character framing. */
const SENSEI_HEADER = "🥋【 WANGSIT RABA LABA SENSEI HARI INI 】";

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━";

/** Closing wisdom, in character. */
const SENSEI_QUOTE =
  '🧘‍♂️ "Semedi di depan chart mengajarkan kita: yang patah bisa tumbuh, yang floating minus belum tentu rebound."';

/** Wrap in backticks so symbols/prices render monospace in Discord. */
function code(s: string | number): string {
  return `\`${s}\``;
}

/** Signed P&L like " (+120%)", " (-15%)", " (+0.28%)" — precision scales with
 *  magnitude, trailing zeros dropped. Empty when there's no value. */
function pctSuffix(pct?: number): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  const abs = Math.abs(pct);
  const digits = abs >= 10 ? 0 : abs >= 1 ? 1 : 2;
  const v = abs.toLocaleString("en-US", { maximumFractionDigits: digits });
  return ` (${pct >= 0 ? "+" : "-"}${v}%)`;
}

/** Price suffix " @`<num>`" (omitted when there's no price). */
function priceSuffix(price?: number | null): string {
  return price != null ? ` @${code(formatNum(price))}` : "";
}

/**
 * Render alerts into a single in-character "Wangsit Raba Laba Sensei" Discord
 * message: header → 🚨 SINYAL (new entries) → 📢 HASIL (TP / SL / Reversed
 * outcomes, each with realized %) → closing wisdom. Returns null when there's
 * nothing to say so the caller can skip the POST.
 */
export function formatAlertsForDiscord(alerts: JournalAlert[]): string | null {
  if (alerts.length === 0) return null;

  const renderSignal = (a: JournalAlert) => {
    const emoji = a.kind === "new_long" ? "🟢" : "🔴";
    const dir = a.kind === "new_long" ? "LONG" : "SHORT";
    const parts = [code(a.symbol), dir];
    if (a.grade) parts.push(`Grade ${a.grade}`);
    if (a.entry != null) parts.push(`Entry @${code(formatNum(a.entry))}`);
    return `${emoji} ${parts.join(" • ")}`;
  };
  // LONG first, then SHORT — one line each, no blank line between.
  const signalBody = [
    ...alerts.filter((a) => a.kind === "new_long"),
    ...alerts.filter((a) => a.kind === "new_short"),
  ]
    .map(renderSignal)
    .join("\n");

  // TP, then SL, then Reversed — one line each, with the realized %.
  const outcomeBody = [
    ...alerts
      .filter((a) => a.kind === "tp_hit")
      .map(
        (a) =>
          `🎯 ${code(a.symbol)} ➔ TP${a.tpLevel ?? ""}${priceSuffix(a.price)}${pctSuffix(a.pnlPct)}`,
      ),
    ...alerts
      .filter((a) => a.kind === "sl_hit")
      .map((a) => `⛔ ${code(a.symbol)} ➔ SL${priceSuffix(a.price)}${pctSuffix(a.pnlPct)}`),
    ...alerts
      .filter((a) => a.kind === "reversed")
      .map(
        (a) =>
          `🔄 ${code(a.symbol)} ➔ Reversed${priceSuffix(a.price)}${pctSuffix(a.pnlPct)}`,
      ),
  ].join("\n");

  const blocks: string[] = [SENSEI_HEADER];
  if (signalBody) blocks.push(DIVIDER, "🚨 SINYAL:\n\n" + signalBody);
  if (outcomeBody) blocks.push(DIVIDER, "📢 HASIL:\n\n" + outcomeBody);
  blocks.push(DIVIDER, SENSEI_QUOTE);

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
  if (Number.isInteger(n)) return n.toString();
  const abs = Math.abs(n);
  if (abs >= 1) {
    return n.toLocaleString("en-US", {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // Sub-1: enough decimals to stay meaningful, trailing zeros NOT padded.
  const leadingZeros = Math.max(0, -Math.floor(Math.log10(abs)) - 1);
  return n.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: Math.min(10, leadingZeros + 4),
  });
}
