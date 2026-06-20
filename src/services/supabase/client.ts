/**
 * Browser Supabase client — uses the PUBLISHABLE key (RLS-bound: read-only on
 * journal_trades per the migration's policy). Safe to ship in the client bundle.
 *
 * NOTE: the Cron Worker does NOT import this. It builds its own client with the
 * SECRET key (bypasses RLS to write), kept out of the client bundle entirely.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env",
  );
}

export const supabase = createClient<Database>(url, publishableKey);
