# FSD 03 — Auto-Journal Robot

> 🇮🇩 Robot yang nulis jurnal trade otomatis tiap 30 menit via cron, tanpa browser.
> 🇺🇸 The robot that auto-journals trades every 30 minutes via cron, without a browser.

---

## TL;DR

🇮🇩 Tiap 30 menit, **pg_cron** POST ke **Supabase Edge Function** `auto-journal`. Function narik candle Yahoo (lewat CF proxy) untuk universe `journal_assets`, jalanin `runAutoJournal` (pure core), **emit** trade baru (LONG/SHORT+plan) & **close** trade open yang kena TP/SL/reversal, lalu tulis `journal_trades` (service-role, bypass RLS) + broadcast **Discord alert**. Semua gating data-driven di `journal_settings` (pause/interval/market-hours) — gak perlu edit cron atau redeploy.

🇺🇸 Every 30 minutes, **pg_cron** POSTs to the **Supabase Edge Function** `auto-journal`. The function pulls Yahoo candles (via CF proxy) for the `journal_assets` universe, runs `runAutoJournal` (pure core), **emits** new trades (LONG/SHORT+plan) & **closes** open trades that hit TP/SL/reversal, then writes `journal_trades` (service-role, bypasses RLS) + broadcasts a **Discord alert**. All gating is data-driven on `journal_settings` (pause/interval/market-hours) — no cron edit or redeploy needed.

> Detail teknis: [`../tsd/05-edge-functions.md`](../tsd/05-edge-functions.md). ELI5: [`../explainer/auto-journal-explained.md`](../explainer/auto-journal-explained.md).

---

## 🔄 Satu putaran / One cycle

| # | 🇮🇩 Yang terjadi | 🇺🇸 What happens |
|---|---|---|
| 1 | ⏰ pg_cron `*/30 * * * *` POST ke function (`x-cron-secret` dari Vault) | ⏰ pg_cron POSTs with the private cron-secret header |
| 2 | 🦾 Baca `journal_settings`: enabled? udah waktunya (clock-aligned ke WIB midnight)? | 🦾 Read `journal_settings`: enabled? due? |
| 3 | 📥 Baca trade open + state episode + universe (`journal_assets` + komoditas/forex konstanta) | 📥 Read open trades, episode states, and universe |
| 4 | 🌐 Fetch candle Yahoo 60d/1h per aset (concurrency 8, timeout 12 detik, lewat CF proxy) | 🌐 Fetch Yahoo 60d/1h candles (bounded concurrency + timeout) |
| 5 | 🧠 `buildEngineContexts` (BTC/IHSG/S&P top-down) + `runAutoJournal(assets, openRows, {contexts})` | 🧠 Build contexts + run pure decision core |
| 6 | ✍️ Claim slot setelah fetch sukses; UPDATE milestone/closure, INSERT trade, lalu rekonsiliasi `journal_signal_states` dari penulisan yang berhasil | ✍️ Claim after successful IO; persist journal changes and reconcile episode states from successful writes |
| 7 | 📢 `buildAutoJournalAlerts` + `formatAlertBatchesForDiscord` → POST webhook per batch (best-effort) | 📢 Build alerts + batch Discord messages + POST webhook |
| 8 | Kembalikan ringkasan run; browser membaca episode dan jurnal setiap 60 detik atau saat mount/focus/refresh | Return run summary; browser reads episodes and journal every 60 seconds or on mount/focus/refresh |

> Entry: `supabase/functions/auto-journal/index.ts:133` (`Deno.serve`), `:300` (`runAutoJournal` call).

---

## 🧠 Decision core — `runAutoJournal`

File: `src/core/automation/auto-journal-core.ts:100` (`runAutoJournal`). Pure, unit-tested.

### Emit (trade baru)
- Skip quote tanpa timestamp, stale >90 menit, atau >5 menit di masa depan (`QUOTE_MAX_AGE_MS`). Candle keputusan entry harus sudah selesai dengan usia 0–15 menit.
- Enrich aset dengan context own-index agar strength/tier sama dengan screener; context tidak menyembunyikan sinyal.
- Entry memakai open candle eksekusi pertama setelah candle keputusan selesai; spot live tetap hanya untuk display.
- Kandidat LONG/SHORT fresh + trading plan dicatat jika entry executable dan episode mengizinkan, tanpa trade lain yang tetap open pada symbol/timeframe sama. LONG/SHORT terminal baru terbit dari episode aktif dengan snapshot valid; sebelum itu kandidat berlabel Netral.
- Setelah TP/SL, arah yang sama diblokir sampai raw signal melewati netral; reversal boleh langsung flip ke arah lawan.
- Snapshot menyimpan `engine_version`, `decision_candle_open_at`, `decision_candle_closed_at`, regime, HTF trend, dan direction score untuk audit cohort.
- Entry, TP, SL awal, dan R:R episode aktif tetap dari snapshot. Harga atau filter no-trade terbaru tidak mengubah setup maupun menahan label trade aktif.

