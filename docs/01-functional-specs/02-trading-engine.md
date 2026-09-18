# FSD 02 — Trading Engine / Trading Engine

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Pipeline 5-Layer, Regime, Benchmark, Enrichment, Backtest, Kalibrasi

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Engine sinyal berisi fungsi pure tanpa DOM, fetch, atau Date.now di `core/engine/`. Alur per aset: volume gate, regime Layer 1, chop filter, bias Layer 2, momentum Layer 3, risk Layer 4, skor Layer 5. Alur gas dari candle mentah sampai outlook terasa solid.

Output Outlook memuat direction LONG/SHORT/NEUTRAL plus strength 0-100 plus tier A/B/C plus risk plus teks analisis. Engine single-source di-bundle ke browser dan cron Deno via edge-engine. Output mentah belum menjadi sinyal trade terminal.

Browser memakai `applySignalEpisode` dengan `journal_signal_states`. Hanya episode aktif plus setup valid menerbitkan LONG/SHORT. Kandidat belum tercatat berlabel Netral. Setup trade aktif tetap memakai snapshot server.

## 🇮🇩 Pipeline Lima Layer

Entry memakai `signals.ts › computeSignal` dari SignalInput menjadi Outlook. Volume gate mendistribusi ulang bobot volume bila data volume tidak reliabel. Chop filter mengubah squeeze lean menjadi NEUTRAL plus suppressed.

| Layer | Langkah | Output |
|---|---|---|
| Gate | Reliabilitas volume | Flag unreliableVolume |
| 1 Regime | Klasifikasi regime | MarketRegime |
| 2 Bias | Skor TREND EMA+MACD+ADX | trendScore |

Kategori Momentum memakai RSI plus StochRSI plus divergence. Kategori Volatility memakai Bollinger plus Fib. Kategori Volume memakai OBV plus spike. Layer 5 menggabung 4 kategori via REGIME_WEIGHT_MULTIPLIERS menjadi directionScore.

Strength dihitung via round dari nilai absolut directionScore dikali 100. Strength berarti alignment teknikal, bukan probabilitas menang. Empat kategori mencegah indikator berkorelasi dihitung dobel. HTF confirmation memberi boost atau downgrade. Counter-trend guard plus tier A/B/C menutup layer.

## 🇮🇩 Regime Layer 1

File memakai `regime.ts › classifyRegime`. Squeeze low_vol memiliki prioritas tertinggi. Trending memakai threshold ADX strong-trend. High volatility memakai ATR persen di atas threshold. Ranging menjadi default.

| Regime | Pemicu | Efek |
|---|---|---|
| low_volatility | Bandwidth Bollinger sempit | Prioritas tertinggi ke suppressed |
| trending | ADX kuat | Boost bobot trend |
| high_volatility | ATR persen tinggi | Boost bobot volatility |

## 🇮🇩 Konteks Tiga Benchmark

Setiap context menurunkan RiskState risk_on, risk_off, atau neutral dari benchmark. De-rate memakai `benchmark-derate.ts › applyBenchmarkDerate`. De-rate menurunkan directionScore plus strength, lalu re-tier plus warning transparan. De-rate tidak pernah hide atau flip sinyal.

| Context | Benchmark | Tiebreak |
|---|---|---|
| Kripto | directionScore BTC | Tanpa tiebreak |
| IDX | directionScore IHSG | Persen mingguan USDIDR |
| USA | directionScore S&P 500 | Level/mingguan VIX plus mingguan DXY |

Mutually exclusive per assetType berlaku ketat. Aset kripto tidak lewat context IDX. Aset Indonesia tidak lewat context USA. Aset USA tidak lewat context kripto. Aturan ini menjaga top-down tetap murni dan auto rapi.

## 🇮🇩 Rantai Enrichment

Rantai memakai `enrichment.ts › enrichAsset` bersama screener, dialog, dan cron. Hanya context benchmark wajib masuk jalur keputusan. Evidence opsional ditempel untuk display tanpa mengubah signal, strength, atau tier.

- Smart-money kripto via `smart-money.ts › derivePositioning` dari OI x price plus funding plus L/S ratio.
- Accumulation equity via `accumulation.ts › deriveAccumulation` dari CMF/MFI/A-D plus volume.
- Relative-strength via `relative-strength.ts › deriveRelativeStrength` dari return r1w dan r1m.
- Fundamental saham via `fundamentals.ts › applyFundamentals` sebagai konteks display-only.

