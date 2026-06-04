import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import { computePnl } from "@/features/follow-trade/lib/follow-trade-model";
import { formatPrice, formatRatio } from "@/lib/formatters";
import { TradeSetupChart } from "@/features/trading-plan/components/trade-setup-chart";
import { PercentageChange } from "@/components/shared/percentage-change";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useShareSetup } from "@/features/trading-plan/hooks/use-share-setup";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Check, Loader2, Calendar, Share2 } from "lucide-react";
import { SIGNAL_COLORS, TIER_COLORS } from "@/constants/signals";

import type { FollowedTrade } from "@/features/follow-trade/lib/follow-trade-model";
import type { TradingPlan, SignalDirection } from "@/types/asset";

interface TradeDetailDialogProps {
  trade: FollowedTrade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Reconstructs a `TradingPlan` from the saved FollowedTrade levels.
 * This ensures the chart shows the *running* setup (as-followed),
 * not the current live signal which may have changed.
 */
function buildPlanFromTrade(trade: FollowedTrade): TradingPlan {
  return {
    entry: trade.entryPrice,
    stopLoss: trade.stopLoss,
    takeProfit1: trade.takeProfits[0] ?? trade.entryPrice,
    takeProfit2:
      trade.takeProfits[1] ?? trade.takeProfits[0] ?? trade.entryPrice,
    takeProfit3: trade.takeProfits[2],
    riskRewardRatio: trade.riskRewardRatio,
  };
}

export function TradeDetailDialog({
  trade,
  open,
  onOpenChange,
}: TradeDetailDialogProps) {
  const { t, i18n } = useTranslation();

  // Fetch current candle data for the symbol so the saved setup can be charted.
  const { data: assets, isLoading: chartLoading } = useMarketData(
    trade ? [trade.symbol] : [],
  );
  const asset = assets?.[0];

  // Normalize candles from the fetched data
  const candles = useMemo(
    () =>
      asset?.quoteIndicators
        ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
        : [],
    [asset],
  );

  // Build the trading plan from the running/saved setup data
  const tradingPlan = useMemo(
    () => (trade ? buildPlanFromTrade(trade) : null),
    [trade],
  );

  const isClosed = trade ? trade.status !== "open" : false;
  const livePrice = asset?.price ?? trade?.entryPrice ?? 0;
  const displayPrice = isClosed
    ? trade?.closePrice ?? trade?.entryPrice ?? 0
    : livePrice;
  const changePercent = isClosed ? 0 : asset?.changePercent ?? 0;

  const pnl = useMemo(() => {
    if (!trade) return { pct: 0, r: 0 };
    return computePnl(trade, displayPrice);
  }, [trade, displayPrice]);

  const pos = pnl.r >= 0;
  const sign = (v: number) => (v >= 0 ? "+" : "");

  const { isSharing, shareSetup } = useShareSetup();

  const handleShare = () => {
    if (!trade) return;
    if (!tradingPlan) return;
    shareSetup({
      symbol: trade.symbol,
      name: trade.name,
      signal: trade.signal,
      strength: trade.strengthAtEntry ?? 0,
      currentPrice: displayPrice,
      assetType: trade.assetType,
      candles,
      tradingPlan,
      isPosition: true,
      entryPrice: trade.entryPrice,
      pnlPct: pnl.pct,
      pnlR: pnl.r,
    });
  };

  if (!trade) return null;

  const signal: SignalDirection = trade.signal;
  const formatTradeDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formattedFollowedDate = formatTradeDate(trade.followedAt);
  const formattedClosedDate = trade.closedAt
    ? formatTradeDate(trade.closedAt)
    : null;
  const slReached = isClosed && trade.status === "sl";
  const priceLabel = isClosed
    ? t("journal.close_price")
    : t("journal.current_price");
  const chartTitle = isClosed
    ? t("journal.trade_detail")
    : t("journal.running_position");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            {trade.symbol}
            <Badge
              variant="outline"
              className={cn(
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
                SIGNAL_COLORS[trade.signal].bg,
                SIGNAL_COLORS[trade.signal].text,
                SIGNAL_COLORS[trade.signal].border,
              )}
            >
              {t(`journal.${trade.signal}`)}
            </Badge>
            {trade.grade && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold rounded-md",
                  TIER_COLORS[trade.grade].border,
                  TIER_COLORS[trade.grade].bg,
                  TIER_COLORS[trade.grade].text,
                )}
              >
                {trade.grade}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {trade.name} · {t(`common.asset_types.${trade.assetType}`)}
          </DialogDescription>

          {/* Price + P/L row */}
          {chartLoading && !isClosed ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-15 w-full rounded" />
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3 mt-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {priceLabel}
                </p>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold text-mono-data">
                    {formatPrice(displayPrice, trade.assetType)}
                  </span>
                  {!isClosed && (
                    <PercentageChange
                      value={changePercent}
                      className="text-sm pb-1"
                    />
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right leading-tight">
                <div
                  className={`text-xl font-bold text-mono-data ${
                    pos ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {sign(pnl.pct)}
                  {pnl.pct.toFixed(2)}%
                </div>
                <div
                  className={`text-xs font-semibold text-mono-data ${
                    pos ? "text-emerald-400/80" : "text-rose-400/80"
                  }`}
                >
                  {sign(pnl.r)}
                  {formatRatio(pnl.r)}R
                </div>
              </div>
            </div>
          )}

          {/* Meta row: followed date + TP milestones */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold rounded-md border-border bg-muted/50 text-muted-foreground gap-1"
            >
              <Calendar className="h-3 w-3" />
              {t("journal.followed_at")}: {formattedFollowedDate}
            </Badge>
            {formattedClosedDate && (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold rounded-md border-border bg-muted/50 text-muted-foreground gap-1"
              >
                <Calendar className="h-3 w-3" />
                {t("journal.closed_at")}: {formattedClosedDate}
              </Badge>
            )}
            {trade.takeProfits.map((_, i) => {
              const reached = trade.highestTpReached > i;
              return (
                <Badge
                  key={i}
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold rounded-md",
                    reached
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  {reached && <Check className="h-3 w-3 mr-0.5" />}
                  TP{i + 1}
                </Badge>
              );
            })}
            {isClosed && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold rounded-md",
                  slReached
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    : "border-border bg-muted/50 text-muted-foreground",
                )}
              >
                {slReached && <Check className="h-3 w-3 mr-0.5" />}
                SL
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col space-y-6">
          <Separator />

          {chartLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("dialog.loading")}
            </div>
          ) : tradingPlan && candles.length > 0 ? (
            <>
              {/* Trading Plan Chart — uses the saved setup, not the live signal */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">{chartTitle}</h3>
                  </div>
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
                </div>

                <TradeSetupChart
                  candles={candles}
                  plan={tradingPlan}
                  signal={signal}
                  assetType={trade.assetType}
                  currentPrice={displayPrice}
                />
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
