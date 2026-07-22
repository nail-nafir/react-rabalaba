# TSD 03 — Database Schema

> 🇮🇩 Schema Supabase Postgres: 15 tabel, 25 function/RPC, RLS, 30 migrasi.
> 🇺🇸 Supabase Postgres schema: 15 tables, 25 functions/RPCs, RLS, 30 migrations.

---

## TL;DR

🇮🇩 30 migrasi timestamp-order (idempotent) di `supabase/migrations/` bikin 15 tabel + 25 function/RPC + 5 trigger + RLS penuh. Ekstensi: `pg_cron`, `pg_net`, `vault`. Project ref `nravncsodgcxwkdaeqcw`. Tipe schema hand-written ada di `src/services/supabase/database.types.ts` (type-only, edge-safe).

🇺🇸 30 timestamp-ordered idempotent migrations in `supabase/migrations/` create 15 tables + 25 functions/RPCs + 5 triggers + full RLS. Extensions: `pg_cron`, `pg_net`, `vault`. Project ref `nravncsodgcxwkdaeqcw`. Hand-written schema types live in `src/services/supabase/database.types.ts` (type-only, edge-safe).

---

## 📋 Tabel / Tables (15)

| Tabel / Table | PK | Kunci / Key columns | RLS policy |
|---|---|---|---|
| `journal_trades` | id | symbol, signal, status `open\|tp1\|tp2\|tp3\|sl\|reversed\|manual`, opened_at, closed_at, reversed | `journal_trades_premium_read` — authenticated + `is_premium()`. Write: service-role only; unique partial index menjaga satu trade terbuka per simbol/timeframe. Public aggregate hanya lewat `get_public_journal_success_rates()` |
| `journal_assets` | symbol | name, asset_type, active, source `admin\|auto`, discovery_reason, last_discovered_at, sort_order, created_by | premium read (`is_premium()`) OR admin (`is_admin()`). Admin all (FOR ALL) |
| `journal_settings` | bool singleton | enabled, interval_minutes, market_hours_only, last_run_at, daily/weekly/monthly summary flags+hour+stamps, discovery flags+caps+prune | admin all |
| `profiles` | user_id→auth.users | tier `free\|trial\|premium`, trial_expires_at, is_admin, is_owner, is_blocked, last_active_at | own-row select |
| `access_codes` | code | kind `full\|trial`, max_redemptions, trial_days, note | no policies (locked) |
| `code_redemptions` | code+user_id | — | own select |
| `user_favorites` | user_id+symbol | — | own select/insert/delete |
| `subscription_plans` | slug | JSONB bilingual name/description/price/features, cta_kind, highlighted | public read + admin write |
| `payment_methods` | uuid | category `bank\|ewallet\|qris\|crypto` | public read + admin write |
| `disclaimer` | bool singleton | version, JSONB bilingual clauses | public read + admin write |
| `disclaimer_agreements` | user_id+version | agreed_at | own insert, own-or-admin read |
| `invitations` | code | kind, trial_days, max_redemptions, recipient_label, expires_at, revoked | no policies (locked) |
| `invitation_redemptions` | code+user_id | — | own select |
| `testimonial_submissions` | id | unique user_id, display_name, persona, body, rating, status, private rejection/reviewer fields | non-blocked owner CRUD own row; admin all. Trigger forces new/edited content to `pending` and removes stale featured snapshot |
| `featured_testimonials` | slot 1–6 | unique submission_id + public-safe content snapshot | anon/authenticated read; admin write. Trigger accepts approved submissions only and copies snapshot server-side |

> Seed: `journal_assets` seed `EDGE_UNIVERSE`; `subscription_plans` seed 3 plan (Citizen/Veteran/Lord); `payment_methods` seed 6 channel; `disclaimer` seed v1; `journal_settings` seed 1 row.

---

## ⚙️ Function/RPC (25)

