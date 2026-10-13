# FSD 04 — Journal Dashboard / Journal Dashboard

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Statistik Premium, Outcome Donut, Top Performer, Tabel Transaksi

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Jurnal adalah tab Jurnal di /terminal/journal khusus premium; non premium melihat kartu Premium Terkunci plus dialog lisensi. Tab Pasar ada di /terminal dan /terminal/market (FSD 01). Urutan: tiga kartu recharts plus top performer, lalu tabel transaksi. Sentimen Pasar (MarketSummaryRow) hanya ada di tab Pasar. Baca journal_trades via RLS is_premium, read-only; cron satu-satunya penulis.

Filter timeframe 1H/1M/1B/Semua mengikuti kalender WIB dan periode jurnal (`journal-performance.ts › journalWindow`, di atas `recapWindow`): 1H = hari ini (sumbu 00:00 sampai 24:00), 1M = minggu ini Senin sampai Minggu, 1B = bulan ini dari tanggal 1 sampai akhir bulan, Semua = awal periode sampai sekarang. Data tidak pernah dimulai sebelum awal periode, jadi minggu yang dimulai di bulan lalu digambar dari tanggal 1, dan jam atau hari yang belum tiba dibiarkan kosong. Chart acuan, statistik, donut hasil transaksi, kinerja per kategori, dan Performa Aset memakai rentang data yang sama. Semua statistik dari `follow-trade-model.ts › buildTrackerStats` plus `follow-trade-model.ts › computePnl` yang pure dan shared dengan cron. Empty state bila stats.closed nol.

## 🇮🇩 Tiga Kartu

Komponen memakai `journal-dashboard.tsx › JournalDashboard`. Benchmark pembanding BTC-USD dan Gold GC=F dinormalisasi dari harga pertama di rentang data timeframe terpilih, dan kosong di luar rentang itu. Persen jurnal penjumlahan aritmetis return tiap sinyal tertutup sesuai arah LONG/SHORT. Ini bukan portfolio return karena tanpa notional, sizing, cash, atau overlap posisi.

| Kartu | Isi |
|---|---|
| Benchmark | Laba/rugi plus kumulatif vs BTC dan Gold |
| Outcome | Donut SL/impas/TP/reversal profit/reversal loss |
| Tipe aset | Bar total persen sinyal per tipe plus porsi transaksi |

Donut: protected stop profit masuk Take Profit; gap negatif masuk SL; penyebab exit exact tersimpan untuk audit. Pattern hatched untuk reversal. Center win-rate wins dibagi wins plus losses; impas tampil tetapi keluar denominator. BTC dan Gold hanya benchmark pembanding, bukan aset asumsi milik akun.

## 🇮🇩 Top Performer dan Tabel

File top memakai `top-performers.tsx › TopPerformers`. Top-3 gainer plus top-3 loser per tab 1H/1M/1B/Semua; tabnya terpisah dari Statistik Jurnal tetapi rentangnya identik (`journalWindow`). Symbol button membuka TradeDetailDialog.

| Kolom | Isi |
|---|---|
| Tanggal | Timestamp entry/close |
| Simbol | Ticker plus badge tipe |
| Harga | Entry/live/close plus strength/grade |

Tabel memakai `follow-history-table.tsx › FollowHistoryTable` TanStack Table over useJournalTrades open plus closed. Kolom P&L persen plus R plus hasil ringkas TP n/total, BE, SL, atau Reversal via deriveFollowProgress. Lifecycle badge RUNNING/CLOSED terpisah dari hasil trade. Filter aset, direction, lifecycle open/closed, PnL/outcome tp/sl/breakeven/reversal_profit/reversal_loss mirror donut. Keduanya premium; non premium membuka dialog lisensi. Live price via useMarketData openSymbols di refs dengan column def memoized.

## 🇮🇩 Dialog dan Statistik

