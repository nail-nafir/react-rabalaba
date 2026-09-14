# FSD 01 — Terminal: Screener & Asset Detail

> 🇮🇩 Halaman terminal market view: kartu Market Pulse + tabel sinyal + dialog detail aset + share card.
> 🇺🇸 The terminal market view: Market Pulse cards + signal table + asset detail dialog + share card.

---

## TL;DR

🇮🇩 Halaman `/terminal` (default) nampilin lima kartu **Market Pulse** di atas, terus **screener tabel** aset multi-kelas dengan sinyal, strength, grade, success-rate, sparkline. Klik baris aset → **Asset Detail Dialog** dengan chart candlestick + rencana trading + evidence. Tombol Share → **share card PNG**.

🇺🇸 The `/terminal` page (default) shows five **Market Pulse** cards on top, then the multi-asset **screener table** with signal, strength, grade, success-rate, sparkline. Asset-row click → **Asset Detail Dialog** with candlestick chart + trade plan + evidence. Share button → **share card PNG**.

> Entry point: `src/pages/terminal.tsx` → `AssetSignalTable`.

---

## 📊 Market Pulse

Komponen: `src/features/market/components/market-summary-row.tsx` (`MarketSummaryRow`). Semua kartu memakai komposisi Nova `Card`/`CardFooter` yang sama: benchmark utama, sparkline, footer konteks, dan donut skor 0–100.

| Kartu | Benchmark utama | Rumus donut | Footer konteks |
|---|---|---|---|
| Kripto | BTC/USD | 100% arah teknikal BTC | BTC Dominance dari CoinGecko |
| Saham ID | IHSG | 70% teknikal IHSG + 30% kebalikan perubahan mingguan USD/IDR | volatilitas IHSG |
| Saham AS | S&P 500 | 70% teknikal S&P + 30% konteks VIX/DXY | CBOE Volatility Index |
| Komoditas | Gold (dibalik menjadi risk appetite) | 70% teknikal + 30% konteks VIX/DXY | Copper/Gold Ratio |
| Valas | USD/IDR (dibalik menjadi kekuatan rupiah) | 70% teknikal + 30% konteks VIX/DXY | US Dollar Index |

🇮🇩 BTC.D adalah persentase kapitalisasi pasar kripto yang dikuasai Bitcoin. Nilai naik berarti modal makin terkonsentrasi di BTC; turun berarti aset kripto lain mengambil porsi. Browser mengambil `/api/v3/global` dan `/api/v3/coins/markets` langsung memakai IP visitor. Delta 24 jam dihitung relatif dari market cap BTC dan total market yang direkonstruksi ke nilai 24 jam sebelumnya. Kalau payload Bitcoin gagal, nilai BTC.D tetap tampil tanpa delta; kalau snapshot global gagal, hanya footer kripto yang unavailable.

🇺🇸 BTC.D is Bitcoin's share of total crypto market capitalization. A rise means capital is concentrating in BTC; a fall means other crypto assets are gaining share. The browser calls `/api/v3/global` and `/api/v3/coins/markets` directly with the visitor's IP. The relative 24-hour delta is reconstructed from BTC and total-market caps. If the Bitcoin payload fails, BTC.D remains visible without a delta; if the global snapshot fails, only the crypto footer becomes unavailable.

> BTC Dominance is informative context only. It does not enter the crypto donut formula. The other four cards use the shared 70/30 combiner when both inputs exist and fall back to the available input when one is missing.

---

## 📋 Screener Tabel

Komponen: `src/features/market/components/asset-signal-table.tsx:90` (`AssetSignalTable`).

### Universe (`:132`)
| Tier | Universe |
|---|---|
| Premium | `useScreenerUniverse()` → `journal_assets` DB (single-source dengan cron) |
| Free | `DEFAULT_*` konstanta (`constants/assets.ts`) |
| Komoditas/Forex | selalu `DEFAULT_COMMODITY_TICKERS` / `DEFAULT_FOREX_TICKERS` (`:142-147`) |

### Data fetching (`:133-154`)
`useMarketData(...)` per kategori (crypto/usStock/idStock/commodities/forex/favorites), semua share query key `["asset-data",…]`. `usePublicJournalSuccessRates()` mengambil agregat `{symbol,wins,total}` lewat RPC publik tanpa membuka row jurnal mentah. `useSignalEpisodeStates()` membaca status dan snapshot dari `journal_signal_states`. Refresh menyegarkan data market, agregat keberhasilan, episode, dan cache jurnal.

`applySignalEpisode` memproyeksikan hasil enrichment menjadi model tampilan lokal: LONG/SHORT hanya untuk episode aktif dengan setup tersimpan yang valid. Kandidat belum tercatat dan arah lama diblokir sama-sama berlabel **Netral**, dengan penjelasan sesuai alasan internalnya. State gagal dibaca atau setup rusak → **Tidak tersedia** dan tindakan coba lagi di dialog. Tabel dan dialog memakai state serta hasil pembacaan yang sama. Episode dan jurnal dipoll 60 detik, serta dibaca ulang saat mount/focus.

