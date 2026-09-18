# FSD 01 — Terminal Screener dan Detail Aset / Terminal Screener and Asset Detail

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Market Pulse, Tabel Sinyal, Dialog Detail, Chart Setup, Share Card

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Halaman /terminal menampilkan lima kartu Market Pulse di atas, lalu tabel screener multi-aset di bawah. Tabel memuat sinyal, strength, grade, success-rate, dan sparkline. Alur sat-set dari pulse sampai dialog detail terasa cepat.

Klik baris aset membuka Asset Detail Dialog berisi chart candlestick plus rencana trading plus evidence. Tombol Share membangun kartu PNG bermerek. Universe premium memakai DB single-source dengan cron.

Episode aktif dengan setup valid menerbitkan LONG/SHORT. Kandidat belum tercatat berlabel Netral. Status gagal verifikasi berlabel Tidak Tersedia plus aksi coba lagi.

## 🇮🇩 Market Pulse

Baris pulse memakai komposisi Card seragam: benchmark utama, sparkline, footer konteks, dan donut skor 0-100. Skor Indonesia memakai 70 persen teknikal plus 30 persen konteks forex. Skor USA memakai 70 persen teknikal plus 30 persen konteks VIX/DXY.

| Kartu | Benchmark | Donut |
|---|---|---|
| Kripto | BTC/USD | 100 persen arah teknikal BTC |
| Saham Indonesia | IHSG | 70 persen teknikal plus 30 persen USD/IDR |
| Saham USA | S&P 500 | 70 persen teknikal plus 30 persen VIX/DXY |

BTC Dominance mencerminkan porsi kapitalisasi pasar kripto milik Bitcoin. Nilai naik berarti modal terkonsentrasi di BTC. Nilai turun berarti aset kripto lain mengambil porsi.

Browser memanggil endpoint global CoinGecko langsung memakai IP visitor. Delta 24 jam direkonstruksi dari market-cap BTC dan total. Payload Bitcoin gagal membuat delta disembunyikan. Snapshot global gagal membuat footer kripto unavailable.

BTC Dominance hanya konteks informatif. Formula donut kripto tidak memakai BTC Dominance. Empat kartu lain memakai combiner 70/30 bila dua input tersedia, lalu fallback ke input tersedia bila satu input hilang.

## 🇮🇩 Tabel Screener

Tabel memakai TanStack Table dengan pageSize 10. Sort default strength descending. Filter tipe, filter sinyal, search debounced 100ms, toggle favorit, add-ticker, dan refresh tersedia.

| Area | Sumber | Perilaku |
|---|---|---|
| Universe premium | journal_assets DB | Single-source dengan cron |
| Universe free | Konstanta DEFAULT | Komoditas/forex selalu default |
| Fetch data | useMarketData per kategori | Share query key asset-data |

Enrichment memakai `enrichment.ts › enrichAsset` tanpa overlay opsional. Hanya context benchmark mengubah keputusan. Smart-money, accumulation, relative-strength, dan fundamental display-only. `signals.ts › computeSignal` tetap pure per aset.

Success-rate memakai agregat all-time per simbol via RPC publik. Denominator hanya win plus loss; impas dikecualikan. Anon, free, dan premium melihat angka identik. Row jurnal mentah tetap premium.

Skeleton 10 baris menanti universe, aset, benchmark, dan episode saat initial load. Refresh background mempertahankan baris plus pagination plus indikator. Favorit tersimpan walau API aset gagal. Episode dan jurnal dipoll 60 detik, lalu dibaca ulang saat mount dan focus.

Seluruh baris berfungsi sebagai DialogTrigger via klik, Enter, atau Space. Simbol menjadi ID baris stabil. Filter, search, atau sort kembali ke halaman pertama. Hasil menyusut membatasi indeks halaman. Radix menangani fokus, Escape, dan pengembalian fokus.

## 🇮🇩 Dialog Detail Aset

Dialog controlled memasang konten hanya saat terbuka, lalu melepas saat tertutup. Query aset memakai cache screener. Enrichment detail menambah overlay tanpa mengubah rumus sinyal. Backtest berjalan di Web Worker module native.

