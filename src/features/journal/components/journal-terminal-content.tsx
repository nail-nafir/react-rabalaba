import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { FollowHistoryTable } from "@/features/follow-trade/components/follow-history-table";
import {
  TradeDetailDialog,
  type TradeDetailDialogState,
} from "@/features/follow-trade/components/trade-detail-dialog";
import { JournalDashboard } from "@/features/journal/components/journal-dashboard";
import { TopPerformers } from "@/features/journal/components/top-performers";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";

export interface JournalTerminalContentProps {
  requestedTradeId: string | null;
  detailOpen: boolean;
  onTradeSelect: (tradeId: string, trigger: HTMLElement) => void;
  onDetailOpenChange: (open: boolean) => void;
  onDetailCloseAutoFocus?: (open: boolean) => void;
}

/**
 * Single owner for the premium journal query and detail dialog. The requested
 * UUID is resolved only against rows returned by Supabase, so RLS remains the
 * authoritative boundary and a deep link never triggers a second lookup.
 */
export function JournalTerminalContent({
  requestedTradeId,
  detailOpen,
  onTradeSelect,
  onDetailOpenChange,
  onDetailCloseAutoFocus,
}: JournalTerminalContentProps) {
  const {
    trades,
    openTrades,
    history,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useJournalTrades();

  const requestedTrade = useMemo(
    () =>
      requestedTradeId
        ? (trades.find((trade) => trade.id === requestedTradeId) ?? null)
        : null,
    [requestedTradeId, trades],
  );

  const detailState: TradeDetailDialogState = requestedTrade
    ? "ready"
    : isLoading || (requestedTradeId !== null && isFetching)
      ? "loading"
      : isError
        ? "error"
        : "unavailable";

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <JournalDashboard
          history={history}
          openTrades={openTrades}
          isLoading={isLoading}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <TopPerformers
          history={history}
          isLoading={isLoading}
          onTradeSelect={onTradeSelect}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <FollowHistoryTable
          openTrades={openTrades}
          history={history}
          isLoading={isLoading}
          isFetching={isFetching}
          onRefresh={() => {
            void refetch();
          }}
          onTradeSelect={onTradeSelect}
        />
      </section>

      <TradeDetailDialog
        trade={requestedTrade}
        open={detailOpen}
        state={detailState}
        onOpenChange={onDetailOpenChange}
        onRetry={() => {
          void refetch();
        }}
        onCloseAutoFocus={onDetailCloseAutoFocus}
      />
    </div>
  );
}