View per-trade me-reconstruct TradingPlan dari level tersimpan via buildPlanFromTrade. Setup as-followed tampil, bukan sinyal live. Trade open hanya tampil TP n/total; trade closed tampil TP yang diamankan, yaitu nilai terbesar dari TP yang dilewati harga tutup dan leg scale-out engine v7 yang sudah dijual, plus Sempat TPn hanya bila TP tertinggi yang disentuh lebih tinggi dari yang diamankan (trade v7 menjual leg di tiap TP, jadi badge ini praktis hanya muncul di trade lama, sejalan dengan PARTIAL di Discord). TradeSetupChart tampil marker entry/close plus tombol share; label marker close menulis cara keluar posisi lewat `follow-outcome.ts › closeMarkerLabel`: SL, SL ENTRY, SL TPn (stop yang sudah dinaikkan), TPn, REVERSAL, atau DITUTUP bila alasannya tidak tersimpan. Contoh: trade v7 yang mengamankan TP1 dan TP2 lalu sisa 20% kena stop di TP1 tampil `TP 2/3` di header dan `SL TP1` di garis TP1. Dialog jurnal hanya menampilkan setup dan chart trade itu; analisis aset terkini dibuka dari baris aset pada tab Pasar.

| Fungsi | Output |
|---|---|
| computePnl | Pct plus r direction-aware |
| evaluateFollow | Replay candle stop-first plus gap fill open aktual |
| buildTrackerStats | Equity/daily, distribusi, per-aset, long-vs-short, by-grade |

Mapper DB-frontend memakai `journal-mapper.ts` yang pure untuk app plus cron. applyPriceSync partisi open/closed plus milestone persist. deriveFollowProgress menulis milestone tertinggi plus TP aman dari close aktual plus alasan exit exact/fallback historis. Impas keluar denominator win-rate.

ID baris memakai UUID trade. Klik baris, Enter/Space, dan tombol Performa Aset menulis `?trade=<id>` ke URL lewat `use-dialog-param.ts › useDialogParam`; satu dialog controlled di tab Jurnal membaca URL itu, jadi tautan bisa dibagikan dan tombol Back browser menutup dialog. Trade di luar periode yang dimuat diambil per ID lewat `use-journal-trades.ts › useJournalTrade` (RLS tetap berlaku); ID tidak valid, di luar akses, atau terhapus memunculkan toast lalu param dihapus. Perpindahan Pasar/Jurnal memakai switch halaman; tautan langsung `?symbol=` dan `?trade=` tetap didukung. Loading bar atas hanya untuk pindah halaman; dialog yang dibuka lewat URL menampilkan status memuat di dalamnya (`role="status"`). Query candle, normalisasi, dan analisis detail dipasang saat terbuka, lalu dilepas saat tutup. Snapshot entry/TP/SL tetap dari trade tersimpan. Refresh pertahankan halaman; filter/search/sort kembali ke halaman pertama dan indeks dibatasi saat hasil berkurang. Skeleton awal 10 baris; refresh tidak mengganti data tersedia.

## 🇮🇩 Tautan Terkait

- Auto-journal: docs/01-functional-specs/03-auto-journal.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Skema: docs/02-technical-specs/03-database-schema.md
- Testing: docs/03-testing/

---

<a id="english-part"></a>

## 🇺🇸 Summary

The journal is the Journal tab at /terminal/journal, premium only; non-premium sees the Premium Locked card plus license dialog. The Market tab lives at /terminal and /terminal/market (FSD 01). Order: three recharts cards plus top performers, then the transaction table. Market Sentiment (MarketSummaryRow) lives only in the Market tab. Reads journal_trades via is_premium RLS, read-only; cron remains sole writer.

The 1H/1M/1B/All timeframe tabs follow the WIB calendar and the journal period (`journal-performance.ts › journalWindow`, built on `recapWindow`): 1H is today (00:00 to 24:00 axis), 1M is this Monday-to-Sunday week, 1B is this month from the 1st to its last day, All runs from the period start until now. Data never starts before the period start, so a week that began last month is drawn from the 1st, and hours or days not reached yet stay empty. The benchmark chart, stats, outcome donut, category bars and Asset Performance share the same data span. All statistics come from `follow-trade-model.ts › buildTrackerStats` plus `follow-trade-model.ts › computePnl` pure and shared with cron. Empty state when stats.closed hits zero.

## 🇺🇸 Three Cards

Component uses `journal-dashboard.tsx › JournalDashboard`. Comparison benchmarks BTC-USD plus Gold GC=F normalize from their first close inside the selected timeframe's data span and stay empty outside it. Journal percent sums arithmetic returns of closed signals per LONG/SHORT direction. This remains not portfolio return without notional, sizing, cash, or position overlap.

