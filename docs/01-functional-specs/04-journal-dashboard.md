# FSD 04 — Journal Dashboard / Journal Dashboard

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Statistik Premium, Outcome Donut, Top Performer, Tabel Transaksi

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

View /terminal/journal premium-gated dengan soft redirect plus license dialog bila non-premium. Baca journal_trades via RLS is_premium, read-only; cron satu-satunya penulis. Tiga kartu recharts plus top performer plus tabel transaksi tampil di bawah. Alur gas dari equity curve sampai tabel terasa premium.

Filter timeframe 1D/1W/1M/ALL tersedia. Semua statistik dari `follow-trade-model.ts › buildTrackerStats` plus `follow-trade-model.ts › computePnl` yang pure dan shared dengan cron. Empty state bila stats.closed nol.

## 🇮🇩 Tiga Kartu

Komponen memakai `journal-dashboard.tsx › JournalDashboard`. Benchmark pembanding BTC-USD dan Gold GC=F dinormalisasi dari awal timeframe terpilih. Persen jurnal penjumlahan aritmetis return tiap sinyal tertutup sesuai arah LONG/SHORT. Ini bukan portfolio return karena tanpa notional, sizing, cash, atau overlap posisi.

| Kartu | Isi |
|---|---|
| Benchmark | Laba/rugi plus kumulatif vs BTC dan Gold |
| Outcome | Donut SL/impas/TP/reversal profit/reversal loss |
| Tipe aset | Bar total persen sinyal per tipe plus porsi transaksi |

Donut: protected stop profit masuk Take Profit; gap negatif masuk SL; penyebab exit exact tersimpan untuk audit. Pattern hatched untuk reversal. Center win-rate wins dibagi wins plus losses; impas tampil tetapi keluar denominator. BTC dan Gold hanya benchmark pembanding, bukan aset asumsi milik akun.

## 🇮🇩 Top Performer dan Tabel

File top memakai `top-performers.tsx › TopPerformers`. Top-3 gainer plus top-3 loser per 1D/1W/1M/ALL, agregat per period. Symbol button membuka TradeDetailDialog.

| Kolom | Isi |
|---|---|
| Tanggal | Timestamp entry/close |
| Simbol | Ticker plus badge tipe |
| Harga | Entry/live/close plus strength/grade |

Tabel memakai `follow-history-table.tsx › FollowHistoryTable` TanStack Table over useJournalTrades open plus closed. Kolom P&L persen plus R plus hasil ringkas TP n/total, BE, SL, atau Reversal via deriveFollowProgress. Lifecycle badge RUNNING/CLOSED terpisah dari hasil trade. Filter aset, direction, lifecycle open/closed, PnL/outcome tp/sl/breakeven/reversal_profit/reversal_loss mirror donut. Live price via useMarketData openSymbols di refs dengan column def memoized.

## 🇮🇩 Dialog dan Statistik

View per-trade me-reconstruct TradingPlan dari level tersimpan via buildPlanFromTrade. Setup as-followed tampil, bukan sinyal live. Trade open hanya tampil TP n/total; trade closed tampil hasil aman dari close aktual plus Sempat TPn sebagai perjalanan sekunder. TradeSetupChart tampil marker entry/close plus tombol share.

| Fungsi | Output |
|---|---|
| computePnl | Pct plus r direction-aware |
| evaluateFollow | Replay candle stop-first plus gap fill open aktual |
| buildTrackerStats | Equity/daily, distribusi, per-aset, long-vs-short, by-grade |

Mapper DB-frontend memakai `journal-mapper.ts` yang pure untuk app plus cron. applyPriceSync partisi open/closed plus milestone persist. deriveFollowProgress menulis milestone tertinggi plus TP aman dari close aktual plus alasan exit exact/fallback historis. Impas keluar denominator win-rate.

ID baris memakai UUID trade. Klik baris, Enter, atau Space membuka dialog controlled. Query candle, normalisasi, dan analisis detail dipasang saat terbuka, lalu dilepas saat tutup. Snapshot entry/TP/SL tetap dari trade tersimpan. Refresh pertahankan halaman; filter/search/sort kembali ke halaman pertama dan indeks dibatasi saat hasil berkurang. Skeleton awal 10 baris; refresh tidak mengganti data tersedia.

