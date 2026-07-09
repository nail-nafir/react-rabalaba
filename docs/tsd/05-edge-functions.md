# TSD 05 — Edge Functions (Cron)

> 🇮🇩 3 Supabase Edge Function (Deno) cron: auto-journal 30m, daily-summary hourly, asset-discovery daily. Scheduling, gating, Discord.
> 🇧🇧 3 Supabase Edge Functions (Deno) cron: auto-journal 30m, daily-summary hourly, asset-discovery daily. Scheduling, gating, Discord.

---

## TL;DR

🇮🇩 3 Edge Function di `supabase/functions/`. Tiap function: `index.ts` (Deno handler) import pure core dari `./_engine.mjs` (build artifact `src/core/edge-engine.ts` via `npm run build:edge`). Tulis pakai service-role (bypass RLS). Semua support manual `{force:true}` (admin-gated via `profiles.is_admin`). Scheduling data-driven di `journal_settings` — gak perlu edit cron atau redeploy.

🇺🇸 3 Edge Functions in `supabase/functions/`. Each: `index.ts` (Deno handler) imports the pure core from `./_engine.mjs` (build artifact of `src/core/edge-engine.ts`). Writes use the service-role key (bypasses RLS). All support manual `{force:true}` (admin-gated via `profiles.is_admin`). Scheduling is data-driven on `journal_settings` — no cron edit or redeploy needed.

---

## 🦾 auto-journal

| Aspect | Value |
|---|---|
| Path | `supabase/functions/auto-journal/index.ts` (383 baris) |
| Trigger | pg_cron `*/30 * * * *` (job `auto-journal-30m`) via `net.http_post` `body:{trigger:'cron'}`. Juga browser invoke admin `{force:true}` |
| Input | `{force?: boolean}` (`:149`). Force butuh admin (`:150-173`) |
| Output | `{ok, forced, universe, fetched, open_before, emitted, closed, alerted, emitError?}` (`:348-358`) |
| Tables | `journal_settings` (read gate + stamp `last_run_at`), `journal_trades` (read open + recently-closed cooldown + INSERT emit + UPDATE closure), `journal_assets` (read universe), `profiles` (admin check) |
| External | Yahoo chart via CF proxy (`YAHOO_PROXY_BASE` default `rabalaba.pages.dev/api/yahoo/v8/finance/chart`, override env), cache-bust + `Cache-Control: no-cache`, concurrency 8 (`mapPool`). Discord webhook best-effort |
| Gating | `enabled` pause; `interval_minutes` clock-aligned WIB midnight (tick jalan kalau `slotMin % interval === 0` + dedup `last_run_at`); `market_hours_only` skip bursa tutup; universe dari `journal_assets` + komoditas/forex konstanta, fallback `EDGE_UNIVERSE` kalau table unreadable; benchmark context-only di-fetch tapi gak di-jurnal |
| Entry | `Deno.serve` `:133`; `runAutoJournal` call `:300`; alerts `:335-336` |
| Schedule file | `supabase/schedule-auto-journal.sql:27` — `pg_cron`+`pg_net`+`vault.create_secret` (auto_journal_url, auto_journal_bearer) |

> Detail functional: [`../fsd/03-auto-journal.md`](../fsd/03-auto-journal.md).

---

## 🗓️ daily-summary

| Aspect | Value |
|---|---|
| Path | `supabase/functions/daily-summary/index.ts` (424 baris) |
| Trigger | pg_cron `0 * * * *` (hourly, job `daily-summary-hourly`). Admin `{force:true, kind?}` (`:175-181`) |
| Input | `{force?: boolean, kind?: 'daily'\|'weekly'\|'monthly'}` |
| Output | `{ok, forced, results:[{kind, sent, empty, closed, emitted, open}]}` (`:389-399`) |
| Tables | `journal_settings` (read enable flags + send hour + per-kind stamps; **atomic send-once claim** conditional UPDATE per kind `:262-267`; release on webhook failure); `journal_trades` (open + closed-in-window + emitted-in-window per kind); `profiles` (admin check) |
| External | Yahoo chart (CF proxy) buat live price open position (cuman kalau `openT.length > 0`). Discord webhook |
| Gating | `daily_summary_hour` (WIB default 23) — tick auto cuma jam itu (`:250-252`); tiap kind cuma di hari send-day WIB via `recapWindow(kind, ref).isSendDay`; per-kind atomic claim anti double-send; per-kind stamp kolom (`KIND_COLUMNS` `:48-61`); WIB=UTC+7 no DST; 10-min back-off `reportRefMs` absorbs cron lag |
| Entry | `Deno.serve` `:160`; pure `recapWindow` (dari `src/core/period-summary.ts`) + `formatDailySummaryForDiscord` + `computePnl` + `adaptYahooChart` |
| Schedule file | `supabase/schedule-daily-summary.sql:24` |

