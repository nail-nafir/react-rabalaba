/**
 * Trend direction. Value list is the source. The label + text color map
 * (TREND_DISPLAY) lives in ./colors; this stays pure data.
 */
export const TREND_DIRECTIONS = ["bullish", "bearish", "sideways"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];
