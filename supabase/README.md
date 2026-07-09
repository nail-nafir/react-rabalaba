# Supabase — Setup & Recovery Runbook

> 🇮🇩 Catatan dwibahasa: tiap langkah ditulis Indonesia lalu English. Blok SQL/perintah dipakai bersama (tidak diterjemahkan).
> 🇺🇸 Bilingual note: every step is written in Indonesian then English. SQL/command blocks are shared (not translated).

**Project ref:** `nravncsodgcxwkdaeqcw` · **Function URL:** `https://nravncsodgcxwkdaeqcw.supabase.co/functions/v1/auto-journal`

---

## TL;DR

🇮🇩 File di folder ini **bukan** kode runtime — dia cetak biru buat **membangun ulang** database + cron dari nol. Migration aman di-rerun (idempotent). Yang sering kelupaan adalah langkah **manual** (seed kode, grant admin, jadwal cron) yang sengaja keluar dari git karena rahasia. Bagian [§2](#2-recovery-dari-nol--rebuild-from-scratch) adalah checklist lengkapnya.

🇺🇸 The files here are **not** runtime code — they are the blueprint to **rebuild** the database + cron from scratch. Migrations are safe to re-run (idempotent). The easy-to-forget parts are the **manual** steps (seed codes, grant admin, schedule cron) deliberately kept out of git because they carry secrets. [§2](#2-recovery-dari-nol--rebuild-from-scratch) is the full checklist.

---

## 1. Isi folder / What's in here

🇮🇩 Ada **dua jenis** file dengan peran berbeda:
🇺🇸 There are **two kinds** of files with different roles:

| Path | 🇮🇩 Peran | 🇺🇸 Role |
|------|----------|---------|
| `migrations/*.sql` | Cetak biru skema (tabel, RLS, function, trigger). Di-replay berurutan. | Schema blueprint (tables, RLS, functions, triggers). Replayed in order. |
| `schedule-*.sql` | **Bukan** migration. Wiring pg_cron per function (auto-journal / daily-summary / asset-discovery) — jalan **paling akhir** (butuh function + Vault). | **Not** migrations. pg_cron wiring per function (auto-journal / daily-summary / asset-discovery) — runs **last** (needs functions + Vault). |
| `functions/<nama>/` | Edge Function (auto-journal, daily-summary, asset-discovery): `index.ts` (handler) + `_engine.mjs` (engine hasil bundle) + `deno.json`. | Edge Functions (auto-journal, daily-summary, asset-discovery): `index.ts` (handler) + `_engine.mjs` (bundled engine) + `deno.json`. |
| `functions/.env` | Env **lokal** untuk `functions serve` saja (gitignored). | **Local-only** env for `functions serve` (gitignored). |
| `config.toml` | Config function (`verify_jwt = true`). | Function config (`verify_jwt = true`). |

### Migrations (urutan = urutan nama file / order = filename order)

🇮🇩 Urutan wajib — ada ketergantungan (mis. `is_admin()` dibuat di `06`, dipakai `07`; `profiles` dibuat di `03`, di-`alter` oleh `06`).
🇺🇸 Order is mandatory — there are dependencies (e.g. `is_admin()` is created in `06` and used by `07`; `profiles` is created in `03` and `alter`ed by `06`).

| # | File | 🇮🇩 Isi / 🇺🇸 Contents |
|---|------|----------|
| 1 | `20260613000001_journal_trades` | Tabel track-record auto-journal + RLS read-only. / Auto-journal track-record table + read-only RLS. |
| 2 | `20260613000002_access_codes` | `access_codes` + `verify_access_code()`. |
| 3 | `20260614000001_auth_entitlements` | `profiles`, `code_redemptions`, `redeem_access_code()`, trigger signup. |
| 4 | `20260614000002_journal_premium_rls` | `is_premium()` + gate baca journal khusus premium. / `is_premium()` + premium-only journal read gate. |
| 5 | `20260615000001_user_favorites` | Favorites per-user + RLS own-rows. |
| 6 | `20260617000001_journal_assets` | Universe cron data-driven + `profiles.is_admin` + `is_admin()`. |
| 7 | `20260617000002_journal_settings` | Jadwal cron data-driven (interval/pause/market-hours). / Data-driven cron schedule (interval/pause/market-hours). |

---

## 2. Recovery dari nol / Rebuild from scratch

🇮🇩 Skenario: project hilang / pindah / bikin staging baru. Ikuti urut.
🇺🇸 Scenario: project lost / migrated / fresh staging. Follow in order.

### Step 1 — Replay semua migration / Replay all migrations

🇮🇩 Cara utama (CLI). `db push` membaca folder `migrations/` dan menerapkan berurutan berdasar timestamp.
🇺🇸 Primary method (CLI). `db push` reads the `migrations/` folder and applies them in timestamp order.

```bash
supabase link --project-ref nravncsodgcxwkdaeqcw
supabase db push
```

🇮🇩 Fallback manual: buka **SQL Editor**, paste isi tiap file **urut #1 → #7**. Aman kalau dobel (semua idempotent: `create ... if not exists`, `create or replace`, `drop policy if exists`).
🇺🇸 Manual fallback: open the **SQL Editor**, paste each file's contents **in order #1 → #7**. Safe to repeat (all idempotent: `create ... if not exists`, `create or replace`, `drop policy if exists`).

### Step 2 — Seed access codes (MANUAL)

🇮🇩 Kode redeem sengaja TIDAK ada di git. Bikin di SQL Editor:
🇺🇸 Redeem codes are deliberately NOT in git. Create them in the SQL Editor:

```sql
-- 🇮🇩 kode premium sekali pakai / 🇺🇸 single-use premium code
insert into public.access_codes (code, kind, max_redemptions)
  values ('<premium code>', 'full', 1) on conflict (code) do nothing;

-- 🇮🇩 kode trial bersama (siapa pun, sekali per akun, 7 hari) / 🇺🇸 shared trial code (anyone, once each, 7 days)
insert into public.access_codes (code, kind, trial_days)
  values ('<trial code>', 'trial', 7) on conflict (code) do nothing;
```

### Step 3 — Grant admin ke owner (MANUAL)

🇮🇩 Daftar dulu akun owner lewat app (biar baris `profiles` kebuat oleh trigger), baru jalankan:
🇺🇸 First sign up the owner account via the app (so the trigger creates the `profiles` row), then run:

```sql
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = 'nf.nailulfirdaus@gmail.com');
```

### Step 4 — Deploy Edge Function

🇮🇩 `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` **auto-inject saat deploy** — JANGAN di-set via `supabase secrets set`. Tidak ada secret function lain.
🇺🇸 `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected on deploy** — do NOT set them via `supabase secrets set`. There are no other function secrets.

```bash
npm run deploy:edge        # = build:edge (bundle _engine.mjs) + deploy auto-journal
npm run deploy:summary     # deploy daily-summary
npm run deploy:discovery   # deploy asset-discovery (auto universe curation)
```

### Step 5 — Jadwalkan cron / Schedule the crons (MANUAL)

🇮🇩 Buka `schedule-auto-journal.sql`, **paste publishable key** di placeholder `auto_journal_bearer`, lalu jalankan seluruh file di SQL Editor. Dia: enable `pg_cron`+`pg_net`, simpan URL+bearer di Vault, dan `cron.schedule('auto-journal-30m', ...)`. Lanjutkan dengan `schedule-daily-summary.sql` dan `schedule-asset-discovery.sql` (keduanya reuse bearer yang sama dari Vault).
🇺🇸 Open `schedule-auto-journal.sql`, **paste the publishable key** into the `auto_journal_bearer` placeholder, then run the whole file in the SQL Editor. It: enables `pg_cron`+`pg_net`, stashes URL+bearer in Vault, and runs `cron.schedule('auto-journal-30m', ...)`. Then run `schedule-daily-summary.sql` and `schedule-asset-discovery.sql` (both reuse the same Vault bearer).

> 🇮🇩 Bearer = **publishable** key (memang publik); cukup buat lolos gateway. Function tetap nulis pakai service-role.
> 🇺🇸 Bearer = the **publishable** key (it's public anyway); enough to pass the gateway. The function still writes with the service-role key.

### Step 6 — (Opsional) Pertajam cadence ke 15 menit / (Optional) Retune cadence to 15 min

🇮🇩 `interval_minutes` di `journal_settings` cuma bisa sehalus tick cron. Default cron `*/30`; jadikan `*/15` sekali:
🇺🇸 `interval_minutes` in `journal_settings` can only be as fine as the cron tick. Default cron is `*/30`; make it `*/15` once:

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'auto-journal-30m'),
  schedule := '*/15 * * * *'
);
```

### Step 7 — Smoke test

```sql
select jobid, schedule, jobname from cron.job;                          -- 🇮🇩 cron terjadwal? / 🇺🇸 cron scheduled?
select * from cron.job_run_details order by start_time desc limit 5;    -- 🇮🇩 ada run sukses? / 🇺🇸 any successful runs?
select count(*) from public.journal_trades;                            -- 🇮🇩 trade masuk? / 🇺🇸 trades landing?
select * from public.journal_settings;                                  -- 🇮🇩 config kebaca? / 🇺🇸 config present?
```

---

## 3. Operasi harian / Day-to-day ops

🇮🇩 **Ubah engine / logika cron** → edit `src/core/edge-engine.ts`, lalu `npm run deploy:edge` (re-bundle `_engine.mjs` + deploy). Jangan edit `_engine.mjs` tangan — itu artefak build.
🇺🇸 **Change engine / cron logic** → edit `src/core/edge-engine.ts`, then `npm run deploy:edge` (re-bundles `_engine.mjs` + deploys). Never hand-edit `_engine.mjs` — it's a build artifact.

🇮🇩 **Ubah universe / jadwal** → lewat **admin UI** di `/admin` (data-driven; tabel `journal_assets` & `journal_settings`). Gak perlu rebuild/redeploy.
🇺🇸 **Change universe / schedule** → via the **admin UI** at `/admin` (data-driven; `journal_assets` & `journal_settings` tables). No rebuild/redeploy needed.

🇮🇩 **Kelola cron** / 🇺🇸 **Manage cron:**

```sql
select * from cron.job_run_details order by start_time desc limit 10;  -- 🇮🇩 cek run / 🇺🇸 inspect runs
select cron.unschedule('auto-journal-30m');                            -- 🇮🇩 matikan / 🇺🇸 stop
```

> 🇮🇩 Untuk pause sementara, lebih baik set `journal_settings.enabled = false` lewat admin UI — cron tetap tick tapi function skip. Unschedule hanya kalau mau benar-benar copot.
> 🇺🇸 To pause temporarily, prefer setting `journal_settings.enabled = false` via the admin UI — the cron keeps ticking but the function skips. Only unschedule to fully remove it.

---

## 4. Local dev

🇮🇩 Jalankan function lokal pakai `.env` (gitignored; isi `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):
🇺🇸 Run the function locally using `.env` (gitignored; holds `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run build:edge                       # 🇮🇩 bundle engine dulu / 🇺🇸 bundle the engine first
supabase functions serve auto-journal --env-file supabase/functions/.env
```

---

## 5. Prinsip penting / Key principles

- 🇮🇩 **Migration itu append-only.** Skema berubah = file baru, bukan ngedit yang lama (yang sudah keapply di prod). / 🇺🇸 **Migrations are append-only.** Schema changes = a new file, never editing an already-applied one.
- 🇮🇩 **Jangan diringkas/di-squash.** Kecil, idempotent, dan tiap file = satu fase (audit trail). Squash = risiko rusak pas rebuild, manfaat nol. / 🇺🇸 **Don't condense/squash.** Small, idempotent, one file per phase (audit trail). Squashing risks breaking rebuilds for zero benefit.
- 🇮🇩 **Langkah MANUAL = bawa secret** (kode, grant admin, bearer key). Itu sebabnya keluar dari git; jangan commit nilainya. / 🇺🇸 **MANUAL steps carry secrets** (codes, admin grant, bearer key). That's why they're out of git; never commit the values.
- 🇮🇩 **Kalau dulu apply manual via SQL Editor**, tracking CLI belum tahu. `supabase db push` mungkin coba apply ulang — **aman** karena idempotent. / 🇺🇸 **If you previously applied manually via the SQL Editor**, the CLI tracker doesn't know. `supabase db push` may try to re-apply — **safe** because they're idempotent.