### Top-down context (`:156-166`)
`useCryptoContext` (BTC), `useIdxContext` (IHSG+rapih), `useUsContext` (S&P+VIX+DXY) — subscribe cache shared, nyaris nol fetch ekstra.

### Optional detail data
🇮🇩 Smart money hanya diambil untuk aset pada dialog terbuka. Akumulasi dan relative strength juga hanya dihitung pada detail; tabel tidak menunggu API informasi tambahan.
🇺🇸 Smart money is fetched only for the asset in an open dialog. Accumulation and relative strength are also computed in detail; the table does not wait for these optional APIs.

### Enrichment (`:238-253`)
`enrichAsset(asset, { cryptoContext, idxContext, usContext }, { applyOptionalOverlays: false })` dari `src/core/engine/enrichment.ts:81`. Hanya **context de-rate** (BTC/IHSG/S&P) yang mengubah keputusan; smart-money, accumulation, relative strength, dan fundamentals display-only. `computeSignal` tetap pure per-aset. Lihat `fsd/02` & `tsd/06` untuk detail engine.

### Kolom tabel (`:316-553`)
TanStack Table, `pageSize 10` (`:553`):

| Kolom / Column | Isi / Content |
|---|---|
| Symbol + name | ticker + nama aset |
| Type | badge tipe aset (crypto/us-stock/id-stock/commodity/forex) |
| Price | harga live |
| Change % | `PercentageChange` warna |
| Volume | volume |
| Trend | `TrendIndicator` (bullish/bearish/sideways) |
| **Strength** | `StrengthBar` (default sort desc) |
| **Grade / Tier** | badge A/B/C + hint suppressed |
| **Success rate** | agregat all-time per-symbol dari RPC `get_public_journal_success_rates`; denominator hanya win+loss (impas dikecualikan), anon/free/premium melihat angka identik, jurnal mentah tetap premium |
| Signal | LONG/SHORT dari episode aktif; Netral ketika belum ada trade aktif; Tidak tersedia jika status/setup tidak dapat diverifikasi |
| Sparkline | `Sparkline` mini price line |

### Kontrol (`:589-703`)
- FilterGroup tipe aset (all/crypto/us-stock/id-stock/commodity/forex/favorite)
- FilterGroup sinyal (all/long/short/neutral)
- Search debounced 100ms
- **Favorites toggle** (premium-gated, `:640-651`)
- **Add-ticker** (premium-gated, `:686-694`) → `AddTickerDialog` (Yahoo search, `add-ticker-dialog.tsx:229`)
- Refresh

### Loading strategy (`:255-275`)
🇮🇩 Skeleton 10 baris setinggi data nyata menunggu universe, aset, benchmark, dan episode pada initial load. Refresh background mempertahankan tabel dan halaman sambil menampilkan indikator. Favorit tetap tersimpan jika API aset gagal.
🇺🇸 Ten skeleton rows match the loaded row height while initial universe, asset, benchmark, and episode queries settle. Background refresh retains rows and pagination with a refresh indicator. Asset API failures never remove saved favorites.

Pembacaan episode awal ikut loading tabel. Kegagalan episode tidak menghilangkan harga/analisis, tetapi menahan label LONG/SHORT. Success-rate adalah data sekunder: cell memakai skeleton berukuran tetap saat RPC masih pending, `Tidak tersedia` saat gagal, dan `Belum ada` hanya kalau simbol benar-benar belum punya trade tertutup.

### Table interaction
🇮🇩 Seluruh baris menjadi `DialogTrigger` dan dapat dibuka dengan klik, Enter, atau Space. ID baris memakai simbol. Layout, ukuran kontrol, dan perataan kolom mengikuti tampilan awal; input pencarian dan kontrol ikon tetap memiliki label aksesibel. Filter, pencarian, atau sorting kembali ke halaman pertama; hasil berkurang membatasi indeks halaman. Dialog controlled memakai state lokal, dan Radix menangani fokus, Escape, serta pengembalian fokus.
🇺🇸 The entire row is the dialog trigger, supporting clicks, Enter, and Space. The symbol is the stable row ID. Layout, control sizes, and column alignment match the original interface; search and icon controls retain accessible labels. Filters/search/sorting reset pagination; shrinking results clamp it. Controlled dialog state stays local, with Radix handling focus, Escape, and focus restoration.

`StrengthBar` / `SuccessRateBar`: CSS, tanpa animasi chart / no chart animations. `Sparkline`: SVG statis 30 close valid terakhir / static SVG of the latest 30 valid closes.

### Performance verification (2026-09-10)

