import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import { rowToFollowedTrade } from "@/services/supabase/journal-mapper";
import type { FollowedTrade } from "@/features/follow-trade/lib/follow-trade-model";
import { usePremiumAccess } from "@/hooks/use-premium-access";

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
  // users get zero rows. Skip the query (and its 60s poll) entirely for them.
  const { hasAccess } = usePremiumAccess();
  const query = useQuery({
    queryKey: ["journal-trades"],
    queryFn: fetchJournalTrades,
    enabled: hasAccess,
    staleTime: 60_000,
    // Surface cron updates (new emits / closes) without a manual refresh.
    refetchInterval: 60_000,
  });

  // Identity-stable derivations: new arrays only when the query data changes,
  // NOT every render — otherwise consumers (open-positions symbols memo,
  // history-table data, the recharts trade-detail dialog) thrash and recharts
  // cascades into a max-update-depth hang. See [[recharts-identity-stable-props]].
  const data = query.data;
  const openTrades = useMemo(
    () => (data ?? []).filter((t) => t.status === "open"),
    [data],
  );
  const history = useMemo(
    () => (data ?? []).filter((t) => t.status !== "open"),
    [data],
  );
  return {
    openTrades,
    history,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
