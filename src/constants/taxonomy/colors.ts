import { BADGE, PALETTE, type BadgeColor } from "./palette";
import type { SignalDirection } from "./signal";
import type { SignalTier } from "./tier";
import type { RiskLevel } from "./risk";
import type { MarketRegime } from "./regime";
import type { TrendDirection } from "./trend";
import type { FollowStatus } from "./status";
import type { IndicatorStatus } from "./indicator";

/**
 * Categorical color maps — every domain value → its badge/text color, all
 * routed through the shared PALETTE/BADGE tokens so a hue changes in exactly one
 * place. Kept SEPARATE from the value taxonomy files (which import nothing from
 * here) so those stay pure data and never drag Tailwind classes into the pure
 * auto-journal edge bundle.
 */

export const SIGNAL_COLORS: Record<SignalDirection, BadgeColor> = {
  long: BADGE.positive,
  short: BADGE.negative,
  neutral: BADGE.neutral,
};

export const TIER_COLORS: Record<SignalTier, BadgeColor> = {
  A: BADGE.positive,
  B: BADGE.warning,
  C: BADGE.negative,
};

export const RISK_COLORS: Record<RiskLevel, BadgeColor> = {
  low: BADGE.positive,
  medium: BADGE.warning,
  high: BADGE.negative,
};

/** Badge hues are deliberately distinct from the directional signal/trend hues
 *  so a regime isn't misread as bullish/bearish. */
export const REGIME_COLORS: Record<MarketRegime, BadgeColor> = {
  trending: BADGE.accent,
  ranging: BADGE.warning,
  high_volatility: BADGE.negative,
  low_volatility: BADGE.positive,
};

/** Status badge colors. `open` = Running (amber); TP reuse long/green, SL reuses
 *  short/red, reversed = neutral — all from the single SIGNAL_COLORS source. */
export const STATUS_COLORS: Record<FollowStatus, BadgeColor> = {
  open: BADGE.warning,
  tp1: SIGNAL_COLORS.long,
  tp2: SIGNAL_COLORS.long,
  tp3: SIGNAL_COLORS.long,
  sl: SIGNAL_COLORS.short,
  reversed: SIGNAL_COLORS.neutral,
};

/** Trend label (plain trading term, identical in both locales today) + text
 *  color from the shared palette. */
export const TREND_DISPLAY: Record<
  TrendDirection,
  { label: string; text: string }
> = {
  bullish: { label: "Bullish", text: PALETTE.positive.text },
  bearish: { label: "Bearish", text: PALETTE.negative.text },
  sideways: { label: "Sideways", text: PALETTE.neutral.text },
};

/** Text color per indicator status (asset detail dialog rows). bullish/oversold
 *  read constructive, the inverse destructive; `normal` is plain foreground. */
export const INDICATOR_STATUS_COLORS: Record<IndicatorStatus, string> = {
  bullish: PALETTE.positive.text,
  oversold: PALETTE.positive.text,
  bearish: PALETTE.negative.text,
  overbought: PALETTE.negative.text,
  normal: "text-foreground",
};
