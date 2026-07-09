# Ops — Runbook Produksi / Production Runbook

> 🇮🇩 Operasi & troubleshooting produksi: cron health, 429 proxy, rollback deploy, restore DB, incident checklist.
> 🇺🇸 Production operations & troubleshooting: cron health, 429 proxy, deploy rollback, DB restore, incident checklist.

---

## TL;DR

🇮🇩 Runbook buat saat produksi bermasalah. Setup/rebuild dari nol ada di [`../../supabase/README.md`](../../supabase/README.md). Deploy flow ada di [`../tsd/07-deployment.md`](../tsd/07-deployment.md). Ini fokus **troubleshoot & operasi harian**.

🇺🇸 Runbook for when production breaks. Setup/rebuild from scratch is in [`../../supabase/README.md`](../../supabase/README.md). Deploy flow is in [`../tsd/07-deployment.md`](../tsd/07-deployment.md). This focuses on **troubleshooting & day-to-day ops**.

---

## 🩺 Quick health check

```sql
-- Cron status
select jobid, schedule, jobname, active from cron.job;
select jobname, status, start_time, return_message
  from cron.job_run_details order by start_time desc limit 10;

-- Config & last run
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
# Proxy CoinGecko (cron path) cache header
curl -sI "https://rabalaba.pages.dev/api/coingecko/api/v3/global" | grep -iE "x-rabalaba"
```

---

## 🚨 Incident playbook

### 1. Cron auto-journal gak jalan / gak emit
| Gejala / Symptom | Cek / Check | Aksi / Action |
|---|---|---|
| `cron.job` gak ada job `auto-journal-30m` | `select * from cron.job;` | Re-run `supabase/schedule-auto-journal.sql` (paste publishable key) |
| Job ada tapi `status='failed'` | `cron.job_run_details.return_message` | Cek 429/timeout di return_message → lihat §2 |
| Job sukses tapi `emitted=0` terus | `journal_settings.enabled` / `interval_minutes` / `last_run_at` | Pause? clock-align gak match? `last_run_at` dedup? Set `enabled=true`, atau admin "Scan Sekarang" force |
| `emitError` di response body | Discord/log function | Stale quote (90m) atau universe kosong → cek `journal_assets` active rows |
| Universe kosong | `select count(*) from journal_assets where active;` | Re-seed atau admin "Discover Now" |

### 2. CoinGecko/Binance 429 di proxy (cron path)
```bash
curl -sI "https://rabalaba.pages.dev/api/coingecko/api/v3/search/trending" | grep -i x-rabalaba
# X-Rabalaba-Cache: hit = OK (cached), miss/error = upstream marah
```
- **`X-Rabalaba-Cache: error-hit`** → upstream 429, proxy serve error/stale. Tunggu errorTtl (60s) expire, atau:
  - Set env `COINGECKO_DEMO_API_KEY` di Cloudflare Pages dashboard (naikin quota; proxy inject header `x-cg-demo-api-key`). Lihat [`../tsd/04-cloudflare-proxy.md`](../tsd/04-cloudflare-proxy.md).
- Browser direct CoinGecko/Binance 429 → visitor IP sendiri kena limit, gak bisa di-fix server-side (by design, lihat [`../explainer/server-vs-browser.md`](../explainer/server-vs-browser.md)).

### 3. Yahoo proxy 401 (crumb expired)
- Proxy auto-refresh crumb on 401 + retry. Kalau masih 401 massal:
  - Crumb service `fc.yahoo.com` down → tunggu, proxy cache stale 6h/2d.
  - Yahoo block IP CF colo → gampang langka; kalau terjadi, fallback env `YAHOO_PROXY_BASE` di edge function ke mirror lain.

### 4. Discord alert gak masuk
- Cron `alerted: false` tapi run sukses → webhook gagal (best-effort, gak gagalkan run).
- Cek `DISCORD_WEBHOOK_URL` env function (per function). Webhook Discord bisa ke-revoke/expire → bikin ulang webhook, set env, redeploy function.

