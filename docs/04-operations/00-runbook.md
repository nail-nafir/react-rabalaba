# Operasional 00 — Runbook Produksi / Ops 00 — Production Runbook

> Status verifikasi: perintah dan path diverifikasi pada 2026-09-16. Kanonis: cron 30m/hourly/daily; skrip `scripts/gate-compare.mjs` dan `scripts/find-phantom-closes.mjs`; 38 migrasi; 16 tabel; 28 RPC.
> Verification status: commands and paths verified on 2026-09-16. Canonical: 30m/hourly/daily cron; `scripts/gate-compare.mjs` and `scripts/find-phantom-closes.mjs`; 38 migrations; 16 tables; 28 RPCs.

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

## Bagian ID

### TL;DR

Runbook dipakai saat produksi bermasalah. Setup dan rebuild dari nol berada di [`../../supabase/README.md`](../../supabase/README.md). Alur deploy berada di [`../02-technical-specs/07-deployment.md`](../02-technical-specs/07-deployment.md). Fokus file ini: troubleshoot dan operasi harian. Langkah darurat diringkas sat-set di tiap skenario.

### Health check cepat

```sql
-- Status cron
select jobid, schedule, jobname, active from cron.job;
select jobname, status, start_time, return_message
  from cron.job_run_details order by start_time desc limit 10;

-- Konfigurasi dan last run
select enabled, interval_minutes, last_run_at,
       daily_summary_enabled, daily_summary_last_sent_at,
       weekly_summary_last_sent_at, monthly_summary_last_sent_at,
       discovery_enabled, discovery_last_run_at
  from public.journal_settings;

-- Sanity data
select count(*), status from public.journal_trades group by status;
select count(*), active, source from public.journal_assets group by active, source;
```

```bash
# SPA alive?
curl -sI https://rabalaba.pages.dev | grep -iE "HTTP|cf-cache-status"
# Proxy CoinGecko (cron path) cache header
curl -sI "https://rabalaba.pages.dev/api/coingecko/api/v3/global" | grep -iE "x-rabalaba"
```

### Playbook insiden

#### 1. Cron auto-journal tidak jalan / tidak emit

| Gejala | Cek | Aksi |
|---|---|---|
| Job `auto-journal-30m` tidak ada di `cron.job` | `select * from cron.job;` | Jalankan ulang `supabase/schedule-auto-journal.sql`, lalu verifikasi Vault `rabalaba_cron_secret` cocok dengan secret Edge `CRON_SECRET` |
| `net._http_response.status_code = 401` | `select status_code, content, created from net._http_response order by created desc limit 10;` | Set secret Edge `CRON_SECRET` persis sama dengan Vault `rabalaba_cron_secret`; secret aktif langsung, file schedule tidak perlu diulang |
| `net._http_response.timed_out = true` sekitar 5 detik | `select status_code, timed_out, error_msg, created from net._http_response order by created desc limit 10;` | Jalankan ulang ketiga `supabase/schedule-*.sql`; file kanonis menetapkan timeout 120s untuk scan/discovery dan 30s untuk recap |
| Job ada tetapi `status='failed'` | Kolom `return_message` di `cron.job_run_details` | Periksa 429/timeout di return message, lanjut ke skenario §2 |
| Job sukses tetapi `emitted=0` terus | Kolom `enabled` / `interval_minutes` / `last_run_at` di `journal_settings` | Cek pause, clock-align, dan dedup `last_run_at`; set `enabled=true` atau paksa via admin "Scan Sekarang" |
| `emitError` di response body | Response dan log function | Write DB gagal; periksa detail error dan constraint `journal_trades` |
| Universe kosong | `select count(*) from journal_assets where active;` | Seed ulang atau paksa via admin "Discover Now" |

#### 2. CoinGecko/Binance 429 di proxy (cron path)

