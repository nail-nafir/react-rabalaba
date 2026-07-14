import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useMarketData,
  usePeriodCandles,
} from "@/services/queries/use-yahoo-data";
import { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
import {
  computePnl,
  deriveFollowProgress,
} from "@/features/follow-trade/lib/follow-trade-model";
import {
  computeTradeChartWindow,
  fitTradeWindowCandles,
} from "@/features/follow-trade/lib/trade-chart-window";
import { LifecycleBadge, ReversedBadge, TpProgress } from "./follow-status";
import {
  formatPrice,
  formatRatio,
  formatDayMonth,
  formatClock,
} from "@/lib/formatters";
import { TradeSetupChart } from "@/features/trading-plan/components/trade-setup-chart";
import { PercentageChange } from "@/components/shared/percentage-change";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useShareSetup } from "@/features/trading-plan/hooks/use-share-setup";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Share2,
  Target,
} from "lucide-react";
import { SIGNAL_COLORS, PALETTE, SIGNAL_LABEL_KEYS } from "@/constants";

import type { FollowedTrade } from "@/features/follow-trade/lib/follow-trade-model";
import type { TradingPlan, SignalDirection } from "@/types/asset";
import type { ChartMarker } from "@/features/trading-plan/lib/trade-setup-model";

export type TradeDetailDialogState =
  | "loading"
  | "ready"
  | "error"
  | "unavailable";

export interface TradeDetailDialogProps {
  trade: FollowedTrade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state?: TradeDetailDialogState;
  onRetry?: () => void;
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
    // A trade may carry fewer than 3 TPs (or none). TradingPlan requires
    // takeProfit1/2 as numbers, so missing ones become NaN — non-finite levels
    // are dropped by buildTradeSetupModel, instead of fabricating fake TP
    // levels at the entry price (which rendered "+0.0R" TP cards).
    takeProfit1: trade.takeProfits[0] ?? Number.NaN,
    takeProfit2: trade.takeProfits[1] ?? Number.NaN,
    takeProfit3: trade.takeProfits[2],
    riskRewardRatio: trade.riskRewardRatio,
  };
}

