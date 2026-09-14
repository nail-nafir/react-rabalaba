import { useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useMarketData } from "@/services/queries/use-market-data";
import { usePeriodCandles } from "@/services/queries/use-period-candles";
import { normalizeYahooCandles } from "@/core/market/candles";
import {
  computePnl,
  deriveFollowProgress,
} from "@/core/trade/follow-trade-model";
import {
  computeTradeChartWindow,
  fitTradeWindowCandles,
} from "@/features/follow-trade/model/trade-chart-window";
import { LifecycleBadge, TpProgress } from "./follow-status";
import { tradeOutcomeLabel } from "@/features/follow-trade/model/follow-outcome";
import {
  formatPrice,
  formatRatio,
  formatDayMonth,
  formatClock,
} from "@/lib/formatters";
import {
  TradeSetupChart,
  TradeSetupChartSettings,
} from "@/features/trading-plan/components/trade-setup-chart";
import { PercentageChange } from "@/components/shared/percentage-change";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useShareSetup } from "@/features/trading-plan/hooks/use-share-setup";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Loader2,
  Share2,
  Target,
} from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SIGNAL_COLORS, PALETTE, SIGNAL_LABEL_KEYS } from "@/constants";

import type { FollowedTrade } from "@/core/trade/follow-trade-model";
import type { TradingPlan, SignalDirection } from "@/types/asset";
import type { ChartMarker } from "@/features/trading-plan/model/trade-setup-model";

const EMPTY_SIBLINGS: FollowedTrade[] = [];

export interface TradeDetailDialogProps {
  trade: FollowedTrade;
  trigger: ReactElement;
  /**
   * Same-batch trade list used to derive a stable, human-readable per-symbol
   * sequence number for the dialog header (e.g. "#3" = 3rd SOL-USD trade by
   * open time). Cosmetic only — the URL/lookup still uses the trade UUID.
   * Omit (or pass empty) to suppress the badge.
   */
  siblings?: FollowedTrade[];
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

export function TradeDetailDialog({
  trade,
  trigger,
  siblings = EMPTY_SIBLINGS,
}: TradeDetailDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {open && <TradeDetailReadyDialog trade={trade} siblings={siblings} />}
    </Dialog>
  );
}

