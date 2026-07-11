import { formatPrice, formatRatio, formatDayMonth, formatDateNumeric, formatClock, formatVolume } from "@/lib/formatters";
import type { AssetType } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  priceToRatio,
  priceTicks,
  dateTickIndices,
  mapMarkerToCandle,
  MAX_CANDLES,
  type TradeSetupModel,
  type ChartMarker,
} from "./trade-setup-model";


export interface ShareCardMeta {
  symbol: string;
  name?: string;
  strength: number;
  currentPrice: number;
  assetType: AssetType;
  candles: NormalizedYahooCandle[];
  isPosition?: boolean;
  /** A closed position labels the right-hand price as the close price. */
  closed?: boolean;
  /** Why a closed position ended, as an uppercase fragment (e.g. "TP2", "SL"). */
  closeReason?: string;
  entryPrice?: number;
  pnlPct?: number;
  pnlR?: number;
  grade?: string;
  locale?: string;
  /** Entry/close annotations plotted on the candles (journal/position view). */
  markers?: ChartMarker[];
  /** Localized words for the marker badges (e.g. MASUK / TUTUP). */
  markerLabels?: { entry: string; close: string };
}

const W = 1200;
// Tall enough that the chart aspect (~2.1:1) matches the web renderer in
// `trade-setup-chart.tsx` while leaving symmetric ~48px breathing room at
// both the top (above the brand block) and the bottom (below the footer).
const H = 1040;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_MONO = FONT;

/**
 * Theme-aware palette. Hex values are derived from the resolved CSS variables
 * in `index.css` (oklch, e.g. `oklch(0.145 0 0)` ≈ `#0a0a0a`) so the share
 * image matches what the user sees on web. Canvas can't reliably render
 * `oklch(...)` directly, so we keep hex/rgba here.
 */
interface Palette {
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  mutedBg: string;
  primary: string;
  emerald: string;
  emeraldFill: string;
  rose: string;
  roseFill: string;
}

const BRAND_PURPLE = "#863bff"; // matches favicon.svg & header logo

const DARK: Palette = {
  bg: "#0a0a0a",
  card: "#0a0a0a",
  border: "#262626",
  text: "#fafafa",
  muted: "#a2a2a2",
  mutedBg: "#171717",
  primary: BRAND_PURPLE,
  emerald: "#34d399",
  emeraldFill: "rgba(52,211,153,0.10)",
  rose: "#fb7185",
  roseFill: "rgba(251,113,133,0.10)",
};

const LIGHT: Palette = {
  bg: "#ffffff",
  card: "#ffffff",
  border: "#e4e4e4",
  text: "#0a0a0a",
  muted: "#737373",
  mutedBg: "#f5f5f5",
  primary: BRAND_PURPLE,
  emerald: "#34d399",
  emeraldFill: "rgba(52,211,153,0.10)",
  rose: "#fb7185",
  roseFill: "rgba(251,113,133,0.10)",
};

/**
 * Resolve a CSS color expression to a canvas/SVG-renderable string. Pipes
 * through a canvas context to canonicalize `oklch(...)` to `rgb(...)`.
 */
function resolveCssColor(expr: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const probe = document.createElement("div");
    probe.style.color = expr;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    if (!resolved) return null;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return resolved;
    ctx.fillStyle = resolved;
    return ctx.fillStyle as string;
  } catch {
    return null;
  }
}

