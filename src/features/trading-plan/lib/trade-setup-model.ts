import type { TradingPlan, SignalDirection } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";

/**
 * Single source of truth for candle window size used by the trade setup chart.
 * Controls both how many recent candles are rendered and how the price scale
 * is computed (so old, far-away candles don't drag the scale and clip the
 * recent action).
 */
export const MAX_CANDLES = 120;

/**
 * Horizontal split between the candle area (left) and the level-badge / price
 * pill area (right). 0..1 ratio of the chart's drawable width. Higher = more
 * room for candles, narrower badge column.
 */
export const PROJ_X_RATIO = 0.85;

export type LevelKind = "entry" | "risk" | "profit";
export type LevelKey = "entry" | "sl" | "tp1" | "tp2" | "tp3";

export interface SetupLevel {
  key: LevelKey;
  /** i18n key under `dialog.*` */
  labelKey: string;
  price: number;
  /** Signed % distance from the current price. */
  pctFromCurrent: number;
  /** Reward in R for take-profits; 0 for entry/stop. */
  rMultiple: number;
  kind: LevelKind;
}

export interface TradeSetupModel {
  signal: "long" | "short";
  priceMin: number;
  priceMax: number;
  /** Absolute price distance entry → stop-loss. */
  risk: number;
  entry: number;
  stopLoss: number;
  riskReward: number;
  levels: SetupLevel[];
  /** Profit shading bounds (entry → furthest take-profit). */
  profitZone: { from: number; to: number };
  /** Risk shading bounds (entry → stop-loss). */
  riskZone: { from: number; to: number };
}

/** A point-in-time annotation (entry / close) plotted on the candle chart. */
export interface ChartMarker {
  kind: "entry" | "close";
  /** Event time in ms (e.g. followedAt / closedAt). */
  timestamp: number;
  /** Price at which the marker is drawn (entryPrice / closePrice). */
  price: number;
  /** Close markers are colored by realized outcome; entry stays neutral. */
  outcome?: "profit" | "loss";
}

/** A chart marker resolved to a concrete candle index within the view window. */
export interface MappedMarker extends ChartMarker {
  /** Index into the supplied `view` array of the resolved candle. */
  candleIndex: number;
  /** True when the event time fell outside the window and was clamped to an edge. */
  outOfRange?: boolean;
  /** Which edge it was clamped to (only meaningful when `outOfRange`). */
  edge?: "start" | "end";
}

/**
 * Resolve each marker to a candle in the rendered `view`. Markers inside the
 * visible window snap to the nearest candle (min absolute timestamp distance);
 * markers outside it are clamped to the nearest edge and flagged `outOfRange`
 * so the chart can render an off-screen indicator instead of a false position.
 * Pure. Returns [] for an empty view.
 */
export function mapMarkerToCandle(
  markers: ChartMarker[],
  view: { timestamp: number }[],
): MappedMarker[] {
  if (view.length === 0) return [];
  const first = view[0].timestamp;
  const last = view[view.length - 1].timestamp;
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  // Candle indices for the earliest/latest visible time (candles are ascending,
  // but resolve generally in case the order is ever reversed).
  const startIdx = first <= last ? 0 : view.length - 1;
  const endIdx = first <= last ? view.length - 1 : 0;

  const mapped: MappedMarker[] = [];
  for (const marker of markers) {
    if (marker.timestamp < lo) {
      mapped.push({
        ...marker,
        candleIndex: startIdx,
        outOfRange: true,
        edge: "start",
      });
      continue;
    }
    if (marker.timestamp > hi) {
      mapped.push({
        ...marker,
        candleIndex: endIdx,
        outOfRange: true,
        edge: "end",
      });
      continue;
    }
    let candleIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < view.length; i++) {
      const dist = Math.abs(view[i].timestamp - marker.timestamp);
      if (dist < bestDist) {
        bestDist = dist;
        candleIndex = i;
      }
    }
    mapped.push({ ...marker, candleIndex });
  }
  return mapped;
}

