import { createClient } from "@supabase/supabase-js";

type AuthResult =
  | { ok: true; userId?: string }
  | { ok: false; status: number; error: string };

function sameSecret(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Cron uses a private header; force=true uses the caller's Supabase session. */
export async function authorizeCronRequest(
  req: Request,
  url: string,
  serviceRoleKey: string,
  force: boolean,
): Promise<AuthResult> {
  if (!force) {
    const expected = Deno.env.get("CRON_SECRET");
    const actual = req.headers.get("x-cron-secret") ?? "";
    if (!expected || !sameSecret(actual, expected)) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: true };
  }

  const authorization = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !anonKey) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("is_admin, is_owner, is_blocked")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as {
    is_admin?: boolean;
    is_owner?: boolean;
    is_blocked?: boolean;
  } | null;
  if (p?.is_blocked || (!p?.is_admin && !p?.is_owner)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, userId: user.id };
}
