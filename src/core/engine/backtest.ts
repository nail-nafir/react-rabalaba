import type { AssetType, SignalDirection, SignalTier } from "@/types/asset";
import type { MarketRegime } from "@/types/market";
import { computeSignal } from "./signals";
import type { Outlook } from "@/types/engine";
import { computeTradingPlan } from "./trading-plan";
import {
  buildSignalSeriesFromCandles,
  deriveCandleTrendState,
  resampleCandles,
} from "@/core/market/candles";
import type { NormalizedYahooCandle } from "@/core/market/candles";
import {
  TIMEFRAME_PRESETS,
  HIGHER_TIMEFRAME_FACTOR,
  type TimeframePresetKey,
} from "@/constants/timeframes";
import { BACKTEST_COSTS } from "@/constants/signals";
import type { ExitReason } from "@/core/trade/follow-trade-model";

/**
 * Exit model:
 * - "progressive" (default): TP1 moves stop to entry; each later partial TP
 *   moves it one target behind until the final target exits.
 * - "terminal": partial targets are progress; stop stays at its original level.
 * - "secured": research comparison that ratchets the full-position stop to
 *   every reached TP until the final target exits.
 * - "scaleOut": legacy partial-fill model, retained for comparison only.
 * - "tp1": legacy single full exit at TP1. Kept for comparison.
 */
export type ExitMode =
  | "progressive"
  | "terminal"
  | "secured"
  | "tp1"
  | "scaleOut";

export type BacktestExitReason = ExitReason | "end_of_data";

const SCALE_OUT_LEGS: { tpIndex: number; fraction: number }[] = [
  { tpIndex: 0, fraction: 0.5 },
  { tpIndex: 1, fraction: 0.3 },
  { tpIndex: 2, fraction: 0.2 },
];

export interface BacktestTrade {
  direction: Exclude<SignalDirection, "neutral">;
  decisionIndex: number;
  decisionTimestamp: number;
  entryIndex: number;
  entryTimestamp: number;
  entryPrice: number;
  exitIndex: number;
  exitTimestamp: number;
  /** Blended average exit price across partial fills. */
  exitPrice: number;
  exitReason: BacktestExitReason;
  /** Realized reward-to-risk multiple before fees + slippage. */
  grossR: number;
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
  decisionIndex: number;
  decisionTimestamp: number;
  entryIndex: number;
  entryTimestamp: number;
  entryPrice: number;
  /** Current full-position stop. */
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
  /** Gross R accumulated from partial exits so far. */
  grossRealizedR: number;
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
  const move =
    trade.direction === "long"
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;
  trade.grossRealizedR += (move / trade.risk) * trade.remaining;
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
  exitMode: ExitMode,
): Exclude<ExitReason, "reversal"> | null {
  const gapThroughStop =
    trade.direction === "long"
      ? bar.open <= trade.stop
      : bar.open >= trade.stop;
  const stopHit =
    gapThroughStop ||
    (trade.direction === "long"
      ? bar.low <= trade.stop
      : bar.high >= trade.stop);
  if (stopHit) {
    closeRemaining(trade, gapThroughStop ? bar.open : trade.stop);
    if (exitMode === "terminal" || trade.nextLeg === 0) return "initial_stop";
    return trade.stop === trade.entryPrice
      ? "breakeven_stop"
      : "progressive_stop";
  }

  if (
    exitMode === "progressive" ||
    exitMode === "terminal" ||
    exitMode === "secured"
  ) {
    while (trade.nextLeg < trade.legs.length) {
      const target = trade.legs[trade.nextLeg].price;
      const tpHit =
        trade.direction === "long" ? bar.high >= target : bar.low <= target;
      if (!tpHit) break;
      trade.nextLeg += 1;
      if (trade.nextLeg === trade.legs.length) {
        closeRemaining(trade, target);
        return "final_take_profit";
      }
      if (exitMode === "secured") trade.stop = target;
      if (exitMode === "progressive") {
        trade.stop =
          trade.nextLeg === 1
            ? trade.entryPrice
            : trade.legs[trade.nextLeg - 2].price;
      }
    }
    return null;
  }

  while (trade.nextLeg < trade.legs.length) {
    const leg = trade.legs[trade.nextLeg];
    const tpHit =
      trade.direction === "long" ? bar.high >= leg.price : bar.low <= leg.price;
    if (!tpHit) break;

    const fillFraction = Math.min(leg.fraction, trade.remaining);
    const move =
      trade.direction === "long"
        ? leg.price - trade.entryPrice
        : trade.entryPrice - leg.price;
    trade.grossRealizedR += (move / trade.risk) * fillFraction;
    trade.realizedR += partialR(trade, leg.price, fillFraction);
    trade.weightedExit += leg.price * fillFraction;
    trade.remaining -= fillFraction;

    // Lock in the trade after the first target: move stop to breakeven.
    if (
      trade.nextLeg === 0 &&
      exitMode === "scaleOut" &&
      trade.legs.length > 1
    ) {
      trade.stop = trade.entryPrice;
    }
    trade.nextLeg += 1;

    if (trade.remaining <= 1e-9) {
      trade.remaining = 0;
      return "final_take_profit";
    }
  }

  return null;
}

