import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
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
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import { useJournalPeriod } from "@/features/journal/hooks/use-journal-period";
import { SIGNAL_EPISODE_STATES_QUERY_KEY } from "@/features/market/hooks/use-signal-episode-states";

/**
 * Single owner for the premium journal query and detail dialog. The requested
 * UUID is resolved only against rows returned by Supabase, so RLS remains the
 * authoritative boundary and a deep link never triggers a second lookup.
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

  if (period.isError && period.bounds === null) {
    return (
      <Card size="sm">
        <Empty role="alert" className="min-h-48 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RefreshCw aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("journal.period_load_error_title")}</EmptyTitle>
            <EmptyDescription>
              {t("journal.period_load_error_desc")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void period.refetch()}
              disabled={period.isFetching}
              aria-busy={period.isFetching}
            >
              <RefreshCw data-icon="inline-start" />
              {t("common.retry")}
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    );
  }

  if (tradesError && openTrades.length === 0 && history.length === 0) {
    return (
      <Card size="sm">
        <Empty role="alert" className="min-h-48 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RefreshCw aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("common.load_error_title")}</EmptyTitle>
            <EmptyDescription>
              {t("common.load_error_description")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-busy={isFetching}
            >
              <RefreshCw data-icon="inline-start" />
              {t("common.retry")}
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    );
  }

  const contentLoading = period.isLoading || isLoading;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <JournalDashboard
          history={history}
          openTrades={openTrades}
          isLoading={contentLoading}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <TopPerformers history={history} isLoading={contentLoading} />
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
    </div>
  );
}
