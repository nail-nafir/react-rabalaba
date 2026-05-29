import type { AssetType, SignalDirection } from "@/types/asset";
import type { MarketRegime } from "@/types/market";
import { computeSignal } from "./signal-engine";
import { computeTradingPlan } from "./trading-plan";
import { buildSignalSeriesFromCandles } from "@/services/adapters/yahoo-candles";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  TIMEFRAME_PRESETS,
  type TimeframePresetKey,
} from "@/constants/timeframes";

export interface BacktestTrade {
  direction: Exclude<SignalDirection, "neutral">;
  entryIndex: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: "take_profit" | "stop_loss" | "opposite_signal" | "end_of_data";
  /** Realized reward-to-risk multiple (positive = win). */
  r: number;
  regime: MarketRegime;
}

export interface RegimeStat {
  trades: number;
  winRate: number;
  expectancy: number;
}

export interface BacktestMetrics {
  trades: number;
  winRate: number;
  /** Average R per trade. */
  expectancy: number;
  /** Gross profit / gross loss (in R). Infinity when there are no losses. */
  profitFactor: number;
  /** Worst peak-to-trough decline of the equity curve, in R. */
  maxDrawdownR: number;
  perRegime: Record<MarketRegime, RegimeStat>;
}

interface OpenTrade {
  direction: Exclude<SignalDirection, "neutral">;
  entryIndex: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  risk: number;
  regime: MarketRegime;
}

const EMPTY_REGIME_STAT: RegimeStat = { trades: 0, winRate: 0, expectancy: 0 };

function emptyMetrics(): BacktestMetrics {
  return {
    trades: 0,
    winRate: 0,
    expectancy: 0,
    profitFactor: 0,
    maxDrawdownR: 0,
    perRegime: {
      trending: { ...EMPTY_REGIME_STAT },
      ranging: { ...EMPTY_REGIME_STAT },
      high_volatility: { ...EMPTY_REGIME_STAT },
      low_volatility: { ...EMPTY_REGIME_STAT },
    },
  };
}

function realizedR(trade: OpenTrade, exitPrice: number): number {
  const move =
    trade.direction === "long"
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;
  return trade.risk > 0 ? move / trade.risk : 0;
}

/** Worst-case intrabar exit (stop checked before target). */
function checkBarExit(
  trade: OpenTrade,
  bar: NormalizedYahooCandle,
): { price: number; reason: "stop_loss" | "take_profit" } | null {
  if (trade.direction === "long") {
    if (bar.low <= trade.stopLoss)
      return { price: trade.stopLoss, reason: "stop_loss" };
    if (bar.high >= trade.takeProfit)
      return { price: trade.takeProfit, reason: "take_profit" };
  } else {
    if (bar.high >= trade.stopLoss)
      return { price: trade.stopLoss, reason: "stop_loss" };
    if (bar.low <= trade.takeProfit)
      return { price: trade.takeProfit, reason: "take_profit" };
  }
  return null;
}

/**
 * Walk-forward backtest with NO lookahead: at each bar i the engine only sees
 * candles[0..i] and any entry is filled at candle[i+1].open. A single position
 * is held at a time. Exits: stop/target on the following bars, opposite signal
 * at the next open, or end-of-data at the final close.
 */
export function runBacktest(
  candles: NormalizedYahooCandle[],
  options: { assetType?: AssetType; timeframe?: TimeframePresetKey } = {},
): { metrics: BacktestMetrics; trades: BacktestTrade[] } {
  const { assetType, timeframe = "swing" } = options;
  const warmup = TIMEFRAME_PRESETS[timeframe].signalProfile.minCandles;

  const trades: BacktestTrade[] = [];
  let open: OpenTrade | null = null;

  for (let i = warmup; i < candles.length - 1; i++) {
    const series = buildSignalSeriesFromCandles(candles.slice(0, i + 1));
    const outlook = computeSignal({ ...series, assetType, timeframe });
    const nextBar = candles[i + 1];

    // 1. Manage an open position against the next bar (no same-bar entry+exit).
    if (open) {
      const hit = checkBarExit(open, nextBar);
      if (hit) {
        trades.push({
          direction: open.direction,
          entryIndex: open.entryIndex,
          entryPrice: open.entryPrice,
          exitPrice: hit.price,
          exitReason: hit.reason,
          r: realizedR(open, hit.price),
          regime: open.regime,
        });
        open = null;
      } else if (
        outlook.signal !== "neutral" &&
        outlook.signal !== open.direction
      ) {
        trades.push({
          direction: open.direction,
          entryIndex: open.entryIndex,
          entryPrice: open.entryPrice,
          exitPrice: nextBar.open,
          exitReason: "opposite_signal",
          r: realizedR(open, nextBar.open),
          regime: open.regime,
        });
        open = null;
      }
    }

    // 2. Enter a new position while flat, filled at the next bar's open.
    if (!open && outlook.signal !== "neutral") {
      const plan = computeTradingPlan(outlook, nextBar.open, assetType ?? "us-stock");
      if (plan) {
        open = {
          direction: outlook.signal,
          entryIndex: i + 1,
          entryPrice: nextBar.open,
          stopLoss: plan.stopLoss,
          takeProfit: plan.takeProfit1,
          risk: Math.abs(nextBar.open - plan.stopLoss),
          regime: outlook.regime,
        };
      }
    }
  }

  // Close any position still open at the final close.
  if (open && candles.length > 0) {
    const last = candles[candles.length - 1];
    trades.push({
      direction: open.direction,
      entryIndex: open.entryIndex,
      entryPrice: open.entryPrice,
      exitPrice: last.close,
      exitReason: "end_of_data",
      r: realizedR(open, last.close),
      regime: open.regime,
    });
  }

  return { metrics: summarize(trades), trades };
}

function summarize(trades: BacktestTrade[]): BacktestMetrics {
  if (trades.length === 0) return emptyMetrics();

  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;

  const byRegime = emptyMetrics().perRegime;
  const regimeR: Record<MarketRegime, number[]> = {
    trending: [],
    ranging: [],
    high_volatility: [],
    low_volatility: [],
  };

  for (const t of trades) {
    if (t.r > 0) {
      wins += 1;
      grossProfit += t.r;
    } else {
      grossLoss += Math.abs(t.r);
    }
    equity += t.r;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
    regimeR[t.regime].push(t.r);
  }

  (Object.keys(regimeR) as MarketRegime[]).forEach((regime) => {
    const rs = regimeR[regime];
    if (rs.length === 0) return;
    const w = rs.filter((r) => r > 0).length;
    byRegime[regime] = {
      trades: rs.length,
      winRate: w / rs.length,
      expectancy: rs.reduce((s, r) => s + r, 0) / rs.length,
    };
  });

  return {
    trades: trades.length,
    winRate: wins / trades.length,
    expectancy: trades.reduce((s, t) => s + t.r, 0) / trades.length,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    maxDrawdownR,
    perRegime: byRegime,
  };
}
