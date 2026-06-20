/**
 * Signal grade/tier — A (best) → C. Value list is the source; the badge colors
 * live in ./colors (TIER_COLORS) and the engine's tiering thresholds (numeric,
 * TIER_THRESHOLDS) in constants/signals.ts. Pure data — edge-safe.
 */
export const SIGNAL_TIERS = ["A", "B", "C"] as const;
export type SignalTier = (typeof SIGNAL_TIERS)[number];
