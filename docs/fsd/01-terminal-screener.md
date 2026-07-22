# FSD 01 — Terminal: Screener & Asset Detail

> 🇮🇩 Halaman terminal market view: kartu Market Pulse + tabel sinyal + dialog detail aset + share card.
> 🇺🇸 The terminal market view: Market Pulse cards + signal table + asset detail dialog + share card.

---

## TL;DR

🇮🇩 Halaman `/terminal` (default) nampilin lima kartu **Market Pulse** di atas, terus **screener tabel** aset multi-kelas dengan sinyal, strength, grade, success-rate, sparkline. Klik baris → **Asset Detail Dialog** dengan chart candlestick + rencana trading + evidence. Tombol Share → **share card PNG**.

🇺🇸 The `/terminal` page (default) shows five **Market Pulse** cards on top, then the multi-asset **screener table** with signal, strength, grade, success-rate, sparkline. Row click → **Asset Detail Dialog** with candlestick chart + trade plan + evidence. Share button → **share card PNG**.

> Entry point: `src/pages/terminal/index.tsx:25` → market view at `:122-133`.

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
`useMarketData(...)` per kategori (crypto/usStock/idStock/commodities/forex/favorites), semua share query key `["asset-data",…]`. `usePublicJournalSuccessRates()` mengambil agregat `{symbol,wins,total}` lewat RPC publik tanpa membuka row jurnal mentah. Tombol refresh meng-invalidasi kedua query family sekaligus.

### Top-down context (`:156-166`)
`useCryptoContext` (BTC), `useIdxContext` (IHSG+rapih), `useUsContext` (S&P+VIX+DXY) — subscribe cache shared, nyaris nol fetch ekstra.

### Smart money (`:223-236`)
`useSmartMoney(cryptoForSmartMoney)` — cuman untuk crypto dengan sinyal **non-neutral actionable** (jaga Binance call tetap bounded). Positioning (funding/OI/long-short) → `derivePositioning`.

### Enrichment (`:238-253`)
`enrichAsset(asset, { cryptoContext, idxContext, usContext, smartMoney })` dari `src/features/engine/enrichment.ts:81`. Rantai: **context de-rate** (BTC/IHSG/S&P) → **flow nudge** (smart-money crypto / accumulation equity). `computeSignal` tetap pure per-aset. Lihat `fsd/02` & `tsd/06` untuk detail engine.

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
| **Success rate** | agregat all-time per-symbol dari RPC `get_public_journal_success_rates`; anon/free/premium melihat angka identik, jurnal mentah tetap premium |
| Signal | badge LONG/SHORT/NEUTRAL |
| Sparkline | `Sparkline` mini price line |

### Kontrol (`:589-703`)
- FilterGroup tipe aset (all/crypto/us-stock/id-stock/commodity/forex/favorite)
- FilterGroup sinyal (all/long/short/neutral)
- Search debounced 300ms
- **Favorites toggle** (premium-gated, `:640-651`)
- **Add-ticker** (premium-gated, `:686-694`) → `AddTickerDialog` (Yahoo search, `add-ticker-dialog.tsx:229`)
- Refresh

### Loading strategy (`:255-275`)
Skeleton ditahan sampai **semua** sumber (aset dasar + BTC context + smart-money) selesai `isLoading`/`isPending` awal, jadi tabel muncul ter-sort sekaligus (tanpa per-kategori flash). Background refetch update nilai in-place.

Success-rate adalah data sekunder: cell memakai skeleton berukuran tetap saat RPC masih pending, `Tidak tersedia` saat gagal, dan `Belum ada` hanya kalau simbol benar-benar belum punya trade tertutup.

### Row click (`:766`)
Setiap row menjadi `DialogTrigger` untuk `AssetDetailDialog` miliknya. Tidak ada query parameter URL atau visibility state global; Radix menangani buka, tutup, fokus, Escape, dan restore-focus.

---

## 🔍 Asset Detail Dialog

Komponen: `src/features/trading-plan/components/asset-detail-dialog.tsx:92` (`AssetDetailDialog`).

🇮🇩 Dialog analisis per-aset dibuka oleh `DialogTrigger` pada row. Content baru mount setelah dibuka, lalu re-fetch aset + re-jalanin **enrichment chain yang sama** dengan screener (jaga conviction/tier konsisten). Selain itu jalanin `runBacktest` + `calibrateConfidence` buat win-rate historis yang jujur.

🇺🇸 The per-asset analysis dialog is opened by the row's `DialogTrigger`. Its content mounts only when opened, then re-fetches the asset and re-runs the **same enrichment chain** as the screener. It also runs `runBacktest` + `calibrateConfidence` for an honest historical win-rate.

### Section yang dirender
| Section | Isi |
|---|---|
| Price row + favorite toggle | harga live + toggle favorite |
| Meta badges | regime, trend, tier, risk |
| **Trading Plan** | `TradeSetupChart` — entry/SL/TP1-3, zona profit/risk |
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

File: `src/features/trading-plan/lib/share-card.ts:666` (`buildShareCardSvg`), hook `src/features/trading-plan/hooks/use-share-setup.ts:118` (`useShareSetup`).

🇮🇩 Generator SVG/PNG brandable 1200×1040: logo+halo, symbol+name, pill status/grade/direction, legend OHLC, chart candlestick watermark + zona + level + marker, statistik R:R/RISK/REWARD, footer disclaimer. Theme-aware (resolve CSS var → hex, dark/light). `svgToPngBlob` (rasterize 2×), `shareOrDownloadPng` (Web Share API → download fallback). Hook `useShareSetup` orchestrate build-model → build-SVG → PNG → share/download + toast.

🇺🇸 Brandable 1200×1040 SVG/PNG generator: logo+halo, symbol+name, status/grade/direction pills, OHLC legend, watermarked candlestick chart with zones+levels+markers, R:R/RISK/REWARD stats, disclaimer footer. Theme-aware (resolves CSS vars to hex, dark/light). `svgToPngBlob` (2× rasterize), `shareOrDownloadPng` (Web Share API → download fallback). Hook `useShareSetup` orchestrates build-model → build-SVG → PNG → share/download + toast.

---

## 🔗 Terkait / Related
- [`02-trading-engine.md`](02-trading-engine.md) — detail engine sinyal & enrichment
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — formula mendalam
- [`../tsd/02-data-flow.md`](../tsd/02-data-flow.md) — flow data market
- [`00-overview.md`](00-overview.md) — ikhtisar