---

## 🧭 asset-discovery

| Aspect | Value |
|---|---|
| Path | `supabase/functions/asset-discovery/index.ts` (497 baris) |
| Trigger | pg_cron `30 22 * * *` (daily 22:30 UTC = 05:30 WIB, job `asset-discovery-daily`). Admin `{force:true}` (`:225-249`) |
| Input | `{force?: boolean}` |
| Output | `{ok, forced, added, reactivated, refreshed, pruned, validated_failed, skipped_markets, auto_active_total, writeError?}` (`:460-472`) |
| Tables | `journal_settings` (read `discovery_enabled`/`max_per_market`/`prune_days`; atomic once-per-WIB-day claim `discovery_last_run_at` `:276-294`; stamp on force); `journal_assets` (read universe + provenance; upsert insert `onConflict:'symbol', ignoreDuplicates:true`; UPDATE reactivate/refresh/prune guarded `.eq('source','auto')`); `journal_trades` (open-trade symbols buat prune protection); `profiles` (admin check) |
| External (via CF proxy `PROXY_BASE` default `rabalaba.pages.dev/api`) | CoinGecko `/coingecko/api/v3/search/trending`; Binance `/binance/fapi/v1/ticker/24hr`; Yahoo day_gainers + most_actives screener; Yahoo custom IDX screener POST (`IDX_SCREENER_BODY`); Yahoo search (PEPE defense crypto-base→ticker); Yahoo chart validasi. Discord webhook |
| Validation bar | `MIN_CANDLES=120` (engine readiness), `MAX_AUTO_ACTIVE=60` (env `DISCOVERY_MAX_AUTO_ACTIVE`), `PRICE_DIVERGENCE_MAX=0.3`, `FEED_COUNT=25` (`:53-62`). Tiap market feed independently fault-tolerant — market fully-dead excluded dari pruning run itu |
| Entry | `Deno.serve` `:210`; pure pipeline `rankCryptoCandidates`/`rankUsCandidates`/`rankIdCandidates` → `dedupeCandidates` → `validateMarket` → `planDiscovery` → `formatDiscoveryForDiscord` |
| Schedule file | `supabase/schedule-asset-discovery.sql:26` |

> Invariant: `source='admin'` row **gak pernah** disentuh — semua UPDATE bawa `.eq('source','auto')`.

---

## ⏰ Cron wiring (`schedule-*.sql`)

| File | Job | Schedule | Vault secret |
|---|---|---|---|
| `schedule-auto-journal.sql:27` | `auto-journal-30m` | `*/30 * * * *` | `auto_journal_url`, `auto_journal_bearer` (publishable key) |
| `schedule-daily-summary.sql:24` | `daily-summary-hourly` | `0 * * * *` | `daily_summary_url`, reuse `auto_journal_bearer` |
| `schedule-asset-discovery.sql:26` | `asset-discovery-daily` | `30 22 * * *` | `asset_discovery_url`, reuse `auto_journal_bearer` |

Semua: `create extension pg_cron; pg_net;` → `vault.create_secret` (idempotent) → `cron.schedule(net.http_post Authorization: Bearer <vault>)`. Bearer = **publishable** key (public, lewat gateway; function tulis service-role).

---

## ⚙️ `supabase/config.toml`
`project_id = "nravncsodgcxwkdaeqcw"`; `[functions.auto-journal]` & `[functions.asset-discovery]` `verify_jwt = true` (cron bearer publishable lewat gateway; tulis service-role). `daily-summary` default.

---

## 🔗 Terkait / Related
- [`../fsd/03-auto-journal.md`](../fsd/03-auto-journal.md) — functional
- [`../explainer/auto-journal-explained.md`](../explainer/auto-journal-explained.md) — ELI5
- [`03-database-schema.md`](03-database-schema.md) — tabel yang ditulis
- [`06-engine-internals.md`](06-engine-internals.md) — pure core detail
- [`07-deployment.md`](07-deployment.md) — deploy + schedule