function TradeDetailStatusDialog({
  open,
  onOpenChange,
  state,
  onRetry,
}: Omit<TradeDetailDialogProps, "trade"> & {
  state: Exclude<TradeDetailDialogState, "ready">;
}) {
  const { t } = useTranslation();
  const isLoading = state === "loading";
  const isError = state === "error";
  const title = isLoading
    ? t("journal.trade_detail")
    : isError
      ? t("journal.detail_load_error_title", {
          defaultValue: "Detail jurnal belum dapat dimuat",
        })
      : t("journal.detail_unavailable_title", {
          defaultValue: "Detail jurnal tidak tersedia",
        });
  const description = isLoading
    ? t("dialog.loading")
    : isError
      ? t("journal.detail_load_error_description", {
          defaultValue:
            "Terjadi gangguan saat mengambil data jurnal. Coba muat ulang.",
        })
      : t("journal.detail_unavailable_description", {
          defaultValue:
            "Transaksi ini tidak ditemukan atau tidak tersedia untuk akun Anda.",
        });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border border-border text-foreground"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex flex-col space-y-6"
          role={isError ? "alert" : undefined}
        >
          {isLoading ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-44 w-full rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 py-6 text-center sm:py-8">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                {isError && (
                  <Button
                    type="button"
                    onClick={onRetry}
                    disabled={!onRetry}
                    className="min-h-11"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("common.retry")}
                  </Button>
                )}
                <DialogClose
                  render={
                    <Button
                      type="button"
                      variant={isError ? "outline" : "default"}
                      className="min-h-11"
                    />
                  }
                >
                  {t("journal.close_short")}
                </DialogClose>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TradeDetailDialog({
  trade,
  open,
  onOpenChange,
  state = trade ? "ready" : "unavailable",
  onRetry,
}: TradeDetailDialogProps) {
  if (state !== "ready" || !trade) {
    return (
      <TradeDetailStatusDialog
        open={open}
        onOpenChange={onOpenChange}
        state={state === "ready" ? "unavailable" : state}
        onRetry={onRetry}
      />
    );
  }

  return (
    <TradeDetailReadyDialog
      trade={trade}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

function TradeDetailReadyDialog({
  trade,
  open,
  onOpenChange,
}: Omit<TradeDetailDialogProps, "state" | "onRetry"> & {
  trade: FollowedTrade;
}) {
  const { t, i18n } = useTranslation();

  const isClosed = trade.status !== "open";

  // OPEN trades chart the live recent window (and need the live price), so
  // they go through useMarketData. Memoize the symbols array so its input is
  // identity-stable (a fresh [trade.symbol] each render churns the query).
  const symbols = useMemo(
    () => (!isClosed ? [trade.symbol] : []),
    [trade.symbol, isClosed],
  );
  const { data: assets, isLoading: liveLoading } = useMarketData(symbols);
  const asset = assets?.[0];

  // CLOSED trades chart ONE continuous series from before entry up to now:
  // the default frame centers on the trade, and panning right reaches the
  // current market — no separate "current" mode.
  const chartWindow = useMemo(
    () =>
      isClosed && trade.closedAt != null
        ? computeTradeChartWindow(trade.followedAt, trade.closedAt)
        : null,
    [trade, isClosed],
  );
  const { data: periodCandles, isLoading: periodLoading } = usePeriodCandles(
    isClosed ? trade.symbol : null,
    chartWindow,
  );

  const candles = useMemo(
    () =>
      isClosed
        ? (periodCandles ?? [])
        : asset?.quoteIndicators
          ? normalizeYahooCandles(asset.quoteIndicators, asset.timestamps)
          : [],
    [isClosed, periodCandles, asset],
  );
  const chartLoading = isClosed ? periodLoading : liveLoading;

  // Build the trading plan from the running/saved setup data
  const tradingPlan = useMemo(() => buildPlanFromTrade(trade), [trade]);
  const livePrice = asset?.price ?? trade.entryPrice;
  const displayPrice = isClosed
    ? (trade.closePrice ?? trade.entryPrice)
    : livePrice;
  const changePercent = isClosed ? 0 : (asset?.changePercent ?? 0);

  const pnl = useMemo(() => {
    return computePnl(trade, displayPrice);
  }, [trade, displayPrice]);

  // Entry/close annotations for the chart: always show entry; add the close
  // marker only when the trade is closed, colored by realized outcome.
  // Candle timestamps are in SECONDS (Yahoo), but followedAt/closedAt are ms
  // (Date.now()), so convert to seconds to keep the marker on the same axis.
  const markers = useMemo<ChartMarker[]>(() => {
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

  // The share card is a static image — it can't zoom, so hand it the default
  // frame (whole trade centered) instead of the full fetched range the
  // interactive chart pans through.
  const shareCandles = useMemo(
    () =>
      isClosed && chartWindow
        ? fitTradeWindowCandles(
            candles,
            chartWindow.focusStart,
            chartWindow.focusEnd,
          )
        : candles,
    [isClosed, chartWindow, candles],
  );

  const handleShare = () => {
    shareSetup({
      symbol: trade.symbol,
      name: trade.name,
      signal: trade.signal,
      strength: trade.strengthAtEntry ?? 0,
      grade: trade.grade,
      currentPrice: displayPrice,
      assetType: trade.assetType,
      candles: shareCandles,
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

  const signal: SignalDirection = trade.signal;
  const formatTradeDate = (timestamp: number) => {
    const sec = timestamp / 1000;
    return `${formatDayMonth(sec, i18n.language)} ${formatClock(sec)}`;
  };
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
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
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
                  <span className="text-xl sm:text-3xl font-bold wrap-break-word">
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
                  className={`text-xl font-bold ${
                    pos ? PALETTE.positive.text : PALETTE.negative.text
                  }`}
                >
                  {sign(pnl.pct)}
                  {pnl.pct.toFixed(2)}%
                </div>
                <div
                  className={`text-xs font-semibold ${
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
              className={cn(
                "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
                PALETTE.positive.bg,
                PALETTE.positive.border,
                PALETTE.positive.text,
              )}
            >
              {t("journal.datetime_entry")} {formattedFollowedDate}
            </Badge>
            {formattedClosedDate && (
              <Badge
                variant="outline"
                className={cn(
                  "w-fit rounded-md text-[10px] font-bold uppercase tracking-wider",
                  PALETTE.positive.bg,
                  PALETTE.positive.border,
                  PALETTE.positive.text,
                )}
              >
                {t("journal.datetime_closed")} {formattedClosedDate}
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
            {progress.reversed && (
              <ReversedBadge reversedPnl={pos ? "profit" : "loss"} />
            )}
            <LifecycleBadge open={progress.lifecycle === "open"} />
          </div>
          <Separator className="mt-4" />
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
          {/* Trading Plan Chart — uses the saved setup, not the live signal.
              The header (title + window toggle + share) stays mounted through
              loading/empty states so the toggle can't strand the user in a
              mode with no way back. */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{chartTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleShare}
                  disabled={isSharing || chartLoading || candles.length === 0}
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

            {chartLoading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("dialog.loading")}
              </div>
            ) : candles.length > 0 ? (
              <TradeSetupChart
                candles={candles}
                plan={tradingPlan}
                signal={signal}
                assetType={trade.assetType}
                currentPrice={displayPrice}
                markers={markers}
              />
            ) : (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                {t("dialog.not_enough_data")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
