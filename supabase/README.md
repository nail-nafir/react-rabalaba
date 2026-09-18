# Supabase — Setup & Recovery Runbook

> 🇮🇩 Catatan dwibahasa sekuensial: seluruh bab Indonesia tampil dulu, lalu mirror English. Blok SQL dan perintah dipakai bersama (tidak diterjemahkan).
> 🇺🇸 Sequential bilingual note: full Indonesian chapters appear first, then the English mirror. SQL and command blocks stay shared (untranslated).

Terverifikasi: 2026-09-16 | Verified: 2026-09-16 — Kanonis: 38 migrasi, 16 tabel, 28 RPC.

**Project ref:** `<project-ref>` · **Function URL:** `https://<project-ref>.supabase.co/functions/v1/auto-journal`

> Nilai aktual project ref dan email owner tidak dicantumkan di git. Ganti placeholder `<project-ref>` dan `<owner-email>` dengan nilai dari dashboard saat eksekusi.

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

File di folder ini bukan kode runtime — melainkan cetak biru untuk membangun ulang database plus cron dari nol. Alur sat-set dari replay migrasi sampai smoke test tetap tertata. Migrasi aman di-rerun (idempotent). Langkah manual (seed kode, grant admin, jadwal cron) sengaja keluar dari git karena membawa secret. Checklist lengkap berada di §2.

## 🇮🇩 Isi Folder

Dua jenis file dengan peran berbeda:

| Path | Peran |
|---|---|
| `migrations/*.sql` | Cetak biru skema (tabel, RLS, function, trigger). Di-replay berurutan. |
| `schedule-*.sql` | Bukan migrasi. Wiring pg_cron per function — jalan paling akhir (butuh function plus Vault). |
| `functions/<nama>/` | Edge Function (auto-journal, daily-summary, asset-discovery): `index.ts` plus `_engine.mjs` plus `deno.json`. |
| `functions/.env` | Env lokal untuk `functions serve` saja (gitignored). |
| `config.toml` | Config function (`verify_jwt = false`, handler auth). |

### Migrasi (urutan = urutan nama file, 38 file)

Urutan wajib karena ada ketergantungan (contoh `profiles` dibuat di migrasi awal, `is_admin()` menyusul, fitur lanjutan memakai keduanya).

| # | File | Isi |
|---|---|---|
| 1 | `20260613000001_journal_trades` | Track-record auto-journal plus RLS read-only |
| 2 | `20260613000002_access_codes` | `access_codes` plus `verify_access_code()` |
| 3 | `20260614000001_auth_entitlements` | `profiles`, `code_redemptions`, `redeem_access_code()`, trigger signup |
| 4 | `20260614000002_journal_premium_rls` | `is_premium()` plus gate baca jurnal premium |
| 5 | `20260615000001_user_favorites` | Favorit per user plus RLS own-rows |
| 6 | `20260617000001_journal_assets` | Universe cron data-driven plus `is_admin()` |
| 7 | `20260617000002_journal_settings` | Jadwal cron data-driven (interval, pause, market-hours) |
| 8 | `20260620000001_journal_assets_premium_read` | Policy baca universe premium |
| 9–10 | `20260621000001…20260622000001` | Status reversal plus rename status legacy |
| 11–19 | `20260623000001…09` | RPC admin user dan access code |
| 20 | `20260625000001_subscription` | Paket langganan plus metode pembayaran |
| 21 | `20260625000002_disclaimer` | Disclaimer versioned plus agreement |
| 22–24 | `20260625000003…20260626000001` | Invitation, redemption, listing admin |
| 25 | `20260629000001_journal_daily_summary` | Konfigurasi rangkuman harian |
| 26 | `20260701000001_profile_last_active` | Aktivitas terakhir profil |
| 27 | `20260702000001_asset_discovery` | Auto-discovery universe |
| 28 | `20260702000002_journal_periodic_summary` | Rangkuman mingguan dan bulanan |
| 29 | `20260713093413_user_testimonials` | Testimoni privat, snapshot publik, moderasi |
| 30 | `20260714000000_remove_persona_add_verified_purchase` | Bukti purchase testimoni |
| 31 | `20260722025846_public_journal_success_rates` | Agregat success-rate publik |
| 32–33 | `20260727042144…20260727045554` | Periode jurnal aktif plus bulan |
| 34 | `20260728125625_backfill_journal_asset_names` | Backfill nama aset |
| 35 | `20260822000001_engine_hardening` | Hardening engine plus `claim_auto_journal_slot` |
| 36 | `20260829100120_progressive_exit_v4` | Exit progressive plus `exit_reason` exact |
| 37 | `20260830095557_exclude_breakeven_from_public_win_rate` | Impas keluar denominator publik |
| 38 | `20260901000001_engine_v5_signal_episodes` | `journal_signal_states` episodes |

