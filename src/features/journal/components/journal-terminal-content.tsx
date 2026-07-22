import { Separator } from "@/components/ui/separator";
import { FollowHistoryTable } from "@/features/follow-trade/components/follow-history-table";
import { JournalDashboard } from "@/features/journal/components/journal-dashboard";
import { TopPerformers } from "@/features/journal/components/top-performers";
import { useJournalTrades } from "@/features/journal/hooks/use-journal-trades";

/**
 * Single owner for the premium journal query and detail dialog. The requested
 * UUID is resolved only against rows returned by Supabase, so RLS remains the
 * authoritative boundary and a deep link never triggers a second lookup.
 */
export function JournalTerminalContent() {
  const {
    openTrades,
    history,
    isLoading,
    isFetching,
    refetch,
  } = useJournalTrades();

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
        />
      </section>
    </div>
  );
}