| RPC | Guard | Fungsi / Purpose |
|---|---|---|
| `verify_access_code(p_code)` | — | return kind (no reveal) |
| `redeem_access_code(p_code)` | row-locked | grant premium/trial → `premium\|trial\|invalid\|exhausted\|already\|unauthenticated` |
| `is_premium()` | — | true kalau premium OR trial aktif (respect `is_blocked`) |
| `is_admin()` | — | admin OR owner (respect blocked) |
| `is_owner()` | — | owner (respect blocked) |
| `handle_new_user()` | trigger | auto-create `free` profile on signup |
| `set_updated_at()` | trigger | stamp `updated_at` |
| `get_public_journal_success_rates()` | anon-safe aggregate | per-symbol `{symbol,wins,total}` dari trade tertutup; tidak mengekspos row jurnal |
| `touch_last_active()` | own-row | stamp `profiles.last_active_at` |
| `admin_list_users()` | `is_admin()` | join auth.users↔profiles↔redemptions↔codes↔disclaimer |
| `admin_list_access_codes()` | `is_admin()` | list codes |
| `admin_create_user(email,pw,tier,is_admin,is_owner,p_trial_expires_at,p_is_blocked)` | `is_admin()` | bcrypt insert auth.users + profile |
| `admin_create_access_code(code,kind,max_redemptions,trial_days,note)` | `is_admin()` | mint code |
| `admin_delete_access_code(code)` | `is_admin()` | cascade redemptions |
| `admin_toggle_block_user(uuid,bool)` | `is_admin()` | can't block self |
| `admin_delete_user(uuid)` | `is_admin()` | can't delete self, cascade |
| `admin_update_user(user_id,tier,is_admin,is_owner,p_trial_expires_at,p_is_blocked)` | `is_admin()` | can't demote self, auto trial expiry |
| `peek_invitation(code)` | anon-safe | preview `{valid,reason,kind,trial_days}` |
| `redeem_invitation(code)` | row-locked | grant → `premium\|trial\|invalid\|expired\|revoked\|exhausted\|already\|already_premium\|unauthenticated` |
| `admin_create_invitation(...)` | `is_admin()` | 12-hex random code |
| `admin_list_invitations()` | `is_admin()` | list |
| `admin_revoke_invitation(code,bool)` | `is_admin()` | revoke |
| `admin_delete_invitation(code)` | `is_admin()` | delete |
| `admin_set_featured_testimonial(submission_id,slot)` | `is_admin()` + RLS, `SECURITY INVOKER` | atomically move an approved submission into slot 1–6, replacing the current occupant |
| `admin_unfeature_testimonial(submission_id?,slot?)` | `is_admin()` + RLS, `SECURITY INVOKER` | remove one featured snapshot; rejects an unscoped call |

> Fungsi trigger privat `private.enforce_testimonial_submission_write`, `private.populate_featured_testimonial_snapshot`, dan `private.unfeature_blocked_user_testimonials` tidak diekspos sebagai Data API RPC. Execute privilege dicabut dari role client.
>
> Private trigger functions `private.enforce_testimonial_submission_write`, `private.populate_featured_testimonial_snapshot`, and `private.unfeature_blocked_user_testimonials` are not exposed as Data API RPCs. Client roles have no execute privilege.

---

## 🔒 RLS principles

🇮🇩 - **User data** (`profiles`, `user_favorites`, `code_redemptions`, `invitation_redemptions`, `disclaimer_agreements`): own-row select.
- **Testimonial privat** (`testimonial_submissions`): pemilik non-blocked CRUD row sendiri; admin moderasi semua row.
- **Public data** (`subscription_plans`, `payment_methods`, `disclaimer`, `featured_testimonials`): public read. Featured testimonial hanya snapshot tanpa email/user/reviewer ID atau alasan penolakan.
- **Locked** (`access_codes`, `invitations`): no policies (gak bisa dibaca client) — akses lewat RPC.
- **Premium data** (`journal_trades`, `journal_assets`): `is_premium()` OR admin.
- **Admin data** (`journal_settings`): `is_admin()`.
- **Writes sensitif**: service-role atau RPC/policy admin. Pengecualian terkontrol: pengguna non-blocked menulis testimoni sendiri; trigger selalu melindungi status moderasi dan snapshot publik.

