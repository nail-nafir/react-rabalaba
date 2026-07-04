/**
 * Edge-function entrypoint façade — the SINGLE surface the auto-journal cron
 * needs from the app's pure engine/tracker. esbuild bundles THIS file (with the
 * "@" -> ./src alias) into a standalone ESM that a Supabase Edge Function (Deno)
 * imports, so the engine stays single-source in src/ — no duplication, no
 * reliance on the Supabase CLI resolving imports outside supabase/functions/.
 *
 * Everything re-exported here is PURE (no React/DOM/Vite, no fetch): the browser
 * fetch path in services/api/yahoo-finance.ts is imported type-only by the
 * adapter, so it is erased and never bundled.
 */
export { adaptYahooChart } from "@/services/adapters/yahoo-adapter";
export {
  buildFollowedTrade,
  applyPriceSync,
  computePnl,
} from "@/features/follow-trade/lib/follow-trade-model";
export type {
  FollowedTrade,
  FollowCandle,
} from "@/features/follow-trade/lib/follow-trade-model";
export {
  followedTradeToInsert,
  rowToFollowedTrade,
} from "@/services/supabase/journal-mapper";
export { resolveTimeframePreset } from "@/constants/timeframes";
export { normalizeYahooCandles } from "@/services/adapters/yahoo-candles";
export { runAutoJournal } from "./auto-journal-core";
export type { AutoJournalPlan, JournalClosure } from "./auto-journal-core";
// Index-aware journaling: the cron derives the same top-down contexts the app
// does, then runAutoJournal enriches + gates emissions with them.
export { enrichAsset } from "@/features/engine/enrichment";
export { buildEngineContexts } from "./context-pipeline";
export type { EngineContexts } from "./context-pipeline";
export {
  benchmarkSymbolsFor,
  ALL_BENCHMARK_SYMBOLS,
} from "@/constants/benchmarks";
export {
  buildAutoJournalAlerts,
  formatAlertsForDiscord,
  formatDailySummaryForDiscord,
} from "./alerts";
// WIB calendar-window math for the daily/weekly/monthly Discord recaps.
export { recapWindow } from "./period-summary";
export type { RecapPeriod, RecapWindow } from "./period-summary";
export type {
  JournalAlert,
  DailySummaryInput,
  DailySummaryClosed,
  DailySummaryEmitted,
  DailySummaryOpen,
} from "./alerts";
export type { UnifiedAsset } from "@/types/asset";
export type { JournalTradeRow } from "@/services/supabase/database.types";
// Asset auto-discovery: the pure ranking/mapping/plan/format core the daily
// asset-discovery cron wires fetch + DB around (same split as auto-journal).
export {
  parseCgTrending,
  parseBinance24h,
  parseYahooScreener,
  parseYahooSearch,
  binancePerpBase,
  rankCryptoCandidates,
  rankUsCandidates,
  rankIdCandidates,
  pickYahooCryptoSymbol,
  dedupeCandidates,
  planDiscovery,
  formatDiscoveryForDiscord,
} from "./asset-discovery-core";
export type {
  DiscoveryMarket,
  DiscoveryReason,
  RawCandidate,
  ExistingAssetLite,
  ValidatedCandidate,
  DiscoveryPlan,
} from "./asset-discovery-core";

import {
  DEFAULT_CRYPTO_TICKERS,
  DEFAULT_US_STOCK_TICKERS,
  DEFAULT_ID_STOCK_TICKERS,
  DEFAULT_COMMODITY_TICKERS,
  DEFAULT_FOREX_TICKERS,
} from "@/constants/assets";

// Commodity & forex are constant-driven everywhere (not the DB universe).
// Re-exported so the Deno cron (index.ts) can APPEND them to the crypto/US/ID it
// reads from journal_assets at runtime.
export { DEFAULT_COMMODITY_TICKERS, DEFAULT_FOREX_TICKERS };

/** FALLBACK universe baked into the cron bundle — used ONLY when journal_assets
 *  is unreadable (the live source is the DB at runtime). Crypto/US/ID = the free
 *  DEFAULT_* seed; commodity & forex = their constants. */
export const EDGE_UNIVERSE: string[] = [
  ...DEFAULT_CRYPTO_TICKERS,
  ...DEFAULT_US_STOCK_TICKERS,
  ...DEFAULT_ID_STOCK_TICKERS,
  ...DEFAULT_COMMODITY_TICKERS,
  ...DEFAULT_FOREX_TICKERS,
];