## 🇮🇩 Recovery Dari Nol

Skenario: project hilang, pindah, atau staging baru. Ikuti urutan.

### Step 1 — Replay Migrasi

Cara utama (CLI). `db push` membaca folder `migrations/` dan menerapkan berurutan berdasar timestamp.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Fallback manual: buka **SQL Editor**, lalu paste file migrasi **urut #1 → #38**. Aman bila dobel (pola idempotent `create ... if not exists`, `create or replace`, `drop policy if exists`).

### Step 2 — Seed Access Codes (MANUAL)

Kode redeem sengaja tidak ada di git. Buat di SQL Editor:

```sql
-- kode premium sekali pakai
insert into public.access_codes (code, kind, max_redemptions)
  values ('<premium code>', 'full', 1) on conflict (code) do nothing;

-- kode trial bersama (sekali per akun; durasi ikut VITE_TRIAL_DURATION)
insert into public.access_codes (code, kind, trial_days)
  values ('<trial code>', 'trial', 7) on conflict (code) do nothing;
```

### Step 3 — Grant Admin ke Owner (MANUAL)

Daftarkan akun owner via app dulu (agar trigger membuat baris `profiles`), lalu jalankan:

```sql
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = '<owner-email>');
```

### Step 4 — Deploy Edge Function

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` auto-inject saat deploy — tanpa `supabase secrets set`. `CRON_SECRET` dan opsional `DISCORD_WEBHOOK_URL` merupakan secret function terpisah.

```bash
npm run deploy:auto-journal     # = build:edge (bundle _engine.mjs) + deploy auto-journal
npm run deploy:daily-summary    # = build:edge + deploy daily-summary
npm run deploy:asset-discovery  # = build:edge + deploy asset-discovery
```

### Step 5 — Jadwalkan Cron (MANUAL)

Jalankan `schedule-auto-journal.sql` di SQL Editor. File tersebut membuat secret acak `rabalaba_cron_secret` di Vault; set nilai sama sebagai secret `CRON_SECRET` function. Lanjutkan dua schedule lain (reuse secret Vault yang sama).

> Cron tidak memakai publishable key sebagai autentikasi job; handler memvalidasi `x-cron-secret`. `force=true` tetap memvalidasi session admin/owner.

### Step 6 — Smoke Test

```sql
select jobid, schedule, jobname from cron.job;
select * from cron.job_run_details order by start_time desc limit 5;
select count(*) from public.journal_trades;
select * from public.journal_settings;
select count(*) from public.testimonial_submissions;
select * from public.featured_testimonials order by slot;
```

## 🇮🇩 Operasi Harian

**Ubah engine atau logika cron** → edit `src/core/edge-engine.ts`, lalu `npm run deploy:auto-journal` (re-bundle `_engine.mjs` plus deploy). Tanpa edit manual `_engine.mjs` — artefak build tersebut tertimpa tiap build.

**Ubah universe atau jadwal** → via admin UI `/admin` (data-driven; tabel `journal_assets` dan `journal_settings`). Tanpa rebuild atau redeploy.

**Kelola cron:**

```sql
select * from cron.job_run_details order by start_time desc limit 10;
select cron.unschedule('auto-journal-30m');
```

> Pause sementara lebih baik via `journal_settings.enabled = false` di admin UI — cron tetap tick tetapi function skip. Unschedule hanya untuk pencopotan permanen.

## 🇮🇩 Local Dev

Jalankan function lokal memakai `.env` (gitignored; berisi `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run build:edge
supabase functions serve auto-journal --env-file supabase/functions/.env
```

## 🇮🇩 Prinsip Penting

- **Migrasi append-only.** Schema berubah = file baru. Tanpa edit file yang sudah apply di prod.
- **Tanpa squash.** Kecil, idempotent, tiap file = satu fase audit trail. Squash berisiko merusak rebuild tanpa manfaat.
- **Langkah MANUAL membawa secret** (kode, grant admin, cron secret). Karena itu keluar dari git; nilai tidak pernah di-commit.
- **Apply manual via SQL Editor** membuat CLI tracker tidak tahu. `supabase db push` mungkin apply ulang — aman karena idempotent.

## 🇮🇩 Tautan Terkait

- Skema: `../docs/02-technical-specs/03-database-schema.md`
- Deploy: `../docs/02-technical-specs/07-deployment.md`
- Runbook: `../docs/04-operations/00-runbook.md`

---

<a id="english-part"></a>

## 🇺🇸 Summary

Folder files serve not as runtime code — but as blueprint for rebuilding database plus cron from zero. Tidy flow from migration replay to smoke test stays ordered. Migrations rerun safely (idempotent). Manual steps (seed codes, admin grants, cron schedules) stay out of git because secrets ride along. Full checklist lives in §2.

## 🇺🇸 Folder Contents

Two file kinds with separate roles:

| Path | Role |
|---|---|
| `migrations/*.sql` | Schema blueprint (tables, RLS, functions, triggers). Replayed in order. |
| `schedule-*.sql` | Not migrations. Per-function pg_cron wiring — runs last (needs functions plus Vault). |
| `functions/<name>/` | Edge Functions (auto-journal, daily-summary, asset-discovery): `index.ts` plus `_engine.mjs` plus `deno.json`. |
| `functions/.env` | Local env for `functions serve` only (gitignored). |
| `config.toml` | Function config (`verify_jwt = false`, handler auth). |

### Migrations (order = filename order, 38 files)

Order stays mandatory through dependencies (example `profiles` created early, `is_admin()` follows, later features use both).

| # | File | Contents |
|---|---|---|
| 1 | `20260613000001_journal_trades` | Auto-journal track record plus read-only RLS |
| 2 | `20260613000002_access_codes` | `access_codes` plus `verify_access_code()` |
| 3 | `20260614000001_auth_entitlements` | `profiles`, `code_redemptions`, `redeem_access_code()`, signup trigger |
| 4 | `20260614000002_journal_premium_rls` | `is_premium()` plus premium journal read gate |
| 5 | `20260615000001_user_favorites` | Per-user favorites plus own-row RLS |
| 6 | `20260617000001_journal_assets` | Data-driven cron universe plus `is_admin()` |
| 7 | `20260617000002_journal_settings` | Data-driven cron schedule (interval, pause, market hours) |
| 8 | `20260620000001_journal_assets_premium_read` | Premium universe read policy |
| 9–10 | `20260621000001…20260622000001` | Reversal status plus legacy status rename |
| 11–19 | `20260623000001…09` | Admin user plus access-code RPCs |
| 20 | `20260625000001_subscription` | Subscription plans plus payment methods |
| 21 | `20260625000002_disclaimer` | Versioned disclaimer plus agreements |
| 22–24 | `20260625000003…20260626000001` | Invitations, redemptions, admin listing |
| 25 | `20260629000001_journal_daily_summary` | Daily summary config |
| 26 | `20260701000001_profile_last_active` | Profile last activity |
| 27 | `20260702000001_asset_discovery` | Universe auto-discovery |
| 28 | `20260702000002_journal_periodic_summary` | Weekly plus monthly summaries |
| 29 | `20260713093413_user_testimonials` | Private testimonials, public snapshots, moderation |
| 30 | `20260714000000_remove_persona_add_verified_purchase` | Testimonial purchase proof |
| 31 | `20260722025846_public_journal_success_rates` | Public success-rate aggregates |
| 32–33 | `20260727042144…20260727045554` | Active journal period plus months |
| 34 | `20260728125625_backfill_journal_asset_names` | Asset-name backfill |
| 35 | `20260822000001_engine_hardening` | Engine hardening plus `claim_auto_journal_slot` |
| 36 | `20260829100120_progressive_exit_v4` | Progressive exit plus exact `exit_reason` |
| 37 | `20260830095557_exclude_breakeven_from_public_win_rate` | Breakeven out of public denominator |
| 38 | `20260901000001_engine_v5_signal_episodes` | `journal_signal_states` episodes |

## 🇺🇸 Rebuild From Scratch

Scenario: lost project, migration, or fresh staging. Follow order.

### Step 1 — Replay Migrations

Primary method (CLI). `db push` reads `migrations/` plus applies in timestamp order.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Manual fallback: open **SQL Editor**, then paste migration files **ordered #1 → #38**. Double runs stay safe (idempotent patterns `create ... if not exists`, `create or replace`, `drop policy if exists`).

### Step 2 — Seed Access Codes (MANUAL)

Redeem codes stay out of git by design. Create in SQL Editor:

```sql
-- single-use premium code
insert into public.access_codes (code, kind, max_redemptions)
  values ('<premium code>', 'full', 1) on conflict (code) do nothing;

-- shared trial code (once per account; length follows VITE_TRIAL_DURATION)
insert into public.access_codes (code, kind, trial_days)
  values ('<trial code>', 'trial', 7) on conflict (code) do nothing;
```

### Step 3 — Grant Admin to Owner (MANUAL)

Register the owner account via app first (so triggers create `profiles` rows), then run:

```sql
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = '<owner-email>');
```

### Step 4 — Deploy Edge Functions

`SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` auto-inject on deploy — no `supabase secrets set`. `CRON_SECRET` plus optional `DISCORD_WEBHOOK_URL` remain separate function secrets.

```bash
npm run deploy:auto-journal     # = build:edge (bundle _engine.mjs) + deploy auto-journal
npm run deploy:daily-summary    # = build:edge + deploy daily-summary
npm run deploy:asset-discovery  # = build:edge + deploy asset-discovery
```

### Step 5 — Schedule Crons (MANUAL)

Run `schedule-auto-journal.sql` in SQL Editor. File creates random `rabalaba_cron_secret` in Vault; set the same value as function secret `CRON_SECRET`. Continue with two other schedules (same Vault secret reuse).

> Cron uses no publishable key as job auth; handlers validate `x-cron-secret`. `force=true` still validates admin/owner sessions.

### Step 6 — Smoke Test

```bash
# same SQL as Indonesian section: cron.job, job_run_details, journal_trades,
# journal_settings, testimonial_submissions, featured_testimonials
```

```sql
select jobid, schedule, jobname from cron.job;
select * from cron.job_run_details order by start_time desc limit 5;
select count(*) from public.journal_trades;
select * from public.journal_settings;
select count(*) from public.testimonial_submissions;
select * from public.featured_testimonials order by slot;
```

## 🇺🇸 Day-to-Day Ops

**Engine or cron logic shifts** → edit `src/core/edge-engine.ts`, then `npm run deploy:auto-journal` (re-bundles `_engine.mjs` plus deploys). No manual `_engine.mjs` edits — build artifacts overwrite each build.

**Universe or schedule shifts** → via `/admin` UI (data-driven; `journal_assets` plus `journal_settings` tables). No rebuild or redeploy.

**Cron management:**

```sql
select * from cron.job_run_details order by start_time desc limit 10;
select cron.unschedule('auto-journal-30m');
```

> Temporary pause prefers `journal_settings.enabled = false` in admin UI — cron keeps ticking but functions skip. Unschedule only for permanent removal.

## 🇺🇸 Local Dev

Run functions locally with `.env` (gitignored; holds `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run build:edge
supabase functions serve auto-journal --env-file supabase/functions/.env
```

## 🇺🇸 Key Principles

- **Append-only migrations.** Schema shifts equal fresh files. No edits to prod-applied files.
- **No squash.** Small, idempotent, each file equals one audit-trail phase. Squash risks rebuilds sans benefit.
- **MANUAL steps carry secrets** (codes, admin grants, cron secret). Hence outside git; values never committed.
- **Manual SQL Editor applies** leave CLI tracker unaware. `supabase db push` may re-apply — safe through idempotency.

## 🇺🇸 Related Links

- Schema: `../docs/02-technical-specs/03-database-schema.md`
- Deploy: `../docs/02-technical-specs/07-deployment.md`
- Runbook: `../docs/04-operations/00-runbook.md`
