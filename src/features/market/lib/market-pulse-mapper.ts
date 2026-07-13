import type { UnifiedAsset } from "@/types/asset";
import type {
  CryptoContext,
  IdxContext,
  UsContext,
  MarketPulseCardModel,
} from "@/types/market";
import { IDX_CONTEXT, US_CONTEXT } from "@/constants/signals";

const TECHNICAL_WEIGHT = 0.7;
const CONTEXT_WEIGHT = 0.3;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasUsableTechnical(
  asset: UnifiedAsset | null | undefined,
): asset is UnifiedAsset & { outlook: NonNullable<UnifiedAsset["outlook"]> } {
  return Boolean(
    asset?.outlook &&
      isFiniteNumber(asset.outlook.directionScore) &&
      asset.outlook.dataQuality?.ready !== false,
  );
}

function averageAvailable(values: Array<number | undefined>): number | undefined {
  const available = values.filter(isFiniteNumber);
  if (available.length === 0) return undefined;
  return available.reduce((total, value) => total + value, 0) / available.length;
}

function trendFromScore(score: number): "bullish" | "bearish" | "sideways" {
  if (score >= 60) return "bullish";
  if (score <= 40) return "bearish";
  return "sideways";
}

/** Normalize the signal engine's direction score from [-1, 1] to [0, 100]. */
export function directionScoreToPercent(directionScore: number): number {
  return clampScore((directionScore + 1) * 50);
}

/**
 * Convert a fear-positive percentage change into risk appetite. A negative
 * move equal to the threshold maps to 100, zero to 50, and a positive move
 * equal to the threshold maps to 0.
 */
export function inverseChangeScore(
  changePercent: number | undefined,
  thresholdPercent: number,
): number | undefined {
  if (
    typeof changePercent !== "number" ||
    !Number.isFinite(changePercent) ||
    !Number.isFinite(thresholdPercent) ||
    thresholdPercent <= 0
  ) {
    return undefined;
  }
  return clampScore(50 - (changePercent / thresholdPercent) * 50);
}

/** Map VIX spot from the configured risk-on/risk-off band into [100, 0]. */
export function vixLevelToAppetite(vixLevel: number | undefined): number | undefined {
  if (typeof vixLevel !== "number" || !Number.isFinite(vixLevel)) return undefined;
  const range = US_CONTEXT.VIX_RISK_OFF_LEVEL - US_CONTEXT.VIX_RISK_ON_LEVEL;
  if (range <= 0) return undefined;
  return clampScore(
    100 - ((vixLevel - US_CONTEXT.VIX_RISK_ON_LEVEL) / range) * 100,
  );
}

export function combineRiskAppetiteScore(
  technicalScore?: number,
  contextScore?: number,
): number {
  if (isFiniteNumber(technicalScore) && isFiniteNumber(contextScore)) {
    return Math.round(
      clampScore(
        clampScore(technicalScore) * TECHNICAL_WEIGHT +
          clampScore(contextScore) * CONTEXT_WEIGHT,
      ),
    );
  }
  if (isFiniteNumber(technicalScore)) {
    return Math.round(clampScore(technicalScore));
  }
  if (isFiniteNumber(contextScore)) {
    return Math.round(clampScore(contextScore));
  }
  return 50;
}

/** Equal-weight VIX and DXY gauges, while gracefully using whichever exists. */
export function deriveUsAppetiteContext(
  usContext: UsContext | null | undefined,
): number | undefined {
  if (!usContext) return undefined;
  const vixScore = averageAvailable([
    vixLevelToAppetite(usContext.vixLevel),
    inverseChangeScore(
      usContext.vix1wChangePercent,
      US_CONTEXT.VIX_PRESSURE_1W_PCT,
    ),
  ]);
  const dxyScore = inverseChangeScore(
    usContext.dxy1wChangePercent,
    US_CONTEXT.DXY_PRESSURE_1W_PCT,
  );
  return averageAvailable([vixScore, dxyScore]);
}

function hasCompleteGlobalAppetiteContext(
  usContext: UsContext | null | undefined,
  vixAsset: UnifiedAsset | null | undefined,
  dxyAsset: UnifiedAsset | null | undefined,
): boolean {
  return Boolean(
    usContext &&
      vixAsset &&
      dxyAsset &&
      isFiniteNumber(usContext.vixLevel) &&
      isFiniteNumber(usContext.vix1wChangePercent) &&
      isFiniteNumber(usContext.dxy1wChangePercent),
  );
}