function TradeDetailReadyDialog({
  trade,
  siblings = EMPTY_SIBLINGS,
}: Pick<TradeDetailDialogProps, "siblings"> & {
  trade: FollowedTrade;
}) {
  const { t, i18n } = useTranslation();
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showEma200, setShowEma200] = useState(false);
  const [showBollingerBands, setShowBollingerBands] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showRsi, setShowRsi] = useState(false);
  const [showZones, setShowZones] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const isClosed = trade.status !== "open";

  // Per-symbol sequence number (cosmetic). Only trades of the SAME symbol are
  // counted, sorted by open time asc with a deterministic id tiebreak — stable
  // across closes/updates since open time is immutable. Null when the trade is
  // not found among siblings (e.g. the caller passed an empty/partial list), in
  // which case the badge is hidden.
  const tradeNumber = useMemo(() => {
    if (siblings.length === 0) return null;
    const sameSymbol = siblings.filter((s) => s.symbol === trade.symbol);
    if (sameSymbol.length === 0) return null;
    const sorted = sameSymbol.sort(
      (a, b) =>
        a.followedAt - b.followedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const idx = sorted.findIndex((s) => s.id === trade.id);
    return idx === -1 ? null : idx + 1;
  }, [siblings, trade.id, trade.symbol]);

  // OPEN trades chart the live recent window (and need the live price), so
  // they go through useMarketData. Memoize the symbols array so its input is
  // identity-stable (a fresh [trade.symbol] each render churns the query).
  const symbols = useMemo(
    () => (!isClosed ? [trade.symbol] : []),
    [trade.symbol, isClosed],
  );
  const {
    data: assets,
    isLoading: liveLoading,
    isError: liveError,
    isFetching: liveFetching,
    refetch: refetchLive,
  } = useMarketData(symbols);
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
  const {
    data: periodCandles,
    isLoading: periodLoading,
    isError: periodError,
    isFetching: periodFetching,
    refetch: refetchPeriod,
  } = usePeriodCandles(isClosed ? trade.symbol : null, chartWindow);

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
  const chartError = isClosed ? periodError : liveError;
  const chartFetching = isClosed ? periodFetching : liveFetching;
  const retryChart = isClosed ? refetchPeriod : refetchLive;

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
      const r = computePnl(trade, trade.closePrice).r;
      const outcome = r > 0 ? "profit" : r < 0 ? "loss" : "flat";
      list.push({
        kind: "close",
        timestamp: toSec(trade.closedAt),
        price: trade.closePrice,
        outcome,
      });
    }
    return list;
  }, [trade, isClosed]);

  const pnlTone = pnl.r > 0 ? "profit" : pnl.r < 0 ? "loss" : "flat";
  const pnlColor =
    pnlTone === "profit"
      ? PALETTE.positive
      : pnlTone === "loss"
        ? PALETTE.negative
        : PALETTE.neutral;
  const sign = (v: number) => (v >= 0 ? "+" : "");
  // Running protection is replayed live; closed rows use their persisted exit.
  const progress = deriveFollowProgress(trade, livePrice, candles);

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
      closeReason: isClosed
        ? tradeOutcomeLabel(
            t,
            progress.exitReason,
            progress.tpSecured,
            progress.tpTotal,
            pnlTone,
          ).toUpperCase()
        : undefined,
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
  const priceLabel = isClosed
    ? t("journal.close_price")
    : t("journal.current_price");
  const chartTitle = isClosed
    ? t("journal.trade_detail")
    : t("journal.open_position");
  return (
    <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
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
          {tradeNumber !== null && (
            <Badge
              variant="outline"
              className={cn(
                "font-bold tracking-wider uppercase text-[10px] rounded-md",
                SIGNAL_COLORS.neutral.bg,
                SIGNAL_COLORS.neutral.text,
                SIGNAL_COLORS.neutral.border,
              )}
            >
              #{tradeNumber}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {trade.name} ·{" "}
          {t(`common.asset_types.${trade.assetType.replaceAll("-", "_")}`)}
        </DialogDescription>

        {/* Price + P/L row */}
        {chartLoading && !isClosed ? (
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Skeleton className="h-3 w-24" />
              <div className="flex min-w-0 items-end gap-3">
                <Skeleton className="h-8 w-32 max-w-full" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
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
              <div className={`text-xl font-bold ${pnlColor.text}`}>
                {sign(pnl.pct)}
                {pnl.pct.toFixed(2)}%
              </div>
              <div className={`text-xs font-semibold ${pnlColor.text}`}>
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
              secured={progress.tpSecured}
              total={progress.tpTotal}
              exitReason={progress.exitReason}
              pnlTone={pnlTone}
              isClosed={progress.lifecycle !== "open"}
              size="sm"
              variant="badge"
              showJourney
            />
          )}
          <LifecycleBadge open={progress.lifecycle === "open"} />
        </div>
        <Separator className="mt-4" />
      </DialogHeader>

      <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
        {/* Trading Plan Chart — uses the saved setup, not the live signal.
              The header (title + settings + share) stays mounted through
              loading/empty states so the toggle can't strand the user in a
              mode with no way back. */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{chartTitle}</h3>
            </div>
            <div className="flex items-center gap-2">
              <TradeSetupChartSettings
                showEma20={showEma20}
                onShowEma20Change={setShowEma20}
                showEma50={showEma50}
                onShowEma50Change={setShowEma50}
                showEma200={showEma200}
                onShowEma200Change={setShowEma200}
                showBollingerBands={showBollingerBands}
                onShowBollingerBandsChange={setShowBollingerBands}
                showVolume={showVolume}
                onShowVolumeChange={setShowVolume}
                showRsi={showRsi}
                onShowRsiChange={setShowRsi}
                showZones={showZones}
                onShowZonesChange={setShowZones}
                showGrid={showGrid}
                onShowGridChange={setShowGrid}
                disabled={chartLoading || candles.length === 0}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleShare}
                disabled={isSharing || chartLoading || candles.length === 0}
                title={t("dialog.share")}
                aria-label={t("dialog.share")}
                className="size-11 cursor-pointer sm:size-7"
              >
                {isSharing ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Share2 data-icon="inline-start" />
                )}
              </Button>
            </div>
          </div>

          {chartLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("dialog.loading")}
            </div>
          ) : chartError && candles.length === 0 ? (
            <Empty role="alert" className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertCircle aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
                <EmptyDescription>
                  {t("common.load_error_description")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (retryChart) void retryChart();
                  }}
                  disabled={chartFetching || !retryChart}
                  aria-busy={chartFetching}
                >
                  {t("common.retry")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : candles.length > 0 ? (
            <TradeSetupChart
              candles={candles}
              plan={tradingPlan}
              signal={signal}
              assetType={trade.assetType}
              currentPrice={displayPrice}
              markers={markers}
              showEma20={showEma20}
              showEma50={showEma50}
              showEma200={showEma200}
              showBollingerBands={showBollingerBands}
              showVolume={showVolume}
              showRsi={showRsi}
              showZones={showZones}
              showGrid={showGrid}
            />
          ) : (
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("dialog.not_enough_data")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </DialogContent>
  );
}
