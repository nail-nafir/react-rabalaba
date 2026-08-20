/**
 * Admin-only config for the AUTO-JOURNAL SCHEDULE (interval / pause / market
 * hours), server-truth in the singleton `journal_settings` row. The cron ticks
 * at a fixed base cadence and reads this row each tick to decide whether to run
 * — so changing the cadence or pausing is pure data: NO cron edit, NO redeploy.
 * RLS gates writes to admins; the cron uses the service-role key. See
 * [[journal-universe-data-driven]], [[use-journal-assets]].
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { JournalSettingsRow } from "@/services/supabase/database.types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";

const QUERY_KEY = ["journal-settings"] as const;

/** The admin-editable subset (id/last_run_at/updated_* are server-managed). */
export type JournalSettingsPatch = Partial<
  Pick<
    JournalSettingsRow,
    | "enabled"
    | "interval_minutes"
    | "market_hours_only"
    | "daily_summary_enabled"
    | "daily_summary_hour"
    | "weekly_summary_enabled"
    | "monthly_summary_enabled"
    | "journal_period_months"
    | "discovery_enabled"
    | "discovery_max_per_market"
    | "discovery_prune_days"
  >
>;

export function useJournalSettings() {
  const { user } = useAuth();
  const { isAdmin } = usePremiumAccess();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      // Hand-written Database type doesn't resolve select() shapes; assert it.
      return data as JournalSettingsRow | null;
    },
  });

  const update = useCallback(
    async (patch: JournalSettingsPatch) => {
      if (!userId) throw new Error("Authentication required");
      const previous = queryClient.getQueryData<JournalSettingsRow | null>(
        QUERY_KEY,
      );
      // Optimistic so the switch/select responds instantly.
      queryClient.setQueryData<JournalSettingsRow | null>(QUERY_KEY, (prev) =>
        prev ? { ...prev, ...patch } : prev,
      );
      const { data, error } = await supabase
        .from("journal_settings")
        .update({
          ...patch,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", true)
        .select("id")
        .maybeSingle();
      if (error) {
        queryClient.setQueryData(QUERY_KEY, previous);
        throw error;
      }
      if (!data) {
        queryClient.setQueryData(QUERY_KEY, previous);
        throw new Error("Journal settings update was not applied");
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if ("journal_period_months" in patch) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["journal-period-config"],
          }),
          queryClient.invalidateQueries({ queryKey: ["journal-trades"] }),
        ]);
      }
    },
    [userId, queryClient],
  );

  const startNewPeriod = useCallback(async () => {
    if (!userId) throw new Error("Authentication required");
    const { data, error } = await supabase.rpc(
      "admin_start_new_journal_period",
    );
    if (error) throw error;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["journal-period-config"] }),
      queryClient.invalidateQueries({ queryKey: ["journal-trades"] }),
    ]);
    return data;
  }, [userId, queryClient]);

  return { settings, isLoading, update, startNewPeriod };
}
