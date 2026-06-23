/**
 * Admin-only user & access-code lists — fetches every registered user with
 * their entitlement + redeemed access-code via the admin_list_users() RPC, and
 * every access code with its redemption count via admin_list_access_codes().
 * Follows the same react-query pattern as [[use-journal-assets]].
 *
 * Both RPCs are SECURITY DEFINER + gated by is_admin(); the hook itself is
 * disabled unless the caller isAdmin (same guard as useJournalAssets).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type {
  AdminUserRow,
  AccessCodeRow,
} from "@/services/supabase/database.types";
import { usePremiumAccess } from "@/hooks/use-premium-access";

const USERS_KEY = ["admin-users"] as const;
const CODES_KEY = ["admin-access-codes"] as const;
const EMPTY_USERS: AdminUserRow[] = [];
const EMPTY_CODES: AccessCodeRow[] = [];

export type AddUserResult = "added" | "duplicate" | "invalid";

export function useAdminUsers() {
  const { isAdmin } = usePremiumAccess();
  const queryClient = useQueryClient();

  const addUser = useCallback(
    async (
      email: string,
      tier: "free" | "trial" | "premium" = "free",
      role: "user" | "admin" | "owner" = "user",
      trialExpiresAt: string | null = null,
      isBlocked: boolean = false
    ): Promise<AddUserResult> => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) return "invalid";

      const existing =
        queryClient.getQueryData<AdminUserRow[]>(USERS_KEY) ?? [];
      if (existing.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return "duplicate";
      }

      const defaultPassword = "ChangeMe2026!";
      const isOwner = role === "owner";
      const is_admin = role === "admin" || role === "owner";

      const { error } = await supabase.rpc("admin_create_user", {
        p_email: cleanEmail,
        p_password: defaultPassword,
        p_tier: tier,
        p_is_admin: is_admin,
        p_is_owner: isOwner,
        p_trial_expires_at: trialExpiresAt,
        p_is_blocked: isBlocked,
      } as never);

      if (error) {
        if (error.code === "23505" || error.message?.includes("already exists")) {
          return "duplicate";
        }
        return "invalid";
      }

      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      return "added";
    },
    [queryClient]
  );

  const addAccessCode = useCallback(
    async (
      code: string,
      kind: "full" | "trial" = "full",
      maxRedemptions: number | null = null,
      trialDays: number | null = null,
      note: string | null = null
    ): Promise<"added" | "duplicate" | "invalid"> => {
      const cleanCode = code.trim();
      if (!cleanCode) return "invalid";

      const { error } = await supabase.rpc("admin_create_access_code", {
        p_code: cleanCode,
        p_kind: kind,
        p_max_redemptions: maxRedemptions,
        p_trial_days: trialDays,
        p_note: note,
      } as never);

      if (error) {
        if (error.code === "23505" || error.message?.includes("already exists")) {
          return "duplicate";
        }
        return "invalid";
      }

      await queryClient.invalidateQueries({ queryKey: CODES_KEY });
      return "added";
    },
    [queryClient]
  );

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: USERS_KEY,
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      // Hand-written Database type doesn't resolve no-arg rpc() shapes; cast.
      const { data, error } = await supabase.rpc(
        "admin_list_users" as never,
      );
      if (error) throw error;
      return data as AdminUserRow[];
    },
  });

  const { data: codesData, isLoading: isLoadingCodes } = useQuery({
    queryKey: CODES_KEY,
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_list_access_codes" as never,
      );
      if (error) throw error;
      return data as AccessCodeRow[];
    },
  });

  const toggleBlockUser = useCallback(
    async (userId: string, blocked: boolean): Promise<boolean> => {
      const { error } = await supabase.rpc("admin_toggle_block_user", {
        p_user_id: userId,
        p_blocked: blocked,
      } as never);

      if (error) {
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      return true;
    },
    [queryClient]
  );

  const deleteUser = useCallback(
    async (userId: string): Promise<boolean> => {
      const { error } = await supabase.rpc("admin_delete_user", {
        p_user_id: userId,
      } as never);

      if (error) {
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      return true;
    },
    [queryClient]
  );

  const deleteAccessCode = useCallback(
    async (code: string): Promise<boolean> => {
      const { error } = await supabase.rpc("admin_delete_access_code", {
        p_code: code,
      } as never);

      if (error) {
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: CODES_KEY });
      return true;
    },
    [queryClient]
  );

  const updateUser = useCallback(
    async (
      userId: string,
      tier: "free" | "trial" | "premium",
      role: "user" | "admin" | "owner",
      trialExpiresAt: string | null = null,
      isBlocked: boolean = false
    ): Promise<boolean> => {
      const isOwner = role === "owner";
      const is_admin = role === "admin" || role === "owner";

      const { error } = await supabase.rpc("admin_update_user", {
        p_user_id: userId,
        p_tier: tier,
        p_is_admin: is_admin,
        p_is_owner: isOwner,
        p_trial_expires_at: trialExpiresAt,
        p_is_blocked: isBlocked,
      } as never);

      if (error) {
        return false;
      }

      await queryClient.invalidateQueries({ queryKey: USERS_KEY });
      return true;
    },
    [queryClient]
  );

  return {
    users: usersData ?? EMPTY_USERS,
    accessCodes: codesData ?? EMPTY_CODES,
    isLoading: isLoadingUsers || isLoadingCodes,
    isLoadingUsers,
    isLoadingCodes,
    addUser,
    addAccessCode,
    toggleBlockUser,
    deleteUser,
    deleteAccessCode,
    updateUser,
  };
}
