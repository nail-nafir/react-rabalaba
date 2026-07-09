# TSD 06 — Engine Internals (Mendalam / Deep)

> 🇮🇩 Referensi mendalam engine sinyal: tiap export + formula/threshold. Pure, single-source di `src/features/engine/` + `src/core/`.
> 🇺🇸 Deep engine reference: every export + formula/threshold. Pure, single-sourced in `src/features/engine/` + `src/core/`.

---

## 🧭 Peta modul / Module map

| File | Baris | Export kunci / Key exports |
|---|---|---|
| `signals.ts` | 1110 | `computeSignal`, `createUnavailableSignal`, `Outlook`, `SignalInput`, `SignalReasons`, `SignalDataQuality` |
| `indicators.ts` | 704 | 19 fungsi indikator (lihat bawah) |
| `regime.ts` | 56 | `classifyRegime` |
| `backtest.ts` | 364 | `runBacktest`, `BacktestMetrics` |
| `calibration.ts` | 52 | `calibrateConfidence` |
| `trading-plan.ts` | 141 | `computeTradingPlan` |
| `crypto-context.ts` | 92 | `deriveCryptoContext`, `applyCryptoContext`, `deriveCryptoRiskState` |
| `idx-context.ts` | 96 | `deriveIdxContext`, `applyIdxContext`, `deriveIdxRiskState` |
| `us-context.ts` | 128 | `deriveUsContext`, `applyUsContext`, `deriveUsRiskState` |
| `benchmark-derate.ts` | 64 | `tierFor`, `alignmentFor`, `fightsBenchmark`, `applyBenchmarkDerate` |
| `enrichment.ts` | 171 | `enrichAsset`, `EnrichmentInputs` |
| `smart-money.ts` | 172 | `derivePositioning`, `applySmartMoney`, `isNeutralPositioning` |
| `accumulation.ts` | 199 | `deriveAccumulation`, `applyAccumulation`, `supportsAccumulation` |
| `relative-strength.ts` | 152 | `computeWindowReturns`, `deriveRelativeStrength`, `applyRelativeStrength` |
| `fundamentals.ts` | 108 | `applyFundamentals` |
| `sentiment.ts` | 65 | `fearGreedContextWarning`, `generateSentimentAnalysis` |
| `analysis-text.ts` | 41 | `AnalysisText`, `resolveAnalysisText` |
| `../core/auto-journal-core.ts` | 235 | `runAutoJournal`, `AutoJournalPlan`, `JournalClosure` |
| `../core/asset-discovery-core.ts` | 631 | feed parsers, rankers, `planDiscovery`, `binancePerpBase`, `pickYahooCryptoSymbol`, `dedupeCandidates`, `formatDiscoveryForDiscord` |
| `../core/context-pipeline.ts` | 128 | `buildEngineContexts`, `passesEmissionGate` |
| `../core/alerts.ts` | 354 | `buildAutoJournalAlerts`, `formatAlertsForDiscord`, `formatDailySummaryForDiscord` |
| `../core/period-summary.ts` | 66 | `recapWindow` |
| `../core/edge-engine.ts` | 103 | facade re-export (cron entry) |

---

## 🧠 signals.ts — `computeSignal(input) → Outlook` (`:175`)

### Pipeline
1. **Volume gate** — kalau `zeroVolumeRatio > ZERO_VOLUME_MAX_RATIO (0.3)` dalam window 50 → `unreliableVolume=true`; bobot volume didistribusi ulang ke kategori lain.
2. **Layer 1 Regime** — `classifyRegime` (lihat bawah).
3. **Chop filter** — squeeze lean → NEUTRAL + `suppressed=true`.
4. **Layer 2-4 Score per kategori** — tiap indikator skor `[-1..1]` × `SIGNAL_WEIGHTS`, jumlahkan, normalize oleh `CATEGORY_MAX_SCORE` → `[-1..1]`.
5. **Layer 5 Combine** — `directionScore = Σ(categoryScore × baseWeight × regimeMultiplier)` di `[-1..1]`.
6. `strength = round(|directionScore| × 100)`.
7. **HTF confirmation** — boost kalau HTF align, downgrade kalau conflict (`HTF_RESAMPLE_FACTOR` dari `yahoo-adapter.ts:20`: scalp×12/swing×4/position×5).
8. **Counter-trend guard** — force NEUTRAL kecuali `|directionScore| ≥ DIRECTION_OVERRIDE_SCORE (0.6)` atau divergence/strong-score override.
9. **Tier** — A `≥80`, B `≥60`, C `<60` (`TIER_THRESHOLDS`).
10. **Risk** — low `confidence≥75`, medium `≥50`, high `<50` (`RISK_RULES`).

