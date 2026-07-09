# Testing 01 — Coverage Inventory

> 🇮🇩 Peta 26 file / 268 case test, per modul, fokus coverage.
> 🇺🇸 Map of 26 files / 268 test cases, per module, coverage focus.

---

## 📊 Summary

| Metric | Value |
|---|---|
| File test | 26 |
| Total case | 268 |
| Framework | `node --test` + `node:assert/strict` |
| Load | Vite SSR `ssrLoadModule` real `.ts` |
| Fokus | pure trading-engine core (`src/features/engine/*`, `src/core/*`) |
| Celah / Gap | Edge I/O handler (`supabase/functions/*/index.ts`), UI component, hook (lihat `02-gaps`) |

---

## 📋 Inventory (urut cases desc)

| File | Cases | Modul under test | Coverage focus |
|---|---|---|---|
| `indicators-edge-cases.test.mjs` | 68 | `engine/indicators.ts` | edge case numerik RSI/EMA/EMASeries/MACD/SMA/Bollinger/StochRSI/DMI/ATR/OBVTrend/RSISeries/RSIDivergence/FibLevels/SwingLevels/PivotLevels/CLV/CMF/ADDelta/MFI — empty array, sub-period, div-by-zero, NaN guard, hand-computed fixture |
| `follow-trade-model.test.mjs` | 26 | `follow-trade/lib/follow-trade-model.ts` | `computePnl` (long/short sign+R), `buildTradeWinrateSnapshots` (cumulative per-symbol, open pakai pre-entry history), `evaluateFollow` (TP/SL via wick + hit-time, order-matters SL-before-TP vs TP-before-SL, same-bar TP+SL→TP secured, missing tp3, snapshot fallback), `applyPriceSync` (partisi open/closed, skip missing price), `buildTrackerStats` (win rate/equity/per-asset/long-vs-short), `deriveFollowProgress` (live TP lighting, gak downgrade stored milestone) |
| `signal-engine.test.mjs` | 20 | `signals.ts`, `indicators.ts`, `yahoo-candles.ts`, `trading-plan.ts`, `backtest.ts` | Yahoo normalize (drop null OHLCV, keep alignment), RSI flat/DMI direction, clean bull/bear→LONG/SHORT, overbought-no-auto-short, insufficient-depth→neutral capped 25, ranging→neutral, zero-volume→unreliable disables OBV/spike, regime 4-way, chop/no-trade squeeze, volume-unreliable weight redistribution, HTF conflict/align, swing fractals, trading-plan RR clamp + thin-data fallback, backtest profitable + **no-lookahead invariant** |
| `asset-discovery-core.test.mjs` | 15 | `core/asset-discovery-core.ts` | `binancePerpBase` (USDT strip, 1000x, 1INCH, reject non-USDT/delivery), `rankCryptoCandidates` (trending-first, denylists, rank gate, dedup), `pickYahooCryptoSymbol` (PEPE name-match defense), `rankUsCandidates` (EQUITY-only, floors, gainers-first), `rankIdCandidates` (.JK-only, turnover floor), `dedupeCandidates` (admin dropped, auto refresh/reactivate, new validate, 2× cap), `planDiscovery` (per-market cap, headroom, collision routing, prune rules, admin never touched), `formatDiscoveryForDiscord` (null no-news, 1900 cap), feed parsers normalize + null-on-malformed |
| `trade-setup-model.test.mjs` | 14 | `trading-plan/lib/trade-setup-model.ts` | `priceToRatio` (clamp + degenerate domain), `buildTradeSetupModel` (domain encloses levels+candles, scale follows recent action, recent run-up enclosed — SUI kepotong bug, R-multiples ascending, pctFromCurrent signs, robust empty/missing tp3, `priceTicks`, `dateTickIndices`, `mapMarkerToCandle` nearest/edge-clamp/empty) |
| `sentiment-engine.test.mjs` | 14 | `engine/sentiment.ts` | `fearGreedContextWarning` (null undefined, fire cuman lean AGAINST score, boundary 20 0→null), `generateSentimentAnalysis` (5 band → i18n key) |
| `auto-journal-core.test.mjs` | 12 | `core/auto-journal-core.ts` | `runAutoJournal`: emit long/short skip neutral, dedup vs open, close on final-TP candle, leave open no hit, close on REVERSAL (status reversed, exit current), neutral≠close, **stale-quote skip** (crypto), stale quote gak sync/close, **phantom spot guard** (USDIDR bug), real candle SL closes, stale-forex guard (all asset types), **re-entry cooldown** (same symbol+dir blocked 6h, opposite allowed, cooldown elapse) |
| `accumulation.test.mjs` | 10 | `engine/accumulation.ts`, `yahoo-candles.ts` | `deriveAccumulation` (up-volume→accumulation, down→distribution, too-little→null, zero-volume gate >30%→null), `applyAccumulation` (boost agreement/dampen opposition, ±15% bounded, never flips, immutable, neutral untouched), `isNeutralFlow`, `supportsAccumulation` (equities only), `resampleCandlesToDaily` (merge same-UTC-day, passes daily 1:1, no mutation) |
| `regime-engine.test.mjs` | 9 | `engine/regime.ts` | `classifyRegime` 4 regime + **fixed collapsed-band edge case** (bbBW 0 → low_volatility), collapsed+strong ADX → trending, squeeze priority over high_volatility, bandwidth-at-threshold not squeeze |
| `enrichment.test.mjs` | 8 | `engine/enrichment.ts` (+ accumulation, crypto-context, smart-money) | `enrichAsset` id-stock: IDX de-rate BEFORE accumulation nudge (exact combined math), accumulation attaches even neutral, US-stock accumulation, crypto identical legacy chain, idxContext never touches crypto / cryptoContext never touches id-stock, same-ref passthrough, commodity/forex passthrough, US-stock SHORT + opposing flow dampens no flip |
| `daily-summary.test.mjs` | 7 | `core/alerts.ts` (`formatDailySummaryForDiscord`), `core/period-summary.ts` (`recapWindow`) | scoreboard recap, drop per-trade, empty day→null, open-only day counts-only, **`recapWindow`** daily (always send), weekly (Monday-start, Sunday send, WIB/UTC boundary), monthly (last day, Feb non-leap, year rollover), hour-0 send recaps just-completed period |
| `auth-redirect.test.mjs` | 7 | `lib/auth-redirect.ts` | `buildLoginRedirect` plain path, query preserved+encoded, query normalized, empty→DEFAULT_REDIRECT, login never self, lone `?` = no query |
| `signal-suppressed.test.mjs` | 6 | `engine/signals.ts` | `suppressed` flag: always boolean, clean LONG not suppressed, plain ranging not suppressed, `createUnavailableSignal` not suppressed, chop squeeze→NEUTRAL+suppressed (130-bar fixture), invariant `suppressed→neutral` |
| `smart-money.test.mjs` | 5 | `api/binance.ts` (`yahooToBinancePerp`), `engine/smart-money.ts` | `yahooToBinancePerp` (USD crypto, 1000x PEPE, reject non-crypto), `derivePositioning` (OI↑price↑=new longs bullish, extreme funding=contrarian bearish crowded), `applySmartMoney` (boost/dampen ±15% bounded, immutable, neutral untouched) |
| `proxy.test.mjs` | 5 | `functions/api/_shared/proxy.ts` | in-memory `caches.default` mock: cache success (miss→hit), coalesce concurrent identical GET, serve stale on 429, controlled CORS error no stale, bypass `no-cache` header + `?_=` buster |
| `premium-trial.test.mjs` | 5 | `lib/premium-trial.ts` | `isTrialActive` (within 3d, boundary exclusive, null→false), `decodeTrialStamp` (null missing/garbage/non-base64/non-number), encode/decode round-trip |
| `context-pipeline.test.mjs` | 5 | `core/context-pipeline.ts`, `core/auto-journal-core.ts` | `passesEmissionGate` (aligned + benchmark-less pass, counter-trend gated post-context strength ≥60), `buildEngineContexts` (derives crypto from BTC, omit missing benchmark), `runAutoJournal` with contexts blocks weak counter-trend / keeps aligned + exceptional, without = legacy raw-emit |
| `us-context.test.mjs` | 4 | `engine/us-context.ts` | `deriveUsRiskState` (S&P drives, VIX+DXY tiebreak, conflict→neutral, decisive S&P ignores), `deriveUsContext` (packages), `applyUsContext` (de-rate counter-trend LONG immutable, aligned/neutral/non-us unchanged same-ref) |
| `screener-universe.test.mjs` | 4 | `market/lib/screener-universe.ts`, `constants/assets.ts` | `groupUniverse` (null/empty→FALLBACK, group by asset_type, ignore inactive + commodity/forex, present-but-empty category fallback to DEFAULT) |
| `idx-context.test.mjs` | 4 | `engine/idx-context.ts` | `deriveIdxRiskState` (IHSG score + rupiah tiebreak both ways, below-threshold rupiah→neutral, decisive IHSG ignores), `deriveIdxContext`, `applyIdxContext` (de-rate counter-trend id-stock LONG immutable) |
| `fundamentals.test.mjs` | 4 | `engine/fundamentals.ts`, `adapters/yahoo-fundamentals.ts` | `applyFundamentals` (pre-earnings blackout de-rate+flag, analyst consensus nudge aligned/opposes immutable, weak ignored, valuation caution never flips, neutral untouched), `adaptYahooFundamentals` (maps modules, analyst score 5strongBuy+5buy=0.75, nextEarningsMs, null empty) |
| `engine-extras.test.mjs` | 4 | `indicators.ts`, `yahoo-adapter.ts` | `calculateRSISeries` O(n) match reference tail, F&G scoped crypto only (stock→unavailable key), crypto daily change rolling-24h (stocks previousClose), crypto change ignores garbage near-zero Yahoo baseline (+1,152,135% bug) + short span fallback meta |
| `alerts.test.mjs` | 4 | `core/alerts.ts` | `buildAutoJournalAlerts` (inserts→new_long, closures→tp_hit/sl_hit/reversed, reversal-after-TP reports AS its TP), `formatAlertsForDiscord` (signal+outcome+duration, Indonesian labels), null empty |
| `relative-strength.test.mjs` | 3 | `engine/relative-strength.ts` | `deriveRelativeStrength` (excess + outperform/underperform/inline, no-overlap→null), `applyRelativeStrength` (leader boosts aligned LONG, laggard dampens, immutable, saturates MAX_CONVICTION_ADJ cap, never flips, neutral untouched) |
| `crypto-context.test.mjs` | 3 | `engine/crypto-context.ts` | `deriveCryptoRiskState` (BTC score + F&G tiebreak), `applyCryptoContext` (de-rate counter-trend crypto LONG immutable, aligned/BTC-self/non-crypto unchanged) |
| `calibration.test.mjs` | 2 | `engine/calibration.ts` | `calibrateConfidence` (null win-rate below min sample, expose win-rate+regimeWinRate when sufficient) |

