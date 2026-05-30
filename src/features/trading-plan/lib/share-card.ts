import { formatPrice, formatRatio } from "@/lib/formatters";
import type { AssetType } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import { priceToRatio, type TradeSetupModel } from "./trade-setup-model";

export interface ShareCardMeta {
  symbol: string;
  name?: string;
  strength: number;
  currentPrice: number;
  assetType: AssetType;
  candles: NormalizedYahooCandle[];
}

const W = 1200;
const H = 630;

// Self-contained palette (explicit hex — no CSS vars / oklch, so canvas renders).
const C = {
  bg: "#0a0a0b",
  panel: "#111114",
  border: "#27272a",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  emerald: "#34d399",
  emeraldFill: "rgba(52,211,153,0.12)",
  rose: "#fb7185",
  roseFill: "rgba(251,113,133,0.12)",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const n = (v: number) => v.toFixed(1);

/** Build a standalone, brandable PNG-ready SVG of the trade setup. */
export function buildShareCardSvg(
  model: TradeSetupModel,
  meta: ShareCardMeta,
): string {
  const isShort = model.signal === "short";
  const accent = isShort ? C.rose : C.emerald;
  const accentFill = isShort ? C.roseFill : C.emeraldFill;

  // chart panel geometry
  const px0 = 56;
  const px1 = W - 56;
  const top = 210;
  const bottom = 498;
  const left = px0 + 16;
  const right = px1 - 16;
  const projX = left + (right - left) * 0.74;
  const chartH = bottom - top;
  const y = (price: number) =>
    top + (1 - priceToRatio(price, model.priceMin, model.priceMax)) * chartH;

  const view = meta.candles
    .filter((c) => c.high >= model.priceMin && c.low <= model.priceMax)
    .slice(-80);
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
      const bw = Math.max(1, slot * 0.6);
      return `<line x1="${n(cx)}" y1="${n(y(c.high))}" x2="${n(cx)}" y2="${n(y(c.low))}" stroke="${col}" stroke-width="1.2"/><rect x="${n(cx - bw / 2)}" y="${n(bt)}" width="${n(bw)}" height="${n(bh)}" fill="${col}"/>`;
    })
    .join("");

  const zoneRect = (from: number, to: number, fill: string) => {
    const yt = Math.min(y(from), y(to));
    const h = Math.abs(y(from) - y(to));
    return `<rect x="${left}" y="${n(yt)}" width="${n(right - left)}" height="${n(h)}" fill="${fill}"/>`;
  };

  const levels = model.levels
    .map((lvl) => {
      const ly = y(lvl.price);
      const col =
        lvl.kind === "risk" ? C.rose : lvl.kind === "profit" ? C.emerald : C.text;
      const dash = lvl.kind === "entry" ? "" : `stroke-dasharray="6 5"`;
      return `<line x1="${left}" y1="${n(ly)}" x2="${right}" y2="${n(ly)}" stroke="${col}" stroke-width="1.4" ${dash} opacity="0.9"/><text x="${projX + 8}" y="${n(ly - 6)}" fill="${col}" font-size="15" font-weight="700" font-family="${FONT}">${esc(lvl.labelKey.toUpperCase().replace("STOP_LOSS", "SL"))}</text><text x="${right}" y="${n(ly - 6)}" fill="${col}" font-size="15" font-weight="600" text-anchor="end" font-family="${FONT}">${esc(formatPrice(lvl.price, meta.assetType))}</text>`;
    })
    .join("");

  const pillW = isShort ? 132 : 122;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect x="0" y="0" width="${W}" height="6" fill="${accent}"/>
<text x="56" y="104" fill="${C.text}" font-size="64" font-weight="800" font-family="${FONT}">${esc(meta.symbol)}</text>
<rect x="58" y="124" rx="6" width="${pillW}" height="34" fill="${accentFill}" stroke="${accent}"/>
<text x="${58 + pillW / 2}" y="147" fill="${accent}" font-size="18" font-weight="800" text-anchor="middle" font-family="${FONT}">${esc(model.signal.toUpperCase())} ${Math.round(meta.strength)}%</text>
<text x="${58 + pillW + 22}" y="150" fill="${C.muted}" font-size="20" font-family="${FONT}">${esc(meta.name ?? "")}</text>
<text x="${W - 56}" y="80" fill="${C.text}" font-size="26" font-weight="800" text-anchor="end" font-family="${FONT}">RABALABA</text>
<text x="${W - 56}" y="106" fill="${C.muted}" font-size="15" text-anchor="end" font-family="${FONT}">Research Terminal</text>
<text x="${W - 56}" y="150" fill="${C.text}" font-size="30" font-weight="700" text-anchor="end" font-family="${FONT}">${esc(formatPrice(meta.currentPrice, meta.assetType))}</text>
<rect x="${px0}" y="${top - 22}" width="${px1 - px0}" height="${bottom - top + 44}" rx="14" fill="${C.panel}" stroke="${C.border}"/>
${zoneRect(model.profitZone.from, model.profitZone.to, C.emeraldFill)}
${zoneRect(model.riskZone.from, model.riskZone.to, C.roseFill)}
<line x1="${n(projX)}" y1="${top}" x2="${n(projX)}" y2="${bottom}" stroke="${C.border}" stroke-dasharray="3 4"/>
${candles}
${levels}
<text x="56" y="544" fill="${C.muted}" font-size="18" font-weight="600" font-family="${FONT}">RISK : REWARD</text>
<text x="56" y="582" fill="${C.text}" font-size="40" font-weight="800" font-family="${FONT}">1 : ${formatRatio(model.riskReward)}</text>
<text x="${W - 56}" y="544" fill="${C.muted}" font-size="18" font-weight="600" text-anchor="end" font-family="${FONT}">RISK</text>
<text x="${W - 56}" y="582" fill="${accent}" font-size="40" font-weight="800" text-anchor="end" font-family="${FONT}">${model.risk > 0 ? esc(formatPrice(model.risk, meta.assetType)) : "-"}</text>
<text x="56" y="612" fill="${C.muted}" font-size="14" font-family="${FONT}">Not financial advice. DYOR. Past performance does not guarantee future results.</text>
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