### Formula kunci

**Category score** (normalize):
```
categoryScore = clamp(Σ(indicatorScore × weight) / CATEGORY_MAX_SCORE[cat], -1, 1)
```

**Direction score** (regime-weighted):
```
baseWeight[cat] = CATEGORY_BASE_WEIGHTS[cat]  // trend .4 / momentum .3 / vol .2 / volume .1
multiplier[regime][cat] = REGIME_WEIGHT_MULTIPLIERS[regime][cat]
directionScore = clamp(Σ(categoryScore × baseWeight × multiplier), -1, 1)
```

**Category weights & max** (`signals.ts:55-88`):
| Kategori | Base | Indikator (weight) | Max |
|---|---|---|---|
| trend | 0.4 | EMA_ALIGNMENT 1.5 + MACD 1.0 + ADX_TREND 1.0 | 3.5 |
| momentum | 0.3 | RSI 1.0 + STOCH_RSI 0.5 + RSI_DIVERGENCE 1.0 | 2.5 |
| volatility | 0.2 | BOLLINGER 0.75 + FIBONACCI_BOUNCE 1.0 | 1.75 |
| volume | 0.1 | OBV_DIRECTION 0.5 + VOLUME_SPIKE 0.75 | 1.25 |

**Regime multipliers** (`:80-88`):
| Regime | trend | momentum | volatility | volume |
|---|---|---|---|---|
| trending | 1.5 | 0.8 | 0.8 | 1.0 |
| ranging | 0.5 | 1.5 | 1.5 | 1.0 |
| high_volatility | 1.0 | 0.6 | 1.2 | 1.0 |
| low_volatility | 1.0 | 1.0 | 1.0 | 1.0 |

### Thresholds (`SIGNAL_THRESHOLDS`)
RSI oversold 30 / overbought 70; volume spike ×1.5; ADX strong 25 / weak 20; Bollinger period 20 / std 2; StochRSI oversold 20 / overbought 80; zero-volume max ratio 0.3; volume reliability window 50.

---

## 📐 regime.ts — `classifyRegime` (`:56`)

```
if (bbBandwidth% < SQUEEZE_BANDWIDTH_PERCENT (3) && ADX < SQUEEZE_MAX_ADX (20)) → low_volatility  // squeeze priority
else if (ADX ≥ ADX_STRONG_TREND (25)) → trending
else if (atr% > highVol threshold) → high_volatility
else → ranging
```

> Squeeze (low_vol) **prioritas tertinggi**. Edge case fixed: `bbBandwidth=0` → low_volatility (bukan exclude).

---

## 📊 indicators.ts (19 fungsi, O(n) optimized)

