/** Research only: none of these options are enabled by production callers. */
import type { AssetType, TradingPlan } from "@/types/asset";
import type { Outlook } from "@/types/engine";
import type { NormalizedYahooCandle } from "@/core/market/candles";
import { resampleCandlesToDaily } from "@/core/market/candles";
import { deriveAccumulation, supportsAccumulation } from "./accumulation";
import { derivePositioning } from "./smart-money";

export interface ResearchFlow {
  score: number;
  source: "equity-ohlcv" | "binance-usdm";
  observedAt: number;
  availableAt: number;
  expiresAt: number;
}

export function sessionStartIndices(candles: NormalizedYahooCandle[], timeZone = "UTC"): number[] {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  let previous = "";
  return candles.flatMap((candle, i) => {
    const session = date.format(new Date(candle.timestamp * 1000));
    const changed = session !== previous;
    previous = session;
    return changed ? [i] : [];
  });
}

/** Epoch seconds throughout; never use a later publication in an earlier decision. */
export function flowAtDecision(
  flow: ResearchFlow | null | undefined,
  decisionClosedAt: number,
): ResearchFlow | null {
  return flow &&
    [flow.score, flow.observedAt, flow.availableAt, flow.expiresAt, decisionClosedAt].every(Number.isFinite) &&
    Math.abs(flow.score) <= 1 &&
    flow.observedAt > 0 &&
    flow.observedAt <= flow.availableAt &&
    flow.availableAt <= decisionClosedAt &&
    decisionClosedAt <= flow.expiresAt
    ? flow
    : null;
}

export function equityFlow(
  candles: NormalizedYahooCandle[],
  assetType?: AssetType,
): ResearchFlow | null {
  if (!assetType || !supportsAccumulation(assetType) || !candles.length) return null;
  const daily = resampleCandlesToDaily(candles).slice(0, -1);
  // CMF needs 20 complete sessions; the running UTC day never contributes.
  if (daily.length < 20) return null;
  const accumulation = deriveAccumulation(daily);
  if (!accumulation?.reliable) return null;
  const availableAt = (Math.floor(daily.at(-1)!.timestamp / 86400) + 1) * 86400;
  return {
    score: accumulation.score,
    source: "equity-ohlcv",
    observedAt: availableAt,
    availableAt,
    expiresAt: availableAt + 7 * 86400,
  };
}

export interface CryptoFlowSnapshot {
  symbol: string;
  /** Must be the mapped USDT-M contract, including 1000x contract aliases. */
  contract: string;
  venue: "binance-usdm";
  availableAt: number;
  startAt: number;
  endAt: number;
  openInterestStart: number;
  openInterestEnd: number;
  /** Same venue and timestamps as OI, not Yahoo's rolling quote change. */
  priceStart: number;
  priceEnd: number;
  fundingRate?: number;
  fundingAt?: number;
  fundingIntervalHours?: number;
  longShortRatio?: number;
  longShortAt?: number;
}

export function cryptoFlow(
  snapshot: CryptoFlowSnapshot,
  symbol: string,
  contract: string,
  decisionClosedAt: number,
): ResearchFlow | null {
  const s = snapshot;
  if (s.venue !== "binance-usdm" || s.symbol !== symbol || s.contract !== contract ||
    ![s.startAt, s.endAt, s.availableAt, s.openInterestStart, s.openInterestEnd, s.priceStart, s.priceEnd].every(Number.isFinite) ||
    s.startAt <= 0 || s.endAt - s.startAt !== 86400 ||
    Math.min(s.openInterestStart, s.openInterestEnd, s.priceStart, s.priceEnd) <= 0) return null;
  const validFunding = s.fundingRate != null && Number.isFinite(s.fundingRate) &&
    s.fundingAt != null && Number.isFinite(s.fundingAt) &&
    s.fundingIntervalHours != null && Number.isFinite(s.fundingIntervalHours) &&
    s.fundingIntervalHours > 0 && s.fundingIntervalHours <= 24 &&
    s.fundingAt <= s.endAt && s.endAt - s.fundingAt <= s.fundingIntervalHours * 3600;
  const validRatio = s.longShortRatio != null && Number.isFinite(s.longShortRatio) && s.longShortRatio > 0 &&
    s.longShortAt != null && s.longShortAt <= s.endAt && s.endAt - s.longShortAt <= 3600;
  const positioning = derivePositioning({
    openInterest: s.openInterestEnd,
    openInterestDelta: (s.openInterestEnd - s.openInterestStart) / s.openInterestStart,
    priceChangePercent: (s.priceEnd / s.priceStart - 1) * 100,
    fundingRate: validFunding ? s.fundingRate! * 8 / s.fundingIntervalHours! : undefined,
    longShortRatio: validRatio ? s.longShortRatio : undefined,
  });
  return flowAtDecision({
    source: "binance-usdm",
    score: positioning.positioningScore,
    observedAt: s.endAt,
    availableAt: s.availableAt,
    expiresAt: s.endAt + 3600,
  }, decisionClosedAt);
}

export function entryDiagnostics(outlook: Outlook, plan: TradingPlan) {
  const direction = outlook.signal === "long" ? 1 : -1;
  const { atr, ema20, resistance, support, recentSwingHigh, recentSwingLow } = outlook.indicators;
  const risk = Math.abs(plan.entry - plan.stopLoss);
  const levels = direction === 1 ? [resistance, recentSwingHigh] : [support, recentSwingLow];
  const distances = levels.filter((level) => Number.isFinite(level) && level > 0)
    .map((level) => direction * (level - plan.entry)).filter((distance) => distance >= 0);
  return {
    extensionAtr: atr > 0 && Number.isFinite(ema20) ? direction * (plan.entry - ema20) / atr : null,
    structureRoomR: risk > 0 && distances.length ? Math.min(...distances) / risk : null,
    initialRisk: risk,
  };
}

export type EntryExperiment = "setup-room" | "extension" | "flow-filter";

export function passesEntryExperiment(
  experiment: EntryExperiment,
  outlook: Outlook,
  plan: TradingPlan,
  flow?: ResearchFlow | null,
): boolean {
  const { structureRoomR, extensionAtr } = entryDiagnostics(outlook, plan);
  if (experiment === "setup-room") return structureRoomR == null || structureRoomR >= 1;
  if (experiment === "extension") return extensionAtr == null || extensionAtr <= 2;
  if (!flow) return true;
  const direction = outlook.signal === "long" ? 1 : -1;
  return direction * flow.score > -(flow.source === "equity-ohlcv" ? 0.25 : 0.4);
}
