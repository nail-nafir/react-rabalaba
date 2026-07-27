import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FollowHistoryTable } from "@/features/follow-trade/components/follow-history-table";
import { JournalDashboard } from "@/features/journal/components/journal-dashboard";
import { TopPerformers } from "@/features/journal/components/top-performers";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";
import { useJournalPeriod } from "@/features/journal/hooks/use-journal-period";

/**
 * Single owner for the premium journal query and detail dialog. The requested
 * UUID is resolved only against rows returned by Supabase, so RLS remains the
 * authoritative boundary and a deep link never triggers a second lookup.
 */
export function JournalTerminalContent() {
  const { t } = useTranslation();
  const period = useJournalPeriod();
  const { openTrades, history, isLoading, isFetching, refetch } =
    useJournalTrades({
      scope: "active",
      periodBounds: period.bounds,
      enabled: period.isSuccess,
    });

  if (period.isError) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{t("journal.period_load_error_title")}</CardTitle>
          <CardDescription>
            {t("journal.period_load_error_desc")}
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              onClick={() => void period.refetch()}
            >
              <RefreshCw data-icon="inline-start" />
              {t("common.retry")}
            </Button>
          </CardAction>
        </CardHeader>
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
          }}
        />
      </section>
    </div>
  );
}
