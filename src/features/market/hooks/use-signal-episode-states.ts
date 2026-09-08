import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { signalEpisodeKey } from "@/core/automation/signal-episode";
import { supabase } from "@/services/supabase/client";
import type { JournalSignalStateRow } from "@/types/journal";

export const SIGNAL_EPISODE_STATES_QUERY_KEY = ["signal-episode-states"];

export function useSignalEpisodeStates() {
  const query = useQuery({
    queryKey: SIGNAL_EPISODE_STATES_QUERY_KEY,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_signal_states")
        .select("*");
      if (error) throw error;
      return (data ?? []) as JournalSignalStateRow[];
    },
  });
  const byKey = useMemo(
    () =>
      new Map(
        (query.data ?? []).map((state) => [
          signalEpisodeKey(state.symbol, state.timeframe),
          state,
        ]),
      ),
    [query.data],
  );
  return { ...query, byKey };
}
