/**
 * Risk-disclaimer clauses (server-truth in the singleton `disclaimer` row) +
 * HYBRID acceptance tracking:
 *   - logged-in users → a row in `disclaimer_agreements` (user_id, version)
 *   - anonymous users → a localStorage flag (no identity to persist)
 * Bumping the clause `version` in /admin re-prompts everyone (their recorded
 * version falls behind). Clauses read via [[pickLocale]]. See [[use-journal-settings]].
 */
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase/client";
import type { DisclaimerRow } from "@/services/supabase/database.types";
import { useAuth } from "@/hooks/use-auth";

const CLAUSES_KEY = ["disclaimer"] as const;
const AGREE_KEY = (userId: string | null) => ["disclaimer-agreement", userId] as const;

// localStorage keys: legacy bool (pre-DB) + the version the visitor last accepted.
const LS_AGREED = "rabalaba_disclaimer_agreed";
const LS_VERSION = "rabalaba_disclaimer_v";

/** Highest disclaimer version this browser accepted while anonymous. Legacy
 *  `=== "true"` flag counts as v1 so existing users aren't re-prompted by v1. */
function readLocalVersion(): number {
  try {
    const v = localStorage.getItem(LS_VERSION);
    if (v != null) return Number(v) || 0;
    return localStorage.getItem(LS_AGREED) === "true" ? 1 : 0;
  } catch {
    return 0;
  }
}

export function useDisclaimer() {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  // Read localStorage once (anonymous path); agree() advances it locally.
  const [localVersion, setLocalVersion] = useState(readLocalVersion);

  // Clauses — public, always enabled.
  const { data: clauses, isLoading } = useQuery({
    queryKey: CLAUSES_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disclaimer")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data as DisclaimerRow | null;
    },
  });

  // The logged-in user's highest accepted version (null when anonymous).
  const { data: agreedVersion } = useQuery({
    queryKey: AGREE_KEY(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disclaimer_agreements")
        .select("version")
        .eq("user_id", userId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      // Hand-written Database type resolves select() to never; assert the shape.
      const row = data as { version: number } | null;
      return row?.version ?? 0;
    },
  });

  const currentVersion = clauses?.version ?? 0;
  const acceptedVersion = userId ? (agreedVersion ?? 0) : localVersion;
  // Only decide once the visitor's acceptance status is actually known —
  // otherwise the gate flashes open for a frame and then closes:
  //   1. auth must be resolved (`authReady`); before that a logged-in user is
  //      momentarily seen as anonymous and judged against localStorage;
  //   2. for a logged-in user, their agreement query must have returned
  //      (`agreedVersion !== undefined`); while it loads we'd otherwise read it
  //      as 0 (not-yet-agreed) and prompt someone who already agreed.
  const acceptanceResolved =
    authReady && (userId ? agreedVersion !== undefined : true);
  // Only prompt once clauses have loaded, status is known, and they're behind.
  const needsAgreement =
    !!clauses && acceptanceResolved && currentVersion > acceptedVersion;

  const agree = useCallback(async () => {
    if (!clauses) return;
    const version = clauses.version;
    if (userId) {
      // Persist the acceptance; ignore a duplicate (already accepted this version).
      const { error } = await supabase
        .from("disclaimer_agreements")
        .insert({ user_id: userId, version } as never);
      if (error && error.code !== "23505") {
        // Surface nothing to the user, but don't advance state on a real failure.
        throw error;
      }
      await queryClient.invalidateQueries({ queryKey: AGREE_KEY(userId) });
    }
    // Always mirror into localStorage so the same browser isn't re-prompted
    // before the next login (and to cover the anonymous path).
    try {
      localStorage.setItem(LS_AGREED, "true");
      localStorage.setItem(LS_VERSION, String(version));
    } catch {
      /* storage unavailable — DB record (if logged in) still stands */
    }
    setLocalVersion(version);
  }, [clauses, userId, queryClient]);

  // ── Admin-only: edit the clauses. `bumpVersion` re-prompts every user. ──
  const update = useCallback(
    async (
      patch: Partial<
        Pick<
          DisclaimerRow,
          "title" | "description" | "points" | "confirm_label" | "agree_label"
        >
      >,
      bumpVersion = false,
    ): Promise<boolean> => {
      if (!userId) return false;
      const nextVersion = bumpVersion ? currentVersion + 1 : currentVersion;
      const { error } = await supabase
        .from("disclaimer")
        .update({
          ...patch,
          version: nextVersion,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", true);
      if (error) return false;
      await queryClient.invalidateQueries({ queryKey: CLAUSES_KEY });
      return true;
    },
    [userId, currentVersion, queryClient],
  );

  return { clauses, isLoading, needsAgreement, agree, currentVersion, update };
}
