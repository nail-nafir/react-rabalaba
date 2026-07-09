# TSD 07 — Deployment

> 🇮🇩 Cara build, deploy edge function, schedule cron, env vars, smoke test.
> 🇺🇸 How to build, deploy edge functions, schedule cron, env vars, smoke test.

---

## TL;DR

🇮🇩 Deploy = 3 jalur: (1) **SPA** → Cloudflare Pages (`dist/`); (2) **Edge Functions** → Supabase (build:edge + `supabase functions deploy`); (3) **Cron wiring** → SQL Editor jalankan `schedule-*.sql` sekali. Env vars browser di `.env`, service-role di Supabase Vault (cron). Smoke test manual.

🇺🇸 Deploy = 3 tracks: (1) **SPA** → Cloudflare Pages (`dist/`); (2) **Edge Functions** → Supabase (build:edge + `supabase functions deploy`); (3) **Cron wiring** → SQL Editor run `schedule-*.sql` once. Browser env vars in `.env`, service-role in Supabase Vault (cron). Manual smoke test.

> Runbook lengkap: [`../../supabase/README.md`](../../supabase/README.md).

---

## 🔨 Build

### SPA
```bash
npm run build   # tsc -b && vite build → dist/
```
Deploy `dist/` ke Cloudflare Pages (`rabalaba.pages.dev`) via dashboard/Git integration.

### Edge Functions (cron engine)
```bash
npm run build:edge
# esbuild src/core/edge-engine.ts --bundle --format=esm --platform=neutral --alias:@=./src
# → supabase/functions/{auto-journal,daily-summary,asset-discovery}/_engine.mjs
```
> ⚠️ `npm run build` (SPA) **gak** update cron. Harus `build:edge` + deploy function biar cron pick up engine baru.

---

## 🚀 Deploy Edge Functions

```bash
npm run deploy:edge       # build:edge + supabase functions deploy auto-journal --project-ref nravncsodgcxwkdaeqcw
npm run deploy:summary    # build:edge + deploy daily-summary
npm run deploy:discovery  # build:edge + deploy asset-discovery
```

Project ref: `nravncsodgcxwkdaeqcw`. Tiap function `deno.json` cuma map `@supabase/supabase-js`. Service-role key auto-inject (`SUPABASE_SERVICE_ROLE_KEY`).

---

## ⏰ Schedule cron (sekali per function)

Jalankan di Supabase SQL Editor (urutan bebas, tapi setelah function di-deploy):

```sql
-- supabase/schedule-auto-journal.sql     → job auto-journal-30m   */30 * * * *
-- supabase/schedule-daily-summary.sql    → job daily-summary-hourly 0 * * * *
-- supabase/schedule-asset-discovery.sql  → job asset-discovery-daily 30 22 * * *
```

Tiap file: `create extension pg_cron; pg_net;` → `vault.create_secret` (idempotent) → `cron.schedule(net.http_post Authorization: Bearer <vault>)`. Paste **publishable** key sebagai bearer (public; lewat gateway; function tulis service-role).

> Optional: `cron.alter_job` retune auto-journal ke `*/15` (README Step 6).

---

## 🔑 Env vars

### Browser (`.env`)
| Var | Untuk / For |
|---|---|
| `VITE_SUPABASE_URL` | browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client (RLS read) + cron bearer (Vault) |

### Cloudflare Pages Functions (dashboard env vars)
| Var | Untuk / For |
|---|---|
| `COINGECKO_DEMO_API_KEY` / `COINGECKO_API_KEY` | inject `x-cg-demo-api-key` header di proxy coingecko (opsional, naikin quota) |

### Supabase Vault (cron)
| Secret | Untuk / For |
|---|---|
| `auto_journal_url` | URL function auto-journal |
| `auto_journal_bearer` | publishable key (dipake 3 cron) |
| `daily_summary_url` | URL function daily-summary |
| `asset_discovery_url` | URL function asset-discovery |

### Supabase Edge Function runtime (auto-inject)
| Var | Untuk / For |
|---|---|
| `SUPABASE_URL` | function client |
| `SUPABASE_SERVICE_ROLE_KEY` | bypass RLS (write) |
| `DISCORD_WEBHOOK_URL` | alert recap (per function) |
| `YAHOO_PROXY_BASE` / `DISCOVERY_PROXY_BASE` | override CF proxy URL (optional fallback) |
| `DISCOVERY_MAX_AUTO_ACTIVE` | override cap (default 60) |

---

## ✅ Smoke test

🇮🇩 1. **SPA**: buka `rabalaba.pages.dev` → screener load, signal muncul.
2. **Cron auto-journal**: SQL Editor `select * from cron.job_run_details order by start_time desc limit 10;` — cek `status='succeeded'`. Atau admin "Scan Sekarang" (`/admin/assets`).
3. **Cron daily-summary**: admin "Send Recap" force, cek Discord.
4. **Cron asset-discovery**: admin "Discover Now" (`/admin/assets`), cek `journal_assets` ada row `source='auto'` baru.
5. **Inspect cron**: `select jobid, schedule, jobname from cron.job;`.

🇺🇸 1. **SPA**: open `rabalaba.pages.dev` → screener loads, signals appear. 2. **Cron**: SQL Editor check `cron.job_run_details` `status='succeeded'`, or admin "Scan Sekarang". 3. **daily-summary**: admin force "Send Recap", check Discord. 4. **asset-discovery**: admin "Discover Now", check `journal_assets` new `source='auto'` row. 5. **Inspect**: `select jobid, schedule, jobname from cron.job;`.

---

## 🔄 Update flow

| Ubah apa / Change what | Langkah / Steps |
|---|---|
| UI/component | `npm run build` → deploy Pages |
| Engine (`src/features/engine/`, `src/core/`) | `npm run build:edge` → `npm run deploy:edge` (+ summary/discovery kalau perlu) |
| Cron schedule | SQL Editor `cron.alter_job` (gak perlu redeploy function) |
| Cron config (interval/pause/discovery) | Admin UI `/admin/assets` (`journal_settings`) — gak perlu redeploy |
| DB schema | Tambah migrasi `supabase/migrations/` → replay SQL Editor |
| Proxy cache policy | Edit `functions/api/*/[[path]].ts` → deploy Pages |

---

## 🔗 Terkait / Related
- [`../../supabase/README.md`](../../supabase/README.md) — runbook lengkap
- [`05-edge-functions.md`](05-edge-functions.md) — cron detail
- [`01-tech-stack.md`](01-tech-stack.md) — scripts
