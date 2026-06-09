import type { AssetType, SignalDirection, SignalTier } from "@/types/asset";
import type { MarketRegime } from "@/types/market";
import { computeSignal } from "./signals";
import { computeTradingPlan } from "./trading-plan";
import { buildSignalSeriesFromCandles } from "@/services/adapters/yahoo-candles";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";
import {
  TIMEFRAME_PRESETS,
  type TimeframePresetKey,
} from "@/constants/timeframes";
import { BACKTEST_COSTS } from "@/constants/signals";

/**
 * Exit model:
 * - "scaleOut" (default): scale out 50% at TP1, 30% at TP2, 20% at TP3, and move
 *   the stop to breakeven after TP1 — matching the 3-TP plan the UI actually
 *   shows the trader. This is what the displayed win-rate should reflect.
 * - "tp1": legacy single full exit at TP1. Kept for comparison.
 */
export type ExitMode = "tp1" | "scaleOut";

const SCALE_OUT_LEGS: { tpIndex: number; fraction: number }[] = [
  { tpIndex: 0, fraction: 0.5 },
  { tpIndex: 1, fraction: 0.3 },
  { tpIndex: 2, fraction: 0.2 },
];

export interface BacktestTrade {
  direction: Exclude<SignalDirection, "neutral">;
  entryIndex: number;
  entryPrice: number;
  /** Blended average exit price across partial fills. */
  exitPrice: number;
  exitReason: "take_profit" | "stop_loss" | "opposite_signal" | "end_of_data";
  /** Realized reward-to-risk multiple, NET of fees + slippage. */
  r: number;
  regime: MarketRegime;
  /** Signal tier at entry — enables per-tier calibration. */
  tier: SignalTier;
}

export interface RegimeStat {
  trades: number;
  winRate: number;
  expectancy: number;
}

export interface BacktestMetrics {
  trades: number;
  winRate: number;
  /** Average R per trade (net of costs). */
  expectancy: number;
  /** Gross profit / gross loss (in R). Infinity when there are no losses. */
  profitFactor: number;
  /** Worst peak-to-trough decline of the equity curve, in R. */
  maxDrawdownR: number;
  perRegime: Record<MarketRegime, RegimeStat>;
  /** Per-tier stats — the basis for confidence calibration. */
  perTier: Record<SignalTier, RegimeStat>;
}

interface TradeLeg {
  price: number;
  fraction: number;
}

interface OpenTrade {
  direction: Exclude<SignalDirection, "neutral">;
  entryIndex: number;
  entryPrice: number;
  /** Current stop — moves to breakeven after the first take-profit fills. */
  stop: number;
  legs: TradeLeg[];
  nextLeg: number;
  /** Initial risk magnitude (> 0). */
  risk: number;
  regime: MarketRegime;
  tier: SignalTier;
  /** Open fraction of the position (1 → 0). */
  remaining: number;
  /** Net R accumulated from partial exits so far. */
  realizedR: number;
  /** Σ fraction × fill price, for reporting a blended exit price. */
  weightedExit: number;
  /** fee + slippage per side, as a fraction of price. */
  costRate: number;
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
    perTier: {
      A: { ...EMPTY_REGIME_STAT },
      B: { ...EMPTY_REGIME_STAT },
      C: { ...EMPTY_REGIME_STAT },
    },
  };
}

function costRateFor(assetType?: AssetType): number {
  const c =
    assetType === "crypto" ? BACKTEST_COSTS.crypto : BACKTEST_COSTS.default;
  return c.fee + c.slippage;
}

/** Net R contributed by exiting `fraction` of the position at `exitPrice`,
 *  including entry + exit costs on that fraction's notional. */
function partialR(
  trade: OpenTrade,
  exitPrice: number,
  fraction: number,
): number {
  if (trade.risk <= 0 || fraction <= 0) return 0;
  const move =
    trade.direction === "long"
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;
  const grossR = (move / trade.risk) * fraction;
  const costPrice = (trade.entryPrice + exitPrice) * trade.costRate * fraction;
  return grossR - costPrice / trade.risk;
}

function closeRemaining(trade: OpenTrade, exitPrice: number): void {
  trade.realizedR += partialR(trade, exitPrice, trade.remaining);
  trade.weightedExit += exitPrice * trade.remaining;
  trade.remaining = 0;
}

/**
 * Advance an open position against one bar. Stop is checked before targets
 * (worst-case intrabar). Returns the exit reason when the position fully closes.
 */
function stepBar(
  trade: OpenTrade,
  bar: NormalizedYahooCandle,
  moveToBE: boolean,
): "take_profit" | "stop_loss" | null {
  const stopHit =
    trade.direction === "long" ? bar.low <= trade.stop : bar.high >= trade.stop;
  if (stopHit) {
    closeRemaining(trade, trade.stop);
    return "stop_loss";
  }

  while (trade.nextLeg < trade.legs.length) {
    const leg = trade.legs[trade.nextLeg];
    const tpHit =
      trade.direction === "long" ? bar.high >= leg.price : bar.low <= leg.price;
    if (!tpHit) break;

    const fillFraction = Math.min(leg.fraction, trade.remaining);
    trade.realizedR += partialR(trade, leg.price, fillFraction);
    trade.weightedExit += leg.price * fillFraction;
    trade.remaining -= fillFraction;

    // Lock in the trade after the first target: move stop to breakeven.
    if (trade.nextLeg === 0 && moveToBE && trade.legs.length > 1) {
      trade.stop = trade.entryPrice;
    }
    trade.nextLeg += 1;

    if (trade.remaining <= 1e-9) {
      trade.remaining = 0;
      return "take_profit";
    }
  }

  return null;
}