function getPalette(): Palette {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const base = isDark ? DARK : LIGHT;
  if (typeof document === "undefined") return base;
  return {
    ...base,
    bg: resolveCssColor("var(--background)") ?? base.bg,
    card: resolveCssColor("var(--card)") ?? base.card,
    border: resolveCssColor("var(--border)") ?? base.border,
    text: resolveCssColor("var(--foreground)") ?? base.text,
    muted: resolveCssColor("var(--muted-foreground)") ?? base.muted,
    mutedBg: resolveCssColor("var(--muted)") ?? base.mutedBg,
    primary: resolveCssColor("var(--primary)") ?? base.primary,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const n = (v: number) => v.toFixed(1);

function formatGeneratedAt(d: Date): string {
  const ts = d.getTime() / 1000;
  return `${formatDateNumeric(ts)} \u00B7 ${formatClock(ts)}`;
}

/**
 * Brand mark from the web header (lucide `Radio` icon — concentric "broadcast"
 * arcs with a center dot). Rendered as inline SVG so the share card can be
 * fully self-contained.
 */
function brandMark(x: number, y: number, size: number, color: string): string {
  // Native viewBox is 24x24. Pad ~18% so the icon doesn't touch the box edge.
  const padding = 0.18;
  const inner = size * (1 - padding * 2);
  const scale = inner / 24;
  const offsetX = x + size * padding;
  const offsetY = y + size * padding;
  // Stroke width is in the icon's coordinate space; scaling preserves it.
  return `<g transform="translate(${n(offsetX)} ${n(offsetY)}) scale(${scale.toFixed(4)})"><g stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M16.247 7.761a6 6 0 0 1 0 8.478"/><path d="M19.075 4.933a10 10 0 0 1 0 14.134"/><path d="M4.925 19.067a10 10 0 0 1 0-14.134"/><path d="M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2" fill="${color}"/></g></g>`;
}

/** Build a standalone, brandable PNG-ready SVG of the trade setup. */
export function buildShareCardSvg(
  model: TradeSetupModel,
  meta: ShareCardMeta,
): string {
  const C = getPalette();
  const isShort = model.signal === "short";
  const accent = isShort ? C.rose : C.emerald;
  const accentFill = isShort ? C.roseFill : C.emeraldFill;

  // Chart panel geometry. PROJ_X ratio + dash patterns mirror the web
  // renderer in `trade-setup-chart.tsx` (shared via `trade-setup-model.ts`).
  const px0 = 56;
  const px1 = W - 56;
  const panelY = 312;
  const panelH = 515;
  const PAD = 26; // uniform inner padding from the card border (all sides)
  const left = px0 + PAD;
  const right = px1 - PAD;
  // Extra top room: the OHLC legend strip sits INSIDE the panel above the plot
  // (mirrors the web, where it's in the chart card above the candles).
  const top = panelY + PAD + 22;
  const bottom = panelY + panelH - PAD - 18; // leave room for the date labels
  // Right price column auto-sizes to the widest [KEY | price] pill, so candles
  // fill the rest of the width (mirrors the web renderer).
  const pillWidth = (key: string, price: string) =>
    key.length * 9 + 16 + (price.length * 9 + 16);
  const axisW =
    Math.max(
      60,
      ...model.levels.map((l) =>
        pillWidth(l.key.toUpperCase(), formatPrice(l.price, meta.assetType)),
      ),
    ) + 8;
  const projX = right - axisW;
  const chartH = bottom - top;
  const y = (price: number) =>
    top + (1 - priceToRatio(price, model.priceMin, model.priceMax)) * chartH;

  // Use the same window as the web chart for consistency — the model's price
  // domain encloses every candle here, so the full window always renders.
  const view = meta.candles.slice(-MAX_CANDLES);
  const slot = view.length ? (projX - left) / view.length : 0;
  const candles = view
    .map((c, i) => {
      const cx = left + (i + 0.5) * slot;
      const up = c.close >= c.open;
      const col = up ? C.emerald : C.rose;
      const yo = y(c.open);
      const yc = y(c.close);
      const bt = Math.min(yo, yc);
      const bh = Math.max(1, Math.abs(yo - yc));
      const bw = Math.max(1, slot * 0.62);
      return `<line x1="${n(cx)}" y1="${n(y(c.high))}" x2="${n(cx)}" y2="${n(y(c.low))}" stroke="${col}" stroke-width="1"/><rect x="${n(cx - bw / 2)}" y="${n(bt)}" width="${n(bw)}" height="${n(bh)}" fill="${col}"/>`;
    })
    .join("");

  const zoneRect = (from: number, to: number, fill: string) => {
    const yt = Math.min(y(from), y(to));
    const h = Math.abs(y(from) - y(to));
    return `<rect x="${left}" y="${n(yt)}" width="${n(projX - left)}" height="${n(h)}" fill="${fill}"/>`;
  };

  // Exchange-style brand watermark: big, faint, single-color, centered behind
  // the candles — mirrors the web renderer.
  const watermark = `<text x="${n((left + projX) / 2)}" y="${n((top + bottom) / 2)}" fill="${C.text}" opacity="0.06" font-size="66" font-weight="900" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" letter-spacing="0.02em">RABALABA</text>`;

  // OHLC legend strip above the chart: the LATEST visible candle (a static
  // share can't hover), so it matches the web's idle legend reading.
  const legend = (() => {
    if (!view.length) return "";
    const c = view[view.length - 1];
    const up = c.close >= c.open;
    const dir = up ? C.emerald : C.rose;
    const chg = c.open !== 0 ? ((c.close - c.open) / c.open) * 100 : 0;
    const vol = c.volume > 0 ? formatVolume(c.volume) : "—";
    const stat = (label: string, value: string, fill: string) =>
      `<tspan dx="16" fill="${C.muted}">${label}</tspan><tspan dx="4" fill="${fill}">${esc(value)}</tspan>`;
    return (
      `<text x="${left}" y="${top - 20}" font-family="${FONT_MONO}" font-size="15" dominant-baseline="central">` +
      `<tspan fill="${C.muted}">${esc(formatDayMonth(c.timestamp, meta.locale))} ${esc(formatClock(c.timestamp))}</tspan>` +
      // % change leads the OHLV cluster: a full group-gap (dx matches the stat
      // spacing below) from the date, not glued to the timestamp.
      `<tspan dx="16" fill="${dir}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</tspan>` +
      stat("OPEN", formatPrice(c.open, meta.assetType), C.text) +
      stat("HIGH", formatPrice(c.high, meta.assetType), C.emerald) +
      stat("LOW", formatPrice(c.low, meta.assetType), C.rose) +
      stat("CLOSE", formatPrice(c.close, meta.assetType), dir) +
      stat("VOLUME", vol, C.text) +
      `</text>`
    );
  })();

  // Price axis: horizontal gridlines + candle price labels near the candles.
  const priceAxis = priceTicks(model.priceMin, model.priceMax)
    .map((p) => {
      const py = y(p);
      return `<line x1="${left}" y1="${n(py)}" x2="${n(projX)}" y2="${n(py)}" stroke="${C.border}" stroke-width="1" opacity="0.5"/><text x="${n(projX + 8)}" y="${n(py)}" fill="${C.muted}" font-size="15" text-anchor="start" dominant-baseline="central" font-family="${FONT_MONO}">${esc(formatPrice(p, meta.assetType))}</text>`;
    })
    .join("");

  // Date axis: vertical gridlines + DD/MM labels along the bottom.
  const dateAxis = view.length
    ? dateTickIndices(view.length)
        .map((idx, i, arr) => {
          const cx = left + (idx + 0.5) * slot;
          const anchor =
            i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle";
          return `<line x1="${n(cx)}" y1="${top}" x2="${n(cx)}" y2="${bottom}" stroke="${C.border}" stroke-width="1" opacity="0.5"/><text x="${n(cx)}" y="${bottom + 18}" fill="${C.muted}" font-size="15" text-anchor="${anchor}" font-family="${FONT_MONO}">${esc(formatDayMonth(view[idx].timestamp, meta.locale))}</text>`;
        })
        .join("")
    : "";

  // Level lines + combined [KEY | price] pills, right-aligned (mirrors web).
  const levels = model.levels
    .map((lvl) => {
      const ly = y(lvl.price);
      const col =
        lvl.kind === "risk"
          ? C.rose
          : lvl.kind === "profit"
            ? C.emerald
            : C.muted;
      const dash = lvl.kind === "entry" ? "" : `stroke-dasharray="5 4"`;

      const key = lvl.key.toUpperCase();
      const price = formatPrice(lvl.price, meta.assetType);
      const keyW = key.length * 9 + 16;
      const priceW = price.length * 9 + 16;
      const bw = keyW + priceW;
      const bh = 24;
      const bx = right - bw;
      const by = ly - bh / 2;
      const divX = bx + keyW;

      const line = `<line x1="${left}" y1="${n(ly)}" x2="${n(projX)}" y2="${n(ly)}" stroke="${col}" stroke-width="1.4" ${dash} opacity="0.9"/>`;
      const rect = `<rect x="${n(bx)}" y="${n(by)}" width="${n(bw)}" height="${bh}" rx="4" fill="${C.card}" stroke="${col}" stroke-width="1"/>`;
      const keyText = `<text x="${n(bx + keyW / 2)}" y="${n(ly)}" fill="${col}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" letter-spacing="0.05em">${esc(key)}</text>`;
      const divLine = `<line x1="${n(divX)}" y1="${n(ly - bh / 2 + 4)}" x2="${n(divX)}" y2="${n(ly + bh / 2 - 4)}" stroke="${col}" stroke-width="1" opacity="0.5"/>`;
      const priceText = `<text x="${n(divX + priceW / 2)}" y="${n(ly)}" fill="${col}" font-size="16" font-weight="600" text-anchor="middle" dominant-baseline="central" font-family="${FONT_MONO}">${esc(price)}</text>`;

      return `${line}${rect}${keyText}${divLine}${priceText}`;
    })
    .join("");

  // Entry/close markers (journal/position view): an arrow at the (time, price)
  // point + a single-word badge (MASUK/TUTUP). Mirrors the web renderer in
  // `trade-setup-chart.tsx` — out-of-window events clamp to the edge with an
  // outward chevron; in-window events fan above/below by price rank.
  const mGeo = (
    meta.markers && meta.markerLabels && view.length
      ? mapMarkerToCandle(meta.markers, view)
      : []
  ).map((m) => ({
    ...m,
    cx: m.outOfRange
      ? m.edge === "start"
        ? left
        : projX
      : left + (m.candleIndex + 0.5) * slot,
    py: y(m.price),
  }));
  const markerOrder = [...mGeo.map((mk, idx) => ({ idx, py: mk.py }))]
    .sort((a, b) => a.py - b.py || a.idx - b.idx)
    .map((e) => e.idx);
  const markerLabelAbove = (idx: number) =>
    mGeo.length > 1 && markerOrder.indexOf(idx) < mGeo.length / 2;
  const PILL_H_M = 24;
  const arrowH = 10;
  const arrowHalf = 7;
  const clampCy = (v: number) =>
    Math.min(bottom - PILL_H_M / 2, Math.max(top + PILL_H_M / 2, v));
  const markers = mGeo
    .map((m, i) => {
      const col =
        m.kind === "entry"
          ? C.muted
          : m.outcome === "loss"
            ? C.rose
            : C.emerald;
      const word = (
        m.kind === "entry" ? meta.markerLabels!.entry : meta.markerLabels!.close
      ).toUpperCase();
      const bw = word.length * 9 + 16;
      const pill = (bx: number, cy: number) =>
        `<rect x="${n(bx)}" y="${n(cy - PILL_H_M / 2)}" width="${n(bw)}" height="${PILL_H_M}" rx="4" fill="${C.card}" stroke="${col}" stroke-width="1"/>` +
        `<text x="${n(bx + bw / 2)}" y="${n(cy)}" fill="${col}" font-size="14" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" letter-spacing="0.05em">${esc(word)}</text>`;

      if (m.outOfRange) {
        const atStart = m.edge === "start";
        const baseX = atStart ? m.cx + arrowH : m.cx - arrowH;
        const chevron = `${n(m.cx)},${n(m.py)} ${n(baseX)},${n(m.py - arrowHalf)} ${n(baseX)},${n(m.py + arrowHalf)}`;
        const above = markerLabelAbove(i);
        const labelCy = clampCy(
          above ? m.py - PILL_H_M / 2 - 6 : m.py + PILL_H_M / 2 + 6,
        );
        const labelX = atStart ? left : projX - bw;
        const nearY = above ? labelCy + PILL_H_M / 2 : labelCy - PILL_H_M / 2;
        return (
          `<line x1="${n(m.cx)}" y1="${n(m.py)}" x2="${n(baseX)}" y2="${n(m.py)}" stroke="${col}" stroke-width="1" stroke-dasharray="3 2" opacity="0.6"/>` +
          `<line x1="${n(m.cx)}" y1="${n(m.py)}" x2="${n(m.cx)}" y2="${n(nearY)}" stroke="${col}" stroke-width="1" opacity="0.6"/>` +
          `<polygon points="${chevron}" fill="${col}"/>` +
          pill(labelX, labelCy)
        );
      }

      const pointsUp = !markerLabelAbove(i);
      const baseY = pointsUp ? m.py + arrowH : m.py - arrowH;
      const tri = `${n(m.cx)},${n(m.py)} ${n(m.cx - arrowHalf)},${n(baseY)} ${n(m.cx + arrowHalf)},${n(baseY)}`;
      const gap = 6;
      const labelCy = clampCy(
        pointsUp ? baseY + gap + PILL_H_M / 2 : baseY - gap - PILL_H_M / 2,
      );
      const labelX = Math.min(projX - bw, Math.max(left, m.cx - bw / 2));
      const nearY = pointsUp ? labelCy - PILL_H_M / 2 : labelCy + PILL_H_M / 2;
      return (
        `<line x1="${n(m.cx)}" y1="${n(m.py)}" x2="${n(m.cx)}" y2="${n(nearY)}" stroke="${col}" stroke-width="1" opacity="0.6"/>` +
        `<polygon points="${tri}" fill="${col}"/>` +
        pill(labelX, labelCy)
      );
    })
    .join("");

  // ── Header ──────────────────────────────────────────────────────────────
  // Brand block: rounded gradient square with white Radio icon + wordmark
  const logoX = 56;
  const logoY = 48;
  const logoSize = 52;
  const wordmarkX = logoX + logoSize + 14;

  // ── Symbol row ─────────────────────────────────────────────────────────
  const symbolY = 198;
  const nameY = 230;
  // One shared, fixed size for the three header values — ticker, centered P&L,
  // and the right-hand price — so the row reads as a uniform set.
  const HEADER_FONT = 40;
  // Shared size for the small caps labels above the header/footer values.
  const LABEL_FONT = 12;
  const GRADE_COLORS: Record<string, { text: string; fill: string; stroke: string }> = {
    A: { text: C.emerald, fill: C.emeraldFill, stroke: C.emerald },
    B: { text: "#fbbf24", fill: "rgba(251, 191, 36, 0.15)", stroke: "#fbbf24" },
    C: { text: C.rose, fill: C.roseFill, stroke: C.rose },
  };

  const pillY = 248;
  const pillH = 28;
  const gap = 8;

  // 1. Type / status badges (left). A signal is a single
  // "SIGNAL" chip; a position breaks into separate pills \u2014 POSITION, its
  // lifecycle (OPEN / CLOSED), and, once closed, how it ended (TP* / SL /
  // REVERSED) colored by realized outcome.
  const pnlWin = (meta.pnlR ?? 0) >= 0;
  const neutralChip = {
    text: C.muted,
    fill: "rgba(128, 128, 128, 0.08)",
    stroke: C.border,
  };
  const outcomeChip = pnlWin
    ? { text: C.emerald, fill: C.emeraldFill, stroke: C.emerald }
    : { text: C.rose, fill: C.roseFill, stroke: C.rose };
  const statusPills: { text: string; chip: typeof neutralChip }[] =
    meta.isPosition
      ? [
          // Position + lifecycle in one chip. \u25B6 = running, \u25A0 = finished.
          {
            text: meta.closed ? "\u25A0 CLOSED POSITION" : "\u25B6 OPEN POSITION",
            chip: neutralChip,
          },
          ...(meta.closed && meta.closeReason
            ? [
                {
                  // TP \u2192 \u2713, SL \u2192 \u2715 (colored by outcome); a no-TP reversed exit \u2192
                  // \u21A9 stays neutral like the position chip (no win/loss verdict).
                  text: `${meta.closeReason === "REVERSED" ? "\u21A9" : pnlWin ? "\u2713" : "\u2715"} ${meta.closeReason}`,
                  chip: meta.closeReason === "REVERSED" ? neutralChip : outcomeChip,
                },
              ]
            : []),
        ]
      : [{ text: "\u2726 SIGNAL", chip: neutralChip }];
  let leftX = 56;
  const typeBadgeHtml = statusPills
    .map((p) => {
      const w = Math.ceil(p.text.length * 8 + 18);
      const html = `
<rect x="${leftX}" y="${pillY}" rx="6" width="${w}" height="${pillH}" fill="${p.chip.fill}" stroke="${p.chip.stroke}"/>
<text x="${leftX + w / 2}" y="${pillY + pillH / 2 + 1}" fill="${p.chip.text}" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="central" font-family="${FONT}">${esc(p.text)}</text>`;
      leftX += w + gap;
      return html;
    })
    .join("");

  // 2. Right cluster (grade / strength / direction)
  const signalArrow = isShort ? "\u25BC" : "\u25B2"; // ▼ / ▲
  // Right cluster — grade · direction, right-aligned to the margin. Shown on
  // every card. Grade carries its tier color; direction (with the strength %)
  // uses the long/short accent.
  const gradeUpper = meta.grade?.toUpperCase();
  const gc =
    gradeUpper &&
    (GRADE_COLORS[gradeUpper] ?? {
      text: C.primary,
      fill: "rgba(134, 59, 255, 0.15)",
      stroke: C.primary,
    });
  const rightPills: { text: string; chip: typeof neutralChip }[] = [
    ...(gc ? [{ text: `✦ GRADE ${gradeUpper}`, chip: gc }] : []),
    {
      text: `${signalArrow} ${model.signal.toUpperCase()} ${Math.round(meta.strength)}%`,
      chip: { text: accent, fill: accentFill, stroke: accent },
    },
  ];
  const rightWidths = rightPills.map((p) => Math.ceil(p.text.length * 8 + 18));
  const rightTotal =
    rightWidths.reduce((a, b) => a + b, 0) + gap * (rightPills.length - 1);
  let rightX = W - 56 - rightTotal;
  const dirBadgeHtml = rightPills
    .map((p, i) => {
      const w = rightWidths[i];
      const html = `
<rect x="${rightX}" y="${pillY}" rx="6" width="${w}" height="${pillH}" fill="${p.chip.fill}" stroke="${p.chip.stroke}"/>
<text x="${rightX + w / 2}" y="${pillY + pillH / 2 + 1}" fill="${p.chip.text}" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="central" font-family="${FONT}">${esc(p.text)}</text>`;
      rightX += w + gap;
      return html;
    })
    .join("");

  const generatedAt = formatGeneratedAt(new Date());

  // ── Stats row ──────────────────────────────────────────────────────────
  // Three columns: R:R aligned to left, RISK centered, REWARD aligned to right.
  const statsLabelY = 869;
  const statsValueY = 913;
  const reward = model.risk * model.riskReward;

  // ── Footer ─────────────────────────────────────────────────────────────
  // Baseline placed so the gap from the bottom purple separator (y=948) to
  // the footer's text top mirrors the kop surat ↔ top separator gap (~28px).
  const footerY = 989;



  // Right-hand price label: a closed position shows its close price, otherwise
  // the live/current price (signals are always live).
  const priceLabel = meta.closed ? "CLOSE PRICE" : "CURRENT PRICE";

  // Dynamic right-hand header values: either centered PNL & current price for position, or only current price for signal
  const headerRightSide = meta.isPosition
    ? `<!-- Position P&L -->
<text x="${W / 2}" y="${logoY + 148}" fill="${meta.pnlR !== undefined && meta.pnlR >= 0 ? C.emerald : C.rose}" font-size="${HEADER_FONT}" font-weight="800" text-anchor="middle" font-family="${FONT_MONO}" letter-spacing="-0.01em">${meta.pnlPct !== undefined && meta.pnlPct >= 0 ? "+" : ""}${meta.pnlPct?.toFixed(2)}% (${meta.pnlR !== undefined && meta.pnlR >= 0 ? "+" : ""}${formatRatio(meta.pnlR ?? 0)}R)</text>
<text x="${W / 2}" y="${logoY + 176}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" text-anchor="middle" font-family="${FONT}">${meta.closed ? "REALIZED PNL" : "FLOATING PNL"}</text>

<!-- Right-hand price -->
<text x="${W - 56}" y="${logoY + 148}" fill="${C.text}" font-size="${HEADER_FONT}" font-weight="800" text-anchor="end" font-family="${FONT_MONO}" letter-spacing="-0.01em">${esc(formatPrice(meta.currentPrice, meta.assetType))}</text>
<text x="${W - 56}" y="${logoY + 176}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" text-anchor="end" font-family="${FONT}">${priceLabel}</text>`
    : `<!-- Current Price -->
<text x="${W - 56}" y="${logoY + 148}" fill="${C.text}" font-size="${HEADER_FONT}" font-weight="800" text-anchor="end" font-family="${FONT_MONO}" letter-spacing="-0.01em">${esc(formatPrice(meta.currentPrice, meta.assetType))}</text>
<text x="${W - 56}" y="${logoY + 176}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" text-anchor="end" font-family="${FONT}">CURRENT PRICE</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${C.primary}"/>
    <stop offset="100%" stop-color="${C.primary}" stop-opacity="0.65"/>
  </linearGradient>
  <radialGradient id="logoHalo" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="${C.primary}" stop-opacity="0.5"/>
    <stop offset="60%" stop-color="${C.primary}" stop-opacity="0.12"/>
    <stop offset="100%" stop-color="${C.primary}" stop-opacity="0"/>
  </radialGradient>
</defs>

<!-- Page background -->
<rect width="${W}" height="${H}" fill="${C.bg}"/>

<!-- Logo halo: soft purple aura behind the brand square -->
<rect x="${logoX - 22}" y="${logoY - 22}" width="${logoSize + 44}" height="${logoSize + 44}" rx="28" fill="url(#logoHalo)"/>

<!-- Brand block: logo square + wordmark + subtitle -->
<rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="14" fill="url(#logoBg)"/>
${brandMark(logoX, logoY, logoSize, "#ffffff")}
<text x="${wordmarkX}" y="${logoY + 30}" fill="${C.text}" font-size="30" font-weight="900" font-family="${FONT}" letter-spacing="-0.02em">RABA<tspan fill="${C.primary}">LABA</tspan></text>
<text x="${wordmarkX}" y="${logoY + 50}" fill="${C.muted}" font-size="11" font-weight="700" font-family="${FONT}" letter-spacing="0.32em">TERMINAL</text>

<!-- Top-right: timestamp -->
<text x="${W - 56}" y="${logoY + 22}" fill="${C.muted}" font-size="11" font-weight="700" text-anchor="end" font-family="${FONT}" letter-spacing="0.32em">GENERATED</text>
<text x="${W - 56}" y="${logoY + 46}" fill="${C.text}" font-size="16" font-weight="700" text-anchor="end" font-family="${FONT_MONO}">${esc(generatedAt)}</text>

<!-- Brand-purple separator: divides letterhead from asset section -->
<line x1="56" y1="128" x2="${W - 56}" y2="128" stroke="${C.primary}" stroke-width="2"/>

<!-- Symbol + name + signal pills -->
<text x="56" y="${symbolY}" fill="${C.text}" font-size="${HEADER_FONT}" font-weight="800" font-family="${FONT}" letter-spacing="-0.02em">${esc(meta.symbol)}</text>
<text x="56" y="${nameY}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" font-family="${FONT}">${esc(meta.name ?? "")}</text>
${typeBadgeHtml}${dirBadgeHtml}

${headerRightSide}

<!-- Chart panel (flat card background, matches web) -->
<rect x="${px0}" y="${panelY}" width="${px1 - px0}" height="${panelH}" rx="14" fill="${C.card}" stroke="${C.border}"/>
${legend}
${watermark}
${zoneRect(model.profitZone.from, model.profitZone.to, C.emeraldFill)}
${zoneRect(model.riskZone.from, model.riskZone.to, C.roseFill)}
${priceAxis}
${dateAxis}
${candles}
${levels}
${markers}

<!-- Hairline divider above stats (panel border serves as visual separator,
     no extra divider needed here). -->

<!-- Stats row: R:R (left) · RISK (center) · REWARD (right) -->
<text x="56" y="${statsLabelY}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" text-anchor="start" font-family="${FONT}">RISK : REWARD</text>
<text x="56" y="${statsValueY}" fill="${C.text}" font-size="${HEADER_FONT}" font-weight="800" text-anchor="start" font-family="${FONT_MONO}">1 : ${formatRatio(model.riskReward)}</text>

<text x="${W / 2}" y="${statsLabelY}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" text-anchor="middle" font-family="${FONT}">RISK</text>
<text x="${W / 2}" y="${statsValueY}" fill="${C.rose}" font-size="${HEADER_FONT}" font-weight="800" text-anchor="middle" font-family="${FONT_MONO}">${model.risk > 0 ? esc(formatPrice(model.risk, meta.assetType)) : "-"}</text>

<text x="${W - 56}" y="${statsLabelY}" fill="${C.muted}" font-size="${LABEL_FONT}" font-weight="700" text-anchor="end" font-family="${FONT}">REWARD</text>
<text x="${W - 56}" y="${statsValueY}" fill="${C.emerald}" font-size="${HEADER_FONT}" font-weight="800" text-anchor="end" font-family="${FONT_MONO}">${reward > 0 ? esc(formatPrice(reward, meta.assetType)) : "-"}</text>

<!-- Brand-purple separator: divides trade content from footer -->
<line x1="56" y1="948" x2="${W - 56}" y2="948" stroke="${C.primary}" stroke-width="2"/>

<!-- Footer: disclaimer + brand URL -->
<text x="56" y="${footerY}" fill="${C.muted}" font-size="16" font-weight="600" font-family="${FONT}">Not Financial Advice. Do Your Own Research.</text>
<text x="${W - 56}" y="${footerY}" fill="${C.muted}" font-size="16" font-weight="700" text-anchor="end" font-family="${FONT_MONO}">https://rabalaba.page.dev</text>
</svg>`;
}

/** Rasterize a standalone SVG string to a PNG Blob (2x for crispness). */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg image load failed"));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context unavailable");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Share a PNG via the Web Share API, falling back to a download. */
export async function shareOrDownloadPng(
  blob: Blob,
  filename: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    // Share ONLY the file — passing a `title` alongside makes macOS's share
    // sheet attach a text/preview item too, which pastes as a second image
    // (e.g. into WhatsApp). Files-only keeps it to exactly one image.
    await nav.share({ files: [file] });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

export const SHARE_CARD_SIZE = { width: W, height: H };



