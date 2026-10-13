type BadgeTone = "positive" | "negative" | "warning" | "neutral";

const LABELS: Record<string, string> = {
  ENTRY: "Entry", ENTRYPRICE: "Entry",
  SL: "Stop loss", STOPLOSS: "Stop loss",
  RR: "Risk reward", RISKREWARD: "Risk reward", RISKREWARDRATIO: "Risk reward",
  RISK: "Risk", RISIKO: "Risiko", RISKBUDGET: "Risk budget",
  RISKAMOUNT: "Risk amount", RISKPERCENT: "Risk percent", RISKPERCENTAGE: "Risk percent",
};

// Recognize display values only; their validation and calculations stay in the tools.
const METRIC_VALUE = /^(?:(?:Rp|IDR|USD|USDT|EUR|GBP|JPY)\s*|[$€£¥])?[+\-−]?(?:\d[\d.,]*|\.\d+)(?:\s*:\s*[+\-−]?\d[\d.,]*)?(?:\s*(?:%|R|Rp|IDR|USD|USDT|EUR|GBP|JPY))?$/i;
const METRIC_LABEL = /^(entry(?:[ _-]?price)?|stop[ _-]?loss|sl|take[ _-]?profit(?:[ _-]?\d+)?|tp\d*|risk[ _-]?reward(?:[ _-]?ratio)?|rr|risiko|risk(?:[ _-]?(?:budget|amount|percent(?:age)?))?)(?=$|[\s:;=])\s*[:;=]?\s*(.*)$/i;

/** Only an inline badge's label is normalized, never the message or fenced code. */
export function inlineBadge(
  source: string,
  symbols: ReadonlySet<string>,
): { label: string; tone: BadgeTone } | null {
  const value = source.trim();
  if (symbols.has(value.replace(/^\$/, "").toUpperCase())) {
    return { label: value, tone: "neutral" };
  }
  const clean = value.replace(/;+$/, "").trim();
  const status = clean.toUpperCase();
  if (/^(LONG|SHORT|NEUTRAL|BUY|SELL|TIER [A-D]|BULLISH|BEARISH|OVERBOUGHT|OVERSOLD|SUPPORT|RESISTANCE)$/.test(status)) {
    const tone = /^(SHORT|SELL|BEARISH|RESISTANCE)$/.test(status)
      ? "negative"
      : /^(OVERBOUGHT|OVERSOLD)$/.test(status)
        ? "warning"
        : /^(LONG|BUY|BULLISH)$/.test(status) ? "positive" : "neutral";
    return { label: clean, tone };
  }
  const match = clean.match(METRIC_LABEL);
  if (!match) return null;
  const [, rawLabel, amount] = match;
  if (amount && !METRIC_VALUE.test(amount)) return null;
  const key = rawLabel.replace(/[ _-]/g, "").toUpperCase();
  const target = key.match(/^(?:TAKEPROFIT|TP)(\d*)$/);
  const label = target ? `TP${target[1]}` : LABELS[key];
  if (!label) return null;
  return {
    label: amount ? `${label} ${amount}` : label,
    tone: target ? "positive" : label === "Stop loss" ? "negative" : "neutral",
  };
}
