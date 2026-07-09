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
| 1 | ⏰ pg_cron `*/30 * * * *` POST ke function (Bearer = publishable key di Vault) | ⏰ pg_cron POSTs to the function |
| 2 | 🦾 Baca `journal_settings`: enabled? udah waktunya (clock-aligned ke WIB midnight)? | 🦾 Read `journal_settings`: enabled? due? |
| 3 | 📥 Baca trade open + yang baru ditutup (cooldown) + universe (`journal_assets` + komoditas/forex konstanta) | 📥 Read open + recently-closed + universe |
| 4 | 🌐 Fetch candle Yahoo 1mo/1h per aset (concurrency 8, lewat CF proxy, cache-bust) | 🌐 Fetch Yahoo 1mo/1h candles (concurrency 8, via CF proxy) |
| 5 | 🧠 `buildEngineContexts` (BTC/IHSG/S&P top-down) + `runAutoJournal(assets, openRows, {contexts, recentClosed})` | 🧠 Build contexts + run pure decision core |
| 6 | ✍️ INSERT emit baru + UPDATE closure (service-role, bypass RLS) | ✍️ INSERT emits + UPDATE closures |
| 7 | 📢 `buildAutoJournalAlerts` + `formatAlertsForDiscord` → POST webhook (best-effort) | 📢 Build alerts + format Discord + POST webhook |
| 8 | 🕒 Stamp `journal_settings.last_run_at` | 🕒 Stamp `last_run_at` |

> Entry: `supabase/functions/auto-journal/index.ts:133` (`Deno.serve`), `:300` (`runAutoJournal` call).

---

## 🧠 Decision core — `runAutoJournal`

File: `src/core/auto-journal-core.ts:100` (`runAutoJournal`). Pure, unit-tested.

### Emit (trade baru)
- Skip quote stale > 90 menit (`QUOTE_MAX_AGE_MS`).
- Enrich aset dengan context own-index.
- `buildFollowedTrade` snapshot.
- `passesEmissionGate` — counter-trend call vs context di-blok **kecuali** post-context strength ≥ `JOURNAL_EMISSION.COUNTER_TREND_MIN_STRENGTH` (60).
- `REENTRY_COOLDOWN_MS` 6 jam per `symbol|signal` — simbol+arah sama diblok 6 jam, arah lawan boleh.

### Close (trade open)
Replay candle sejak entry per trade:
- **Close 1** — price TP/SL via `applyPriceSync` (secures highest TP di stop berikutnya).
- **Close 2** — signal **REVERSAL** (long↔short), secure TP yang udah ke-touch di harganya, kalau belum exit di current. Status `reversed=true`.

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

File: `src/core/alerts.ts:354` (`buildAutoJournalAlerts`, `formatAlertsForDiscord`).

- Emit insert → `new_long` / `new_short`.
- Closure → `tp_hit` / `sl_hit` / `reversed` (mirror donut bucket UI, termasuk secured-TP reversal).
- Format: 🚨 SINYAL → 📢 HASIL, direction-aware % dari entry, label durasi Indonesia.
- `DISCORD_MAX = 1900` char cap.
- Best-effort: gagal webhook gak gagalkan run.

---

## 🧭 Asset Discovery (cron terpisah)

File: `src/core/asset-discovery-core.ts` + `supabase/functions/asset-discovery/index.ts:210`. Cron `30 22 * * *` (05:30 WIB harian).

🇮🇩 Bukan bagian auto-journal, tapi **ngisi universe** yang auto-journal baca. Fetch feed trending (CoinGecko / Binance 24h / Yahoo gainers+most-actives + IDX most-actives), rank/dedup via pure core, validasi tiap kandidat round-trip chart ≥120 bar, lalu INSERT/refresh/reactivate/prune `journal_assets` (baris `source='admin'` **gak pernah** disentuh). Lihat `tsd/05` untuk detail.

🇺🇸 Not part of auto-journal, but **fills the universe** auto-journal reads. Fetches trending feeds, ranks/dedups via pure core, validates each candidate round-trips a ≥120-bar chart, then INSERT/refresh/reactivate/prune `journal_assets` (admin rows never touched).

---

## 🗓️ Daily/Weekly/Monthly Recap (cron terpisah)

File: `supabase/functions/daily-summary/index.ts:160`. Cron `0 * * * *` (hourly, self-gate per WIB day/week/month).

🇮🇩 Recap scoreboard Discord: TOTAL/TERBAIK/TERBURUK/SINYAL BARU/MASIH TERBUKA/SUDAH DITUTUP/RASIO LABA RUGI. Atomic send-once per kind via stamp kolom. Lihat `tsd/05`.
🇺🇸 Discord recap scoreboard. Atomic send-once per kind via stamp columns. See `tsd/05`.

---

## 🔗 Terkait / Related
- [`../explainer/auto-journal-explained.md`](../explainer/auto-journal-explained.md) — ELI5
- [`../tsd/05-edge-functions.md`](../tsd/05-edge-functions.md) — detail teknis 3 cron
- [`04-journal-dashboard.md`](04-journal-dashboard.md) — baca hasil jurnal
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — engine core