function finalize(
  trade: OpenTrade,
  exitReason: BacktestTrade["exitReason"],
): BacktestTrade {
  return {
    direction: trade.direction,
    entryIndex: trade.entryIndex,
    entryPrice: trade.entryPrice,
    exitPrice: trade.weightedExit, // already fraction-weighted; sums to full size
    exitReason,
    r: trade.realizedR,
    regime: trade.regime,
    tier: trade.tier,
  };
}

/**
 * Walk-forward backtest with NO lookahead: at each bar i the engine only sees
 * candles[0..i] and any entry is filled at candle[i+1].open. A single position
 * is held at a time. Exits: scale-out at TP1/TP2/TP3 (or single TP1 in "tp1"
 * mode), stop (→ breakeven after TP1), opposite signal at the next open, or
 * end-of-data at the final close. Fees + slippage are deducted from every fill.
 */
export function runBacktest(
  candles: NormalizedYahooCandle[],
  options: {
    assetType?: AssetType;
    timeframe?: TimeframePresetKey;
    exitMode?: ExitMode;
  } = {},
): { metrics: BacktestMetrics; trades: BacktestTrade[] } {
  const { assetType, timeframe = "swing", exitMode = "scaleOut" } = options;
  const warmup = TIMEFRAME_PRESETS[timeframe].signalProfile.minCandles;
  const costRate = costRateFor(assetType);

  const trades: BacktestTrade[] = [];
  let open: OpenTrade | null = null;

  for (let i = warmup; i < candles.length - 1; i++) {
    const series = buildSignalSeriesFromCandles(candles.slice(0, i + 1));
    const outlook = computeSignal({ ...series, assetType, timeframe });
    const nextBar = candles[i + 1];

    // 1. Manage an open position against the next bar (no same-bar entry+exit).
    if (open) {
      const reason = stepBar(open, nextBar, exitMode === "scaleOut");
      if (reason) {
        trades.push(finalize(open, reason));
        open = null;
      } else if (
        outlook.signal !== "neutral" &&
        outlook.signal !== open.direction
      ) {
        closeRemaining(open, nextBar.open);
        trades.push(finalize(open, "opposite_signal"));
        open = null;
      }
    }

    // 2. Enter a new position while flat, filled at the next bar's open.
    if (!open && outlook.signal !== "neutral") {
      const plan = computeTradingPlan(
        outlook,
        nextBar.open,
        assetType ?? "us-stock",
      );
      if (plan) {
        const risk = Math.abs(nextBar.open - plan.stopLoss);
        const tps = [
          plan.takeProfit1,
          plan.takeProfit2,
          plan.takeProfit3 ?? plan.takeProfit2,
        ];
        const legPlan =
          exitMode === "scaleOut"
            ? SCALE_OUT_LEGS
            : [{ tpIndex: 0, fraction: 1 }];
        open = {
          direction: outlook.signal,
          entryIndex: i + 1,
          entryPrice: nextBar.open,
          stop: plan.stopLoss,
          legs: legPlan.map((l) => ({
            price: tps[l.tpIndex],
            fraction: l.fraction,
          })),
          nextLeg: 0,
          risk,
          regime: outlook.regime,
          tier: outlook.tier,
          remaining: 1,
          realizedR: 0,
          weightedExit: 0,
          costRate,
        };
      }
    }
  }

  // Close any position still open at the final close.
  if (open && candles.length > 0) {
    closeRemaining(open, candles[candles.length - 1].close);
    trades.push(finalize(open, "end_of_data"));
  }

  return { metrics: summarize(trades), trades };
}

function statFrom(rs: number[]): RegimeStat {
  if (rs.length === 0) return { ...EMPTY_REGIME_STAT };
  const wins = rs.filter((r) => r > 0).length;
  return {
    trades: rs.length,
    winRate: wins / rs.length,
    expectancy: rs.reduce((s, r) => s + r, 0) / rs.length,
  };
}

function summarize(trades: BacktestTrade[]): BacktestMetrics {
  if (trades.length === 0) return emptyMetrics();

  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;

  const metrics = emptyMetrics();
  const regimeR: Record<MarketRegime, number[]> = {
    trending: [],
    ranging: [],
    high_volatility: [],
    low_volatility: [],
  };
  const tierR: Record<SignalTier, number[]> = { A: [], B: [], C: [] };

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
    tierR[t.tier].push(t.r);
  }

  (Object.keys(regimeR) as MarketRegime[]).forEach((regime) => {
    metrics.perRegime[regime] = statFrom(regimeR[regime]);
  });
  (Object.keys(tierR) as SignalTier[]).forEach((tier) => {
    metrics.perTier[tier] = statFrom(tierR[tier]);
  });

  metrics.trades = trades.length;
  metrics.winRate = wins / trades.length;
  metrics.expectancy = trades.reduce((s, t) => s + t.r, 0) / trades.length;
  metrics.profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  metrics.maxDrawdownR = maxDrawdownR;
  return metrics;
}
