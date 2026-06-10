/**
 * Pure helpers for the per-user premium trial.
 * Client-side only: the activation timestamp is stored (obfuscated) in
 * localStorage and validated against the device clock. The trial window
 * length is configurable via the VITE_TRIAL_DURATION env (see
 * {@link parseTrialDuration}); there is no built-in default.
 */

export const MINUTE_MS = 60 * 1000;

export const HOUR_MS = 60 * MINUTE_MS;

export const DAY_MS = 24 * HOUR_MS;

const UNIT_MS: Record<string, number> = { d: DAY_MS, h: HOUR_MS, m: MINUTE_MS };

/**
 * Parse a duration string into milliseconds. Accepts a single unit ("3d",
 * "12h", "30m"), decimals ("3.5d"), or compound units ("3d12h", "3d 12h 30m").
 * Returns null when missing or malformed, which callers treat as the trial
 * being disabled.
 */
export function parseTrialDuration(
  raw: string | undefined | null,
): number | null {
  if (!raw) return null;
  const str = raw.trim().toLowerCase();
  // The whole string must be one or more <number><unit> tokens (optionally
  // space-separated); anything else is rejected rather than partially parsed.
  if (!/^(?:\s*\d+(?:\.\d+)?[dhm])+\s*$/.test(str)) return null;
  let total = 0;
  for (const [, value, unit] of str.matchAll(/(\d+(?:\.\d+)?)([dhm])/g)) {
    total += Number(value) * UNIT_MS[unit];
  }
  return total > 0 ? total : null;
}

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
  now: number,
  durationMs: number,
): boolean {
  return activatedAt != null && now < activatedAt + durationMs;
}

/** Absolute end-of-trial timestamp. */
export function trialExpiresAt(
  activatedAt: number,
  durationMs: number,
): number {
  return activatedAt + durationMs;
}

/** Whole days remaining, ceiling so the final hours still read "1 day". */
export function trialDaysLeft(
  expiresAt: number,
  now: number = Date.now(),
): number {
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}
