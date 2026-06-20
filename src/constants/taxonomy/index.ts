/**
 * Categorical taxonomy — the single source of truth for every enumerated
 * "domain" shown on the terminal (asset type, signal, tier, risk, regime,
 * trend, status, score category, indicator readouts) plus the shared color
 * palette they all draw from. Each domain owns its value list (the source),
 * its derived TS type, and its label-key/color maps. Import from the specific
 * module (e.g. "@/constants/taxonomy/asset") or via this barrel.
 */
export * from "./palette";
export * from "./colors";
export * from "./asset";
export * from "./signal";
export * from "./tier";
export * from "./risk";
export * from "./regime";
export * from "./trend";
export * from "./status";
export * from "./category";
export * from "./indicator";
