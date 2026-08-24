# FSD 02 — Trading Engine

> 🇮🇩 Otak sinyal RabaLaba: pipeline 5-layer, regime, 3 benchmark context, enrichment, backtest, calibration.
> 🇺🇸 RabaLaba's signal brain: 5-layer pipeline, regime, 3 benchmark contexts, enrichment, backtest, calibration.

---

## TL;DR

🇮🇩 Engine sinyal adalah fungsi **pure** (no DOM/fetch/`Date.now`) di `src/core/engine/`. Per aset: **Volume gate → Layer 1 Regime → Chop filter → Layer 2 Bias → Layer 3 Momentum → Layer 4 Risk → Layer 5 Score**. Output `Outlook` (direction LONG/SHORT/NEUTRAL + strength 0-100 + tier A/B/C + risk + analysis text). Engine ini **single-source**: di-bundle juga ke cron Deno via `edge-engine.ts`.

🇺🇸 The signal engine is a set of **pure** functions (no DOM/fetch/`Date.now`) in `src/core/engine/`. Per asset: **Volume gate → Layer 1 Regime → Chop filter → Layer 2 Bias → Layer 3 Momentum → Layer 4 Risk → Layer 5 Score**. Output `Outlook` (direction + strength 0-100 + tier A/B/C + risk + analysis text). The engine is **single-sourced**: also bundled to the Deno cron via `edge-engine.ts`.

> Entry point: `src/core/engine/signals.ts:78` (`computeSignal`).

---

## 🧠 Pipeline 5-Layer

`computeSignal(input: SignalInput) → Outlook` (`signals.ts:78`).

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

File: `src/core/engine/regime.ts:56` (`classifyRegime`).

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

File: `src/core/engine/enrichment.ts:81` (`enrichAsset`).

🇮🇩 Rantai pasca-sinyal **shared** oleh screener table, dialog, dan cron. Hanya konteks benchmark wajib yang masuk jalur keputusan:

1. **Top-down context de-rate** (BTC/IHSG/S&P, mutually exclusive per assetType)
2. **Display-only evidence** — smart-money, accumulation, relative-strength, dan fundamentals ditempel ke aset tapi tidak mengubah signal/strength/tier.

🇺🇸 The chain is shared by browser and cron. Required benchmark context may de-rate the decision; optional APIs are display-only and cannot make browser and cron disagree.

### Smart money (crypto) — `smart-money.ts:172`
`derivePositioning(input) → SmartMoney` (score `[-1..1]`, label, flow) dari matriks OI×price + contrarian funding extreme + L/S ratio. `applySmartMoney` tetap tersedia untuk eksperimen, tetapi jalur canonical hanya menempelkan hasil untuk display.

### Accumulation (equity) — `accumulation.ts:199`
`deriveAccumulation(dailyCandles) → Accumulation | null` dari CMF/MFI/A-D delta/up-down volume/spike bias. Honesty gate: zero-volume >30% → `null`. `applyAccumulation` hanya helper eksperimen; canonical path display-only. `supportsAccumulation(assetType)` — equities only.

### Relative-strength — `relative-strength.ts:152`
`computeWindowReturns` → `{r1w, r1m}`, `deriveRelativeStrength` → label outperform/inline/underperform. Helper nudge tetap tersedia untuk eksperimen, tetapi canonical path display-only.

### Fundamentals (stocks) — `fundamentals.ts:108`
Fundamental, earnings, dan analyst data ditampilkan sebagai konteks. Helper `applyFundamentals` tetap tersedia untuk eksperimen, tetapi tidak masuk keputusan executable.

---

## 📊 Backtest & Calibration

### Backtest — `backtest.ts:364` (`runBacktest`)
🇮🇩 Walk-forward backtester **no lookahead**. Keputusan candle `i` dieksekusi di open `i+1`; reversal ditutup di open sebelum high/low diproses. Default exit full-position ratchet: TP1/TP2 jadi stop aktif, TP akhir menutup posisi, dan gap stop fill di harga open. Scale-out/TP1 tinggal mode pembanding. Gross+net R, fee/slippage, timestamp keputusan/entry/exit ikut dicatat.

🇺🇸 No-lookahead walk-forward backtest with executable open→intrabar ordering, full-position TP ratchet, gap fills, and gross/net R.

> Invariant test: corrupt future candles gak ubah entry masa lalu (`signal-engine.test.mjs`).

### Calibration — `calibration.ts:52` (`calibrateConfidence`)
`calibrateConfidence(metrics, tier, regime) → CalibratedConfidence`. Tier teknis mentah dipetakan ke **hit-rate historis** backtest yang setara. Return `null` kalau sample < `MIN_CALIBRATION_SAMPLE` (30); overlay/context browser tidak boleh mengganti cohort kalibrasi.

### Evidence gate — `scripts/gate-compare.mjs`

`npm run gate:compare -- 10` memakai kontrak production `60d/1h`, lalu membagi waktu 50% history / 25% validation / 25% holdout. Kandidat harus menaikkan win rate ≥2pp tanpa menurunkan expectancy/PF, tanpa memperburuk drawdown, dan mempertahankan ≥50% trade.

Audit 2026-08-24: tidak ada kandidat baru yang lolos validation, jadi filter regime/HTF/tier **tidak dipromosikan** walaupun beberapa tampak bagus di holdout. Ini mencegah tuning ke satu periode; jalur live hanya menerima perbaikan correctness dan gate benchmark yang sudah ada.

---

## 🧮 Analysis Text

- `analysis-text.ts:41` — `AnalysisText { key, params? }` + `resolveAnalysisText(t, text)`. Jaga engine pure (no i18n dep) tapi dialog render narasi bahasa aktif.

---

## 📐 Trading Plan

File: `src/core/engine/trading-plan.ts:141` (`computeTradingPlan`).

`computeTradingPlan(outlook, currentPrice, assetType) → TradingPlan | null`. Stop ATR-based (1.5×) + structural fallback (recent swing/pivot), R:R adaptif dari opposing structural level clamped `[1..4]`, 3 TP level, risk clamped per tipe aset (crypto 12%, stocks 8%). ATR fallback ke %-of-price kalau ATR=0.

---

## 🔗 Terkait / Related
- [`01-terminal-screener.md`](01-terminal-screener.md) — konsumen engine
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — tiap export + formula
- [`03-auto-journal.md`](03-auto-journal.md) — engine di cron
- [`00-overview.md`](00-overview.md) — glossary
