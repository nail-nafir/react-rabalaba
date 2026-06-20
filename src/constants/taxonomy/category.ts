/**
 * Signal score categories — the four buckets the engine scores and the detail
 * dialog charts. Value list is the source; the numeric weights derived from it
 * (CATEGORY_BASE_WEIGHTS, CATEGORY_MAX_SCORE) stay in constants/signals.ts as
 * scoring config and are typed against `CategoryKey` from here.
 */
export const SCORE_CATEGORIES = [
  "trend",
  "momentum",
  "volatility",
  "volume",
] as const;
export type CategoryKey = (typeof SCORE_CATEGORIES)[number];

/** i18n keys (en.json/id.json dialog.cat_*). */
export const CATEGORY_LABEL_KEYS: Record<CategoryKey, string> = {
  trend: "dialog.cat_trend",
  momentum: "dialog.cat_momentum",
  volatility: "dialog.cat_volatility",
  volume: "dialog.cat_volume",
};
