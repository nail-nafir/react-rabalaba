import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { FollowHistoryTable } from "@/features/follow-trade/components/follow-history-table";
import { JournalDashboard } from "@/features/journal/components/journal-dashboard";
import { TopPerformers } from "@/features/journal/components/top-performers";
import {
  useJournalTrade,
  useJournalTrades,
} from "@/features/journal/hooks/use-journal-trades";
import { useJournalPeriod } from "@/features/journal/hooks/use-journal-period";
import { TradeDetailDialog } from "@/features/follow-trade/components/trade-detail-dialog";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { SIGNAL_EPISODE_STATES_QUERY_KEY } from "@/features/market/hooks/use-signal-episode-states";

/**
 * Single owner for the premium journal query and detail dialog. One trade
 * dialog serves table rows, top performers, the market tab's journal chips and
 * shared `?trade=<id>` links; it only opens rows Supabase returned, so RLS
 * stays the boundary and a deep link never widens access.
 */
export function JournalTerminalContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const period = useJournalPeriod();
  const {
    openTrades,
    history,
    isLoading,
    isFetching,
    isError: tradesError,
    refetch,
  } = useJournalTrades({
    scope: "active",
    periodBounds: period.bounds,
    enabled: period.bounds !== null,
  });

  const periodFailed = period.isError && period.bounds === null;
  const tradesFailed =
    tradesError && openTrades.length === 0 && history.length === 0;
  const retrying = periodFailed ? period.isFetching : isFetching;
  const contentLoading = period.isLoading || isLoading;

  const { value: tradeId, close: closeTrade } = useDialogParam("trade");
  const allTrades = useMemo(
    () => [...openTrades, ...history],
    [openTrades, history],
  );
  const loadedTrade = tradeId
    ? allTrades.find((trade) => trade.id === tradeId)
    : undefined;
  // A link can point past the loaded period: look that one row up once the
  // lists are in.
  const lookup = useJournalTrade(
    tradeId && !loadedTrade && !contentLoading ? tradeId : null,
  );
  const linkedTrade = loadedTrade ?? lookup.data ?? undefined;
  // Keep the last trade on screen while the dialog plays its exit animation.
  const [shownTrade, setShownTrade] = useState(linkedTrade);
  if (linkedTrade && linkedTrade !== shownTrade) setShownTrade(linkedTrade);
  const linkMissing =
    tradeId !== null &&
    !loadedTrade &&
    (lookup.data === null || lookup.isError);
  useEffect(() => {
    if (!linkMissing) return;
    // Explain instead of failing silently: bad id, outside RLS, or removed.
    // The id keeps a re-run before the URL updates from stacking a second toast.
    toast(t("journal.link_not_found"), { id: "journal-link-not-found" });
    closeTrade();
  }, [linkMissing, closeTrade, t]);

  return (
    <div className="flex flex-col gap-8">
      {periodFailed || tradesFailed ? (
        <Card size="sm">
          <Empty role="alert">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircle aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>
                {t(
                  periodFailed
                    ? "journal.period_load_error_title"
                    : "common.load_error_title",
                )}
              </EmptyTitle>
              <EmptyDescription>
                {t(
                  periodFailed
                    ? "journal.period_load_error_desc"
                    : "common.load_error_description",
                )}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                size="lg"
                onClick={() => void (periodFailed ? period.refetch() : refetch())}
                disabled={retrying}
                aria-busy={retrying}
              >
                <RefreshCw data-icon="inline-start" />
                {t("common.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <JournalDashboard
              history={history}
              openTrades={openTrades}
              periodStartMs={period.bounds?.startMs ?? null}
              isLoading={contentLoading}
            />
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <TopPerformers
              history={history}
              periodStartMs={period.bounds?.startMs ?? null}
              isLoading={contentLoading}
            />
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <FollowHistoryTable
              openTrades={openTrades}
              history={history}
              isLoading={contentLoading}
              isFetching={isFetching}
              onRefresh={() => {
                void refetch();
                void queryClient.invalidateQueries({
                  queryKey: SIGNAL_EPISODE_STATES_QUERY_KEY,
                });
              }}
            />
          </section>
        </>
      )}

      <TradeDetailDialog
        trade={shownTrade}
        siblings={allTrades}
        open={linkedTrade !== undefined}
        onOpenChange={(open) => {
          if (!open) closeTrade();
        }}
      />
    </div>
  );
}