Honesty gate accumulation: zero-volume di atas 30 persen menjadi null. Helper eksperimen applySmartMoney, applyAccumulation, dan nudge relative tetap tersedia. Jalur kanonis display-only mencegah browser dan cron berbeda keputusan.

## 🇮🇩 Backtest dan Kalibrasi

Backtest memakai `backtest.ts › runBacktest` walk-forward tanpa lookahead. Keputusan candle i dieksekusi di open i+1. Reversal ditutup di open sebelum high/low diproses. Mode default progressive memindah stop ke entry setelah TP1, lalu ke TP1 setelah TP2. Gap melewati stop aktif mengisi di open aktual.

- Gross plus net R, fee/slippage, timestamp keputusan/entry/exit tercatat.
- Mode terminal, secured, scale-out, dan TP1 tersedia sebagai pembanding riset.
- Invariant corrupt future candle tidak mengubah entry masa lalu.

Kalibrasi memakai `calibration.ts › calibrateConfidence` dari metrik ke hit-rate historis per tier plus regime. Return null bila sampel di bawah MIN_CALIBRATION_SAMPLE = 30. Overlay browser tidak boleh mengganti cohort kalibrasi. Basis uji kanonis: 45 file dengan 422 kasus.

Gate riset memakai `gate-compare.mjs` kontrak 60d/1h dengan split 50 persen history, 25 persen validation, 25 persen holdout. Kandidat wajib menaikkan win-rate minimal 2pp tanpa menurunkan expectancy/PF, tanpa memperburuk drawdown, dan mempertahankan minimal 50 persen trade. Production tidak memakai kandidat otomatis.

## 🇮🇩 Teks Analisis dan Rencana Trading

Teks memakai `analysis-text.ts › resolveAnalysisText` dengan struct key plus params. Engine tetap pure tanpa dependensi i18n. Dialog me-render narasi bahasa aktif dari key tersebut.

Rencana memakai `trading-plan.ts › computeTradingPlan` dari outlook, harga saat ini, dan tipe aset. Stop memakai ATR 1.5x plus fallback struktural swing/pivot. R:R adaptif dari level struktural lawan di-clamp 1-4. Tiga level TP plus risk clamp per tipe aset: kripto 12 persen, saham 8 persen. ATR nol fallback ke persen harga.

## 🇮🇩 Tautan Terkait

- Screener: docs/01-functional-specs/01-terminal-screener.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Auto-journal: docs/01-functional-specs/03-auto-journal.md
- Metodologi: docs/05-explainers/00-trading-methodology.md

---

<a id="english-part"></a>

## 🇺🇸 Summary

Signal engine holds pure functions without DOM, fetch, or Date.now in `core/engine/`. Per-asset flow: volume gate, Layer 1 regime, chop filter, Layer 2 bias, Layer 3 momentum, Layer 4 risk, Layer 5 score. Deep-dive flow from raw candles to outlook remains solid.

Outlook output holds LONG/SHORT/NEUTRAL direction plus 0-100 strength plus A/B/C tier plus risk plus analysis text. Single-source engine bundles to browser plus Deno cron via edge-engine. Raw output remains not terminal trade signal.

Browser applies `applySignalEpisode` with `journal_signal_states`. Only active episodes plus valid setups publish LONG/SHORT. Unrecorded candidates show Neutral. Active trade setups continue using server snapshots.

## 🇺🇸 Five-Layer Pipeline

Entry uses `signals.ts › computeSignal` from SignalInput to Outlook. Volume gate redistributes volume weight when volume data lacks reliability. Chop filter turns squeeze lean into NEUTRAL plus suppressed.

| Layer | Step | Output |
|---|---|---|
| Gate | Volume reliability | unreliableVolume flag |
| 1 Regime | Regime classifier | MarketRegime |
| 2 Bias | TREND score EMA+MACD+ADX | trendScore |

Momentum category uses RSI plus StochRSI plus divergence. Volatility category uses Bollinger plus Fib. Volume category uses OBV plus spike. Layer 5 combines 4 categories via REGIME_WEIGHT_MULTIPLIERS into directionScore.

