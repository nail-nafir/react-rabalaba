import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { useFavoriteStore } from "@/store/favorite-store";
import { toast } from "sonner";
import { runBacktest } from "@/features/signals/engine/backtest";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import { TradeSetupChart } from "./trade-setup-chart";
import { FollowSignalButton } from "@/components/shared/follow-signal-button";
import { buildSignalText } from "../lib/signal-text";
import { buildTradeSetupModel } from "../lib/trade-setup-model";
import {
  buildShareCardSvg,
  svgToPngBlob,
  shareOrDownloadPng,
  SHARE_CARD_SIZE,
} from "../lib/share-card";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useUIStore } from "@/store/ui-store";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { PercentageChange } from "@/components/shared/percentage-change";
import { SignalStrengthMeter } from "@/components/shared/signal-strength-meter";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  Copy,
  Share2,
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

  const outlook = asset?.outlook;
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

  // Current price and change percent
  const currentPrice = asset?.price ?? 0;
  const changePercent = asset?.changePercent ?? 0;

  const [isSharing, setIsSharing] = useState(false);

  const handleCopy = async () => {
    if (!outlook || !tradingPlan || !selectedAssetSymbol) return;
    try {
      await navigator.clipboard.writeText(
        buildSignalText(
          selectedAssetSymbol,
          outlook,
          tradingPlan,
          asset?.assetType ?? "crypto",
        ),
      );
      toast.success(t("dialog.copied"));
    } catch {
      /* clipboard unavailable (e.g. insecure context) */
    }
  };

  const handleShare = async () => {
    if (!outlook || !tradingPlan || !asset || !selectedAssetSymbol) return;
    setIsSharing(true);
    try {
      const model = buildTradeSetupModel(
        candles,
        tradingPlan,
        outlook.signal,
        currentPrice,
      );
      const svg = buildShareCardSvg(model, {
        symbol: selectedAssetSymbol,
        name: asset.name,
        strength: outlook.strength,
        currentPrice,
        assetType: asset.assetType,
        candles,
      });
      const blob = await svgToPngBlob(
        svg,
        SHARE_CARD_SIZE.width,
        SHARE_CARD_SIZE.height,
      );
      const result = await shareOrDownloadPng(
        blob,
        `${selectedAssetSymbol}-setup.png`,
      );
      toast.success(
        t(result === "shared" ? "dialog.shared" : "dialog.downloaded"),
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error(t("dialog.share_failed"));
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (!selectedAssetSymbol) return null;

  return (
    <Dialog
      open={isDetailDialogOpen}
      onOpenChange={(open) => !open && closeDetailDialog()}
    >
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-border p-0"
        showCloseButton={true}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex flex-row items-start justify-between pr-8">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
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
                  title={
                    isStarred ? "Remove from Favorites" : "Add to Favorites"
                  }
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-all duration-200",
                      isStarred
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30 hover:scale-110",
                    )}
                  />
                </Button>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {asset?.name ?? selectedAssetSymbol} ·{" "}
                {t("dialog.title_suffix")}
              </DialogDescription>
            </div>
            {asset && <FollowSignalButton asset={asset} />}
          </div>

          {/* Price row */}
          {chartLoading ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-15 w-full rounded" />
            </div>
          ) : (
            <>
              <div className="flex items-end gap-3 mt-2">
                <span className="text-3xl font-bold text-mono-data">
                  {formatPrice(currentPrice, asset?.assetType)}
                </span>
                <PercentageChange
                  value={changePercent}
                  className="text-sm pb-1"
                />
              </div>
            </>
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
              <div className="flex-1 min-w-25">
                <SignalStrengthMeter value={outlook.strength} size="md" />
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

        <Separator />

        {chartLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("dialog.loading")}
          </div>
        ) : outlook ? (
          <>
            {/* Trading Plan */}
            <div className="px-6 py-5 space-y-4">
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
                      onClick={handleCopy}
                      title={t("dialog.copy")}
                      aria-label={t("dialog.copy")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
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
                <p className="text-sm text-muted-foreground">
                  {t("dialog.no_setup")}
                </p>
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
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {t("dialog.decision_support")}
                </h3>
              </div>

              {/* Per-category alignment — bars with signed score (-100..+100) */}
              <Card className="border border-border">
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
                        <div className="relative h-2 flex-1 rounded-full bg-muted/40">
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
                <Card className="border border-border">
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
                  </CardContent>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("dialog.bt_insufficient")}
                </p>
              )}
            </div>

            <Separator />

            {/* Technical Indicators */}
            <div className="px-6 py-5">
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
                  value={formatPrice(outlook.indicators.atr, asset?.assetType)}
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
                  status={outlook.indicators.volumeSpike ? "bullish" : "normal"}
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
            <div className="px-6 py-5">
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
          className="fill-none stroke-muted/40"
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
    <Card className="border border-border overflow-hidden">
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