### Close (trade open)
Replay candle sejak entry per trade:
- **Close 1** — progressive stop: TP1 memindahkan stop aktif ke entry; TP2 memindahkannya ke TP1; TP final menutup posisi. Pada candle selesai yang mencapai TP baru, final close yang kembali melewati stop baru menutup di level stop; wick saja tidak. Gap pada stop yang sudah aktif tetap mengisi di open aktual.
- **Close 2** — signal **REVERSAL** (long↔short) exit di close candle terkoroborasi; gak ada perfect-fill sintetis.

Trade lama `engine-v3` yang sudah ditutup di ratchet non-final tidak ditulis ulang. Migration v4 hanya memindahkan trade yang masih `open` ke kontrak progressive dan menambah `exit_reason` (`initial_stop`, `breakeven_stop`, `progressive_stop`, `final_take_profit`, `reversal`) untuk audit.

### Phantom guard 🇮🇩🇺🇸
🇮🇩 Hanya candle **timestamped** yang mutusin TP/SL. Spot price ≥ SL diabaikan (anti phantom close dari quote transient). Test: `auto-journal-core.test.mjs` "phantom spot guard".
🇺🇸 Only **timestamped** candles decide TP/SL. Spot price ≥ SL is ignored (anti phantom close from transient quotes).

---

## ⚙️ Gating (`journal_settings` singleton)

| Field | Efek / Effect |
|---|---|
| `enabled` | Pause global robot |
| `interval_minutes` | Clock-aligned ke WIB midnight — tick auto cuma jalan kalau `slotMin % interval === 0` + dedup vs `last_run_at` |
| `market_hours_only` | Skip aset bursa tutup (filter closed-exchange symbol) |
| `last_run_at` | Dedup tick + stamp |

> Admin bisa trigger manual "Scan Sekarang" via `useMarketScan` (`{force:true}`, admin-gated).

---

## 📢 Discord Alert

File: `src/core/automation/alerts.ts` (`buildAutoJournalAlerts`, `formatAlertBatchesForDiscord`).

- Insert yang berhasil → `new_long` / `new_short`, menggunakan snapshot entry, TP, dan SL awal jurnal. Perubahan database yang gagal tidak membuat alert.
- Closure internal → `tp_hit` / `sl_hit` / `protected_stop` / `reversed`, berdasarkan `exit_reason`; output protected stop memakai hasil nyata `TP n/total`, `BE`, atau `SL`, lalu milestone tertinggi ditulis sebagai `SEMPAT TPn`.
- Format: 🚨 SINYAL → 📢 HASIL, direction-aware % dari entry, label durasi Indonesia.
- `DISCORD_MAX = 1900` per batch; blok alert tidak dipotong.
- HTTP 429 menghormati `Retry-After` dan retry sekali bila masih dalam budget function.
- Best-effort: gagal webhook gak membatalkan jurnal. Tidak ada antrean permanen untuk semua kegagalan pengiriman.

---

## 🧭 Asset Discovery (cron terpisah)

File: `src/core/automation/asset-discovery-core.ts` + `supabase/functions/asset-discovery/index.ts:210`. Cron `30 22 * * *` (05:30 WIB harian).

🇮🇩 Bukan bagian auto-journal, tapi **ngisi universe** yang auto-journal baca. Fetch feed trending (CoinGecko / Binance 24h / Yahoo gainers+most-actives + IDX most-actives), rank/dedup via pure core, validasi tiap kandidat round-trip chart ≥120 bar, lalu INSERT/refresh/reactivate/prune `journal_assets` (baris `source='admin'` **gak pernah** disentuh). Lihat `tsd/05` untuk detail.

🇺🇸 Not part of auto-journal, but **fills the universe** auto-journal reads. Fetches trending feeds, ranks/dedups via pure core, validates each candidate round-trips a ≥120-bar chart, then INSERT/refresh/reactivate/prune `journal_assets` (admin rows never touched).

---

## 🗓️ Daily/Weekly/Monthly Recap (cron terpisah)

File: `supabase/functions/daily-summary/index.ts:160`. Cron `0 * * * *` (hourly, self-gate per WIB day/week/month).

🇮🇩 Recap scoreboard Discord: TOTAL/TERBAIK/TERBURUK/SINYAL BARU/MASIH TERBUKA/SUDAH DITUTUP/RASIO LABA RUGI. Atomic send-once per kind via stamp kolom. Lihat `tsd/05`.
🇺🇸 Discord recap scoreboard. Atomic send-once per kind via stamp columns. See `tsd/05`.

---

## 🔗 Terkait / Related
- [`../explainer/trading-methodology.md`](../explainer/trading-methodology.md) — panduan aturan lengkap dan contoh LONG/SHORT
- [`../explainer/auto-journal-explained.md`](../explainer/auto-journal-explained.md) — ELI5
- [`../tsd/05-edge-functions.md`](../tsd/05-edge-functions.md) — detail teknis 3 cron
- [`04-journal-dashboard.md`](04-journal-dashboard.md) — baca hasil jurnal
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — engine core