```bash
curl -sI "https://rabalaba.pages.dev/api/coingecko/api/v3/search/trending" | grep -i x-rabalaba
# X-Rabalaba-Cache: hit = OK (cached), miss/error = upstream bermasalah
```

- **`X-Rabalaba-Cache: error-hit`** berarti upstream 429 dan proxy menyajikan stale/error. Tunggu errorTtl (60s) expire, atau set env `COINGECKO_DEMO_API_KEY` di dashboard Cloudflare Pages (quota naik; proxy inject header `x-cg-demo-api-key`). Lihat [`../02-technical-specs/04-cloudflare-proxy.md`](../02-technical-specs/04-cloudflare-proxy.md).
- Direct CoinGecko/Binance 429 dari browser berarti IP visitor sendiri kena limit; kondisi by design dan tidak bisa di-fix server-side (lihat [`../05-explainers/03-server-vs-browser.md`](../05-explainers/03-server-vs-browser.md)).

#### 3. Yahoo proxy 401 (crumb expired)

- Proxy auto-refresh crumb saat 401 lalu retry. Bila 401 massal berlanjut:
  - Service crumb `fc.yahoo.com` down: tunggu; cache stale proxy menahan 6h/2d.
  - IP colo CF terblokir Yahoo: kejadian langka; fallback via env `YAHOO_PROXY_BASE` di Edge Function ke mirror lain.

#### 4. Discord alert tidak masuk

- Cron mencatat `alerted < alerts_total` tetapi run sukses berarti delivery webhook parsial/gagal (best-effort; run tidak digagalkan).
- Periksa env `DISCORD_WEBHOOK_URL` per function. Webhook Discord bisa ter-revoke/expire: buat ulang webhook, set env, redeploy function.

#### 5. Daily-summary double-send / tidak kirim

- Double-send: atomic claim per-kind gagal; periksa stamp `journal_settings.{kind}_last_sent_at` dan `daily_summary_hour`.
- Tidak kirim: `daily_summary_enabled=false`, atau `recapWindow.isSendDay=false` (bukan hari kirim), atau jam belum `daily_summary_hour`. Paksa via admin "Send Recap" `{force:true, kind:'daily'}`.

> 🇮🇩 Catatan: cadence cron kanonis adalah 30m (`auto-journal-30m`), hourly (`daily-summary-hourly`), daily (`asset-discovery-daily`).
> 🇺🇸 Note: the canonical cron cadence is 30m (`auto-journal-30m`), hourly (`daily-summary-hourly`), daily (`asset-discovery-daily`).

### Rollback deploy

#### SPA (Cloudflare Pages)

- Dashboard Cloudflare → project → Deployments → pilih deployment sebelumnya → **Rollback to this deployment**. Instant, tanpa rebuild.

#### Edge Function (Supabase)

- Supabase tidak menyediakan rollback native. Bila deploy baru break:
  1. `git revert` commit engine penyebab break.
  2. `npm run deploy:auto-journal` (re-bundle dan deploy versi lama; sama untuk `deploy:daily-summary` dan `deploy:asset-discovery`).
- Pencegahan: sebelum deploy prod, test lokal via `supabase functions serve` dan jalankan diagnostik `scripts/find-phantom-closes.mjs`. Riset filter entry hipotetis tetap lewat `scripts/gate-compare.mjs`; jurnal production tetap parity dengan screener.

#### Migrasi DB

- Migrasi append-only tanpa rollback otomatis. Bila migrasi break: tulis migrasi baru yang mengembalikan via `drop`/`alter`; file lama tidak diedit. Lihat [`../../supabase/README.md`](../../supabase/README.md) §prinsip.

### Restore DB / backup

Supabase: dashboard → Project → Database → Backups. **Scheduled daily** (retensi 7d free / 30d pro). **PITR** hanya plan Pro+.

Prosedur restore:

1. Dashboard → Backups → pilih timestamp → **Restore** (overwrite project) atau "Restore to new project" (aman, paralel).
2. Bila restore ke project sama: SPA dan Edge Function tetap jalan, tetapi `last_run_at` cron bisa time-travel; set manual `update journal_settings set last_run_at = now();` agar dedup tidak menahan run.
3. Verifikasi: `select count(*) from journal_trades;` plus smoke test admin "Scan Sekarang".

> 🇮🇩 Backup manual sebelum eksperimen: `pg_dump` dengan connection string dashboard (`-F c -f backup.dump`).
> 🇺🇸 Manual backup before experiments: `pg_dump` with the dashboard connection string (`-F c -f backup.dump`).

### Monitoring

| Objek | Cara | Lokasi |
|---|---|---|
| Cron run health | `cron.job_run_details` | SQL Editor |
| Konsol diagnostik admin | KPI, log stream, grid status service | `/admin/statistics` |
| Status cache proxy | Header `X-Rabalaba-Cache` | `curl -sI` per route |
| Log function | Log Functions | Dashboard Supabase |
| Error Edge Function | `emitError`/`writeError` di response body | Invoke manual / log |

> 🇮🇩 Belum ada: error tracking otomatis (Sentry/Discord error webhook) dan uptime alert. Rekomendasi: tambah Discord error webhook terpisah dari alert, atau Sentry.
> 🇺🇸 Not yet present: automated error tracking and uptime alerting. Recommendation: a separate Discord error webhook, or Sentry.

### Pause darurat

| Skenario | Cara |
|---|---|
| Pause auto-journal tanpa redeploy | Admin UI `/admin/assets` → toggle pause, atau `update journal_settings set enabled = false;` (cron tetap tick, function skip) |
| Stop cron total | `select cron.unschedule('auto-journal-30m');` (hanya bila copot permanen) |
| Stop recap hourly | `select cron.unschedule('daily-summary-hourly');` (hanya bila copot permanen) |
| Stop discovery daily | `select cron.unschedule('asset-discovery-daily');` (hanya bila copot permanen) |
| Pause discovery | `update journal_settings set discovery_enabled = false;` atau toggle admin |
| Hentikan SPA | Cloudflare Pages → project → Settings → **Pause** (jarang diperlukan) |

### Terkait

- [`../../supabase/README.md`](../../supabase/README.md) — setup dan rebuild dari nol
- [`../02-technical-specs/07-deployment.md`](../02-technical-specs/07-deployment.md) — alur deploy
- [`../02-technical-specs/04-cloudflare-proxy.md`](../02-technical-specs/04-cloudflare-proxy.md) — proxy cache dan 429
- [`01-security.md`](01-security.md) — security dan RLS

## English Part

### TL;DR

The runbook applies when production breaks. Setup and from-scratch rebuild live in [`../../supabase/README.md`](../../supabase/README.md). Deploy flow lives in [`../02-technical-specs/07-deployment.md`](../02-technical-specs/07-deployment.md). The focus here: troubleshooting and day-to-day operations. Emergency steps stay compact in each scenario.

### Fast health check

```sql
-- Cron status
select jobid, schedule, jobname, active from cron.job;
select jobname, status, start_time, return_message
  from cron.job_run_details order by start_time desc limit 10;

-- Config and last runs
select enabled, interval_minutes, last_run_at,
       daily_summary_enabled, daily_summary_last_sent_at,
       weekly_summary_last_sent_at, monthly_summary_last_sent_at,
       discovery_enabled, discovery_last_run_at
  from public.journal_settings;

-- Data sanity
select count(*), status from public.journal_trades group by status;
select count(*), active, source from public.journal_assets group by active, source;
```

```bash
# SPA alive?
curl -sI https://rabalaba.pages.dev | grep -iE "HTTP|cf-cache-status"
# CoinGecko proxy (cron path) cache header
curl -sI "https://rabalaba.pages.dev/api/coingecko/api/v3/global" | grep -iE "x-rabalaba"
```