| Fungsi / Function | Formula |
|---|---|
| `calculateRSI(closes, period=14)` | Wilder smoothing: `RSU=avgUp, RSD=avgDown, RSI=100-100/(1+RSU/RSD)` |
| `calculateSMA(values, period)` | simple moving average |
| `calculateEMA(values, period)` | `EMA=today×k + prevEMA×(1-k)`, `k=2/(period+1)` |
| `calculateEMASeries(values, period)` | full EMA array |
| `calculateMACD(closes, fast=12, slow=26, signal=9)` | `{macdLine, signalLine, histogram}` |
| `calculateBollingerBands(closes, period=20, std=2)` | `{upper, middle, lower, percentB, bandwidth}` |
| `calculateStochRSI(rsiSeries, period=14)` | incremental Wilder: `(RSI-minRSI)/(maxRSI-minRSI)×100` |
| `calculateDMI(candles, period=14)` | `{adx, plusDI, minusDI}` |
| `calculateATR(candles, period=14)` | Wilder TR average |
| `calculateOBVTrend(candles)` | linear-regression slope of OBV → `[-1..1]` |
| `calculateCLV(candle)` | `((close-low)-(high-close))/(high-low)` |
| `calculateADDelta(candles, period)` | A/D line delta |
| `calculateCMF(candles, period=20)` | Chaikin Money Flow `Σ(MFV)/Σ(Volume)` |
| `calculateMFI(candles, period=14)` | Money Flow Index |
| `calculateRSISeries(closes, period)` | O(n) full RSI array |
| `detectRSIDivergence(closes, rsiSeries)` | peak/trough matching → bullish/bearish/none |
| `calculateFibLevels(candles)` | swing high/low → 0/23.6/38.2/50/61.8/78.6/100% |
| `detectSwingLevels(candles)` | 3-bar fractals |
| `calculatePivotLevels(candle)` | classic pivot P=S+H+L / R1..R3 / S1..S3 |

---

## 🛡️ 3 Context (top-down de-rate)

Tiap context: `derive*Context` (package outlook+extras) + `apply*Context` (de-rate). De-rate via `applyBenchmarkDerate(factor=COUNTER_MARKET_DERATE 0.6)` — skala `directionScore`+`strength` ×0.6, re-tier, append warning. **Gak pernah** hide/flip.

### crypto-context.ts
- `deriveCryptoRiskState`: `|btcDirectionScore| ≥ RISK_SCORE_THRESHOLD (0.3)` → risk_on/risk_off; tiebreak F&G extreme (`EXTREME_FEAR 25` / `EXTREME_GREED 80`).
- `applyCryptoContext`: de-rate counter-trend crypto. BTC-self & non-crypto unchanged (same-ref).

### idx-context.ts
- `deriveIdxRiskState`: IHSG score primary; tiebreak `|USDIDR 1w %| ≥ RUPIAH_PRESSURE_1W_PCT (1.0)` (rupiah weaken = risk-off). Decisive IHSG ignores tiebreak.
- `applyIdxContext`: de-rate counter-trend id-stock LONG immutably.

### us-context.ts
- `deriveUsRiskState`: S&P score primary; tiebreak VIX level (`VIX_RISK_OFF_LEVEL 20` / `VIX_RISK_ON_LEVEL 15`) + `|VIX 1w %| ≥ VIX_PRESSURE_1W_PCT (10)` AND `|DXY 1w %| ≥ DXY_PRESSURE_1W_PCT (1)` (harus agree). Decisive S&P ignores tiebreak.
- `applyUsContext`: de-rate counter-trend US-stock.

### benchmark-derate.ts
- `tierFor(signal)`, `alignmentFor(signal, riskState)`, `fightsBenchmark(signal, riskState)`, `applyBenchmarkDerate(outlook, {factor, warning})` — return NEW outlook (immutable).

---

## 🔗 enrichment.ts — `enrichAsset(asset, inputs) → UnifiedAsset` (`:81`)

**Urutan load-bearing:**
1. Top-down context de-rate (BTC/IHSG/S&P, mutually exclusive per assetType)
2. Flow nudge — `applySmartMoney` (crypto) / `applyAccumulation` (US+ID stocks)
3. `applyRelativeStrength` (bounded ±`RELATIVE_STRENGTH.MAX_CONVICTION_ADJ 0.1`)
4. `applyFundamentals` (stocks, browser-only)

Semua nudge bounded ±`*_MAX_CONVICTION_ADJ`, **gak pernah flip**. Same-ref passthrough kalau gak ada yang apply.

---

## 💰 smart-money.ts

`derivePositioning(input: {openInterest, openInterestDelta, fundingRate, longShortRatio, priceChange?}) → SmartMoney` (score `[-1..1]`, label, flow).

