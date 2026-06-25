/**
 * Invitation CLAIM flow for the /invite/:code page.
 *   - useInvitationPeek(code): anon-safe preview (valid? premium/trial? why not)
 *   - useInvitation().claim(code): authenticated redeem → writes profiles.tier,
 *     then invalidates the entitlement so the gate updates immediately.
 * Both go through the SECURITY DEFINER RPCs in 20260625000003_invitations.sql.
 * Mirrors grantAccess in [[use-premium-access]].
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { InvitationPeek } from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";

export type ClaimResult =
  | "premium"
  | "trial"
  | "invalid"
  | "expired"
  | "revoked"
  | "exhausted"
  | "already"
  | "unauthenticated"
  | "error";

/** Preview an invitation without claiming it (works for anonymous visitors). */
export function useInvitationPeek(code: string | undefined) {
  return useQuery({
    queryKey: ["invitation-peek", code],
    enabled: !!code,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<InvitationPeek> => {
      const { data, error } = await supabase.rpc("peek_invitation", {
        p_code: code!,
      } as never);
      if (error) throw error;
      return data as InvitationPeek;
    },
  });
}

export function useInvitation() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const claim = useCallback(
    async (code: string): Promise<ClaimResult> => {
      const { data, error } = await supabase.rpc("redeem_invitation", {
        p_code: code,
      } as never);
      if (error) return "error";
      // Pull the fresh entitlement so the premium gate flips right away.
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["invitation-peek", code] });
      return (data as string) as ClaimResult;
    },
    [queryClient, userId],
  );

  return { claim };
}