🇮🇩 Baseline development memblokir main thread selama 3.563 ms saat pagination, dengan respons interaksi sekitar 3.680–3.720 ms. Sepuluh isi dialog tertutup tetap terpasang dan masing-masing menjalankan backtest sinkron. Setelah perubahan, pengukuran lokal memakai production preview, 201 aset, cache hangat, viewport 1440 × 1000, dan tanpa CPU throttling.

🇺🇸 The development baseline blocked the main thread for 3,563 ms during pagination, with interaction latency around 3,680–3,720 ms. Ten closed dialog bodies remained mounted, each running a synchronous backtest. Post-change measurements use a local production preview with 201 assets, a warm cache, a 1440 × 1000 viewport, and no CPU throttling.

| Interaction | Three samples / Tiga sampel | Median |
|---|---|---|
| Pagination | 17.2 / 18.0 / 19.0 ms | 18.0 ms |
| Sorting | 19.6 / 21.9 / 16.8 ms | 19.6 ms |
| Search / Pencarian | 118.0 / 122.9 / 119.6 ms | 119.6 ms |

🇮🇩 Latensi diukur hingga dua `requestAnimationFrame` setelah isi tabel berubah: sejak pointer/keyboard untuk pagination dan sorting, serta sejak input terakhir untuk pencarian (termasuk debounce 100 ms). Event Timing untuk klik mencatat 32–40 ms. Tidak ada long task >50 ms atau worker backtest selama ketiga interaksi tersebut. Perbandingan build berbeda ini bukan benchmark sebelum/sesudah dengan kondisi identik.

🇺🇸 Latency ends two `requestAnimationFrame` callbacks after table content changes. It starts at pointer/keyboard input for pagination and sorting, and at the final input event for search, including the 100 ms debounce. Click Event Timing records 32–40 ms. No task over 50 ms or backtest worker occurs during these interactions. Different build modes mean this is not a controlled before/after benchmark.

🇮🇩 Membuka detail BTC membuat satu worker, selesai dan dihentikan sekitar 398 ms; membuka ulang revisi candle yang sama memakai cache. Render awal dialog masih memiliki satu long task 108 ms untuk UI/chart. Pagination jurnal tercatat 27.6 ms, dan observer query candle detail kembali ke nol saat ditutup. Regresi otomatis memeriksa dialog tertutup, kesetaraan hasil worker dengan engine langsung, cache/pembatalan/error/retry, serta keputusan dan snapshot entry/TP/SL tanpa overlay opsional.

🇺🇸 Opening BTC detail creates one worker, which completes and terminates in about 398 ms; reopening the same candle revision reuses the cache. Initial dialog UI/chart rendering still has one 108 ms long task. Journal pagination measures 27.6 ms, and detail candle-query observers return to zero on close. Automated regressions cover closed dialogs, worker/direct-engine parity, cache/cancellation/error/retry, and unchanged decisions and entry/TP/SL snapshots without optional overlays.

🇮🇩 QA mencakup 375/768/1024/1440 px, tema terang/gelap, scroll horizontal tabel, filter/sort/pencarian, hasil kosong, pembatasan halaman, dan favorit ketika API gagal. Refresh nyata pada halaman 2 mempertahankan sepuluh baris tanpa skeleton sambil indikator berputar. Dialog market/jurnal mengembalikan fokus; chat dapat dibuka dengan Enter dan ditutup dengan Escape, lalu fokus kembali ke launcher. Launcher chat mobile tetap mengambang di atas navigasi bawah. Aturan CSS reduced motion diaktifkan secara paksa untuk memeriksa transisi, bukan emulasi preferensi OS; transisi panel menjadi `none` dan grafik kecil tabel tidak beranimasi. Hasil akhir: 402 tes, build, dan lint lulus. Build masih menampilkan peringatan ukuran chunk utama >500 kB yang sudah ada sebelumnya.

🇺🇸 QA covers 375/768/1024/1440 px, light/dark themes, horizontal table scrolling, filters/sorting/search, empty results, page clamping, and favorites during asset API failure. An actual refresh on page 2 keeps ten rows without skeletons while its indicator spins. Market/journal dialogs restore focus; chat opens with Enter, closes with Escape, and returns focus to its launcher. The mobile chat launcher floats above the bottom navigation. Reduced-motion CSS rules were forced on to inspect transitions, rather than emulating the OS preference; panel transitions become `none`, and table mini charts remain static. Final checks: 402 tests, build, and lint pass. The build retains the existing main-chunk size warning above 500 kB.

---

## 🔍 Asset Detail Dialog

Komponen: `src/features/trading-plan/components/asset-detail-dialog.tsx:92` (`AssetDetailDialog`).

