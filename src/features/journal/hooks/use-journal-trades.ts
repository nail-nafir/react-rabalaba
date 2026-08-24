import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import { rowToFollowedTrade } from "@/core/trade/journal-mapper";
import type { JournalTradeRow } from "@/services/supabase/database.types";
import type { FollowedTrade } from "@/core/trade/follow-trade-model";
import type {
  JournalPeriodBounds,
  JournalScope,
} from "@/features/journal/model/journal-period";
import { collectPaginatedRows } from "@/features/journal/model/paginated-rows";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { useAuth } from "@/features/auth/hooks/use-auth";

const EMPTY_TRADES: FollowedTrade[] = [];

interface JournalTradesResult {
  trades: FollowedTrade[];
  openTrades: FollowedTrade[];
  history: FollowedTrade[];
}

export interface UseJournalTradesOptions {
  /** Terminal defaults active; legacy/admin consumers can request full history. */
  scope?: JournalScope;
  periodBounds?: JournalPeriodBounds | null;
  /** Lets the terminal wait for period config before issuing any trade query. */
  enabled?: boolean;
}

async function fetchOpenRows() {
  return collectPaginatedRows<JournalTradeRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("journal_trades")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as JournalTradeRow[];
  });
}

async function fetchClosedRows(bounds: JournalPeriodBounds | null) {
  return collectPaginatedRows<JournalTradeRow>(async (from, to) => {
    let query = supabase
      .from("journal_trades")
      .select("*")
      .neq("status", "open");

    if (bounds?.startMs != null) {
      query = query.gte("closed_at", new Date(bounds.startMs).toISOString());
    }
    if (bounds?.endMs != null) {
      query = query.lt("closed_at", new Date(bounds.endMs).toISOString());
    }

    const { data, error } = await query
      .order("closed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as JournalTradeRow[];
  });
}

/**
 * Reads open trades plus realized history in independent, range-paginated
 * queries. This avoids PostgREST's 1,000-row response cap while keeping the
 * default active-period load bounded. Open positions are deliberately unscoped
 * so they carry across every reporting rollover.
 */
async function fetchJournalTrades(
  scope: JournalScope,
  periodBounds: JournalPeriodBounds | null,
): Promise<JournalTradesResult> {
  const closedBounds = scope === "active" ? periodBounds : null;
  const [openRows, closedRows] = await Promise.all([
    fetchOpenRows(),
    fetchClosedRows(closedBounds),
  ]);
  const openTrades = openRows.map(rowToFollowedTrade);
  const history = closedRows.map(rowToFollowedTrade);
  return {
    trades: [...openTrades, ...history],
    openTrades,
    history,
  };
}

export function useJournalTrades({
  scope = "history",
  periodBounds = null,
  enabled = true,
}: UseJournalTradesOptions = {}) {
  // The journal is premium-gated server-side (RLS → is_premium()); non-entitled
  // users get zero rows. Skip the query and polling entirely for them.
  const { hasAccess } = usePremiumAccess();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const canReadJournal = hasAccess && userId !== null && enabled;
  const query = useQuery({
    // Include identity + resolved window so a rollover cannot reuse stale rows.
    queryKey: [
      "journal-trades",
      userId,
      scope,
      periodBounds?.startMs ?? null,
      periodBounds?.endMs ?? null,
    ],
    queryFn: () => fetchJournalTrades(scope, periodBounds),
    enabled: canReadJournal,
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  // Never expose a previous identity's cached RLS result after logout, expiry,
  // downgrade, or while the period config is unresolved.
  const result = canReadJournal ? query.data : undefined;
  return {
    trades: result?.trades ?? EMPTY_TRADES,
    openTrades: result?.openTrades ?? EMPTY_TRADES,
    history: result?.history ?? EMPTY_TRADES,
    isLoading: canReadJournal && query.isLoading,
    isFetching: canReadJournal && query.isFetching,
    isError: canReadJournal && query.isError,
    isSuccess: canReadJournal && query.isSuccess,
    error: query.error,
    refetch: query.refetch,
  };
}