- OI ↑ + price ↑ = new longs bullish; OI ↑ + price ↓ = new shorts bearish.
- Funding extreme (`|rate| ≥ FUNDING_EXTREME 0.0005`) = contrarian crowded bearish.
- L/S extreme (`ratio ≥ LS_EXTREME 2.0` atau inverse) = crowded.
`applySmartMoney` nudge ±`MAX_CONVICTION_ADJ 0.15`, immutable, neutral untouched.

---

## 📥 accumulation.ts

`deriveAccumulation(dailyCandles) → Accumulation | null`. Komponen weighted (`ACCUMULATION.WEIGHTS`): adFlow 0.3 / cmf 0.25 / mfi 0.15 / upDownVolume 0.15 / spikeBias 0.15. Honesty gate: zero-volume >30% → null. Min 15 daily candles. Label `SCORE_THRESHOLD 0.25` / `STRONG_THRESHOLD 0.6`. `applyAccumulation` ±`MAX_CONVICTION_ADJ 0.15`. `supportsAccumulation` — equities only (us-stock/id-stock).

---

## 📈 relative-strength.ts

`computeWindowReturns(dailyCloses) → {r1w, r1m}`. `deriveRelativeStrength(assetCloses, benchReturns, name) → RelativeStrength | null` (excess = asset − bench; label outperform/inline/underperform via `INLINE_BAND_PCT 1.0`). `applyRelativeStrength` saturate di `SCALE_PCT 5.0`, ±`MAX_CONVICTION_ADJ 0.1`.

---

## 🏛️ fundamentals.ts

`applyFundamentals(outlook, f)`:
- Pre-earnings blackout (`EARNINGS_BLACKOUT_DAYS 5`) → de-rate ×`EARNINGS_DERATE 0.85` + flag.
- Analyst consensus nudge ±`ANALYST_MAX_ADJ 0.08` (skip kalau `|score| < ANALYST_MIN_SCORE 0.2`).
- Valuation caution: `HIGH_DEBT_TO_EQUITY 200` / `HIGH_TRAILING_PE 60` on LONG (flag, gak flip).
- Conservative — never flips.

---

## 📊 backtest.ts — `runBacktest(candles, options) → {metrics, trades}` (`:364`)

- Single position, entry next bar open, **no lookahead** (invariant: corrupt future candles gak ubah entry masa lalu).
- Exit: scale-out (50/30/20% TP1/2/3, stop→breakeven after TP1) atau single TP1 (legacy `tp1`), stop, opposite signal, end-of-data.
- Cost: `BACKTEST_COSTS.crypto {fee 0.0004, slippage 0.0006}` / `default {0.0002, 0.0003}` per side.
- Output `BacktestMetrics`: winRate, expectancy, profitFactor, maxDrawdownR, per-regime, **per-tier**. Optional `entryFilter` model emission gate.

---

## 🎯 calibration.ts — `calibrateConfidence(metrics, tier, regime) → CalibratedConfidence` (`:52`)

Petakan tier+regime live ke hit-rate historis trade sebanding. Return `null` winRate kalau sample < `MIN_CALIBRATION_SAMPLE` (8). Bridge "alignment teknis" → "probabilitas profit".

---

## 📐 trading-plan.ts — `computeTradingPlan(outlook, currentPrice, assetType) → TradingPlan | null` (`:141`)

- Stop ATR-based (1.5×) + structural fallback (recent swing/pivot).
- R:R adaptif dari opposing structural level, clamp `[1..4]`.
- 3 TP level.
- Risk clamp per tipe: crypto 12%, stocks 8%.
- ATR fallback ke %-of-price kalau ATR=0.

---

## 🤖 core/auto-journal-core.ts — `runAutoJournal` (`:100`)

`runAutoJournal(assets, openRows, {contexts, recentClosed, now?}) → AutoJournalPlan {inserts, closures}`.

