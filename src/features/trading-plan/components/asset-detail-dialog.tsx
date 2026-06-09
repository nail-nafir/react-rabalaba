import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { useFavoriteStore } from "@/store/favorite-store";
import { toast } from "sonner";
import { runBacktest } from "@/features/engine/backtest";
import { calibrateConfidence } from "@/features/engine/calibration";
import { applyMarketContext } from "@/features/engine/market-context";
import { applySmartMoney } from "@/features/engine/smart-money";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import { TradeSetupChart } from "./trade-setup-chart";
import { FollowSignalButton } from "@/components/shared/follow-signal-button";
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
import { useUIStore } from "@/store/ui-store";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { useMarketContext } from "@/services/queries/use-market-context";
import { useSmartMoney } from "@/services/queries/use-smart-money";
import { useQueryClient } from "@tanstack/react-query";
import { PercentageChange } from "@/components/shared/percentage-change";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StrengthBar } from "@/components/charts/strength-bar";
import { Badge } from "@/components/ui/badge";
import { RISK_COLORS, REGIME_COLORS } from "@/constants/signals";
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
} from "lucide-react";

export function AssetDetailDialog() {
  const { t } = useTranslation();
  const { isDetailDialogOpen, selectedAssetSymbol, closeDetailDialog } =
    useUIStore();

  const { favoriteSymbols, addSymbol, removeSymbol } = useFavoriteStore();
  const isStarred = selectedAssetSymbol
    ? favoriteSymbols.includes(selectedAssetSymbol)
    : false;

  const { data: assets, isLoading: chartLoading } = useMarketData(
    selectedAssetSymbol ? [selectedAssetSymbol] : [],
  );
  const asset = assets?.[0];

  // Apply the same enrichment the screener uses, so conviction / tier shown
  // here is consistent: market-context de-rate + smart-money positioning nudge.
  const { data: marketContext } = useMarketContext();
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
  const outlook = useMemo(() => {
    let o = asset?.outlook ?? undefined;
    if (!o || !asset) return o;
    if (marketContext) o = applyMarketContext(o, asset, marketContext);
    if (smartMoney) o = applySmartMoney(o, smartMoney);
    return o;
  }, [asset, marketContext, smartMoney]);
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
            <div className="ml-auto pr-8">
              {asset && <FollowSignalButton asset={asset} />}
            </div>
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
                  <span className="text-xl sm:text-3xl font-bold text-mono-data break-words">
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
                {t(`dialog.regime_${outlook.regime}`)}
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
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                      <PauseCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {t("dialog.suppressed_note", {
                          tier: outlook.tier,
                          reason:
                            outlook.regime === "low_volatility"
                              ? t("dialog.suppressed_reason_chop")
                              : t("dialog.suppressed_reason_countertrend"),
                        })}
                      </p>
                    </div>
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
                  <CardContent className="space-y-3">
                    {(
                      [
                        ["cat_trend", outlook.categoryScores.trend],
                        ["cat_momentum", outlook.categoryScores.momentum],
                        ["cat_volatility", outlook.categoryScores.volatility],
                        ["cat_volume", outlook.categoryScores.volume],
                      ] as const
                    ).map(([key, val]) => {
                      const pct = Math.round(val * 100);
                      const isPos = val > 0.05;
                      const isNeg = val < -0.05;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 text-[11px] text-muted-foreground">
                            {t(`dialog.${key}`)}
                          </span>
                          <div className="relative h-2 flex-1 rounded-full bg-muted-foreground/15">
                            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
                            <div
                              className={cn(
                                "absolute top-0 h-full rounded-full",
                                isPos
                                  ? "bg-emerald-400"
                                  : isNeg
                                    ? "bg-rose-400"
                                    : "bg-zinc-500",
                              )}
                              style={
                                val >= 0
                                  ? {
                                      left: "50%",
                                      width: `${Math.abs(pct) / 2}%`,
                                    }
                                  : {
                                      right: "50%",
                                      width: `${Math.abs(pct) / 2}%`,
                                    }
                              }
                            />
                          </div>
                          <span
                            className={cn(
                              "w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-mono-data",
                              isPos
                                ? "text-emerald-400"
                                : isNeg
                                  ? "text-rose-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {pct > 0 ? `+${pct}` : pct}%
                          </span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {backtest && backtest.trades > 0 ? (
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-4">
                      <div className="flex justify-center">
                        <WinRateRing
                          value={backtest.winRate}
                          label={`${backtest.trades} ${t("dialog.bt_trades").toLowerCase()}`}
                        />
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-border border-t border-border pt-3">
                        <MetricRow
                          label={t("dialog.bt_expectancy")}
                          value={`${backtest.expectancy.toFixed(2)}R`}
                          color={
                            backtest.expectancy > 0
                              ? "text-emerald-400"
                              : backtest.expectancy < 0
                                ? "text-rose-400"
                                : undefined
                          }
                        />
                        <MetricRow
                          label={t("dialog.bt_profit_factor")}
                          value={
                            Number.isFinite(backtest.profitFactor)
                              ? backtest.profitFactor.toFixed(2)
                              : "∞"
                          }
                          color={
                            backtest.profitFactor >= 1
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }
                        />
                        <MetricRow
                          label={t("dialog.bt_max_dd")}
                          value={`${backtest.maxDrawdownR.toFixed(2)}R`}
                        />
                      </div>
                      {calibration && (
                        <div className="border-t border-border pt-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {t("dialog.calibrated_winrate")} (
                              {t("dialog.tier")} {outlook.tier})
                            </CardTitle>
                            <div
                              className={cn(
                                "text-xs font-bold tabular-nums",
                                calibration.winRate == null
                                  ? "text-muted-foreground"
                                  : calibration.winRate >= 0.5
                                    ? "text-emerald-400"
                                    : "text-rose-400",
                              )}
                            >
                              {calibration.winRate == null
                                ? t("dialog.low_sample")
                                : `${Math.round(calibration.winRate * 100)}%`}
                            </div>
                          </div>
                          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                            {calibration.sufficient
                              ? t("dialog.calibrated_desc", {
                                  sample: calibration.sample,
                                })
                              : t("dialog.calibrated_low_desc", {
                                  sample: calibration.sample,
                                })}
                            {calibration.regimeWinRate != null &&
                              ` ${t("dialog.regime_winrate", {
                                regime: outlook.regime.replace("_", " "),
                                rate: Math.round(
                                  calibration.regimeWinRate * 100,
                                ),
                              })}`}
                          </CardDescription>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("dialog.bt_insufficient")}
                  </p>
                )}

                {/* Market context: how this setup sits vs the BTC-led regime. */}
                {marketContext &&
                  outlook.signal !== "neutral" &&
                  asset?.assetType === "crypto" && (
                    <Card className="border border-border bg-muted/50">
                      <CardContent className="space-y-1">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {t("dialog.market_context")}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                          {t("dialog.market_context_desc", {
                            risk:
                              marketContext.riskState === "risk_on"
                                ? "risk-on"
                                : marketContext.riskState === "risk_off"
                                  ? "risk-off"
                                  : "neutral",
                            score: marketContext.btcDirectionScore.toFixed(2),
                            signal: outlook.signal.toUpperCase(),
                            stance:
                              (outlook.signal === "long" &&
                                marketContext.riskState === "risk_off") ||
                              (outlook.signal === "short" &&
                                marketContext.riskState === "risk_on")
                                ? "fighting"
                                : "aligned with",
                          })}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  )}

                {/* Smart money: crypto derivatives positioning (Binance). */}
                {smartMoney && outlook.signal !== "neutral" && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t("dialog.smart_money")}
                      </CardTitle>
                      <div
                        className={cn(
                          "text-xs font-bold text-right",
                          smartMoney.positioningScore > 0
                            ? "text-emerald-400"
                            : smartMoney.positioningScore < 0
                              ? "text-rose-400"
                              : "text-muted-foreground",
                        )}
                      >
                        {smartMoney.label}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <CardDescription className="text-xs uppercase tracking-wider text-muted-foreground">
                          {t("dialog.sm_funding")}
                        </CardDescription>
                        <div
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            smartMoney.fundingRate == null
                              ? "text-muted-foreground"
                              : smartMoney.fundingRate > 0
                                ? "text-emerald-400"
                                : smartMoney.fundingRate < 0
                                  ? "text-rose-400"
                                  : "",
                          )}
                        >
                          {smartMoney.fundingRate != null
                            ? `${(smartMoney.fundingRate * 100).toFixed(3)}%`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <CardDescription className="text-xs uppercase tracking-wider text-muted-foreground">
                          {t("dialog.sm_oi_delta")}
                        </CardDescription>
                        <div
                          className={cn(
                            "text-xs font-bold tabular-nums",
                            smartMoney.openInterestDelta == null
                              ? "text-muted-foreground"
                              : smartMoney.openInterestDelta > 0
                                ? "text-emerald-400"
                                : smartMoney.openInterestDelta < 0
                                  ? "text-rose-400"
                                  : "",
                          )}
                        >
                          {smartMoney.openInterestDelta != null
                            ? `${(smartMoney.openInterestDelta * 100).toFixed(1)}%`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <CardDescription className="text-xs uppercase tracking-wider text-muted-foreground">
                          {t("dialog.sm_ls")}
                        </CardDescription>
                        <div className="text-xs font-bold tabular-nums">
                          {smartMoney.longShortRatio != null
                            ? smartMoney.longShortRatio.toFixed(2)
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Smart money unavailable (e.g. Binance derivatives blocked by the network/ISP) — surface it instead of hiding silently. */}
                {!smartMoney &&
                  smartMoneyUnavailable &&
                  outlook.signal !== "neutral" &&
                  asset?.assetType === "crypto" && (
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
                  )}
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
                    title={t("dialog.momentum")}
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

function WinRateRing({ value, label }: { value: number; label: string }) {
  const { t } = useTranslation();
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value));
  const positive = value >= 0.5;
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="9"
          className="fill-none stroke-muted-foreground/15"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="9"
          strokeLinecap="round"
          className={cn(
            "fill-none",
            positive ? "stroke-emerald-400" : "stroke-rose-400",
          )}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[9px] font-semibold tracking-wide text-muted-foreground">
          {t("dialog.bt_success_rate")}
        </span>
        <span className="text-xl font-bold text-mono-data">
          {Math.round(value * 100)}%
        </span>
        <span className="px-2 text-center text-[9px] leading-tight text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center px-1 text-center">
      <span className={cn("text-sm font-bold text-mono-data", color)}>
        {value}
      </span>
      <span className="mt-1 text-[10px] leading-tight tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
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
  const statusColors: Record<string, string> = {
    bullish: "text-emerald-400",
    bearish: "text-rose-400",
    overbought: "text-rose-400",
    oversold: "text-emerald-400",
    normal: "text-foreground",
  };

  return (
    <Card className="border border-border bg-muted/50 overflow-hidden">
      <CardContent>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div
          className={cn(
            "text-xs font-semibold text-mono-data",
            statusColors[status ?? "normal"],
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