| Bagian | Isi |
|---|---|
| Baris harga | Harga live plus toggle favorit |
| Meta badge | Regime, trend, tier, risk |
| Trading plan | Snapshot episode aktif: entry, SL awal, TP, R:R tetap |

Panel evidence memuat skor 4 kategori, WinRateRing calibrated plus sample, overlay fundamental/analis, panel accumulation flow, panel relative-strength, panel smart-money, panel konteks benchmark, dan grid status indikator. Narasi memakai `analysis-text.ts › resolveAnalysisText` dengan i18n key. Engine tetap pure tanpa dependensi i18n.

Loading, error, dan retry statistik independen antar panel. Statistik tidak menghalangi panel lain. Cache backtest memakai revisi candle; revisi sama memakai ulang cache. Worker dihentikan saat selesai, gagal, atau observer hilang setelah dialog tertutup.

## 🇮🇩 Chart Setup Trading

Chart memakai SVG candlestick buatan tangan tanpa lib charting. Geometri berasal dari `trade-setup-model.ts › buildTradeSetupModel`. Viewport mendukung zoom anchor cursor via wheel. Drag menggeser; double-click reset; tap menyidik candle.

| Elemen | Fungsi |
|---|---|
| Legend OHLC | Info candle aktif gaya TradingView |
| Zona profit/risk | Shading area TP versus SL |

Level lines memakai pill KEY/price untuk entry, SL, TP1-3. Marker entry/close memakai panah in-range plus chevron out-of-range. Crosshair memakai pill harga plus waktu. Watermark brand plus panel R:R numerik melengkapi tampilan.

Harga live dan evidence boleh berubah. Entry, SL awal, TP, dan R:R episode aktif tetap dari snapshot. SL aktif mengikuti milestone jurnal. Konsistensi tabel dan dialog memakai state episode dan hasil baca sama.

## 🇮🇩 Kartu Share

Generator memakai `share-card.ts › buildShareCardSvg` ukuran 1200x1040. Hook memakai `use-share-setup.ts › useShareSetup` untuk orkestrasi build-model, build-SVG, PNG, lalu share atau download plus toast.

| Elemen | Isi |
|---|---|
| Kepala | Logo plus halo, simbol plus nama, pill status/grade/direction |
| Chart | Candlestick watermark plus zona plus level plus marker |

Statistik memuat R:R, RISK, REWARD. Footer memuat disclaimer. Theme-aware me-resolve CSS var ke hex untuk dark dan light. Rasterize 2x via svgToPngBlob. Web Share API dipakai dahulu, lalu fallback download.

## 🇮🇩 Tautan Terkait

- Engine: docs/01-functional-specs/02-trading-engine.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Testing: docs/03-testing/
- Metodologi: docs/05-explainers/00-trading-methodology.md

---

<a id="english-part"></a>

## 🇺🇸 Summary

The /terminal page shows five Market Pulse cards on top, then multi-asset screener table below. Table holds signals, strength, grade, success-rate, plus sparkline. Deep-dive flow from pulse to detail dialog remains fast.

Asset-row click opens Asset Detail Dialog with candlestick chart plus trade plan plus evidence. Share button builds branded PNG card. Premium universe uses DB single-source with cron.

Active episodes with valid setups publish LONG/SHORT. Unrecorded candidates show Neutral. Failed verification shows Unavailable plus retry action.

## 🇺🇸 Market Pulse

Pulse row uses uniform Card composition: main benchmark, sparkline, context footer, plus 0-100 score donut. Indonesia score uses 70 percent technical plus 30 percent forex context. USA score uses 70 percent technical plus 30 percent VIX/DXY context.

| Card | Benchmark | Donut |
|---|---|---|
| Crypto | BTC/USD | 100 percent BTC technical direction |
| Indonesia stocks | IHSG | 70 percent technical plus 30 percent USD/IDR |
| USA stocks | S&P 500 | 70 percent technical plus 30 percent VIX/DXY |

BTC Dominance reflects crypto market-cap share held in Bitcoin. Rising value means capital concentrates in BTC. Falling value means other crypto assets take share.

Browser calls CoinGecko global endpoints directly with visitor IP. The 24h delta reconstructs from BTC plus total market-cap. Failed Bitcoin payload hides the delta. Failed global snapshot makes crypto footer unavailable.