**Emit**: skip quote stale > `QUOTE_MAX_AGE_MS` 90min; `buildFollowedTrade`; `passesEmissionGate` (counter-trend diblok kecuali post-context strength ≥ `JOURNAL_EMISSION.COUNTER_TREND_MIN_STRENGTH 60`); `REENTRY_COOLDOWN_MS` 6 jam per `symbol|signal`.

**Close**: replay candle sejak entry — Close 1 price TP/SL (`applyPriceSync`, secure highest TP di stop berikutnya); Close 2 signal REVERSAL (long↔short, status `reversed=true`, secure TP touched else exit current). Phantom guard: cuma candle timestamped yang mutusin.

---

## 🧭 core/context-pipeline.ts — `buildEngineContexts` (`:128`) + `passesEmissionGate`

`buildEngineContexts(assetBySymbol, {fearGreed}) → EngineContexts {cryptoContext?, idxContext?, usContext?}` — server-side equivalent 3 context hook. `passesEmissionGate(trade, contexts)` — aligned + benchmark-less always pass; counter-trend gated post-context strength ≥60.

---

## 🧮 core/asset-discovery-core.ts (631 baris)

- Feed parsers (defensive → null): `parseCgTrending`, `parseBinance24h`, `parseYahooScreener`, `parseYahooSearch`.
- `binancePerpBase(perp)` — strip USDT, 1000x/1M prefix, keep 1INCH.
- `pickYahooCryptoSymbol` — PEPE defense `^BASE(\d+)?-USD$` + name match.
- Rankers: `rankCryptoCandidates` (trending-first, denylists, mcap-rank floor 300), `rankUsCandidates` (EQUITY-only, $1B mcap + $5 floor), `rankIdCandidates` (.JK, turnover floor).
- `dedupeCandidates` — admin dropped, auto refresh/reactivate, new validate, 2× cap per-market.
- `planDiscovery` — per-market cap + auto-active headroom (`MAX_AUTO_ACTIVE 60`), prune (stale + no-open-trade + healthy-market + not-seen-this-run; admin never touched).
- `formatDiscoveryForDiscord` — null kalau no-news, `DISCORD_MAX 1900` char cap.

---

## 📢 core/alerts.ts (354 baris)

- `buildAutoJournalAlerts(plan)` — inserts→`new_long`/`new_short`, closures→`tp_hit`/`sl_hit`/`reversed` (mirror donut bucket, secured-TP reversal reports AS its TP).
- `formatAlertsForDiscord` — 🚨 SINYAL → 📢 HASIL, direction-aware % dari entry, label durasi Indonesia.
- `formatDailySummaryForDiscord` — scoreboard TOTAL/TERBAIK/TERBURUK/SINYAL BARU/MASIH TERBUKA/SUDAH DITUTUP/RASIO LABA RUGI; empty day → null.
- `DISCORD_MAX 1900`, `DIVIDER`.

---

## 🗓️ core/period-summary.ts — `recapWindow(period, refMs) → RecapWindow` (`:66`)

WIB (UTC+7) calendar-window math. `period ∈ daily|weekly|monthly`. Weekly start Monday (send day Sunday); monthly = WIB calendar month (send day last WIB day). Pure (no Date; `refMs` injected).

---

## 😌 sentiment.ts & analysis-text.ts

- `fearGreedContextWarning(fearGreed, score)` — null kalau undefined; fire cuman kalau sentiment lean AGAINST score (boundary 20, 0→null).
- `generateSentimentAnalysis(fearGreed) → AnalysisText` — 5 band → i18n key. Sengaja **gak** di-score ke directionScore (lagging/crypto-heavy).
- `AnalysisText { key, params? }` + `resolveAnalysisText(t, text)` — jaga engine pure (no i18n dep).

---

## 🔗 Terkait / Related
- [`../fsd/02-trading-engine.md`](../fsd/02-trading-engine.md) — functional view
- [`05-edge-functions.md`](05-edge-functions.md) — cron yang pakai core
- [`../testing/01-coverage-inventory.md`](../testing/01-coverage-inventory.md) — test per modul
