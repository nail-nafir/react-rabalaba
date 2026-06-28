import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/use-favorites";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { toast } from "sonner";
import { runBacktest } from "@/features/engine/backtest";
import { calibrateConfidence } from "@/features/engine/calibration";
import { fightsBenchmark } from "@/features/engine/benchmark-derate";
import { isNeutralPositioning } from "@/features/engine/smart-money";
import {
  isNeutralFlow,
  supportsAccumulation,
} from "@/features/engine/accumulation";
import { enrichAsset } from "@/features/engine/enrichment";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import { TradeSetupChart } from "./trade-setup-chart";
import { useShareSetup } from "../hooks/use-share-setup";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { useAppSelector, useUIActions } from "@/store/hooks";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { useCryptoContext } from "@/services/queries/use-crypto-context";
import { useIdxContext } from "@/services/queries/use-idx-context";
import { useUsContext } from "@/services/queries/use-us-context";
import { useFundamentals } from "@/services/queries/use-fundamentals";
import { useSmartMoney } from "@/services/queries/use-smart-money";
import { useQueryClient } from "@tanstack/react-query";
import { PercentageChange } from "@/components/shared/percentage-change";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StrengthBar } from "@/components/charts/strength-bar";
import { CategoryScoreChart } from "@/components/charts/category-score-chart";
import { WinRateRing } from "@/components/charts/win-rate-ring";
import { Badge } from "@/components/ui/badge";
import {
  RISK_COLORS,
  REGIME_COLORS,
  REGIME_LABEL_KEYS,
  SIGNAL_LABEL_KEYS,
  ACCUMULATION_LABEL_KEYS,
  INDICATOR_STATUS_COLORS,
  PALETTE,
  BADGE,
  badgeClass,
  type IndicatorStatus,
} from "@/constants";
import { cn } from "@/lib/utils";
import {
  Target,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Gauge,
  Activity,
  Loader2,
  Star,
  Share2,
  PauseCircle,
  RotateCw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export function AssetDetailDialog() {
  const { t } = useTranslation();
  const isDetailDialogOpen = useAppSelector((s) => s.ui.isDetailDialogOpen);
  const selectedAssetSymbol = useAppSelector((s) => s.ui.selectedAssetSymbol);
  const { closeDetailDialog, openLicenseDialog } = useUIActions();
  const { hasAccess } = usePremiumAccess();

  const { favoriteSymbols, addSymbol, removeSymbol } = useFavorites();
  const isStarred = selectedAssetSymbol
    ? favoriteSymbols.includes(selectedAssetSymbol)
    : false;

  const { data: assets, isLoading: chartLoading } = useMarketData(
    selectedAssetSymbol ? [selectedAssetSymbol] : [],
  );
  const asset = assets?.[0];

  // Apply the same enrichment the screener uses (shared enrichAsset chain),
  // so conviction / tier shown here is consistent: context de-rate (BTC for
  // crypto / IHSG for id-stock / S&P 500 for us-stock) + flow nudge
  // (smart-money / accumulation).
  const { data: marketContext } = useCryptoContext();
  const { data: idxContext } = useIdxContext();
  const { data: usContext } = useUsContext();
  // Fundamentals/analyst overlay (stocks only) — one extra fetch for the open
  // asset; cached a day. Null when unavailable (graceful).
  const { data: fundamentals } = useFundamentals(asset?.symbol, asset?.assetType);
  const smAssets = useMemo(() => (asset ? [asset] : []), [asset]);
  const { data: smartMoneyMap, isUnavailable: smartMoneyUnavailable } =
    useSmartMoney(smAssets);
  const smartMoney = asset ? smartMoneyMap[asset.symbol] : undefined;

  // Manual retry for the smart-money (Binance derivatives) query — refetches
  // just this asset's key, bypassing staleTime, when the data was unavailable.
  const queryClient = useQueryClient();
  const [isRetryingSmartMoney, setIsRetryingSmartMoney] = useState(false);
  const handleRetrySmartMoney = async () => {
    if (!asset) return;
    setIsRetryingSmartMoney(true);
    try {
      await queryClient.refetchQueries({
        queryKey: ["smart-money", asset.symbol],
      });
    } finally {
      setIsRetryingSmartMoney(false);
    }
  };
  const enriched = useMemo(
    () =>
      asset
        ? enrichAsset(asset, {
            cryptoContext: marketContext ?? undefined,
            idxContext: idxContext ?? undefined,
            usContext: usContext ?? undefined,
            smartMoney,
            fundamentals: fundamentals ?? undefined,
          })
        : undefined,
    [asset, marketContext, idxContext, usContext, smartMoney, fundamentals],
  );
  const outlook = enriched?.outlook ?? undefined;
  const accumulation = enriched?.accumulation;
  const relativeStrength = enriched?.relativeStrength;
  const assetFundamentals = enriched?.fundamentals;
  const tradingPlan = asset?.tradingPlan;

  // Normalized OHLC candles (shared by the chart, backtest and share card).
  const candles = useMemo(
    () =>
      asset?.quoteIndicators
        ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
        : [],
    [asset],
  );

  // Historical performance (decision-support context shown SEPARATELY from
  // signal strength). Walk-forward, no-lookahead backtest over fetched candles.
  const backtest = useMemo(() => {
    if (!asset || candles.length < 150) return null;
    return runBacktest(candles, {
      assetType: asset.assetType,
      timeframe: "swing",
    }).metrics;
  }, [candles, asset]);

  // Calibrate confidence: map this signal's tier + regime to its historical
  // hit-rate from the same walk-forward backtest. Honest beats precise — shows
  // "insufficient sample" rather than a fake number when the tier rarely traded.
  const calibration = useMemo(() => {
    if (!backtest || !outlook || outlook.signal === "neutral") return null;
    return calibrateConfidence(backtest, outlook.tier, outlook.regime);
  }, [backtest, outlook]);

  // Current price and change percent
  const currentPrice = asset?.price ?? 0;
  const changePercent = asset?.changePercent ?? 0;

  const { isSharing, shareSetup } = useShareSetup();

  const handleShare = () => {
    if (!outlook || !tradingPlan || !asset || !selectedAssetSymbol) return;
    shareSetup({
      symbol: selectedAssetSymbol,
      name: asset.name,
      signal: outlook.signal,
      strength: outlook.strength,
      grade: outlook.tier,
      currentPrice,
      assetType: asset.assetType,
      candles,
      tradingPlan,
    });
  };

  if (!selectedAssetSymbol) return null;

  return (
    <Dialog
      open={isDetailDialogOpen}
      onOpenChange={(open) => !open && closeDetailDialog()}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            {selectedAssetSymbol}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-amber-400 hover:bg-muted/80 flex items-center justify-center cursor-pointer transition-all duration-200"
              onClick={(e) => {
                e.stopPropagation();
                if (!selectedAssetSymbol) return;
                // Favorites are premium + login gated; route non-entitled users
                // to the license dialog instead of a silently failing write.
                if (!hasAccess) {
                  openLicenseDialog();
                  return;
                }
                if (isStarred) {
                  removeSymbol(selectedAssetSymbol);
                  toast.success(
                    t("market.favorite_removed", {
                      symbol: selectedAssetSymbol,
                    }),
                  );
                } else {
                  addSymbol(selectedAssetSymbol);
                  toast.success(
                    t("market.favorite_added", {
                      symbol: selectedAssetSymbol,
                    }),
                  );
                }
              }}
              title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-all",
                  isStarred
                    ? "fill-amber-400 text-amber-400"
                    : "text-amber-400/40 hover:scale-110",
                )}
              />
            </Button>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {asset?.name ?? selectedAssetSymbol} ·{" "}
            {asset && t(`common.asset_types.${asset.assetType}`)}
          </DialogDescription>

          {/* Price row */}
          {chartLoading ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-15 w-full rounded" />
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3 mt-2">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("journal.current_price")}
                </p>
                <div className="flex items-end gap-3 min-w-0">
                  <span className="text-xl sm:text-3xl font-bold text-mono-data wrap-break-word">
                    {formatPrice(currentPrice, asset?.assetType)}
                  </span>
                  <PercentageChange
                    value={changePercent}
                    className="text-sm pb-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Meta badges */}
          {outlook ? (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px] rounded-md",
                  RISK_COLORS[outlook.risk].bg,
                  RISK_COLORS[outlook.risk].text,
                  RISK_COLORS[outlook.risk].border,
                )}
              >
                {outlook.risk} Risk
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-semibold uppercase tracking-wider text-[10px] rounded-md",
                  REGIME_COLORS[outlook.regime].bg,
                  REGIME_COLORS[outlook.regime].text,
                  REGIME_COLORS[outlook.regime].border,
                )}
              >
                {t(REGIME_LABEL_KEYS[outlook.regime])}
              </Badge>
              {outlook.suppressed && (
                <Badge
                  variant="outline"
                  className="font-semibold uppercase tracking-wider text-[10px] rounded-md gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                >
                  <PauseCircle className="h-3 w-3" />
                  {t("dialog.suppressed_badge")}
                </Badge>
              )}
              <div className="flex-1 min-w-25">
                <StrengthBar value={outlook.strength} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-3">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-3 w-24 rounded flex-1" />
            </div>
          )}
        </DialogHeader>

        <div className="flex flex-col space-y-6">
          <Separator />

          {chartLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("dialog.loading")}
            </div>
          ) : outlook ? (
            <>
              {/* Trading Plan */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      {t("dialog.trading_plan")}
                    </h3>
                  </div>
                  {tradingPlan && outlook.signal !== "neutral" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleShare}
                        disabled={isSharing}
                        title={t("dialog.share")}
                        aria-label={t("dialog.share")}
                      >
                        {isSharing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Share2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Custom SVG candlestick visual trade setup */}
                {outlook.signal === "neutral" || !tradingPlan || !asset ? (
                  outlook.suppressed ? (
                    <Card className="border border-amber-500/30 bg-amber-500/10">
                      <CardContent className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            {t("dialog.suppressed_badge")}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                          {t("dialog.suppressed_note", {
                            tier: outlook.tier,
                            reason:
                              outlook.regime === "low_volatility"
                                ? t("dialog.suppressed_reason_chop")
                                : t("dialog.suppressed_reason_countertrend"),
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("dialog.no_setup")}
                    </p>
                  )
                ) : (
                  <TradeSetupChart
                    candles={candles}
                    plan={tradingPlan}
                    signal={outlook.signal}
                    assetType={asset.assetType}
                    currentPrice={currentPrice}
                  />
                )}
              </div>

              <Separator />

              {/* Supporting evidence: historical backtest context */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t("dialog.decision_support")}
                  </h3>
                </div>

                {/* Per-category alignment — bars with signed score (-100..+100) */}
                <Card className="border border-border bg-muted/50">
                  <CardContent>
                    <CategoryScoreChart scores={outlook.categoryScores} />
                  </CardContent>
                </Card>

                {/* Historical backtest + calibrated win-rate (one unit). Moved
                    up here, right under the category score. */}
                {backtest && backtest.trades > 0 ? (
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-4">
                      <div className="flex justify-center">
                        <WinRateRing
                          value={backtest.winRate}
                          label={`${backtest.trades} ${t("dialog.bt_trades").toLowerCase()}`}
                        />
                      </div>
                      <div className="flex items-stretch gap-3">
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div
                              className={cn(
                                "text-sm font-bold tabular-nums tracking-tight",
                                backtest.expectancy > 0
                                  ? PALETTE.positive.text
                                  : backtest.expectancy < 0
                                    ? PALETTE.negative.text
                                    : "",
                              )}
                            >
                              {backtest.expectancy.toFixed(2)}R
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              Expectancy (Avg R)
                            </CardDescription>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div
                              className={cn(
                                "text-sm font-bold tabular-nums tracking-tight",
                                backtest.profitFactor >= 1
                                  ? PALETTE.positive.text
                                  : PALETTE.negative.text,
                              )}
                            >
                              {Number.isFinite(backtest.profitFactor)
                                ? backtest.profitFactor.toFixed(2)
                                : "∞"}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              Profit Factor
                            </CardDescription>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div className="text-sm font-bold tabular-nums tracking-tight text-rose-400">
                              -{backtest.maxDrawdownR.toFixed(2)}R
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              Max Drawdown (R)
                            </CardDescription>
                          </CardContent>
                        </Card>
                      </div>
                      {calibration && (
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {t("dialog.calibrated_winrate")} (
                              {t("dialog.grade_label")} {outlook.tier})
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                                calibration.winRate == null
                                  ? "text-muted-foreground border-muted-foreground/30"
                                  : calibration.winRate >= 0.5
                                    ? badgeClass(BADGE.positive)
                                    : badgeClass(BADGE.negative),
                              )}
                            >
                              {calibration.winRate == null
                                ? t("dialog.low_sample")
                                : `${Math.round(calibration.winRate * 100)}%`}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            {calibration.sufficient
                              ? t("dialog.calib_sufficient", {
                                  count: calibration.sample,
                                })
                              : t("dialog.calib_insufficient", {
                                  count: calibration.sample,
                                })}
                            {calibration.regimeWinRate != null &&
                              ` ${t("dialog.calib_regime", {
                                regime: t(REGIME_LABEL_KEYS[outlook.regime]),
                                pct: Math.round(calibration.regimeWinRate * 100),
                              })}`}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-amber-500/30 bg-amber-500/10">
                    <CardContent className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          {t("dialog.bt_insufficient_badge")}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                        {t("dialog.bt_insufficient")}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Fundamentals + analyst overlay (stocks only). Valuation,
                    consensus, and the next earnings date — context, not a
                    trigger. Hidden when Yahoo's v10 endpoint is unavailable. */}
                {assetFundamentals && (
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.fund_title")}
                        </CardTitle>
                        {typeof assetFundamentals.analystScore === "number" && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-bold uppercase tracking-wider text-[10px] rounded-md",
                              assetFundamentals.analystScore > 0.1
                                ? badgeClass(BADGE.positive)
                                : assetFundamentals.analystScore < -0.1
                                  ? badgeClass(BADGE.negative)
                                  : "text-muted-foreground border-muted-foreground/30",
                            )}
                          >
                            {assetFundamentals.recommendationKey
                              ? t(
                                  `dialog.fund_rec_${assetFundamentals.recommendationKey}`,
                                  {
                                    defaultValue:
                                      assetFundamentals.recommendationKey.replace(
                                        /_/g,
                                        " ",
                                      ),
                                  },
                                )
                              : t(
                                  assetFundamentals.analystScore > 0
                                    ? "dialog.fund_bullish"
                                    : "dialog.fund_bearish",
                                )}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-stretch gap-3">
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div className="text-sm font-bold tabular-nums tracking-tight">
                              {typeof assetFundamentals.trailingPE === "number"
                                ? assetFundamentals.trailingPE.toFixed(1)
                                : "—"}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              P/E
                            </CardDescription>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div className="text-sm font-bold tabular-nums tracking-tight">
                              {typeof assetFundamentals.priceToBook === "number"
                                ? assetFundamentals.priceToBook.toFixed(1)
                                : "—"}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              P/B
                            </CardDescription>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div className="text-sm font-bold tabular-nums tracking-tight">
                              {typeof assetFundamentals.debtToEquity === "number"
                                ? `${(assetFundamentals.debtToEquity / 100).toFixed(1)}×`
                                : "—"}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              D/E
                            </CardDescription>
                          </CardContent>
                        </Card>
                      </div>
                      {typeof assetFundamentals.nextEarningsMs === "number" && (
                        <p className="text-[10px] text-muted-foreground">
                          {t("dialog.fund_next_earnings", {
                            date: new Date(
                              assetFundamentals.nextEarningsMs,
                            ).toLocaleDateString(),
                          })}
                          {typeof assetFundamentals.analystCount === "number"
                            ? ` • ${t("dialog.fund_analysts", {
                                count: assetFundamentals.analystCount,
                              })}`
                            : ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Accumulation: equities daily OHLCV flow (US & ID stocks).
                    No neutral gate — flow context is useful pre-signal. */}
                {accumulation && asset && supportsAccumulation(asset.assetType) && (
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.accumulation")}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold uppercase tracking-wider text-[10px] rounded-md",
                            isNeutralFlow(accumulation.label)
                              ? "text-muted-foreground border-muted-foreground/30"
                              : accumulation.score > 0
                                ? badgeClass(BADGE.positive)
                                : badgeClass(BADGE.negative),
                          )}
                        >
                          {t(
                            ACCUMULATION_LABEL_KEYS[accumulation.label] ??
                              "dialog.acc_label_neutral",
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-stretch gap-3">
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div
                              className={cn(
                                "text-sm font-bold tabular-nums tracking-tight",
                                accumulation.breakdown.cmf > 0
                                  ? PALETTE.positive.text
                                  : accumulation.breakdown.cmf < 0
                                    ? PALETTE.negative.text
                                    : "text-muted-foreground",
                              )}
                            >
                              {`${accumulation.breakdown.cmf > 0 ? "+" : ""}${accumulation.breakdown.cmf.toFixed(2)}`}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              {t("dialog.acc_cmf")}
                            </CardDescription>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div
                              className={cn(
                                "text-sm font-bold tabular-nums tracking-tight",
                                accumulation.breakdown.mfi > 50
                                  ? PALETTE.positive.text
                                  : accumulation.breakdown.mfi < 50
                                    ? PALETTE.negative.text
                                    : "text-muted-foreground",
                              )}
                            >
                              {accumulation.breakdown.mfi.toFixed(0)}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              {t("dialog.acc_mfi")}
                            </CardDescription>
                          </CardContent>
                        </Card>
                        <Card className="flex-1 border-border border">
                          <CardContent>
                            <div
                              className={cn(
                                "text-sm font-bold tabular-nums tracking-tight",
                                accumulation.breakdown.upDownVolume > 0
                                  ? PALETTE.positive.text
                                  : accumulation.breakdown.upDownVolume < 0
                                    ? PALETTE.negative.text
                                    : "text-muted-foreground",
                              )}
                            >
                              {`${accumulation.breakdown.upDownVolume > 0 ? "+" : ""}${(accumulation.breakdown.upDownVolume * 100).toFixed(0)}%`}
                            </div>
                            <CardDescription className="text-[10px] text-muted-foreground">
                              {t("dialog.acc_updown")}
                            </CardDescription>
                          </CardContent>
                        </Card>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("dialog.acc_days", {
                          days: accumulation.daysAnalyzed,
                        })}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Relative strength: excess return vs the asset's OWN index
                    (id→IHSG, us→S&P, crypto→BTC). Leadership confirms a trade. */}
                {relativeStrength && (
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.rs_title", {
                            benchmark: relativeStrength.benchmark ?? "Benchmark",
                          })}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold uppercase tracking-wider text-[10px] rounded-md",
                            relativeStrength.label === "outperform"
                              ? badgeClass(BADGE.positive)
                              : relativeStrength.label === "underperform"
                                ? badgeClass(BADGE.negative)
                                : "text-muted-foreground border-muted-foreground/30",
                          )}
                        >
                          {t(`dialog.rs_${relativeStrength.label}`)}
                        </Badge>
                      </div>
                      <div className="flex items-stretch gap-3">
                        {(["r1w", "r1m"] as const).map((key) => {
                          const v = relativeStrength[key];
                          return (
                            <Card key={key} className="flex-1 border-border border">
                              <CardContent>
                                <div
                                  className={cn(
                                    "text-sm font-bold tabular-nums tracking-tight",
                                    typeof v !== "number"
                                      ? "text-muted-foreground"
                                      : v > 0
                                        ? PALETTE.positive.text
                                        : v < 0
                                          ? PALETTE.negative.text
                                          : "text-muted-foreground",
                                  )}
                                >
                                  {typeof v === "number"
                                    ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
                                    : "—"}
                                </div>
                                <CardDescription className="text-[10px] text-muted-foreground">
                                  {t(key === "r1w" ? "dialog.rs_1w" : "dialog.rs_1m")}
                                </CardDescription>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Market context vs the leading benchmark for the asset's
                    class (BTC for crypto, IHSG for ID stocks, S&P 500 for US
                    stocks). One conditional unit keyed off the asset type. */}
                {outlook.signal !== "neutral" &&
                  (asset?.assetType === "crypto" && marketContext ? (
                    <Card className="border border-border bg-muted/50">
                      <CardContent className="space-y-1">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.crypto_context")}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                          {t("dialog.crypto_context_desc", {
                            riskState: t(
                              marketContext.riskState === "risk_off"
                                ? "dialog.crypto_risk_off"
                                : marketContext.riskState === "risk_on"
                                  ? "dialog.crypto_risk_on"
                                  : "dialog.crypto_risk_neutral",
                            ),
                            score: marketContext.btcDirectionScore.toFixed(2),
                            flow: t(
                              marketContext.riskState === "risk_off"
                                ? "dialog.crypto_flow_risk_off"
                                : "dialog.crypto_flow_risk_on",
                            ),
                            signal: t(SIGNAL_LABEL_KEYS[outlook.signal]),
                            alignment: t(
                              fightsBenchmark(
                                outlook.signal,
                                marketContext.riskState,
                              )
                                ? "dialog.crypto_fighting"
                                : "dialog.crypto_aligned",
                            ),
                          })}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ) : asset?.assetType === "id-stock" && idxContext ? (
                    <Card className="border border-border bg-muted/50">
                      <CardContent className="space-y-1">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.idx_context")}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                          {t("dialog.idx_context_desc", {
                            riskState: t(
                              idxContext.riskState === "risk_off"
                                ? "dialog.idx_risk_off"
                                : idxContext.riskState === "risk_on"
                                  ? "dialog.idx_risk_on"
                                  : "dialog.idx_risk_neutral",
                            ),
                            score: idxContext.ihsgDirectionScore.toFixed(2),
                            rupiahTrend: t(
                              idxContext.usdIdrTrend === "bullish"
                                ? "dialog.idx_rupiah_weakening"
                                : idxContext.usdIdrTrend === "bearish"
                                  ? "dialog.idx_rupiah_strengthening"
                                  : "dialog.idx_rupiah_stable",
                            ),
                            signal: t(SIGNAL_LABEL_KEYS[outlook.signal]),
                            alignment: t(
                              fightsBenchmark(
                                outlook.signal,
                                idxContext.riskState,
                              )
                                ? "dialog.idx_fighting"
                                : "dialog.idx_aligned",
                            ),
                          })}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ) : asset?.assetType === "us-stock" && usContext ? (
                    <Card className="border border-border bg-muted/50">
                      <CardContent className="space-y-1">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.us_context")}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                          {t("dialog.us_context_desc", {
                            riskState: t(
                              usContext.riskState === "risk_off"
                                ? "dialog.us_risk_off"
                                : usContext.riskState === "risk_on"
                                  ? "dialog.us_risk_on"
                                  : "dialog.us_risk_neutral",
                            ),
                            score: usContext.spxDirectionScore.toFixed(2),
                            vix:
                              typeof usContext.vixLevel === "number"
                                ? `, VIX ${usContext.vixLevel.toFixed(1)}`
                                : "",
                            signal: t(SIGNAL_LABEL_KEYS[outlook.signal]),
                            alignment: t(
                              fightsBenchmark(outlook.signal, usContext.riskState)
                                ? "dialog.us_fighting"
                                : "dialog.us_aligned",
                            ),
                          })}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ) : null)}
                {/* Smart money: derivatives positioning (Binance), with an
                    unavailable-feed fallback. One conditional unit, kept at the
                    bottom of the supporting evidence. */}
                {outlook.signal !== "neutral" &&
                  (smartMoney ? (
                    <Card className="border border-border bg-muted/50">
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t("dialog.smart_money")}
                          </CardTitle>
                          <div className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                                isNeutralPositioning(smartMoney.label)
                                  ? "text-muted-foreground border-muted-foreground/30"
                                  : smartMoney.positioningScore > 0
                                    ? badgeClass(BADGE.positive)
                                    : badgeClass(BADGE.negative),
                              )}
                            >
                              {smartMoney.label}
                              {smartMoney.flow && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium normal-case text-muted-foreground">
                                  OI
                                  {smartMoney.flow.oi === "up" ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )}
                                  price
                                  {smartMoney.flow.price === "up" ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-stretch gap-3">
                          <Card className="flex-1 border-border border">
                            <CardContent>
                              <div
                                className={cn(
                                  "text-sm font-bold tabular-nums tracking-tight",
                                  smartMoney.fundingRate == null
                                    ? "text-muted-foreground"
                                    : smartMoney.fundingRate > 0
                                      ? PALETTE.positive.text
                                      : smartMoney.fundingRate < 0
                                        ? PALETTE.negative.text
                                        : "",
                                )}
                              >
                                {smartMoney.fundingRate != null
                                  ? `${(smartMoney.fundingRate * 100).toFixed(4)}%`
                                  : "—"}
                              </div>
                              <CardDescription className="text-[10px] text-muted-foreground">
                                Funding
                              </CardDescription>
                            </CardContent>
                          </Card>
                          <Card className="flex-1 border-border border">
                            <CardContent>
                              <div
                                className={cn(
                                  "text-sm font-bold tabular-nums tracking-tight",
                                  smartMoney.openInterestDelta == null
                                    ? "text-muted-foreground"
                                    : smartMoney.openInterestDelta > 0
                                      ? PALETTE.positive.text
                                      : smartMoney.openInterestDelta < 0
                                        ? PALETTE.negative.text
                                        : "",
                                )}
                              >
                                {smartMoney.openInterestDelta != null
                                  ? `${smartMoney.openInterestDelta > 0 ? "+" : ""}${(smartMoney.openInterestDelta * 100).toFixed(1)}%`
                                  : "—"}
                              </div>
                              <CardDescription className="text-[10px] text-muted-foreground">
                                OI 24h
                              </CardDescription>
                            </CardContent>
                          </Card>
                          <Card className="flex-1 border-border border">
                            <CardContent>
                              <div className="text-sm font-bold tabular-nums tracking-tight">
                                {smartMoney.longShortRatio != null
                                  ? smartMoney.longShortRatio.toFixed(2)
                                  : "—"}
                              </div>
                              <CardDescription className="text-[10px] text-muted-foreground">
                                Long/Short
                              </CardDescription>
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  ) : smartMoneyUnavailable && asset?.assetType === "crypto" ? (
                    <Card className="border border-rose-500/30 bg-rose-500/10">
                      <CardContent className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            {t("dialog.sm_unavailable_title")}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleRetrySmartMoney}
                            disabled={isRetryingSmartMoney}
                            title={t("dialog.sm_retry")}
                            aria-label={t("dialog.sm_retry")}
                            className="-mt-1 -mr-1 shrink-0 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                          >
                            <RotateCw
                              className={cn(
                                "h-3.5 w-3.5",
                                isRetryingSmartMoney && "animate-spin",
                              )}
                            />
                          </Button>
                        </div>
                        <p className="text-xs leading-relaxed text-rose-700/90 dark:text-rose-300/90">
                          {t("dialog.sm_unavailable_desc")}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null)}
              </div>

              <Separator />

              {/* Technical Indicators */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t("dialog.indicators")}
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <IndicatorItem
                    label="RSI (14)"
                    value={outlook.indicators.rsi.toFixed(1)}
                    status={
                      outlook.indicators.rsi > 70
                        ? "overbought"
                        : outlook.indicators.rsi < 30
                          ? "oversold"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="EMA 20"
                    value={formatPrice(
                      outlook.indicators.ema20,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="EMA 50"
                    value={formatPrice(
                      outlook.indicators.ema50,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="EMA 200"
                    value={formatPrice(
                      outlook.indicators.ema200,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="MACD"
                    value={outlook.indicators.macd.histogram.toFixed(2)}
                    status={
                      outlook.indicators.macd.histogram > 0
                        ? "bullish"
                        : "bearish"
                    }
                  />
                  <IndicatorItem
                    label="ADX"
                    value={outlook.indicators.adx.toFixed(1)}
                    status={
                      outlook.indicators.adx > 25
                        ? "bullish"
                        : outlook.indicators.adx < 20
                          ? "bearish"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="DMI +DI/-DI"
                    value={`${outlook.indicators.plusDI.toFixed(1)} / ${outlook.indicators.minusDI.toFixed(1)}`}
                    status={
                      outlook.indicators.plusDI > outlook.indicators.minusDI
                        ? "bullish"
                        : outlook.indicators.plusDI < outlook.indicators.minusDI
                          ? "bearish"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="ATR"
                    value={formatPrice(
                      outlook.indicators.atr,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="StochRSI"
                    value={outlook.indicators.stochRSI.toFixed(1)}
                    status={
                      outlook.indicators.stochRSI > 80
                        ? "overbought"
                        : outlook.indicators.stochRSI < 20
                          ? "oversold"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="BB %B"
                    value={`${(outlook.indicators.bollingerBands.percentB * 100).toFixed(0)}%`}
                    status={
                      outlook.indicators.bollingerBands.percentB > 0.8
                        ? "overbought"
                        : outlook.indicators.bollingerBands.percentB < 0.2
                          ? "oversold"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="Support"
                    value={formatPrice(
                      outlook.indicators.support,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="Resistance"
                    value={formatPrice(
                      outlook.indicators.resistance,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="OBV Trend"
                    value={
                      outlook.indicators.obvTrend.charAt(0).toUpperCase() +
                      outlook.indicators.obvTrend.slice(1)
                    }
                    status={
                      outlook.indicators.obvTrend === "rising"
                        ? "bullish"
                        : outlook.indicators.obvTrend === "falling"
                          ? "bearish"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="Vol. Spike"
                    value={outlook.indicators.volumeSpike ? "Yes" : "No"}
                    status={
                      outlook.indicators.volumeSpike ? "bullish" : "normal"
                    }
                  />
                  <IndicatorItem
                    label="RSI Diverg."
                    value={
                      outlook.indicators.rsiDivergence === "none"
                        ? "None"
                        : outlook.indicators.rsiDivergence === "bullish"
                          ? "Bullish"
                          : "Bearish"
                    }
                    status={
                      outlook.indicators.rsiDivergence === "bullish"
                        ? "bullish"
                        : outlook.indicators.rsiDivergence === "bearish"
                          ? "bearish"
                          : "normal"
                    }
                  />
                  <IndicatorItem
                    label="Fib 0.618"
                    value={formatPrice(
                      outlook.indicators.fibLevels[0.618],
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="Swing High"
                    value={formatPrice(
                      outlook.indicators.recentSwingHigh,
                      asset?.assetType,
                    )}
                  />
                  <IndicatorItem
                    label="Swing Low"
                    value={formatPrice(
                      outlook.indicators.recentSwingLow,
                      asset?.assetType,
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Analysis */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t("dialog.analysis")}
                  </h3>
                </div>
                <div className="space-y-4">
                  <AnalysisItem
                    icon={TrendingUp}
                    title={t("table.trend")}
                    text={outlook.analysis.trend}
                  />
                  <AnalysisItem
                    icon={Activity}
                    title={t("table.volume")}
                    text={outlook.analysis.volume}
                  />
                  <AnalysisItem
                    icon={Gauge}
                    title="Momentum"
                    text={outlook.analysis.momentum}
                  />
                  <AnalysisItem
                    icon={ShieldAlert}
                    title={t("dialog.sentiment")}
                    text={outlook.analysis.sentiment}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              {t("dialog.not_enough_data")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisItem({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div>
        <div className="text-xs font-semibold mb-0.5">{title}</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function IndicatorItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: string;
}) {
  return (
    <Card className="border border-border bg-muted/50 overflow-hidden">
      <CardContent>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div
          className={cn(
            "text-xs font-semibold text-mono-data",
            INDICATOR_STATUS_COLORS[(status ?? "normal") as IndicatorStatus],
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
