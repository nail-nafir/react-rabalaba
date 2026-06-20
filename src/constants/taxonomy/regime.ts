/**
 * Market regime — the behavioral state the market is in. Value list is the
 * single source (previously duplicated as MarketRegime in types/market.ts and
 * MarketRegimeKind in features/engine/regime.ts). Badge colors live in ./colors
 * (REGIME_COLORS); the per-regime category WEIGHT MULTIPLIERS (numeric scoring
 * config) stay in constants/signals.ts.
 */
export const MARKET_REGIMES = [
  "trending",
  "ranging",
  "high_volatility",
  "low_volatility",
] as const;
export type MarketRegime = (typeof MARKET_REGIMES)[number];

/** i18n keys (en.json/id.json dialog.regime_*). Use `t(REGIME_LABEL_KEYS[r])`
 *  instead of string-concatenating the key, so a new regime can't silently
 *  produce a missing translation. */
export const REGIME_LABEL_KEYS: Record<MarketRegime, string> = {
  trending: "dialog.regime_trending",
  ranging: "dialog.regime_ranging",
  high_volatility: "dialog.regime_high_volatility",
  low_volatility: "dialog.regime_low_volatility",
};