🇺🇸 - **User data**: own-row select. **Private testimonials**: non-blocked owners CRUD their row; admins moderate all rows. **Public data**: public read, with featured testimonials limited to a public-safe snapshot. **Locked**: no policies (RPC-only). **Premium data**: `is_premium()` OR admin. **Admin data**: `is_admin()`. **Sensitive writes**: service-role or admin RPC/policy; the controlled exception is a non-blocked user writing their own testimonial while triggers protect moderation and publication state.

---

## 📜 Migrasi (30, timestamp order)

| # | File | Bikin / Creates |
|---|---|---|
| 1 | `20260613000001_journal_trades.sql` | `journal_trades` + unique partial index one-open-per-symbol+tf + `set_updated_at` trigger |
| 2 | `20260613000002_access_codes.sql` | `access_codes` + `verify_access_code` |
| 3 | `20260614000001_auth_entitlements.sql` | `profiles` + `handle_new_user` trigger + `code_redemptions` + `redeem_access_code` |
| 4 | `20260614000002_journal_premium_rls.sql` | `is_premium()` + premium RLS `journal_trades` |
| 5 | `20260615000001_user_favorites.sql` | `user_favorites` |
| 6 | `20260617000001_journal_assets.sql` | `journal_assets` (seed EDGE_UNIVERSE) + `is_admin()` |
| 7 | `20260617000002_journal_settings.sql` | `journal_settings` singleton |
| 8 | `20260620000001_journal_assets_premium_read.sql` | premium read `journal_assets` |
| 9 | `20260621000001_journal_trades_reversed.sql` | add `reversed` |
| 10 | `20260622000001_journal_status_reversed.sql` | rename `manual`→`reversed` |
| 11 | `20260623000001_admin_list_users.sql` | `admin_list_users` + `admin_list_access_codes` |
| 12 | `20260623000002_add_owner_role.sql` | `is_owner` + `is_admin` rewrite |
| 13-19 | `20260623000003…09` | admin create/update/block/delete user + access code RPCs (progressive param adds) |
| 20 | `20260625000001_subscription.sql` | `subscription_plans` + `payment_methods` (seed) |
| 21 | `20260625000002_disclaimer.sql` | `disclaimer` + `disclaimer_agreements` (seed v1) |
| 22 | `20260625000003_invitations.sql` | `invitations` + `invitation_redemptions` + 5 invite RPCs |
| 23 | `20260625000004_admin_list_users_disclaimer.sql` | add disclaimer cols to admin_list_users |
| 24 | `20260626000001_invitation_skip_premium.sql` | `redeem_invitation` short-circuit already-premium |
| 25 | `20260629000001_journal_daily_summary.sql` | daily summary cols on `journal_settings` |
| 26 | `20260701000001_profile_last_active.sql` | `last_active_at` + `touch_last_active` |
| 27 | `20260702000001_asset_discovery.sql` | `journal_assets.source` + discovery cols on `journal_settings` |
| 28 | `20260702000002_journal_periodic_summary.sql` | weekly/monthly summary cols |
| 29 | `20260713093413_user_testimonials.sql` | private submissions + public featured snapshots, constraints, RLS/grants, moderation/snapshot triggers, 2 admin RPCs |
| 30 | `20260722025846_public_journal_success_rates.sql` | partial covering index + public aggregate-only success-rate RPC |

> Cron wiring (bukan migrasi): `schedule-auto-journal.sql`, `schedule-daily-summary.sql`, `schedule-asset-discovery.sql` — jalankan terakhir setelah function di-deploy.

---

## 🧩 Tipe schema frontend

`src/services/supabase/database.types.ts` — Row/Insert/Update type per tabel + `Database` generic (11 tabel + 20 RPC terdaftar). Type-only import → runtime-pure, dipake Vite app AND esbuild cron bundle. Mapper: `src/services/supabase/journal-mapper.ts` (`rowToFollowedTrade`, `followedTradeToInsert`) — pure, dipake app (read) + cron (write).

---

## 🔗 Terkait / Related
- [`05-edge-functions.md`](05-edge-functions.md) — cron yang nulis tabel
- [`../fsd/06-auth-entitlement.md`](../fsd/06-auth-entitlement.md) — entitlement flow
- [`../../supabase/README.md`](../../supabase/README.md) — runbook DB
