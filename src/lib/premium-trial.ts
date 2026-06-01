/**
 * Pure helpers for the per-user premium trial (3 days from first redeem).
 * Client-side only: the activation timestamp is stored (obfuscated) in
 * localStorage and validated against the device clock.
 */

export const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

/** Obfuscate an activation timestamp for storage. */
export function encodeTrialStamp(ts: number): string {
  return btoa(String(ts));
}

/** Decode a stored stamp; returns null when missing or corrupted. */
export function decodeTrialStamp(str: string | null): number | null {
  if (!str) return null;
  try {
    const ts = Number(atob(str));
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

/** True while the trial window is still open. */
export function isTrialActive(
  activatedAt: number | null,
  now: number = Date.now(),
  durationMs: number = TRIAL_DURATION_MS,
): boolean {
  return activatedAt != null && now < activatedAt + durationMs;
}
