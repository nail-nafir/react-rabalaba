import { useSessionActivity } from "@/hooks/use-session-activity";

/** Headless: runs the app-wide last_active_at ping + idle logout. */
export function SessionActivity() {
  useSessionActivity();
  return null;
}