---

## 🗺️ Coverage by area

| Area | File test | Modul |
|---|---|---|
| Engine signals/regime/chop | `signal-engine`, `signal-suppressed`, `regime-engine` | `signals.ts`, `regime.ts` |
| Indicators | `indicators-edge-cases`, `engine-extras` | `indicators.ts` |
| 3 Context | `crypto-context`, `idx-context`, `us-context` | `*-context.ts` |
| Enrichment + flow | `enrichment`, `smart-money`, `accumulation`, `relative-strength`, `fundamentals` | `enrichment.ts`, `smart-money.ts`, `accumulation.ts`, `relative-strength.ts`, `fundamentals.ts` |
| Sentiment | `sentiment-engine` | `sentiment.ts` |
| Backtest/calibration | `signal-engine` (backtest), `calibration` | `backtest.ts`, `calibration.ts` |
| Follow-trade model | `follow-trade-model` | `follow-trade-model.ts` |
| Trade setup chart | `trade-setup-model` | `trade-setup-model.ts` |
| Auto-journal core | `auto-journal-core`, `context-pipeline` | `auto-journal-core.ts`, `context-pipeline.ts` |
| Asset discovery | `asset-discovery-core` | `asset-discovery-core.ts` |
| Alerts/summary | `alerts`, `daily-summary` | `alerts.ts`, `period-summary.ts` |
| Proxy | `proxy` | `proxy.ts` |
| Screener universe | `screener-universe` | `screener-universe.ts` |
| Lib | `auth-redirect`, `premium-trial` | `lib/auth-redirect.ts`, `lib/premium-trial.ts` |

---

## 🔗 Terkait / Related
- [`00-overview.md`](00-overview.md) — framework
- [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md) — gap + rekomendasi
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — modul yang di-test
