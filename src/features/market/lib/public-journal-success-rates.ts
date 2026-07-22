import type { PublicJournalSuccessRateRow } from "@/services/supabase/database.types";

export interface SymbolSuccessRate {
  wins: number;
  total: number;
}

export const PUBLIC_JOURNAL_SUCCESS_RATES_QUERY_KEY = [
  "public-journal-success-rates",
] as const;

/** Index the compact RPC response once so every table-cell lookup stays O(1). */
export function indexPublicJournalSuccessRates(
  rows: PublicJournalSuccessRateRow[],
): Record<string, SymbolSuccessRate> {
  const bySymbol: Record<string, SymbolSuccessRate> = {};

  for (const row of rows) {
    bySymbol[row.symbol] = {
      wins: Number(row.wins),
      total: Number(row.total),
    };
  }

  return bySymbol;
}