Strength equals round of absolute directionScore times 100. Strength means technical alignment, not win probability. Four categories prevent correlated indicators from double counting. HTF confirmation adds boost or downgrade. Counter-trend guard plus A/B/C tiers close the layer.

## 🇺🇸 Layer 1 Regime

File uses `regime.ts › classifyRegime`. Low_vol squeeze holds highest priority. Trending uses strong-trend ADX threshold. High volatility uses above-threshold ATR percent. Ranging serves as default.

| Regime | Trigger | Effect |
|---|---|---|
| low_volatility | Narrow Bollinger bandwidth | Highest priority to suppressed |
| trending | Strong ADX | Boost trend weight |
| high_volatility | High ATR percent | Boost volatility weight |

## 🇺🇸 Three Benchmark Contexts

Each context derives risk_on, risk_off, or neutral RiskState from benchmarks. De-rate uses `benchmark-derate.ts › applyBenchmarkDerate`. De-rate lowers directionScore plus strength, then re-tiers plus transparent warning. De-rate never hides or flips signals.

| Context | Benchmark | Tiebreak |
|---|---|---|
| Crypto | BTC directionScore | No tiebreak |
| IDX | IHSG directionScore | Weekly USDIDR percent |
| USA | S&P 500 directionScore | VIX level/weekly plus DXY weekly |

Mutually exclusive behavior per assetType remains strict. Crypto assets skip IDX context. Indonesia assets skip USA context. USA assets skip crypto context. Rules keep top-down pure plus tidy.

## 🇺🇸 Enrichment Chain

Chain uses `enrichment.ts › enrichAsset` across screener, dialog, plus cron. Only required benchmark context enters decision path. Optional evidence attaches for display without changing signal, strength, or tier.

- Crypto smart-money via `smart-money.ts › derivePositioning` from OI x price plus funding plus L/S ratio.
- Equity accumulation via `accumulation.ts › deriveAccumulation` from CMF/MFI/A-D plus volume.
- Relative-strength via `relative-strength.ts › deriveRelativeStrength` from r1w plus r1m returns.
- Stock fundamentals via `fundamentals.ts › applyFundamentals` as display-only context.

Accumulation honesty gate: above-30-percent zero-volume becomes null. Experimental helpers applySmartMoney, applyAccumulation, plus relative nudge remain available. Canonical display-only path prevents browser plus cron decision drift.

## 🇺🇸 Backtest and Calibration

Backtest uses `backtest.ts › runBacktest` walk-forward without lookahead. Candle i decisions execute at open i+1. Reversals close at open before high/low handling. Default progressive mode moves stop to entry after TP1, then to TP1 after TP2. Gaps through active stops fill at actual open.

- Gross plus net R, fee/slippage, decision/entry/exit timestamps recorded.
- Terminal, secured, scale-out, plus TP1 modes serve as research comparisons.
- Corrupt-future-candle invariant preserves past entries.

Calibration uses `calibration.ts › calibrateConfidence` from metrics to historical hit-rate per tier plus regime. Returns null when sample falls below MIN_CALIBRATION_SAMPLE = 30. Browser overlays never replace calibration cohorts. Canonical test basis: 45 files with 422 cases.

Research gate uses `gate-compare.mjs` with 60d/1h contract split 50 percent history, 25 percent validation, 25 percent holdout. Candidates must lift win-rate at least 2pp without lowering expectancy/PF, without worsening drawdown, plus retain at least 50 percent of trades. Production never adopts candidates automatically.

## 🇺🇸 Analysis Text and Trade Plan

Text uses `analysis-text.ts › resolveAnalysisText` with key plus params struct. Engine stays pure without i18n dependency. Dialog renders active-locale narrative from those keys.

Plan uses `trading-plan.ts › computeTradingPlan` from outlook, current price, plus asset type. Stop uses 1.5x ATR plus structural swing/pivot fallback. Adaptive R:R from opposing structural level clamped 1-4. Three TP levels plus per-type risk clamp: crypto 12 percent, stocks 8 percent. Zero ATR falls back to price percent.

## 🇺🇸 Related Links

- Screener: docs/01-functional-specs/01-terminal-screener.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Auto-journal: docs/01-functional-specs/03-auto-journal.md
- Methodology: docs/05-explainers/00-trading-methodology.md
