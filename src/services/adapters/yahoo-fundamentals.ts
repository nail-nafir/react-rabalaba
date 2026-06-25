import type { Fundamentals } from "@/types/asset";
import type { YahooQuoteSummaryResult } from "@/services/api/yahoo-finance";

/** Recommendation weights for the consensus score: a strong buy pulls to +1,
 *  a strong sell to -1, hold is neutral. */
const REC_WEIGHTS = { strongBuy: 1, buy: 0.5, hold: 0, sell: -0.5, strongSell: -1 };

/** Analyst consensus [-1..1] from the most recent recommendationTrend period,
 *  with the analyst count. Undefined when there are no ratings. */
function analystConsensus(raw: YahooQuoteSummaryResult): {
  score?: number;
  count?: number;
} {
  const latest = raw.recommendationTrend?.trend?.[0];
  if (!latest) return {};
  const strongBuy = latest.strongBuy ?? 0;
  const buy = latest.buy ?? 0;
  const hold = latest.hold ?? 0;
  const sell = latest.sell ?? 0;
  const strongSell = latest.strongSell ?? 0;
  const count = strongBuy + buy + hold + sell + strongSell;
  if (count <= 0) return {};
  const weighted =
    REC_WEIGHTS.strongBuy * strongBuy +
    REC_WEIGHTS.buy * buy +
    REC_WEIGHTS.hold * hold +
    REC_WEIGHTS.sell * sell +
    REC_WEIGHTS.strongSell * strongSell;
  return { score: weighted / count, count };
}

/**
 * Adapt a raw Yahoo quoteSummary into the engine's Fundamentals shape, or null
 * when nothing useful came back. Pure; every field is optional so a partial
 * response still yields a partial (useful) overlay.
 */
export function adaptYahooFundamentals(
  raw: YahooQuoteSummaryResult | null,
): Fundamentals | null {
  if (!raw) return null;

  const trailingPE = raw.summaryDetail?.trailingPE?.raw;
  const priceToBook = raw.defaultKeyStatistics?.priceToBook?.raw;
  const debtToEquity = raw.financialData?.debtToEquity?.raw;
  const recommendationKey = raw.financialData?.recommendationKey;
  const { score: analystScore, count: analystCount } = analystConsensus(raw);
  // Yahoo gives earnings dates in epoch SECONDS; the first upcoming one matters.
  const earningsRaw = raw.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
  const nextEarningsMs =
    typeof earningsRaw === "number" ? earningsRaw * 1000 : undefined;

  const fundamentals: Fundamentals = {
    trailingPE,
    priceToBook,
    debtToEquity,
    analystScore,
    analystCount,
    recommendationKey,
    nextEarningsMs,
  };

  // Nothing usable → null so callers treat it as "no overlay".
  const hasAny =
    trailingPE != null ||
    priceToBook != null ||
    debtToEquity != null ||
    analystScore != null ||
    nextEarningsMs != null;
  return hasAny ? fundamentals : null;
}
