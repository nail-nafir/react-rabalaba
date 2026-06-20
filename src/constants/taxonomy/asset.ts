/**
 * Asset type — THE single source for the asset universe the app trades. The
 * value list drives the TS type (so adding/removing one is a compile error
 * everywhere) and every label/option map below. Pure (no UI/i18n imports) so it
 * is safe for the esbuild edge bundle, which consumes the value arrays only.
 */
export const ASSET_TYPES = [
  "crypto",
  "us-stock",
  "id-stock",
  "commodity",
  "forex",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** Tradeable subset (== ASSET_TYPES). Named for intent at engine/stats call
 *  sites that must NOT accidentally include the "all"/"favorite" filter pills. */
export const TRADEABLE_ASSET_TYPES = ASSET_TYPES;

/** Asset type PLUS the two synthetic filter pills the screener adds. */
export const ASSET_FILTER_TYPES = ["all", ...ASSET_TYPES, "favorite"] as const;
export type AssetFilterType = (typeof ASSET_FILTER_TYPES)[number];

/** i18n keys (not English strings) so the displayed text stays bilingual and
 *  lives in en.json/id.json. Components render `t(ASSET_TYPE_LABEL_KEYS[v])`. */
export const ASSET_TYPE_LABEL_KEYS: Record<AssetFilterType, string> = {
  all: "common.asset_types.all",
  crypto: "common.asset_types.crypto",
  "us-stock": "common.asset_types.us-stock",
  "id-stock": "common.asset_types.id-stock",
  commodity: "common.asset_types.commodity",
  forex: "common.asset_types.forex",
  favorite: "common.asset_types.favorite",
};

/** Screener dropdown set: "all" + the tradeable types (favorites is a separate
 *  star toggle, not a dropdown entry). Derived from the value list, never
 *  hand-maintained. */
export const ASSET_TYPE_OPTIONS = (["all", ...ASSET_TYPES] as const).map(
  (value) => ({ value, labelKey: ASSET_TYPE_LABEL_KEYS[value] }),
);
