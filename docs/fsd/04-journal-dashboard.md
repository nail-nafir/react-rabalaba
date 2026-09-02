# FSD 04 — Journal Dashboard

> 🇮🇩 Statistik jurnal premium: performa sinyal, outcome donut, performa per tipe aset, top performers, tabel transaksi.
> 🇺🇸 Premium journal statistics: signal performance, outcome donut, per-asset-type performance, top performers, transactions table.

---

## TL;DR

🇮🇩 View `/terminal/journal` (premium-gated, soft redirect + license dialog kalau non-premium). Baca `journal_trades` (RLS `is_premium()`, read-only; cron satu-satunya penulis). Tiga kartu recharts + top performers + tabel transaksi. Timeframe filter 1D/1W/1M/ALL. Semua statistik dari `buildTrackerStats` + `computePnl` (pure, shared dengan cron).

🇺🇸 The `/terminal/journal` view (premium-gated, soft redirect + license dialog if non-premium). Reads `journal_trades` (RLS `is_premium()`, read-only; cron is the only writer). Three recharts cards + top performers + transactions table. Timeframe filter 1D/1W/1M/ALL. All stats from `buildTrackerStats` + `computePnl` (pure, shared with cron).

> Entry: `src/pages/terminal/index.tsx:134-152`. Hook: `src/features/journal/hooks/use-journal-trades.ts:14`.

---

## 📊 Tiga kartu / Three cards

Komponen: `src/features/journal/components/journal-dashboard.tsx` (`JournalDashboard`).

### 1. Acuan Kinerja / Performance Benchmark

`ComposedChart`: laba/rugi dan kumulatif jurnal dalam persen, dibandingkan dengan return Bitcoin (`BTC-USD`) dan Gold (`GC=F`) yang dinormalisasi dari awal timeframe terpilih. Persen jurnal adalah penjumlahan aritmetis return tiap sinyal yang sudah ditutup, sesuai arah LONG/SHORT.

Ini **bukan portfolio return** karena jurnal tidak menyimpan notional, sizing, cash, atau overlap posisi. BTC dan Gold hanya benchmark pembanding, bukan aset yang diasumsikan dimiliki pengguna.

### 2. Outcome Distribution

Donut: SL / impas / Take Profit / reversal profit / reversal loss. Protected stop yang merealisasikan profit masuk Take Profit; gap negatif masuk SL; penyebab exit exact tetap tersimpan untuk audit. Pattern hatched buat reversal. Center: win-rate `wins / (wins + losses)`; trade impas ditampilkan tetapi tidak masuk denominator.

### 3. Per Asset-Type Performance

Bar total persen sinyal per tipe aset + jumlah/porsi transaksi. Nilainya adalah penjumlahan return tiap sinyal, bukan return portfolio berbobot modal.

> Empty state kalau `stats.closed === 0`.

---

## 🏆 Top Performers

File: `src/features/journal/components/top-performers.tsx:375` (`TopPerformers`). Top-3 gainer + top-3 loser (1D/1W/1M/ALL), agregat per period. Row click → `TradeDetailDialog`.

---

## 📋 Tabel Transaksi / Transactions

File: `src/features/follow-trade/components/follow-history-table.tsx:786` (`FollowHistoryTable`). TanStack Table over `useJournalTrades` (open + closed).

| Kolom / Column | Isi / Content |
|---|---|
| Entry/close date | timestamp |
| Symbol | ticker |
| Type | badge tipe aset |
| Entry/live/close price | harga |
| Strength | bar |
| Grade | badge A/B/C |
| Success-rate | bar historis |
| Signal | LONG/SHORT/NEUTRAL |
| P&L | % + R + hasil ringkas (`TP n/total`, `BE`, `SL`, atau `Reversal`) via `deriveFollowProgress` |
| Lifecycle badge | RUNNING/CLOSED, terpisah dari hasil trade |

Filter: aset, direction, lifecycle (open/closed), PnL/outcome (tp/sl/breakeven/reversal_profit/reversal_loss — mirror donut). Live price via `useMarketData(openSymbols)` di refs (jaga column def memoized). Row click → `TradeDetailDialog`.

---

## 🔍 Trade Detail Dialog

File: `src/features/follow-trade/components/trade-detail-dialog.tsx:375` (`TradeDetailDialog`).

🇮🇩 View per-trade. Reconstruct `TradingPlan` dari level tersimpan (`buildPlanFromTrade`, tampilkan setup *as-followed* bukan sinyal live). Trade open hanya menampilkan `TP n/total`; trade closed menampilkan hasil yang diamankan dari harga tutup aktual + “Sempat TPn” sebagai perjalanan sekunder. `TradeSetupChart` menampilkan marker entry/close dan tombol share.

🇺🇸 Per-trade view. Reconstructs the saved plan; open trades show only `TP n/total`, while closed trades show the result secured by the actual close plus the highest TP reached as secondary journey context.

---

## 🧮 Statistik (pure, shared dengan cron)

File: `src/core/trade/follow-trade-model.ts:396` (`buildTrackerStats`).

| Fungsi / Function | Output |
|---|---|
| `computePnl(trade, price)` (`:166`) | `{pct, r}` direction-aware |
| `evaluateFollow(trade, price, candles)` | replay candle stop-first; TP1→stop entry, TP2→stop TP1; final close bisa mengonfirmasi stop yang baru naik; gap fill di open aktual |
| `applyPriceSync(openTrades, prices, candlesBySymbol)` | partisi open/closed + milestone yang harus dipersist |
| `deriveFollowProgress` | milestone tertinggi + TP yang benar-benar diamankan dari close aktual + alasan exit exact/fallback historis |
| `buildTrackerStats(history, openCount)` (`:396`) | equity/daily series, status distribution, per-asset, asset-type, long-vs-short, win/loss/impas, by-grade; impas keluar dari denominator win-rate |

> Mapper DB↔frontend: `src/core/trade/journal-mapper.ts` — pure, dipake app + cron.

---

## 🔗 Terkait / Related
- [`03-auto-journal.md`](03-auto-journal.md) — sumber data jurnal
- [`01-terminal-screener.md`](01-terminal-screener.md) — trade plan chart
- [`06-auth-entitlement.md`](06-auth-entitlement.md) — gating premium
- [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md) — `journal_trades` schema