function finalize(
  trade: OpenTrade,
  exitReason: BacktestTrade["exitReason"],
  exitIndex: number,
  exitTimestamp: number,
): BacktestTrade {
  return {
    direction: trade.direction,
    decisionIndex: trade.decisionIndex,
    decisionTimestamp: trade.decisionTimestamp,
    entryIndex: trade.entryIndex,
    entryTimestamp: trade.entryTimestamp,
    entryPrice: trade.entryPrice,
    exitIndex,
    exitTimestamp,
    exitPrice: trade.weightedExit, // already fraction-weighted; sums to full size
    exitReason,
    grossR: trade.grossRealizedR,
    r: trade.realizedR,
    regime: trade.regime,
    tier: trade.tier,
  };
}

/**
 * Walk-forward backtest with NO lookahead: at each bar i the engine only sees
 * candles[0..i] and any entry is filled at candle[i+1].open. A single position
 * is held at a time. Exits use the selected mode, opposite signal at the next
 * open, or end-of-data at the final close. Fees + slippage are deducted from
 * every fill.
 */
export function runBacktest(
  candles: NormalizedYahooCandle[],
  options: {
    assetType?: AssetType;
    timeframe?: TimeframePresetKey;
    exitMode?: ExitMode;
    /** Stress fees + slippage without changing production constants. */
    costMultiplier?: number;
    /** Optional gate: return false to BLOCK an otherwise-valid entry. Lets a
     *  harness model the journal's context emission-gate without touching the
     *  exit model. Receives the entry signal + the decision bar. */
    entryFilter?: (args: {
      outlook: Outlook;
      barIndex: number;
      timestamp: number;
    }) => boolean;
  } = {},
): { metrics: BacktestMetrics; trades: BacktestTrade[] } {
  const {
    assetType,
    timeframe = "swing",
    exitMode = "progressive",
    costMultiplier = 1,
    entryFilter,
  } = options;
  const warmup = TIMEFRAME_PRESETS[timeframe].signalProfile.minCandles;
  const costRate = costRateFor(assetType) * Math.max(0, costMultiplier);

  const trades: BacktestTrade[] = [];
  let open: OpenTrade | null = null;

  for (let i = warmup; i < candles.length - 1; i++) {
    const decisionCandles = candles.slice(0, i + 1);
    const series = buildSignalSeriesFromCandles(decisionCandles);
    const higherTimeframe = deriveCandleTrendState(
      resampleCandles(decisionCandles, HIGHER_TIMEFRAME_FACTOR[timeframe], {
        includeTrailingPartial: false,
      }),
    );
    const outlook = computeSignal({
      ...series,
      assetType,
      timeframe,
      higherTimeframeTrend: higherTimeframe.trend,
      higherTimeframeReady: higherTimeframe.ready,
    });
    const nextBar = candles[i + 1];
    const nextIndex = i + 1;

    // The new decision is known before the next open, so a reversal exits at
    // that open before any high/low from the new bar can affect the old trade.
    if (
      open &&
      outlook.signal !== "neutral" &&
      outlook.signal !== open.direction
    ) {
      closeRemaining(open, nextBar.open);
      trades.push(
        finalize(open, "reversal", nextIndex, nextBar.timestamp),
      );
      open = null;
    }

    // Enter while flat at the next open. A reversal can therefore flip at the
    // same executable price; an intrabar exit cannot retroactively re-enter.
    if (
      !open &&
      outlook.signal !== "neutral" &&
      (!entryFilter ||
        entryFilter({
          outlook,
          barIndex: i,
          timestamp: candles[i].timestamp,
        }))
    ) {
      const plan = computeTradingPlan(
        outlook,
        nextBar.open,
        assetType ?? "us-stock",
      );
      if (plan) {
        const risk = Math.abs(nextBar.open - plan.stopLoss);
        if (risk <= 0) continue;
        const allTps = [
          plan.takeProfit1,
          plan.takeProfit2,
          plan.takeProfit3,
        ].filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
        const tps = exitMode === "tp1" ? allTps.slice(0, 1) : allTps;
        if (tps.length === 0) continue;
        const legPlan =
          exitMode === "scaleOut"
            ? tps.length === 1
              ? [{ tpIndex: 0, fraction: 1 }]
              : tps.length === 2
                ? [
                    { tpIndex: 0, fraction: 0.5 },
                    { tpIndex: 1, fraction: 0.5 },
                  ]
                : SCALE_OUT_LEGS
            : tps.map((_, tpIndex) => ({ tpIndex, fraction: 1 }));
        open = {
          direction: outlook.signal,
          decisionIndex: i,
          decisionTimestamp: candles[i].timestamp,
          entryIndex: nextIndex,
          entryTimestamp: nextBar.timestamp,
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
          grossRealizedR: 0,
          weightedExit: 0,
          costRate,
        };
      }
    }

    if (open) {
      const reason = stepBar(open, nextBar, exitMode);
      if (reason) {
        trades.push(finalize(open, reason, nextIndex, nextBar.timestamp));
        open = null;
      }
    }
  }

  // Close any position still open at the final close.
  if (open && candles.length > 0) {
    const finalIndex = candles.length - 1;
    closeRemaining(open, candles[finalIndex].close);
    trades.push(
      finalize(open, "end_of_data", finalIndex, candles[finalIndex].timestamp),
    );
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
