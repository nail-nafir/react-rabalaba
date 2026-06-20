/**
 * Admin-only management of the AUTO-JOURNAL universe (the symbols the cron
 * journals). Server-truth in `journal_assets`, replacing the bundled
 * EDGE_UNIVERSE: adding/removing a row changes what the cron fetches on its next
 * run — NO rebuild, NO redeploy. See [[auto-journal-supabase]], [[use-favorites]].
 *
 * RLS gates every read/write to admins (profiles.is_admin); the cron itself uses
 * the service-role key and bypasses RLS. This hook is meant for the /admin page,
 * which is already guarded by `isAdmin` from [[use-premium-access]].
 *
 * NOTE: this is the JOURNAL (auto-signal) universe only. The screener's universe
 * stays in src/constants/assets.ts (free DEFAULT vs premium TOP) — untouched.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type {
  JournalAssetRow,
  JournalAssetInsert,
} from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { fetchYahooChart } from "@/services/api/yahoo-finance";
import { adaptYahooChart } from "@/services/adapters/yahoo-adapter";

const QUERY_KEY = ["journal-assets"] as const;
const EMPTY: JournalAssetRow[] = [];
const clean = (symbol: string) => symbol.trim().toUpperCase();

/** "added" — new row written. "duplicate" — symbol already tracked. "invalid" —
 *  Yahoo returned no data (typo / delisted), OR it's a commodity/forex symbol
 *  (those are constant-driven, not part of the DB-managed universe). */
export type AddAssetResult = "added" | "duplicate" | "invalid";

export function useJournalAssets() {
  const { user } = useAuth();
  const { isAdmin } = usePremiumAccess();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_assets")
        .select("*")
        .order("asset_type", { ascending: true })
        .order("symbol", { ascending: true });
      if (error) throw error;
      // Hand-written Database type doesn't resolve select() shapes; assert it.
      return data as JournalAssetRow[];
    },
  });

  const assets = data ?? EMPTY;

  const addAsset = useCallback(
    async (rawSymbol: string): Promise<AddAssetResult> => {
      if (!userId) return "invalid";
      const symbol = clean(rawSymbol);
      if (!symbol) return "invalid";

      // Dedup against the loaded list first (cheap, avoids a wasted Yahoo fetch).
      const existing =
        queryClient.getQueryData<JournalAssetRow[]>(QUERY_KEY) ?? [];
      if (existing.some((a) => a.symbol.toUpperCase() === symbol)) {
        return "duplicate";
      }

      // Validate it resolves on Yahoo + derive name/asset_type, reusing the SAME
      // fetch+adapt path the cron/screener use — a typo'd symbol can't slip in as
      // a silent no-op (the cron would just fail to fetch it forever).
      const asset = await fetchYahooChart(symbol, "1mo", "1h")
        .then((chart) => adaptYahooChart(chart))
        .catch(() => null);
      if (!asset) return "invalid";
      // Commodity & forex are constant-driven (not the DB universe) — keep them
      // out of journal_assets so the screener and cron stay consistent.
      if (asset.assetType === "commodity" || asset.assetType === "forex") {
        return "invalid";
      }

      const row: JournalAssetInsert = {
        symbol,
        name: asset.name,
        asset_type: asset.assetType,
        sort_order: null,
        created_by: userId,
      };
      // Hand-written Database type mis-resolves insert() args to never; cast.
      const { error } = await supabase
        .from("journal_assets")
        .insert(row as never);
      // 23505 = a concurrent add already inserted it → treat as duplicate.
      if (error) {
        if (error.code === "23505") return "duplicate";
        throw error;
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return "added";
    },
    [userId, queryClient],
  );

  const toggleActive = useCallback(
    async (symbol: string, active: boolean) => {
      if (!userId) return;
      // Optimistic: flip locally so the toggle responds instantly.
      queryClient.setQueryData<JournalAssetRow[]>(QUERY_KEY, (prev) =>
        (prev ?? []).map((a) => (a.symbol === symbol ? { ...a, active } : a)),
      );
      const { error } = await supabase
        .from("journal_assets")
        .update({ active } as never)
        .eq("symbol", symbol);
      if (error) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
    },
    [userId, queryClient],
  );

  const removeAsset = useCallback(
    async (symbol: string) => {
      if (!userId) return;
      // Optimistic: drop locally first.
      queryClient.setQueryData<JournalAssetRow[]>(QUERY_KEY, (prev) =>
        (prev ?? []).filter((a) => a.symbol !== symbol),
      );
      const { error } = await supabase
        .from("journal_assets")
        .delete()
        .eq("symbol", symbol);
      if (error) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      }
    },
    [userId, queryClient],
  );

  return { assets, isLoading, addAsset, toggleActive, removeAsset };
}