/** Map a price into a [0..1] ratio within [min..max] (0 = min, 1 = max). */
export function priceToRatio(price: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (price - min) / (max - min)));
}

/** Evenly-spaced price values across [min..max] inclusive, ascending. */
export function priceTicks(min: number, max: number, count = 5): number[] {
  if (max <= min || count < 2) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/** Evenly-spaced candle indices in [0..length-1], unique and ascending. */
export function dateTickIndices(length: number, count = 7): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (count - 1);
  return Array.from(
    new Set(Array.from({ length: count }, (_, i) => Math.round(step * i))),
  );
}

/**
 * Build the geometry + numeric model for the visual trade setup. Pure: covers
 * both candle extremes and every plan level so nothing is clipped, and exposes
 * per-level distance (%) and reward (R) for the numeric panel.
 */
export function buildTradeSetupModel(
  candles: NormalizedYahooCandle[],
  plan: TradingPlan,
  signal: SignalDirection,
  currentPrice: number,
): TradeSetupModel {
  const isShort = signal === "short";
  const risk = Math.abs(plan.entry - plan.stopLoss);
  const ref = currentPrice > 0 ? currentPrice : plan.entry;

  const tps = [plan.takeProfit1, plan.takeProfit2, plan.takeProfit3].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );

  const pct = (price: number) => (ref > 0 ? ((price - ref) / ref) * 100 : 0);
  const rMult = (price: number) =>
    risk > 0 ? Math.abs(price - plan.entry) / risk : 0;

  const levels: SetupLevel[] = [
    {
      key: "entry",
      labelKey: "entry",
      price: plan.entry,
      pctFromCurrent: pct(plan.entry),
      rMultiple: 0,
      kind: "entry",
    },
    {
      key: "sl",
      labelKey: "stop_loss",
      price: plan.stopLoss,
      pctFromCurrent: pct(plan.stopLoss),
      rMultiple: rMult(plan.stopLoss),
      kind: "risk",
    },
    ...tps.map<SetupLevel>((price, i) => ({
      key: `tp${i + 1}` as LevelKey,
      labelKey: `tp${i + 1}`,
      price,
      pctFromCurrent: pct(price),
      rMultiple: rMult(price),
      kind: "profit",
    })),
  ];

  const levelPrices = levels.map((l) => l.price);

  // Scale to the plan levels + current price, plus candle extremes that sit
  // within a band around the plan's own range. Clipping out-of-band candles
  // stops old, far-away action (e.g. a coin that has since 10x'd) from dragging
  // the scale and opening a huge empty gap. Levels and the current price are
  // always enclosed. Uses a recent window first to bound the work.
  const recent = candles.slice(-MAX_CANDLES);
  const anchorLow = Math.min(...levelPrices, ref);
  const anchorHigh = Math.max(...levelPrices, ref);
  const span = anchorHigh - anchorLow || ref * 0.1 || 1;
  const inBand = (p: number) => p >= anchorLow - span && p <= anchorHigh + span;
  const candleHighs = recent.map((c) => c.high).filter(inBand);
  const candleLows = recent.map((c) => c.low).filter(inBand);
  const highs = [...levelPrices, ref, ...candleHighs];
  const lows = [...levelPrices, ref, ...candleLows];
  let max = Math.max(...highs);
  let min = Math.min(...lows);
  const pad = (max - min) * 0.05 || ref * 0.02 || 1;
  max += pad;
  min -= pad;

  const furthestTp = tps.length ? tps[tps.length - 1] : plan.entry;

  return {
    signal: isShort ? "short" : "long",
    priceMin: min,
    priceMax: max,
    risk,
    entry: plan.entry,
    stopLoss: plan.stopLoss,
    riskReward: plan.riskRewardRatio,
    levels,
    profitZone: { from: plan.entry, to: furthestTp },
    riskZone: { from: plan.entry, to: plan.stopLoss },
  };
}
