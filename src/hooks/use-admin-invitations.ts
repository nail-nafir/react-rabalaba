/**
 * Admin-only invitation management — list every invite (with redemption count),
 * mint new ones (server-generated code), and revoke/un-revoke. All via the
 * SECURITY DEFINER + is_admin()-gated RPCs in 20260625000003_invitations.sql.
 * Same react-query shape as [[use-admin-users]]; disabled unless isAdmin.
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { InvitationRow } from "@/services/supabase/database.types";
import { usePremiumAccess } from "@/hooks/use-premium-access";

const KEY = ["admin-invitations"] as const;
const EMPTY: InvitationRow[] = [];

export function useAdminInvitations() {
  const { isAdmin } = usePremiumAccess();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: KEY,
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_invitations" as never);
      if (error) throw error;
      return data as InvitationRow[];
    },
  });

  const createInvitation = useCallback(
    async (
      kind: "full" | "trial",
      trialDays: number | null,
      maxRedemptions: number | null,
      recipientLabel: string | null,
      expiresAt: string | null,
    ): Promise<string | null> => {
      const { data, error } = await supabase.rpc("admin_create_invitation", {
        p_kind: kind,
        p_trial_days: trialDays,
        p_max_redemptions: maxRedemptions,
        p_recipient_label: recipientLabel,
        p_expires_at: expiresAt,
      } as never);
      if (error) return null;
      await queryClient.invalidateQueries({ queryKey: KEY });
      return data as string;
    },
    [queryClient],
  );

  const revokeInvitation = useCallback(
    async (code: string, revoked: boolean): Promise<boolean> => {
      const { error } = await supabase.rpc("admin_revoke_invitation", {
        p_code: code,
        p_revoked: revoked,
      } as never);
      if (error) return false;
      await queryClient.invalidateQueries({ queryKey: KEY });
      return true;
    },
    [queryClient],
  );

  const deleteInvitation = useCallback(
    async (code: string): Promise<boolean> => {
      const { error } = await supabase.rpc("admin_delete_invitation", {
        p_code: code,
      } as never);
      if (error) return false;
      await queryClient.invalidateQueries({ queryKey: KEY });
      return true;
    },
    [queryClient],
  );

  return {
    invitations: data ?? EMPTY,
    isLoading,
    createInvitation,
    revokeInvitation,
    deleteInvitation,
  };
}
