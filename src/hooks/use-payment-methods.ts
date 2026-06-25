/**
 * Payment channels rendered on /subscription + inside the PaymentDialog,
 * server-truth in `payment_methods` — replaces the hardcoded list in
 * payment-dialog.tsx. PUBLIC read, admin writes gated by RLS (is_admin()).
 * Same react-query shape as [[use-subscription-plans]].
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type {
  PaymentMethodRow,
  PaymentMethodInsert,
} from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";

const QUERY_KEY = ["payment-methods"] as const;
const EMPTY: PaymentMethodRow[] = [];

export function usePaymentMethods() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as PaymentMethodRow[];
    },
  });

  const methods = data ?? EMPTY;

  const addMethod = useCallback(
    async (row: PaymentMethodInsert): Promise<boolean> => {
      if (!userId) return false;
      const { error } = await supabase
        .from("payment_methods")
        .insert(row as never);
      if (error) return false;
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return true;
    },
    [userId, queryClient],
  );

  const updateMethod = useCallback(
    async (id: string, patch: Partial<PaymentMethodRow>): Promise<boolean> => {
      if (!userId) return false;
      const { error } = await supabase
        .from("payment_methods")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) return false;
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return true;
    },
    [userId, queryClient],
  );

  const toggleActive = useCallback(
    async (id: string, active: boolean) => {
      if (!userId) return;
      queryClient.setQueryData<PaymentMethodRow[]>(QUERY_KEY, (prev) =>
        (prev ?? []).map((m) => (m.id === id ? { ...m, active } : m)),
      );
      const { error } = await supabase
        .from("payment_methods")
        .update({ active } as never)
        .eq("id", id);
      if (error) await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    [userId, queryClient],
  );

  const removeMethod = useCallback(
    async (id: string) => {
      if (!userId) return;
      queryClient.setQueryData<PaymentMethodRow[]>(QUERY_KEY, (prev) =>
        (prev ?? []).filter((m) => m.id !== id),
      );
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);
      if (error) await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    [userId, queryClient],
  );

  return { methods, isLoading, addMethod, updateMethod, toggleActive, removeMethod };
}
