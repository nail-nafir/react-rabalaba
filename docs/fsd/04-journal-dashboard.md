# FSD 04 — Journal Dashboard

> 🇮🇩 Statistik jurnal premium: kurva realized R, outcome donut, performa per tipe aset, top performers, tabel transaksi.
> 🇺🇸 Premium journal statistics: realized-R curve, outcome donut, per-asset-type performance, top performers, transactions table.

---

## TL;DR

🇮🇩 View `/terminal/journal` (premium-gated, soft redirect + license dialog kalau non-premium). Baca `journal_trades` (RLS `is_premium()`, read-only; cron satu-satunya penulis). Tiga kartu recharts + top performers + tabel transaksi. Timeframe filter 1D/1W/1M/ALL. Semua statistik dari `buildTrackerStats` + `computePnl` (pure, shared dengan cron).

🇺🇸 The `/terminal/journal` view (premium-gated, soft redirect + license dialog if non-premium). Reads `journal_trades` (RLS `is_premium()`, read-only; cron is the only writer). Three recharts cards + top performers + transactions table. Timeframe filter 1D/1W/1M/ALL. All stats from `buildTrackerStats` + `computePnl` (pure, shared with cron).

> Entry: `src/pages/terminal/index.tsx:134-152`. Hook: `src/features/journal/hooks/use-journal-trades.ts:14`.

---

## 📊 Tiga kartu / Three cards

Komponen: `src/features/journal/components/journal-dashboard.tsx:117` (`JournalDashboard`).

### 1. Journal R Curve
`ComposedChart`: realized R harian/jam + cumulative R. Ini sengaja **bukan portfolio return** karena jurnal tidak menyimpan notional, sizing, cash, atau overlap posisi; benchmark return yang beda unit sudah dihapus.

### 2. Outcome Distribution (`:950`)
Donut: `sl`/`tp1`/`tp2`/`tp3`/`reversed-win`/`reversed-loss` (`:511-537`). Pattern hatched buat reversal. Center: win-rate.

### 3. Per Asset-Type Performance
Bar realized R per tipe aset + jumlah/porsi transaksi.

> Empty state kalau `stats.closed === 0` (`:735-743`).

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
| P&L | % + R dengan live milestone via `deriveFollowProgress` |
| Lifecycle badge | RUNNING/CLOSED + outcome (TP/SL) |

Filter: aset, direction, lifecycle (open/closed), PnL/outcome (tp/sl/reversal_profit/reversal_loss — mirror donut). Live price via `useMarketData(openSymbols)` di refs (jaga column def memoized). Row click → `TradeDetailDialog`.

---

## 🔍 Trade Detail Dialog

File: `src/features/follow-trade/components/trade-detail-dialog.tsx:375` (`TradeDetailDialog`).

🇮🇩 View per-trade. Reconstruct `TradingPlan` dari level tersimpan (`buildPlanFromTrade`, tampilkan setup *as-followed* bukan sinyal live). Trade open chart window live recent; trade closed pakai `computeTradeChartWindow` + `usePeriodCandles` buat satu seri continuous. Meta badge entry/close, lifecycle + TP progress + reversed badge, `TradeSetupChart` dengan marker entry/close, tombol share.

🇺🇸 Per-trade view. Reconstructs the `TradingPlan` from saved levels (`buildPlanFromTrade`, shows the *as-followed* setup not the live signal). Open trades chart the live recent window; closed trades use `computeTradeChartWindow` + `usePeriodCandles` for one continuous series. Entry/close meta badges, lifecycle + TP progress + reversed badge, `TradeSetupChart` with entry/close markers, share button.

---

## 🧮 Statistik (pure, shared dengan cron)

File: `src/core/trade/follow-trade-model.ts:396` (`buildTrackerStats`).

| Fungsi / Function | Output |
|---|---|
| `computePnl(trade, price)` (`:166`) | `{pct, r}` direction-aware |
| `evaluateFollow(trade, price, candles)` | replay candle, stop-first per bar, ratchet stop ke TP terakhir, gap fill di open aktual |
| `applyPriceSync(openTrades, prices, candlesBySymbol)` | partisi open/closed + milestone yang harus dipersist |
| `deriveFollowProgress` | live-ratcheted milestone buat trade running |
| `buildTrackerStats(history, openCount)` (`:396`) | equity/daily series, status distribution, per-asset, asset-type, long-vs-short, win/loss, by-grade |

> Mapper DB↔frontend: `src/core/trade/journal-mapper.ts` — pure, dipake app + cron.

---

## 🔗 Terkait / Related
- [`03-auto-journal.md`](03-auto-journal.md) — sumber data jurnal
- [`01-terminal-screener.md`](01-terminal-screener.md) — trade plan chart
- [`06-auth-entitlement.md`](06-auth-entitlement.md) — gating premium
- [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md) — `journal_trades` schema
