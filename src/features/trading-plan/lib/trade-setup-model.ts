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

/** Map a price into a [0..1] ratio within [min..max] (0 = min, 1 = max). */
export function priceToRatio(price: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (price - min) / (max - min)));
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

  // Scale to the recent price action + the plan levels only. Using a recent
  // window (not the full history) stops old, far-away candles from dragging the
  // scale and opening a large empty band below the action. Must match the
  // window used by the chart renderer so on-screen candles aren't clipped.
  const recent = candles.slice(-MAX_CANDLES);
  const highs = [...levelPrices, ref, ...recent.map((c) => c.high)];
  const lows = [...levelPrices, ref, ...recent.map((c) => c.low)];
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