## 🇮🇩 Tautan Terkait

- Auto-journal: docs/01-functional-specs/03-auto-journal.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Skema: docs/02-technical-specs/03-database-schema.md
- Testing: docs/03-testing/

---

<a id="english-part"></a>

## 🇺🇸 Summary

The /terminal/journal view remains premium-gated with soft redirect plus license dialog when non-premium. Reads journal_trades via is_premium RLS, read-only; cron remains sole writer. Three recharts cards plus top performers plus transaction table appear below. Deep-dive flow from equity curve to table feels premium.

Timeframe filter 1D/1W/1M/ALL remains available. All statistics come from `follow-trade-model.ts › buildTrackerStats` plus `follow-trade-model.ts › computePnl` pure and shared with cron. Empty state when stats.closed hits zero.

## 🇺🇸 Three Cards

Component uses `journal-dashboard.tsx › JournalDashboard`. Comparison benchmarks BTC-USD plus Gold GC=F normalize from selected timeframe start. Journal percent sums arithmetic returns of closed signals per LONG/SHORT direction. This remains not portfolio return without notional, sizing, cash, or position overlap.

| Card | Content |
|---|---|
| Benchmark | Profit/loss plus cumulative vs BTC plus Gold |
| Outcome | Donut SL/breakeven/TP/reversal profit/reversal loss |
| Asset type | Bar totals per type plus transaction share |

Donut: protected-stop profit enters Take Profit; negative gaps enter SL; exact exit causes persist for audit. Hatched pattern marks reversal. Center win-rate equals wins divided at wins plus losses; breakeven shows but leaves denominator. BTC plus Gold serve only as comparison benchmarks, not assumed account holdings.

## 🇺🇸 Top Performers and Table

Top file uses `top-performers.tsx › TopPerformers`. Top-3 gainers plus top-3 losers per 1D/1W/1M/ALL, aggregated per period. Symbol buttons open TradeDetailDialog.

| Column | Content |
|---|---|
| Date | Entry/close timestamps |
| Symbol | Ticker plus type badge |
| Price | Entry/live/close plus strength/grade |

Table uses `follow-history-table.tsx › FollowHistoryTable` TanStack Table over useJournalTrades open plus closed. P&L column shows percent plus R plus concise TP n/total, BE, SL, or Reversal via deriveFollowProgress. RUNNING/CLOSED lifecycle badge stays separate from trade result. Filters span asset, direction, lifecycle open/closed, PnL/outcome tp/sl/breakeven/reversal_profit/reversal_loss mirroring donut. Live prices via useMarketData openSymbols in refs with memoized column defs.

## 🇺🇸 Dialog and Statistics

Per-trade view reconstructs TradingPlan from saved levels via buildPlanFromTrade. As-followed setup shows, not live signals. Open trades show TP n/total only; closed trades show secured result from actual close plus peak TPn as secondary journey. TradeSetupChart shows entry/close markers plus share button.

| Function | Output |
|---|---|
| computePnl | Pct plus r direction-aware |
| evaluateFollow | Stop-first candle replay plus actual-open gap fill |
| buildTrackerStats | Equity/daily, distribution, per-asset, long-vs-short, by-grade |

DB-frontend mapper uses `journal-mapper.ts` pure for app plus cron. applyPriceSync partitions open/closed plus persist milestones. deriveFollowProgress writes peak milestone plus secured TP from actual close plus exact/historical fallback exit reasons. Breakeven leaves win-rate denominator.

Row IDs use trade UUIDs. Row click, Enter, or Space opens controlled dialog. Candle queries, normalization, plus detail analysis mount while open, then unmount at close. Entry/TP/SL snapshots stay from saved trades. Refresh retains page; filter/search/sort reset to first page and clamp index as results shrink. Initial skeleton holds ten rows; refresh preserves available data.

## 🇺🇸 Related Links

- Auto-journal: docs/01-functional-specs/03-auto-journal.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Schema: docs/02-technical-specs/03-database-schema.md
- Testing: docs/03-testing/
