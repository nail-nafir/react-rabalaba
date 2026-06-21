import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMarketData } from "@/services/queries/use-yahoo-data";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import {
  computePnl,
  deriveFollowProgress,
} from "@/features/follow-trade/lib/follow-trade-model";
import { LifecycleBadge, ReversedBadge, TpProgress } from "./follow-status";
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
import { Target, Check, Loader2, Share2 } from "lucide-react";
import { SIGNAL_COLORS, PALETTE, SIGNAL_LABEL_KEYS } from "@/constants";

import type { FollowedTrade } from "@/features/follow-trade/lib/follow-trade-model";
import type { TradingPlan, SignalDirection } from "@/types/asset";
import type { ChartMarker } from "@/features/trading-plan/lib/trade-setup-model";

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
  // Memoize the symbols array so useMarketData's input is identity-stable
  // (a fresh [trade.symbol] each render churns the query → recharts re-mounts).
  const symbols = useMemo(() => (trade ? [trade.symbol] : []), [trade]);
  const { data: assets, isLoading: chartLoading } = useMarketData(symbols);
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
    ? (trade?.closePrice ?? trade?.entryPrice ?? 0)
    : livePrice;
  const changePercent = isClosed ? 0 : (asset?.changePercent ?? 0);

  const pnl = useMemo(() => {
    if (!trade) return { pct: 0, r: 0 };
    return computePnl(trade, displayPrice);
  }, [trade, displayPrice]);

  // Entry/close annotations for the chart: always show entry; add the close
  // marker only when the trade is closed, colored by realized outcome.
  // Candle timestamps are in SECONDS (Yahoo), but followedAt/closedAt are ms
  // (Date.now()), so convert to seconds to keep the marker on the same axis.
  const markers = useMemo<ChartMarker[]>(() => {
    if (!trade) return [];
    const toSec = (ms: number) => Math.floor(ms / 1000);
    const list: ChartMarker[] = [
      {
        kind: "entry",
        timestamp: toSec(trade.followedAt),
        price: trade.entryPrice,
      },
    ];
    if (isClosed && trade.closedAt != null && trade.closePrice != null) {
      const outcome =
        computePnl(trade, trade.closePrice).r >= 0 ? "profit" : "loss";
      list.push({
        kind: "close",
        timestamp: toSec(trade.closedAt),
        price: trade.closePrice,
        outcome,
      });
    }
    return list;
  }, [trade, isClosed]);

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
      grade: trade.grade,
      currentPrice: displayPrice,
      assetType: trade.assetType,
      candles,
      tradingPlan,
      isPosition: true,
      closed: isClosed,
      closeReason: isClosed ? trade.status.toUpperCase() : undefined,
      entryPrice: trade.entryPrice,
      pnlPct: pnl.pct,
      pnlR: pnl.r,
      markers,
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
  // Split lifecycle (running/closed) from outcome (TP/SL). For a running trade
  // the milestone is recomputed LIVE off the fetched candles — the stored value
  // is stale 0 until the cron closes it (see core/auto-journal-core.ts).
  const progress = deriveFollowProgress(trade, livePrice, candles);
  const priceLabel = isClosed
    ? t("journal.close_price")
    : t("journal.current_price");
  const chartTitle = isClosed
    ? t("journal.trade_detail")
    : t("journal.open_position");

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
              {t(SIGNAL_LABEL_KEYS[trade.signal])}
            </Badge>
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
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {priceLabel}
                </p>
                <div className="flex items-end gap-3 min-w-0">
                  <span className="text-xl sm:text-3xl font-bold text-mono-data wrap-break-word">
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
              <div className="text-right leading-tight">
                <div
                  className={`text-xl font-bold text-mono-data ${
                    pos ? PALETTE.positive.text : PALETTE.negative.text
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

          {/* Meta badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge
              variant="outline"
              className="font-semibold uppercase tracking-wider text-[10px] rounded-md border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1"
            >
              <Check className="h-3 w-3 shrink-0" />
              {formattedFollowedDate}
            </Badge>
            {formattedClosedDate && (
              <Badge
                variant="outline"
                className="font-semibold uppercase tracking-wider text-[10px] rounded-md border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1"
              >
                <Check className="h-3 w-3 shrink-0" />
                {formattedClosedDate}
              </Badge>
            )}
            {(progress.tpTotal > 0 || progress.slHit) && (
              <TpProgress
                reached={progress.tpReached}
                total={progress.tpTotal}
                slHit={progress.slHit}
                isClosed={progress.lifecycle !== "open"}
                size="sm"
                variant="badge"
              />
            )}
            {progress.reversed && <ReversedBadge />}
            <LifecycleBadge open={progress.lifecycle === "open"} />
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
                  markers={markers}
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
