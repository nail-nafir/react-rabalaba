/**
 * Premium screener universe, sourced from the admin-managed `journal_assets`
 * table — the SAME data-driven universe the auto-journal cron uses — so adding or
 * removing a ticker in /admin updates the premium screener with NO rebuild.
 *
 * Scope: crypto + US/ID stocks only. Commodity & forex stay on the fixed
 * DEFAULT_COMMODITY/FOREX constants everywhere (screener + cron), so they are not
 * read here. Free (anonymous) users never query; a not-yet-applied
 * `journal_assets_premium_read` RLS policy or any read failure degrade to
 * DEFAULT_* (see grouping in features/market/model/screener-universe). The admin
 * WRITE side lives in [[use-journal-assets]].
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  groupUniverse,
  FALLBACK_UNIVERSE,
  type ScreenerUniverse,
  type UniverseRow,
} from "@/features/market/model/screener-universe";

export function useScreenerUniverse(): ScreenerUniverse & {
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const { hasAccess } = usePremiumAccess();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["screener-universe", userId],
    enabled: hasAccess,
    staleTime: 60_000,
    queryFn: async (): Promise<UniverseRow[]> => {
      const { data, error } = await supabase
        .from("journal_assets")
        .select("symbol, asset_type, active")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as UniverseRow[];
    },
  });

  // Free users don't query → DEFAULT_*. Premium: group DB rows, using defaults
  // only while loading. A read error is explicit and does not silently scan a
  // different universe.
  // `data` so the ticker arrays keep a STABLE identity across renders — the
  // screener feeds them straight into useMarketData, which is sensitive to
  // unstable references (see the render-loop guard in asset-signal-table).
  const grouped = useMemo(() => {
    if (!hasAccess) return FALLBACK_UNIVERSE;
    if (isError && data === undefined)
      return { crypto: [], usStock: [], idStock: [] };
    return data === undefined ? FALLBACK_UNIVERSE : groupUniverse(data);
  }, [hasAccess, data, isError]);

  return {
    crypto: grouped.crypto,
    usStock: grouped.usStock,
    idStock: grouped.idStock,
    isLoading: hasAccess && isLoading,
    isError: hasAccess && isError,
    refetch,
  };
}