### Incident playbook

#### 1. Auto-journal cron silent / emitting nothing

| Symptom | Check | Action |
|---|---|---|
| `auto-journal-30m` job missing from `cron.job` | `select * from cron.job;` | Re-run `supabase/schedule-auto-journal.sql`, then verify Vault `rabalaba_cron_secret` matches the Edge `CRON_SECRET` secret |
| `net._http_response.status_code = 401` | `select status_code, content, created from net._http_response order by created desc limit 10;` | Set the Edge `CRON_SECRET` secret exactly equal to Vault `rabalaba_cron_secret`; the secret activates immediately, no schedule re-run needed |
| `net._http_response.timed_out = true` near 5 seconds | `select status_code, timed_out, error_msg, created from net._http_response order by created desc limit 10;` | Re-run all three `supabase/schedule-*.sql` files; the canonical files set a 120s timeout for scan/discovery and 30s for recaps |
| Job present but `status='failed'` | `return_message` column in `cron.job_run_details` | Inspect 429/timeout markers in the return message, continue to scenario §2 |
| Successful job but persistent `emitted=0` | `enabled` / `interval_minutes` / `last_run_at` columns in `journal_settings` | Inspect pause state, clock-align, and `last_run_at` dedup; set `enabled=true` or force through admin "Scan Sekarang" |
| `emitError` in the response body | Function response and logs | DB writes failed; inspect error details and `journal_trades` constraints |
| Empty universe | `select count(*) from journal_assets where active;` | Re-seed or force through admin "Discover Now" |

#### 2. CoinGecko/Binance 429 on the proxy (cron path)

```bash
curl -sI "https://rabalaba.pages.dev/api/coingecko/api/v3/search/trending" | grep -i x-rabalaba
# X-Rabalaba-Cache: hit = OK (cached), miss/error = upstream trouble
```

- **`X-Rabalaba-Cache: error-hit`** signals upstream 429 with stale/error serving. Wait for the 60s errorTtl to expire, or set the `COINGECKO_DEMO_API_KEY` env in the Cloudflare Pages dashboard (higher quota; the proxy injects the `x-cg-demo-api-key` header). See [`../02-technical-specs/04-cloudflare-proxy.md`](../02-technical-specs/04-cloudflare-proxy.md).
- Direct browser 429 from CoinGecko/Binance signals a per-visitor IP limit; the condition holds by design with no server-side fix (see [`../05-explainers/03-server-vs-browser.md`](../05-explainers/03-server-vs-browser.md)).

#### 3. Yahoo proxy 401 (expired crumb)

- The proxy auto-refreshes the crumb on 401, then retries. For persistent mass 401:
  - `fc.yahoo.com` crumb service down: wait; proxy stale cache covers 6h/2d.
  - CF colo IP blocked by Yahoo: rare; fall back through the `YAHOO_PROXY_BASE` Edge Function env to another mirror.

#### 4. Missing Discord alerts

- `alerted < alerts_total` with a successful run signals partial/failed webhook delivery (best-effort; the run stays green).
- Inspect the per-function `DISCORD_WEBHOOK_URL` env. Discord webhooks can expire or face revocation: recreate the webhook, set the env, redeploy the function.

#### 5. Daily-summary double-send / missing send

- Double-send: per-kind atomic claim failed; inspect `journal_settings.{kind}_last_sent_at` stamps and `daily_summary_hour`.
- Missing send: `daily_summary_enabled=false`, or `recapWindow.isSendDay=false` (non-send day), or the hour precedes `daily_summary_hour`. Force through admin "Send Recap" `{force:true, kind:'daily'}`.

> 🇮🇩 Catatan: cadence cron kanonis adalah 30m (`auto-journal-30m`), hourly (`daily-summary-hourly`), daily (`asset-discovery-daily`).
> 🇺🇸 Note: the canonical cron cadence is 30m (`auto-journal-30m`), hourly (`daily-summary-hourly`), daily (`asset-discovery-daily`).