export function mapCryptoCard(
  cryptoContext: CryptoContext | null | undefined,
  fearGreed: { value: number; label: string } | null | undefined,
  btcAsset: UnifiedAsset | null | undefined,
  ethAsset: UnifiedAsset | null | undefined,
): MarketPulseCardModel {
  if (!btcAsset) {
    return {
      id: "crypto",
      title: "Crypto",
      assetGroup: "crypto",
      score: 50,
      scoreKind: "risk_appetite",
      trend: "sideways",
      headlineValue: "N/A",
      changePercent: 0,
      updatedAt: Date.now(),
      status: "error",
    };
  }

  const btcDirectionScore =
    cryptoContext?.btcDirectionScore ?? btcAsset.outlook?.directionScore;
  const btcScore =
    typeof btcDirectionScore === "number"
      ? directionScoreToPercent(btcDirectionScore)
      : 50;

  const score = combineRiskAppetiteScore(btcScore, fearGreed?.value);
  const trend = cryptoContext?.btcTrend || btcAsset.outlook?.trend || "sideways";
  const headlineValue = btcAsset.price ? `$${btcAsset.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "N/A";
  const changePercent = btcAsset.changePercent || 0;

  const hasAllData =
    !!cryptoContext &&
    isFiniteNumber(fearGreed?.value) &&
    !!cryptoContext.dominance &&
    !!ethAsset;

  return {
    id: "crypto",
    title: "Crypto",
    assetGroup: "crypto",
    score,
    scoreKind: "risk_appetite",
    trend,
    headlineValue,
    changePercent,
    sparkline: btcAsset.quoteIndicators?.close?.filter((v): v is number => v !== null) || [],
    updatedAt: cryptoContext?.lastUpdated || Date.now(),
    status: hasAllData ? "active" : "degraded",
  };
}

export function mapIdEquityCard(
  idxContext: IdxContext | null | undefined,
  ihsgAsset: UnifiedAsset | null | undefined,
  usdIdrAsset: UnifiedAsset | null | undefined,
): MarketPulseCardModel {
  if (!ihsgAsset) {
    return {
      id: "id-equity",
      title: "ID Equity",
      assetGroup: "id-stock",
      score: 50,
      scoreKind: "risk_appetite",
      trend: "sideways",
      headlineValue: "N/A",
      changePercent: 0,
      updatedAt: Date.now(),
      status: "error",
    };
  }

  const ihsgDirectionScore =
    idxContext?.ihsgDirectionScore ?? ihsgAsset.outlook?.directionScore;
  const ihsgScore =
    typeof ihsgDirectionScore === "number"
      ? directionScoreToPercent(ihsgDirectionScore)
      : 50;

  const usdIdrScore = inverseChangeScore(
    idxContext?.usdIdr1wChangePercent,
    IDX_CONTEXT.RUPIAH_PRESSURE_1W_PCT,
  );
  const score = combineRiskAppetiteScore(ihsgScore, usdIdrScore);
  const trend = idxContext?.ihsgTrend || ihsgAsset.outlook?.trend || "sideways";
  const headlineValue = ihsgAsset.price ? ihsgAsset.price.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "N/A";
  const changePercent = ihsgAsset.changePercent || 0;

  const hasAllData =
    !!idxContext && !!usdIdrAsset && typeof usdIdrScore === "number";

  return {
    id: "id-equity",
    title: "ID Equity",
    assetGroup: "id-stock",
    score,
    scoreKind: "risk_appetite",
    trend,
    headlineValue,
    changePercent,
    sparkline: ihsgAsset.quoteIndicators?.close?.filter((v): v is number => v !== null) || [],
    updatedAt: idxContext?.lastUpdated || Date.now(),
    status: hasAllData ? "active" : "degraded",
  };
}

export function mapUsEquityCard(
  usContext: UsContext | null | undefined,
  spxAsset: UnifiedAsset | null | undefined,
  vixAsset: UnifiedAsset | null | undefined,
  dxyAsset: UnifiedAsset | null | undefined,
): MarketPulseCardModel {
  if (!spxAsset) {
    return {
      id: "us-equity",
      title: "US Equity",
      assetGroup: "us-stock",
      score: 50,
      scoreKind: "risk_appetite",
      trend: "sideways",
      headlineValue: "N/A",
      changePercent: 0,
      updatedAt: Date.now(),
      status: "error",
    };
  }

  const spxDirectionScore =
    usContext?.spxDirectionScore ?? spxAsset.outlook?.directionScore;
  const spxScore =
    typeof spxDirectionScore === "number"
      ? directionScoreToPercent(spxDirectionScore)
      : 50;

  const usAppetiteContext = deriveUsAppetiteContext(usContext);
  const score = combineRiskAppetiteScore(spxScore, usAppetiteContext);
  const trend = usContext?.spxTrend || spxAsset.outlook?.trend || "sideways";
  const headlineValue = spxAsset.price ? spxAsset.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "N/A";
  const changePercent = spxAsset.changePercent || 0;

  const hasAllData = hasCompleteGlobalAppetiteContext(
    usContext,
    vixAsset,
    dxyAsset,
  );

  return {
    id: "us-equity",
    title: "US Equity",
    assetGroup: "us-stock",
    score,
    scoreKind: "risk_appetite",
    trend,
    headlineValue,
    changePercent,
    sparkline: spxAsset.quoteIndicators?.close?.filter((v): v is number => v !== null) || [],
    updatedAt: usContext?.lastUpdated || Date.now(),
    status: hasAllData ? "active" : "degraded",
  };
}

export function mapCommoditiesCard(
  goldAsset: UnifiedAsset | null | undefined,
  usContext: UsContext | null | undefined,
  vixAsset: UnifiedAsset | null | undefined,
  dxyAsset: UnifiedAsset | null | undefined,
): MarketPulseCardModel {
  if (!goldAsset) {
    return {
      id: "commodities",
      title: "Commodity",
      assetGroup: "commodity",
      score: 50,
      scoreKind: "risk_appetite",
      trend: "sideways",
      headlineValue: "N/A",
      changePercent: 0,
      updatedAt: Date.now(),
      status: "error",
    };
  }

  const hasGoldTechnical = hasUsableTechnical(goldAsset);
  const goldDirectionScore = hasGoldTechnical
    ? goldAsset.outlook.directionScore
    : undefined;
  // Gold rising = flight-to-safety = risk-off, so invert the engine's
  // direction score (which treats price-up as bullish) into a risk-appetite
  // score where gold strength reads as risk-off.
  const technicalScore = isFiniteNumber(goldDirectionScore)
    ? 100 - directionScoreToPercent(goldDirectionScore)
    : undefined;
  const globalContextScore = deriveUsAppetiteContext(usContext);
  const score = combineRiskAppetiteScore(technicalScore, globalContextScore);
  const trend = trendFromScore(technicalScore ?? 50);
  const headlineValue = goldAsset.price
    ? `$${goldAsset.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : "N/A";
  const changePercent = goldAsset.changePercent || 0;
  const sparkline =
    goldAsset.quoteIndicators?.close?.filter(isFiniteNumber) ?? [];
  const hasAllData =
    isFiniteNumber(technicalScore) &&
    sparkline.length >= 2 &&
    hasCompleteGlobalAppetiteContext(usContext, vixAsset, dxyAsset);

  return {
    id: "commodities",
    title: "Commodity",
    assetGroup: "commodity",
    score,
    scoreKind: "risk_appetite",
    trend,
    headlineValue,
    changePercent,
    sparkline,
    updatedAt: usContext?.lastUpdated || Date.now(),
    status: hasAllData ? "active" : "degraded",
  };
}

export function mapForexCard(
  usdIdrAsset: UnifiedAsset | null | undefined,
  usContext: UsContext | null | undefined,
  vixAsset: UnifiedAsset | null | undefined,
  dxyAsset: UnifiedAsset | null | undefined,
): MarketPulseCardModel {
  if (!usdIdrAsset) {
    return {
      id: "forex",
      title: "Forex",
      assetGroup: "forex",
      score: 50,
      scoreKind: "risk_appetite",
      trend: "sideways",
      headlineValue: "N/A",
      changePercent: 0,
      updatedAt: Date.now(),
      status: "error",
    };
  }

  const hasDirectTechnical = hasUsableTechnical(usdIdrAsset);
  const usdIdrDirectionScore = hasDirectTechnical
    ? usdIdrAsset.outlook.directionScore
    : undefined;
  // USD/IDR rising = IDR weakening = risk-off for Indonesia, so invert the
  // engine's direction score (which treats price-up as bullish) into a
  // risk-appetite score where IDR strength reads as risk-on.
  const technicalScore = isFiniteNumber(usdIdrDirectionScore)
    ? 100 - directionScoreToPercent(usdIdrDirectionScore)
    : undefined;
  const globalContextScore = deriveUsAppetiteContext(usContext);
  const score = combineRiskAppetiteScore(technicalScore, globalContextScore);
  const trend = trendFromScore(technicalScore ?? 50);
  const headlineValue = usdIdrAsset.price
    ? usdIdrAsset.price.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : "N/A";
  const changePercent = usdIdrAsset.changePercent || 0;
  const sparkline =
    usdIdrAsset.quoteIndicators?.close?.filter(isFiniteNumber) ?? [];
  const hasAllData =
    isFiniteNumber(technicalScore) &&
    sparkline.length >= 2 &&
    hasCompleteGlobalAppetiteContext(usContext, vixAsset, dxyAsset);

  return {
    id: "forex",
    title: "Forex",
    assetGroup: "forex",
    score,
    scoreKind: "risk_appetite",
    trend,
    headlineValue,
    changePercent,
    sparkline,
    updatedAt: usContext?.lastUpdated || Date.now(),
    status: hasAllData ? "active" : "degraded",
  };
}
