import { formatPrice, formatRatio } from "@/lib/formatters";
import type { AssetType } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  priceToRatio,
  MAX_CANDLES,
  PROJ_X_RATIO,
  type TradeSetupModel,
} from "./trade-setup-model";

export interface ShareCardMeta {
  symbol: string;
  name?: string;
  strength: number;
  currentPrice: number;
  assetType: AssetType;
  candles: NormalizedYahooCandle[];
}

const W = 1200;
// Tall enough that the chart aspect (~2.1:1) matches the web renderer in
// `trade-setup-chart.tsx` while leaving symmetric ~48px breathing room at
// both the top (above the brand block) and the bottom (below the footer).
const H = 1040;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

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
    primary: resolveCssColor("var(--primary)") ?? base.primary,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const n = (v: number) => v.toFixed(1);

/** Format generation timestamp, e.g. "31 May 2026 · 12:21". */
function formatGeneratedAt(d: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = d.getDate();
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${mon} ${year} \u00B7 ${hh}:${mm}`;
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
  const top = 293;
  const bottom = 805;
  const left = px0 + 16;
  const right = px1 - 16;
  const projX = left + (right - left) * PROJ_X_RATIO;
  const chartH = bottom - top;
  const y = (price: number) =>
    top + (1 - priceToRatio(price, model.priceMin, model.priceMax)) * chartH;

  // Use the same window as the web chart for consistency.
  const view = meta.candles
    .slice(-MAX_CANDLES)
    .filter((c) => c.high >= model.priceMin && c.low <= model.priceMax);
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
    return `<rect x="${left}" y="${n(yt)}" width="${n(right - left)}" height="${n(h)}" fill="${fill}"/>`;
  };

  // Level lines + badges, mirroring the web chart's badge / price-pill style.
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

      const label = lvl.key.toUpperCase();
      const labelFs = 14;
      const bw = label.length * 9 + 16;
      const bh = 22;
      const bx = projX + 8;
      const by = ly - bh / 2;
      const badge = `<rect x="${n(bx)}" y="${n(by)}" width="${n(bw)}" height="${bh}" rx="4" fill="${col}"/><text x="${n(bx + bw / 2)}" y="${n(ly)}" fill="${C.bg}" font-size="${labelFs}" font-weight="700" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" letter-spacing="0.05em">${esc(label)}</text>`;

      const price = formatPrice(lvl.price, meta.assetType);
      const priceFs = 16;
      const pbw = price.length * 9 + 16;
      const pbh = 22;
      const pbx = right - 6 - pbw;
      const pby = ly - pbh / 2;
      const pricePill = `<rect x="${n(pbx)}" y="${n(pby)}" width="${n(pbw)}" height="${pbh}" rx="4" fill="${C.card}" stroke="${col}" stroke-width="1"/><text x="${n(pbx + pbw / 2)}" y="${n(ly)}" fill="${col}" font-size="${priceFs}" font-weight="600" text-anchor="middle" dominant-baseline="central" font-family="${FONT_MONO}">${esc(price)}</text>`;

      return `<line x1="${left}" y1="${n(ly)}" x2="${right}" y2="${n(ly)}" stroke="${col}" stroke-width="1.4" ${dash} opacity="0.9"/>${badge}${pricePill}`;
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
  // Bumped a bit to make room for the directional arrow prefix on the pill.
  const pillW = isShort ? 124 : 116;
  const pillX = 56;
  const pillY = 212;
  const pillH = 28;
  const namePillGap = 12;
  const generatedAt = formatGeneratedAt(new Date());
  const signalArrow = isShort ? "\u25BC" : "\u25B2"; // ▼ / ▲

  // ── Stats row ──────────────────────────────────────────────────────────
  // Three columns: R:R aligned to left, RISK centered, REWARD aligned to right.
  const statsLabelY = 869;
  const statsValueY = 913;
  const reward = model.risk * model.riskReward;

  // ── Footer ─────────────────────────────────────────────────────────────
  // Baseline placed so the gap from the bottom purple separator (y=948) to
  // the footer's text top mirrors the kop surat ↔ top separator gap (~28px).
  const footerY = 989;

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
<text x="${W - 56}" y="${logoY + 22}" fill="${C.muted}" font-size="11" font-weight="700" text-anchor="end" font-family="${FONT}" letter-spacing="0.24em">GENERATED</text>
<text x="${W - 56}" y="${logoY + 46}" fill="${C.text}" font-size="16" font-weight="700" text-anchor="end" font-family="${FONT_MONO}">${esc(generatedAt)}</text>

<!-- Brand-purple separator: divides letterhead from asset section -->
<line x1="56" y1="128" x2="${W - 56}" y2="128" stroke="${C.primary}" stroke-width="2"/>

<!-- Symbol + signal pill (with directional arrow) + name -->
<text x="56" y="${symbolY}" fill="${C.text}" font-size="56" font-weight="800" font-family="${FONT}" letter-spacing="-0.02em">${esc(meta.symbol)}</text>
<rect x="${pillX}" y="${pillY}" rx="6" width="${pillW}" height="${pillH}" fill="${accentFill}" stroke="${accent}"/>
<text x="${pillX + pillW / 2}" y="${pillY + pillH / 2 + 1}" fill="${accent}" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="central" font-family="${FONT}" letter-spacing="0.08em">${signalArrow} ${esc(model.signal.toUpperCase())} ${Math.round(meta.strength)}%</text>
<text x="${pillX + pillW + namePillGap}" y="${pillY + pillH / 2 + 1}" fill="${C.muted}" font-size="16" dominant-baseline="central" font-family="${FONT}">${esc(meta.name ?? "")}</text>

<!-- Top-right: current price (value first, label below) -->
<text x="${W - 56}" y="${logoY + 148}" fill="${C.text}" font-size="36" font-weight="800" text-anchor="end" font-family="${FONT_MONO}" letter-spacing="-0.01em">${esc(formatPrice(meta.currentPrice, meta.assetType))}</text>
<text x="${W - 56}" y="${logoY + 176}" fill="${C.muted}" font-size="11" font-weight="700" text-anchor="end" font-family="${FONT}" letter-spacing="0.24em">CURRENT PRICE</text>

<!-- Chart panel (flat card background, matches web) -->
<rect x="${px0}" y="${top - 22}" width="${px1 - px0}" height="${bottom - top + 44}" rx="14" fill="${C.card}" stroke="${C.border}"/>
${zoneRect(model.profitZone.from, model.profitZone.to, C.emeraldFill)}
${zoneRect(model.riskZone.from, model.riskZone.to, C.roseFill)}
<line x1="${n(projX)}" y1="${top}" x2="${n(projX)}" y2="${bottom}" stroke="${C.border}" stroke-dasharray="2 3"/>
${candles}
${levels}

<!-- Hairline divider above stats (panel border serves as visual separator,
     no extra divider needed here). -->

<!-- Stats row: R:R (left) · RISK (center) · REWARD (right) -->
<text x="56" y="${statsLabelY}" fill="${C.muted}" font-size="14" font-weight="700" text-anchor="start" font-family="${FONT}" letter-spacing="0.24em">RISK : REWARD</text>
<text x="56" y="${statsValueY}" fill="${C.text}" font-size="34" font-weight="800" text-anchor="start" font-family="${FONT_MONO}">1 : ${formatRatio(model.riskReward)}</text>

<text x="${W / 2}" y="${statsLabelY}" fill="${C.muted}" font-size="14" font-weight="700" text-anchor="middle" font-family="${FONT}" letter-spacing="0.24em">RISK</text>
<text x="${W / 2}" y="${statsValueY}" fill="${C.rose}" font-size="34" font-weight="800" text-anchor="middle" font-family="${FONT_MONO}">${model.risk > 0 ? esc(formatPrice(model.risk, meta.assetType)) : "-"}</text>

<text x="${W - 56}" y="${statsLabelY}" fill="${C.muted}" font-size="14" font-weight="700" text-anchor="end" font-family="${FONT}" letter-spacing="0.24em">REWARD</text>
<text x="${W - 56}" y="${statsValueY}" fill="${C.emerald}" font-size="34" font-weight="800" text-anchor="end" font-family="${FONT_MONO}">${reward > 0 ? esc(formatPrice(reward, meta.assetType)) : "-"}</text>

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
    await nav.share({ files: [file], title: filename });
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