### 5. Daily-summary double-send / gak kirim
- Double-send: per-kind atomic claim gagal → cek `journal_settings.{kind}_last_sent_at` stamp kolom, `daily_summary_hour`.
- Gak kirim: `daily_summary_enabled=false` atau `recapWindow.isSendDay=false` (bukan hari send) atau jam bukan `daily_summary_hour`. Admin force "Send Recap" `{force:true, kind:'daily'}`.

---

## 🔄 Rollback deploy

### SPA (Cloudflare Pages)
- Cloudflare dashboard → project → Deployments → pilih deployment sebelumnya → **Rollback to this deployment**. Instant, gak perlu rebuild.

### Edge Function (Supabase)
- Supabase **gak punya rollback native**. Kalau deploy baru break:
  1. `git revert` commit engine yang break.
  2. `npm run deploy:edge` (re-bundle + deploy versi lama).
- **Prevention**: sebelum deploy ke prod, test lokal `supabase functions serve` + jalankan `find-phantom-closes.mjs` diagnostic.

### DB migration
- **Migrations append-only** — gak rollback otomatis. Kalau migrasi break:
  - Tulis migrasi **baru** yang `drop`/`alter` balik (jangan edit yang lama).
  - Lihat [`../../supabase/README.md`](../../supabase/README.md) §5 prinsip.

---

## 🗄️ Restore DB / backup

🇮🇩 Supabase: dashboard → Project → Database → Backups. **Scheduled daily** (retention 7d free / 30d pro). **PITR** (Point-in-Time Recovery) cuma plan Pro+.

🇮🇧 Supabase: dashboard → Project → Database → Backups. Scheduled daily (7d free / 30d pro retention). PITR is Pro+ only.

**Restore procedure:**
1. Dashboard → Backups → pilih timestamp → **Restore** (overwrite project) **or** "Restore to new project" (safe, paralel).
2. Kalau restore ke project sama: SPA & edge function tetap jalan (gak terpengaruh), tapi cron `last_run_at` mungkin time-travel → set manual `update journal_settings set last_run_at = now();` biar dedup gak nahan.
3. Verifikasi: `select count(*) from journal_trades;` + smoke test admin "Scan Sekarang".

> 🇮🇩 **Backup manual sebelum eksperimen**: `pg_dump --host ... --db postgres --user postgres -F c -f backup.dump` (pakai connection string dari dashboard).
> 🇺🇸 **Manual backup before experimenting**: `pg_dump` with the dashboard connection string.

---

## 📊 Monitoring (yang ada sekarang)

| Apa / What | Cara / How | Lokasi / Where |
|---|---|---|
| Cron run health | `cron.job_run_details` | SQL Editor |
| Admin diagnostics console | KPI + log stream + service-status grid | `/admin/statistics` |
| Proxy cache status | `X-Rabalaba-Cache` header | `curl -sI` per route |
| Function logs | Supabase dashboard → Functions → logs | dashboard |
| Edge function error | `emitError`/`writeError` di response body | invoke manual / log |

> 🇮🇩 **Belum ada**: error tracking otomatis (Sentry/Discord error webhook), uptime alert. Rekomendasi: tambah Discord error webhook terpisah dari alert, atau Sentry.
> 🇺🇸 **Not yet**: automated error tracking, uptime alerting. Recommend: a separate Discord error webhook, or Sentry.

---

## 🧯 Pause darurat / Emergency pause

| Skenario / Scenario | Cara / How |
|---|---|
| Pause auto-journal tanpa redeploy | Admin UI `/admin/assets` → toggle pause, ATAU `update journal_settings set enabled = false;` (cron tetap tick, function skip) |
| Stop cron total | `select cron.unschedule('auto-journal-30m');` (cuma kalau mau copot permanen) |
| Pause discovery | `update journal_settings set discovery_enabled = false;` atau admin toggle |
| Hentikan SPA | Cloudflare Pages → project → Settings → **Pause** (jarang diperlukan) |

---

## 🔗 Terkait / Related
- [`../../supabase/README.md`](../../supabase/README.md) — setup & rebuild dari nol
- [`../tsd/07-deployment.md`](../tsd/07-deployment.md) — deploy flow
- [`../tsd/04-cloudflare-proxy.md`](../tsd/04-cloudflare-proxy.md) — proxy cache & 429
- [`security.md`](security.md) — security & RLS
