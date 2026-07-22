# FSD 02 — Trading Engine

> 🇮🇩 Otak sinyal RabaLaba: pipeline 5-layer, regime, 3 benchmark context, enrichment, backtest, calibration.
> 🇺🇸 RabaLaba's signal brain: 5-layer pipeline, regime, 3 benchmark contexts, enrichment, backtest, calibration.

---

## TL;DR

🇮🇩 Engine sinyal adalah fungsi **pure** (no DOM/fetch/`Date.now`) di `src/features/engine/`. Per aset: **Volume gate → Layer 1 Regime → Chop filter → Layer 2 Bias → Layer 3 Momentum → Layer 4 Risk → Layer 5 Score**. Output `Outlook` (direction LONG/SHORT/NEUTRAL + strength 0-100 + tier A/B/C + risk + analysis text). Engine ini **single-source**: di-bundle juga ke cron Deno via `edge-engine.ts`.

🇺🇸 The signal engine is a set of **pure** functions (no DOM/fetch/`Date.now`) in `src/features/engine/`. Per asset: **Volume gate → Layer 1 Regime → Chop filter → Layer 2 Bias → Layer 3 Momentum → Layer 4 Risk → Layer 5 Score**. Output `Outlook` (direction + strength 0-100 + tier A/B/C + risk + analysis text). The engine is **single-sourced**: also bundled to the Deno cron via `edge-engine.ts`.

> Entry point: `src/features/engine/signals.ts:175` (`computeSignal`).

---

## 🧠 Pipeline 5-Layer

`computeSignal(input: SignalInput) → Outlook` (`signals.ts:175`).

| Layer | Langkah / Step | Output |
|---|---|---|
| **Gate** | Volume reliability — kalau volume sampah, bobot volume didistribusi ulang ke kategori lain (`signals.ts` volume gate). *Volume reliability — if volume is garbage, its weight is redistributed.* | `SignalDataQuality.unreliableVolume` |
| **1 Regime** | `classifyRegime` (`regime.ts`) → `trending`/`ranging`/`high_volatility`/`low_volatility`. Squeeze (low_vol) prioritas tertinggi. | `MarketRegime` |
| **Chop filter** | Squeeze lean → NEUTRAL + flag `suppressed` (no-trade). *Squeeze lean → NEUTRAL + suppressed flag.* | `suppressed: true` |
| **2 Bias** | Kategori TREND (EMA+MACD+ADX) → skor `[-1..1]`. *TREND category score.* | trendScore |
| **3 Momentum** | Kategori MOMENTUM (RSI+StochRSI+divergence) → skor. *MOMENTUM category score.* | momentumScore |
| **4 Risk** | Kategori VOLATILITY (Bollinger+Fib) + VOLUME (OBV+spike) → skor + risk level. *VOLATILITY + VOLUME scores + risk level.* | volScore, volScore, `RiskLevel` |
| **5 Score** | Gabung 4 kategori via `REGIME_WEIGHT_MULTIPLIERS` → `directionScore∈[-1..1]`. `strength=round(|directionScore|×100)`. HTF confirmation boost/downgrade. Counter-trend guard. Tier A/B/C. | `Outlook` |

> 🇮🇩 **Penting:** strength = *alignment teknis*, **bukan** probabilitas menang. 4 kategori dipilih biar indikator berkorelasi gak dihitung dobel (trend = EMA+MACD+ADX, bukan 3 skor terpisah).
> 🇺🇸 **Key:** strength = *technical alignment*, **not** win probability. 4 categories chosen so correlated indicators aren't double-counted (trend = EMA+MACD+ADX, not 3 separate scores).

---

## 🌊 Regime — Layer 1

File: `src/features/engine/regime.ts:56` (`classifyRegime`).

| Regime | Trigger | Bobet / Weight effect |
|---|---|---|
| `low_volatility` (squeeze) | Bollinger bandwidth < threshold | **prioritas tertinggi** → kalau lean, NEUTRAL+suppressed |
| `trending` | ADX ≥ strong-trend threshold | boost trend weight |
| `high_volatility` | ATR % di atas threshold | boost volatility weight |
| `ranging` | default | bobot default |

---

## 🛡️ 3 Benchmark Context (top-down de-rate)

Tiap context deriving `RiskState` (`risk_on`/`risk_off`/`neutral`) dari benchmark, lalu **de-rate** (bukan sembunyiin) setup counter-trend via `applyBenchmarkDerate` (`benchmark-derate.ts:64`).

| Context | File | Benchmark | Tiebreak |
|---|---|---|---|
| **Crypto** | `crypto-context.ts:92` | BTC directionScore | — (BTC score only) |
| **IDX** | `idx-context.ts:96` | IHSG directionScore | USDIDR 1w % (rupiah lemah = risk-off) |
| **US** | `us-context.ts:128` | S&P 500 directionScore | VIX level/1w + DXY 1w (harus agree) |