| Card | Content |
|---|---|
| Benchmark | Profit/loss plus cumulative vs BTC plus Gold |
| Outcome | Donut SL/breakeven/TP/reversal profit/reversal loss |
| Asset type | Bar totals per type plus transaction share |

Donut: protected-stop profit enters Take Profit; negative gaps enter SL; exact exit causes persist for audit. Hatched pattern marks reversal. Center win-rate equals wins divided at wins plus losses; breakeven shows but leaves denominator. BTC plus Gold serve only as comparison benchmarks, not assumed account holdings.

## 🇺🇸 Top Performers and Table

Top file uses `top-performers.tsx › TopPerformers`. Top-3 gainers plus top-3 losers per 1H/1M/1B/All tab; the tabs are separate from Journal Statistics but resolve to the identical span (`journalWindow`). Symbol buttons open TradeDetailDialog.

| Column | Content |
|---|---|
| Date | Entry/close timestamps |
| Symbol | Ticker plus type badge |
| Price | Entry/live/close plus strength/grade |

Table uses `follow-history-table.tsx › FollowHistoryTable` TanStack Table over useJournalTrades open plus closed. P&L column shows percent plus R plus concise TP n/total, BE, SL, or Reversal via deriveFollowProgress. RUNNING/CLOSED lifecycle badge stays separate from trade result. Filters span asset, direction, lifecycle open/closed, PnL/outcome tp/sl/breakeven/reversal_profit/reversal_loss mirroring donut. Both are premium; non-premium opens the license dialog. Live prices via useMarketData openSymbols in refs with memoized column defs.

## 🇺🇸 Dialog and Statistics

Per-trade view reconstructs TradingPlan from saved levels via buildPlanFromTrade. As-followed setup shows, not live signals. Open trades show TP n/total only; closed trades show the secured TP, the higher of the TPs passed by the close price and the engine-v7 scale-out legs already sold, plus Reached TPn only when the highest TP touched beats the secured one (v7 sells a leg at every TP, so the badge in practice only appears on older trades, matching PARTIAL in Discord). TradeSetupChart shows entry/close markers plus share button; the close marker label names how the position left through `follow-outcome.ts › closeMarkerLabel`: SL, SL ENTRY, SL TPn (the raised stop), TPn, REVERSAL, or CLOSED when no reason is stored. Example: a v7 trade that secured TP1 and TP2 before the last 20% stopped at TP1 reads `TP 2/3` in the header and `SL TP1` on the TP1 line. The journal dialog shows only that trade's setup and chart; current asset analysis opens from the asset row in the Market tab.

| Function | Output |
|---|---|
| computePnl | Pct plus r direction-aware |
| evaluateFollow | Stop-first candle replay plus actual-open gap fill |
| buildTrackerStats | Equity/daily, distribution, per-asset, long-vs-short, by-grade |

DB-frontend mapper uses `journal-mapper.ts` pure for app plus cron. applyPriceSync partitions open/closed plus persist milestones. deriveFollowProgress writes peak milestone plus secured TP from actual close plus exact/historical fallback exit reasons. Breakeven leaves win-rate denominator.

Row IDs use trade UUIDs. Row clicks, Enter/Space and the Asset Performance buttons write `?trade=<id>` to the URL through `use-dialog-param.ts › useDialogParam`; one controlled dialog in the Journal tab reads it, so the link can be shared and the browser Back button closes the dialog. A trade outside the loaded period is fetched by ID through `use-journal-trades.ts › useJournalTrade` (RLS still applies); an invalid, out-of-access or deleted ID shows a toast and drops the param. Navigation between Market and Journal uses the page switch; direct `?symbol=` and `?trade=` links remain supported. The top loading bar is for page changes only; a dialog opened from the URL shows its loading status inside (`role="status"`). Candle queries, normalization, plus detail analysis mount while open, then unmount at close. Entry/TP/SL snapshots stay from saved trades. Refresh retains page; filter/search/sort reset to first page and clamp index as results shrink. Initial skeleton holds ten rows; refresh preserves available data.

## 🇺🇸 Related Links

- Auto-journal: docs/01-functional-specs/03-auto-journal.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Schema: docs/02-technical-specs/03-database-schema.md
- Testing: docs/03-testing/