BTC Dominance remains informative context only. Crypto donut formula excludes BTC Dominance. Four other cards use 70/30 combiner when both inputs exist, then fallback to available input when one input misses.

## 🇺🇸 Screener Table

Table uses TanStack Table with pageSize 10. Default sort remains strength descending. Type filter, signal filter, 100ms debounced search, favorites toggle, add-ticker, plus refresh remain available.

| Area | Source | Behavior |
|---|---|---|
| Premium universe | journal_assets DB | Single-source with cron |
| Free universe | DEFAULT constants | Commodities/forex always default |
| Data fetch | useMarketData per category | Shared asset-data query key |

Enrichment uses `enrichment.ts › enrichAsset` without optional overlays. Only benchmark context changes decisions. Smart-money, accumulation, relative-strength, plus fundamentals remain display-only. `signals.ts › computeSignal` stays pure per asset.

Success-rate uses all-time per-symbol aggregates via public RPC. Denominator holds win plus loss only; breakeven excluded. Anonymous, free, plus premium see identical numbers. Raw journal rows remain premium.

Ten skeleton rows await universe, assets, benchmarks, plus episodes at initial load. Background refresh retains rows plus pagination plus indicator. Saved favorites persist when asset API fails. Episodes plus journal poll at 60 seconds, then reload at mount plus focus.

Entire rows act as DialogTrigger via click, Enter, or Space. Symbol serves as stable row ID. Filter, search, or sort returns to first page. Shrinking results clamp page index. Radix handles focus, Escape, plus focus restoration.

## 🇺🇸 Asset Detail Dialog

Controlled dialog mounts content only while open, then unmounts at close. Asset queries reuse screener cache. Detail enrichment adds overlays without changing signal formulas. Backtest runs in native module Web Worker.

| Section | Content |
|---|---|
| Price row | Live price plus favorite toggle |
| Meta badges | Regime, trend, tier, risk |
| Trading plan | Active episode snapshot: entry, initial SL, TP, fixed R:R |

Evidence panel holds 4-category scores, calibrated WinRateRing plus sample, fundamental/analyst overlay, accumulation flow panel, relative-strength panel, smart-money panel, benchmark context panel, plus indicator status grid. Narrative uses `analysis-text.ts › resolveAnalysisText` with i18n keys. Engine stays pure without i18n dependency.

Loading, error, plus retry states remain independent across panels. Statistics never block other panels. Backtest cache keys at candle revision; identical revision reuses cache. Worker terminates at completion, failure, or lost observer after dialog close.

## 🇺🇸 Trade Setup Chart

Chart uses hand-rolled SVG candlestick without charting libraries. Geometry comes from `trade-setup-model.ts › buildTradeSetupModel`. Viewport supports cursor-anchored wheel zoom. Drag pans; double-click resets; tap inspects candles.

| Element | Function |
|---|---|
| OHLC legend | Active candle info in TradingView style |
| Profit/risk zones | Shading for TP versus SL areas |

Level lines use KEY/price pills for entry, SL, TP1-3. Entry/close markers use in-range arrows plus out-of-range chevrons. Crosshair uses price plus time pills. Brand watermark plus numeric R:R panel complete the view.

Live price plus evidence may change. Entry, initial SL, TP, plus R:R of active episodes stay from snapshot. Active SL follows journal milestones. Table plus dialog consistency uses same episode state plus read results.

## 🇺🇸 Share Card

Generator uses `share-card.ts › buildShareCardSvg` at 1200x1040. Hook uses `use-share-setup.ts › useShareSetup` to orchestrate build-model, build-SVG, PNG, then share or download plus toast.

| Element | Content |
|---|---|
| Header | Logo plus halo, symbol plus name, status/grade/direction pills |
| Chart | Watermarked candles plus zones plus levels plus markers |

Statistics hold R:R, RISK, REWARD. Footer holds disclaimer. Theme-aware logic resolves CSS vars to hex for dark plus light. Rasterize at 2x via svgToPngBlob. Web Share API runs first, then download fallback.

## 🇺🇸 Related Links

- Engine: docs/01-functional-specs/02-trading-engine.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Testing: docs/03-testing/
- Methodology: docs/05-explainers/00-trading-methodology.md
