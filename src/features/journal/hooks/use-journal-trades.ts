import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import { rowToFollowedTrade } from "@/services/supabase/journal-mapper";
import type { FollowedTrade } from "@/features/follow-trade/lib/follow-trade-model";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useAuth } from "@/hooks/use-auth";

const EMPTY_TRADES: FollowedTrade[] = [];

/**
 * Reads the GLOBAL auto-journal from Supabase (the cron is the only writer; the
 * browser uses the RLS-bound publishable key = read-only). Replaces the old
 * localStorage follow-store: trades now appear/close autonomously, so this is a
 * plain query — no client mutations. Split into open ("RUNNING") vs closed
 * history; the existing pure buildTrackerStats/computePnl consume these as-is.
 */
async function fetchJournalTrades(): Promise<FollowedTrade[]> {
  const { data, error } = await supabase
    .from("journal_trades")
    .select("*")
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToFollowedTrade);
}

export function useJournalTrades() {
  // The journal is premium-gated server-side (RLS → is_premium()); non-entitled
  // users get zero rows. Skip the query and polling entirely for them.
  const { hasAccess } = usePremiumAccess();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    // Scope cached RLS results per authenticated identity. This prevents a
    // subsequent account in the same browser session from ever seeing stale
    // rows that were fetched under the previous user's JWT.
    queryKey: ["journal-trades", userId],
    queryFn: fetchJournalTrades,
    enabled: hasAccess && userId !== null,
    staleTime: 300_000,
    // Surface cron updates (new emits / closes) without a manual refresh. The
    // cron itself only runs ~every 30 min, so a 5-min poll is plenty — a tighter
    // interval just churned the table (felt like a refresh on every paginate)
    // without ever seeing newer data.
    refetchInterval: 300_000,
  });

  // Identity-stable derivations: new arrays only when the query data changes,
  // NOT every render — otherwise consumers (open-positions symbols memo,
  // history-table data, the recharts trade-detail dialog) thrash and recharts
  // cascades into a max-update-depth hang. See [[recharts-identity-stable-props]].
  // A disabled query can still retain data fetched earlier for this identity.
  // Never expose that cache after logout, expiry, downgrade, or a block: the
  // current entitlement must authorize both network access and cache reads.
  const canReadJournal = hasAccess && userId !== null;
  const trades = canReadJournal ? (query.data ?? EMPTY_TRADES) : EMPTY_TRADES;
  const openTrades = useMemo(
    () => trades.filter((trade) => trade.status === "open"),
    [trades],
  );
  const history = useMemo(
    () => trades.filter((trade) => trade.status !== "open"),
    [trades],
  );
  return {
    trades,
    openTrades,
    history,
    isLoading: canReadJournal && query.isLoading,
    isFetching: canReadJournal && query.isFetching,
    isError: canReadJournal && query.isError,
    isSuccess: canReadJournal && query.isSuccess,
    error: query.error,
    refetch: query.refetch,
  };
}
