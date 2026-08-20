import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { supabase } from "@/services/supabase/client";
import type { JournalPeriodConfigRow } from "@/services/supabase/database.types";
import { resolveJournalPeriod } from "@/features/journal/model/journal-period";

export const JOURNAL_PERIOD_QUERY_KEY = "journal-period-config";
const MAX_TIMER_CHUNK_MS = 24 * 60 * 60 * 1_000;

interface PeriodQueryValue {
  config: JournalPeriodConfigRow;
  serverNowMs: number;
  fetchedAtClientMs: number;
}

export function useJournalPeriod() {
  const { user } = useAuth();
  const { hasAccess } = usePremiumAccess();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [JOURNAL_PERIOD_QUERY_KEY, userId],
    enabled: hasAccess && userId !== null,
    staleTime: 300_000,
    refetchInterval: 300_000,
    queryFn: async (): Promise<PeriodQueryValue> => {
      const fetchedAtClientMs = Date.now();
      const { data, error } = await supabase
        .rpc("get_journal_period_config")
        .single();
      if (error) throw error;
      const config = data as JournalPeriodConfigRow;
      const serverNowMs = Date.parse(config.server_now);
      if (!Number.isFinite(serverNowMs)) {
        throw new Error("Invalid database clock in journal period config");
      }
      return { config, serverNowMs, fetchedAtClientMs };
    },
  });
  const refetch = query.refetch;

  const bounds = useMemo(() => {
    if (!query.data) return null;
    return resolveJournalPeriod(
      query.data.config.journal_period_months ?? 1,
      query.data.config.journal_period_reset_at,
      query.data.serverNowMs,
    );
  }, [query.data]);

  // Re-resolve automatically at a WIB calendar boundary. Month-long delays can
  // exceed the browser's safe setTimeout range, so wake at least once per day.
  useEffect(() => {
    if (!query.data || bounds?.nextRolloverMs == null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const serverOffsetMs =
      query.data.serverNowMs - query.data.fetchedAtClientMs;

    const schedule = () => {
      const serverNowMs = Date.now() + serverOffsetMs;
      const remaining = bounds.nextRolloverMs! - serverNowMs;
      const delay = Math.min(
        MAX_TIMER_CHUNK_MS,
        Math.max(500, remaining + 250),
      );

      timer = setTimeout(() => {
        if (cancelled) return;
        const currentServerMs = Date.now() + serverOffsetMs;
        if (currentServerMs >= bounds.nextRolloverMs!) {
          void refetch().then(() =>
            queryClient.invalidateQueries({ queryKey: ["journal-trades"] }),
          );
          return;
        }
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [bounds?.nextRolloverMs, query.data, refetch, queryClient]);

  return {
    config: query.data?.config ?? null,
    bounds,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch,
  };
}