### Deploy rollback

#### SPA (Cloudflare Pages)

- Cloudflare dashboard → project → Deployments → pick the previous deployment → **Rollback to this deployment**. Instant, no rebuild.

#### Edge Functions (Supabase)

- Supabase provides no native rollback. For a breaking deploy:
  1. `git revert` the breaking engine commit.
  2. `npm run deploy:auto-journal` (re-bundle and deploy the prior version; same pattern for `deploy:daily-summary` and `deploy:asset-discovery`).
- Prevention: before prod deploys, test locally through `supabase functions serve` and run the `scripts/find-phantom-closes.mjs` diagnostic. Hypothetical entry-filter research stays on `scripts/gate-compare.mjs`; the production journal keeps parity with the screener.

#### DB migrations

- Append-only migrations with no automatic rollback. For a breaking migration: author a new migration reverting through `drop`/`alter`; never edit the old file. See [`../../supabase/README.md`](../../supabase/README.md) principles.

### DB restore / backup

Supabase: dashboard → Project → Database → Backups. **Scheduled daily** (7d free / 30d pro retention). **PITR** on Pro+ plans only.

Restore procedure:

1. Dashboard → Backups → pick a timestamp → **Restore** (project overwrite) or "Restore to new project" (safe, parallel).
2. For same-project restore: the SPA and Edge Functions keep running, but cron `last_run_at` can time-travel; set `update journal_settings set last_run_at = now();` manually so dedup never blocks runs.
3. Verify: `select count(*) from journal_trades;` plus the admin "Scan Sekarang" smoke test.

> 🇮🇩 Backup manual sebelum eksperimen: `pg_dump` dengan connection string dashboard (`-F c -f backup.dump`).
> 🇺🇸 Manual backup before experiments: `pg_dump` with the dashboard connection string (`-F c -f backup.dump`).

### Monitoring

| Object | Method | Location |
|---|---|---|
| Cron run health | `cron.job_run_details` | SQL Editor |
| Admin diagnostics console | KPI, log stream, service-status grid | `/admin/statistics` |
| Proxy cache status | `X-Rabalaba-Cache` header | `curl -sI` per route |
| Function logs | Functions logs | Supabase dashboard |
| Edge Function errors | `emitError`/`writeError` in the response body | Manual invoke / logs |

> 🇮🇩 Belum ada: error tracking otomatis (Sentry/Discord error webhook) dan uptime alert. Rekomendasi: tambah Discord error webhook terpisah dari alert, atau Sentry.
> 🇺🇸 Not yet present: automated error tracking and uptime alerting. Recommendation: a separate Discord error webhook, or Sentry.

### Emergency pause

| Scenario | Method |
|---|---|
| Pause auto-journal without redeploy | Admin UI `/admin/assets` → pause toggle, or `update journal_settings set enabled = false;` (cron keeps ticking, function skips) |
| Full cron stop | `select cron.unschedule('auto-journal-30m');` (only for permanent removal) |
| Hourly recap stop | `select cron.unschedule('daily-summary-hourly');` (only for permanent removal) |
| Daily discovery stop | `select cron.unschedule('asset-discovery-daily');` (only for permanent removal) |
| Discovery pause | `update journal_settings set discovery_enabled = false;` or the admin toggle |
| SPA halt | Cloudflare Pages → project → Settings → **Pause** (rarely needed) |

### Related

- [`../../supabase/README.md`](../../supabase/README.md) — from-scratch setup and rebuild
- [`../02-technical-specs/07-deployment.md`](../02-technical-specs/07-deployment.md) — deploy flow
- [`../02-technical-specs/04-cloudflare-proxy.md`](../02-technical-specs/04-cloudflare-proxy.md) — proxy cache and 429
- [`01-security.md`](01-security.md) — security and RLS
