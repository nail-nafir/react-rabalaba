/**
 * Per-user favorites (watchlist), now SERVER-TRUTH in `user_favorites` instead
 * of browser localStorage — so a favorite follows the account across browsers
 * and devices. Replaces the old [[favorite-store]] zustand+persist store.
 *
 * Favorites are a premium feature in the UI (the screener gates the add/show
 * buttons behind premium, which requires login), so writers are always an
 * authenticated user. Logged-out callers read an empty list and mutations are
 * no-ops — the login gate lives both in the UI and in RLS. See [[use-auth]].
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { UserFavoriteRow } from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";

const clean = (symbol: string) => symbol.trim().toUpperCase();

// Stable empty reference for the logged-out / not-yet-loaded case. `data ?? []`
// would mint a fresh array every render, and `favoriteSymbols` feeds memo deps
// (filteredData, displayFavCount) + useMarketData(favoriteSymbols) — an unstable
// identity there churns the screener every render and, under a burst of
// re-renders (e.g. opening/closing the license dialog), spirals react-query's
// structural sharing into a page-unresponsive render loop. See [[use-smart-money]].
const EMPTY_SYMBOLS: string[] = [];

export function useFavorites() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["favorites", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_favorites")
        .select("symbol")
        .eq("user_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Hand-written Database type doesn't resolve select() shapes; assert it.
      return (data as Pick<UserFavoriteRow, "symbol">[]).map((r) => r.symbol);
    },
  });

  const favoriteSymbols = data ?? EMPTY_SYMBOLS;

  // Bulk insert; returns the symbols actually added (skips blanks + dupes).
  const addSymbols = useCallback(
    async (symbols: string[]): Promise<string[]> => {
      if (!userId) return [];
      const existing = new Set(
        queryClient.getQueryData<string[]>(["favorites", userId]) ?? [],
      );
      const toAdd = [...new Set(symbols.map(clean))].filter(
        (s) => s && !existing.has(s),
      );
      if (toAdd.length === 0) return [];
      const rows = toAdd.map((symbol) => ({ user_id: userId, symbol }));
      // Hand-written Database type mis-resolves insert() args to never; cast.
      const { error } = await supabase
        .from("user_favorites")
        .insert(rows as never);
      // 23505 = a concurrent tab already inserted it → non-fatal.
      if (error && error.code !== "23505") throw error;
      await queryClient.invalidateQueries({ queryKey: ["favorites", userId] });
      return toAdd;
    },
    [userId, queryClient],
  );

  const addSymbol = useCallback(
    async (symbol: string): Promise<boolean> => {
      const added = await addSymbols([symbol]);
      return added.length > 0;
    },
    [addSymbols],
  );

  const removeSymbol = useCallback(
    async (symbol: string) => {
      if (!userId) return;
      const sym = clean(symbol);
      // Optimistic: drop locally first so list updates instantly (and the
      // screener's failed-load auto-remove loop doesn't refetch per symbol).
      queryClient.setQueryData<string[]>(["favorites", userId], (prev) =>
        (prev ?? []).filter((s) => s !== sym),
      );
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("symbol", sym);
      if (error) {
        // Roll back to server truth on failure.
        await queryClient.invalidateQueries({ queryKey: ["favorites", userId] });
      }
    },
    [userId, queryClient],
  );

  return { favoriteSymbols, isLoading, addSymbol, addSymbols, removeSymbol };
}
