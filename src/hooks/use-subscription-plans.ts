/**
 * Subscription plan cards, server-truth in `subscription_plans` — replaces the
 * hardcoded i18n `subscription.plans.*`. The read is PUBLIC (the /subscription
 * page is anonymous), so the query is always enabled; admin mutations are gated
 * by RLS (is_admin()). Bilingual copy is read via [[pickLocale]]. Same
 * react-query shape as [[use-journal-assets]].
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type {
  SubscriptionPlanRow,
  SubscriptionPlanInsert,
} from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";

const QUERY_KEY = ["subscription-plans"] as const;
const EMPTY: SubscriptionPlanRow[] = [];

export function useSubscriptionPlans() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      // Hand-written Database type doesn't resolve select() shapes; assert it.
      return data as SubscriptionPlanRow[];
    },
  });

  // All plans (incl. inactive) — the public page filters `active`, admin sees all.
  const plans = data ?? EMPTY;

  const addPlan = useCallback(
    async (row: SubscriptionPlanInsert): Promise<"added" | "duplicate" | "invalid"> => {
      if (!userId) return "invalid";
      const { error } = await supabase
        .from("subscription_plans")
        .insert({ ...row, updated_by: userId } as never);
      if (error) {
        if (error.code === "23505") return "duplicate";
        return "invalid";
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return "added";
    },
    [userId, queryClient],
  );

  const updatePlan = useCallback(
    async (slug: string, patch: Partial<SubscriptionPlanRow>): Promise<boolean> => {
      if (!userId) return false;
      const { error } = await supabase
        .from("subscription_plans")
        .update({ ...patch, updated_by: userId, updated_at: new Date().toISOString() } as never)
        .eq("slug", slug);
      if (error) return false;
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return true;
    },
    [userId, queryClient],
  );

  const toggleActive = useCallback(
    async (slug: string, active: boolean): Promise<boolean> => {
      if (!userId) return false;
      // Optimistic: flip locally so the toggle responds instantly.
      queryClient.setQueryData<SubscriptionPlanRow[]>(QUERY_KEY, (prev) =>
        (prev ?? []).map((p) => (p.slug === slug ? { ...p, active } : p)),
      );
      const { error } = await supabase
        .from("subscription_plans")
        .update({ active, updated_by: userId } as never)
        .eq("slug", slug);
      if (error) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        return false;
      }
      return true;
    },
    [userId, queryClient],
  );

  const removePlan = useCallback(
    async (slug: string): Promise<boolean> => {
      if (!userId) return false;
      queryClient.setQueryData<SubscriptionPlanRow[]>(QUERY_KEY, (prev) =>
        (prev ?? []).filter((p) => p.slug !== slug),
      );
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("slug", slug);
      if (error) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        return false;
      }
      return true;
    },
    [userId, queryClient],
  );

  return { plans, isLoading, addPlan, updatePlan, toggleActive, removePlan };
}
