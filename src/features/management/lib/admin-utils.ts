/**
 * Shared utility functions for admin feature components.
 */

/**
 * Splits a multiline string into a clean array of non-empty, trimmed lines.
 * Used by plan-dialog and disclaimer-editor for bilingual list fields.
 */
export function toList(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Compact relative-time token (e.g. "<1m", "12m", "3h", "2d") from an ISO
 * timestamp. Returns null when the input is missing or invalid.
 */
export function formatAgo(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

/**
 * Returns uniform badge styling for timestamp footers:
 * - Active state (when a run has occurred): primary accent tint
 * - Neutral state (when no run has occurred / "belum pernah"): muted neutral tint
 */
export function getTimeBadgeClassName(hasRun: boolean): string {
  return hasRun
    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
    : "bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground";
}
