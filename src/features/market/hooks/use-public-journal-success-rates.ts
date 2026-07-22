import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { PublicJournalSuccessRateRow } from "@/services/supabase/database.types";
import {
  indexPublicJournalSuccessRates,
  PUBLIC_JOURNAL_SUCCESS_RATES_QUERY_KEY,
} from "@/features/market/lib/public-journal-success-rates";

const EMPTY_ROWS: PublicJournalSuccessRateRow[] = [];
const REFRESH_INTERVAL_MS = 300_000;

async function fetchPublicJournalSuccessRates() {
  const { data, error } = await supabase.rpc(
    "get_public_journal_success_rates",
  );
  if (error) throw error;
  return data ?? EMPTY_ROWS;
}

/**
 * Public aggregate used by the screener for every entitlement tier. The raw
 * journal remains premium-only; this query only returns symbol/wins/total.
 */
export function usePublicJournalSuccessRates() {
  const query = useQuery({
    queryKey: PUBLIC_JOURNAL_SUCCESS_RATES_QUERY_KEY,
    queryFn: fetchPublicJournalSuccessRates,
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const bySymbol = useMemo(
    () => indexPublicJournalSuccessRates(query.data ?? EMPTY_ROWS),
    [query.data],
  );

  return { ...query, bySymbol };
}