🇮🇩 Dialog controlled memasang content hanya ketika dibuka dan melepasnya ketika ditutup. Query aset memakai cache screener; enrichment detail menambahkan overlay tanpa mengubah rumus sinyal. `useAssetBacktest` menjalankan `runBacktest` dalam satu native module Web Worker untuk candle, jenis aset, dan timeframe terpilih. React Query menyimpan `BacktestMetrics` pada `["asset-backtest", symbol, timeframe, dataUpdatedAt]`; cache baru hanya ketika revisi candle berubah. Worker dihentikan saat selesai, gagal, atau query kehilangan observer setelah dialog ditutup. Loading/error/retry statistik tidak menghalangi panel lain.

🇺🇸 Controlled dialogs mount content only while open. Asset queries reuse the screener cache; detail enrichment adds overlays without changing signal formulas. `useAssetBacktest` executes `runBacktest` in one native module Web Worker for the selected candles, asset type, and timeframe. React Query caches `BacktestMetrics` by `["asset-backtest", symbol, timeframe, dataUpdatedAt]`. A new candle revision gets new metrics; completion, failure, or losing the dialog observer terminates the worker. Statistics have independent loading/error/retry states.

### Section yang dirender
| Section | Isi |
|---|---|
| Price row + favorite toggle | harga live + toggle favorite |
| Meta badges | regime, trend, tier, risk |
| **Trading Plan** | `TradeSetupChart` dari snapshot episode aktif — entry, SL awal, TP, R:R tetap; harga dan evidence boleh berubah. SL aktif mengikuti milestone jurnal. |
| **Supporting evidence** | `CategoryScoreChart` (4 kategori), `WinRateRing` (calibrated + sample), fundamentals/analyst overlay, accumulation flow panel, relative-strength panel, smart-money positioning panel, market-context-vs-benchmark panel, indicator status grid |
| **Technical Indicators** | grid status per indikator |
| **Analysis** | narasi via `resolveAnalysisText` (i18n key) |
| Share button | `useShareSetup` → PNG |

---

## 📈 Trade Setup Chart

Komponen: `src/features/trading-plan/components/trade-setup-chart.tsx` (`TradeSetupChart`, 1082 baris).

🇮🇩 Chart candlestick **SVG buatan tangan** (tanpa lib charting). Viewport zoomable/pannable: wheel=zoom anchor cursor, drag=pan, double-click=reset, touch-tap=inspect. TradingView-style legend OHLC fix, zona profit/risk shading, level lines + pill `[KEY|price]` (entry/SL/TP1-3), marker entry/close (panah in-range + chevron out-of-range), crosshair dengan pill harga/waktu, watermark brand, panel R:R numerik. Geometri dari `buildTradeSetupModel` (`lib/trade-setup-model.ts:231`).

🇺🇸 Hand-rolled **SVG candlestick chart** (no charting lib). Zoomable/pannable viewport: wheel=zoom anchored on cursor, drag=pan, double-click=reset, touch-tap=inspect. TradingView-style fixed OHLC legend, profit/risk zone shading, level lines + `[KEY|price]` pills, entry/close markers, crosshair with price/time pills, brand watermark, numeric R:R panel. Geometry from `buildTradeSetupModel` (`lib/trade-setup-model.ts:231`).

---

## 🖼️ Share Card

File: `src/features/trading-plan/model/share-card.ts:666` (`buildShareCardSvg`), hook `src/features/trading-plan/hooks/use-share-setup.ts:118` (`useShareSetup`).

🇮🇩 Generator SVG/PNG brandable 1200×1040: logo+halo, symbol+name, pill status/grade/direction, legend OHLC, chart candlestick watermark + zona + level + marker, statistik R:R/RISK/REWARD, footer disclaimer. Theme-aware (resolve CSS var → hex, dark/light). `svgToPngBlob` (rasterize 2×), `shareOrDownloadPng` (Web Share API → download fallback). Hook `useShareSetup` orchestrate build-model → build-SVG → PNG → share/download + toast.

🇺🇸 Brandable 1200×1040 SVG/PNG generator: logo+halo, symbol+name, status/grade/direction pills, OHLC legend, watermarked candlestick chart with zones+levels+markers, R:R/RISK/REWARD stats, disclaimer footer. Theme-aware (resolves CSS vars to hex, dark/light). `svgToPngBlob` (2× rasterize), `shareOrDownloadPng` (Web Share API → download fallback). Hook `useShareSetup` orchestrates build-model → build-SVG → PNG → share/download + toast.

---

## 🔗 Terkait / Related
- [`../explainer/trading-methodology.md`](../explainer/trading-methodology.md) — kontrak publikasi dan contoh perjalanan trade
- [`02-trading-engine.md`](02-trading-engine.md) — detail engine sinyal & enrichment
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — formula mendalam
- [`../tsd/02-data-flow.md`](../tsd/02-data-flow.md) — flow data market
- [`00-overview.md`](00-overview.md) — ikhtisar