🇮🇩 De-rate = skala `directionScore`+`strength` turun, re-tier, tambah warning transparan. **Gak pernah** hide atau flip sinyal. Mutually exclusive per assetType (crypto gak lewat IDX context).
🇺🇸 De-rate = scales `directionScore`+`strength` down, re-tiers, appends a transparent warning. **Never** hides or flips the signal. Mutually exclusive per assetType (crypto doesn't go through IDX context).

---

## 🔗 Enrichment Chain

File: `src/features/engine/enrichment.ts:81` (`enrichAsset`).

🇮🇩 Rantai pasca-sinyal **shared** oleh screener table & asset detail dialog (jaga conviction/tier gak drift). **Urutan load-bearing:**

1. **Top-down context de-rate** (BTC/IHSG/S&P, mutually exclusive per assetType)
2. **Flow nudge** — smart-money (crypto) / accumulation (US+ID stocks)
3. **Relative-strength** vs own benchmark (bounded ±10%)
4. **Fundamentals/analyst overlay** (stocks, browser-only)

🇺🇸 Post-signal chain **shared** by the screener table & asset detail dialog (keeps conviction/tier from drifting). **Load-bearing ORDER:** (1) context de-rate → (2) flow nudge → (3) relative-strength → (4) fundamentals overlay.

### Smart money (crypto) — `smart-money.ts:172`
`derivePositioning(input) → SmartMoney` (score `[-1..1]`, label, flow) dari matriks OI×price + contrarian funding extreme + L/S ratio. `applySmartMoney` nudge conviction ±`MAX_CONVICTION_ADJ` (gak pernah flip).

### Accumulation (equity) — `accumulation.ts:199`
`deriveAccumulation(dailyCandles) → Accumulation | null` dari CMF/MFI/A-D delta/up-down volume/spike bias. Honesty gate: zero-volume >30% → `null`. `applyAccumulation` nudge ±`MAX_CONVICTION_ADJ`. `supportsAccumulation(assetType)` — equities only.

### Relative-strength — `relative-strength.ts:152`
`computeWindowReturns` → `{r1w, r1m}`, `deriveRelativeStrength` → label outperform/inline/underperform, `applyRelativeStrength` — leadership nudge bounded ±`MAX_CONVICTION_ADJ`.

### Fundamentals (stocks) — `fundamentals.ts:108`
`applyFundamentals(outlook, f)`: pre-earnings blackout de-rate, analyst consensus nudge (bounded), valuation caution (high D/E, rich P/E on LONG). Conservative — gak pernah flip.

---

## 📊 Backtest & Calibration

### Backtest — `backtest.ts:364` (`runBacktest`)
🇮🇩 Walk-forward backtester **no lookahead**. Single position, entry di next bar open, exit via scale-out (50/30/20% di TP1/2/3, stop→breakeven after TP1) atau single TP1 (legacy), stop, opposite signal, atau end-of-data. Deduct fee+slippage per aset (`BACKTEST_COSTS`). Output `BacktestMetrics` (winRate, expectancy, profitFactor, maxDrawdownR, per-regime, **per-tier**).

🇺🇸 Walk-forward backtester with **no lookahead**. Single position, entries filled at next bar's open, exits via scale-out (50/30/20% at TP1/2/3, stop→breakeven after TP1) or single TP1 (legacy), stop, opposite signal, or end-of-data. Deducts per-asset fees+slippage. Output `BacktestMetrics`.

> Invariant test: corrupt future candles gak ubah entry masa lalu (`signal-engine.test.mjs`).

### Calibration — `calibration.ts:52` (`calibrateConfidence`)
`calibrateConfidence(metrics, tier, regime) → CalibratedConfidence`. Petakan tier+regime sinyal live ke **hit-rate historis** trade sebanding. Return `null` winRate kalau sample < `MIN_CALIBRATION_SAMPLE` (8) — kejujuran di atas presisi palsu. Jembatan "alignment teknis" → "probabilitas profit".

---

## 🧮 Analysis Text

- `analysis-text.ts:41` — `AnalysisText { key, params? }` + `resolveAnalysisText(t, text)`. Jaga engine pure (no i18n dep) tapi dialog render narasi bahasa aktif.

---

## 📐 Trading Plan

File: `src/features/engine/trading-plan.ts:141` (`computeTradingPlan`).

`computeTradingPlan(outlook, currentPrice, assetType) → TradingPlan | null`. Stop ATR-based (1.5×) + structural fallback (recent swing/pivot), R:R adaptif dari opposing structural level clamped `[1..4]`, 3 TP level, risk clamped per tipe aset (crypto 12%, stocks 8%). ATR fallback ke %-of-price kalau ATR=0.

---

## 🔗 Terkait / Related
- [`01-terminal-screener.md`](01-terminal-screener.md) — konsumen engine
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — tiap export + formula
- [`03-auto-journal.md`](03-auto-journal.md) — engine di cron
- [`00-overview.md`](00-overview.md) — glossary
