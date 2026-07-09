# Ops — Security & RLS Rationale

> 🇮🇩 Threat model ringan + kenapa RLS/RPC didesain gitu + secret management.
> 🇺🇸 Lightweight threat model + why RLS/RPCs are designed that way + secret management.

---

## TL;DR

🇮🇩 Prinsip inti: **jangan percaya browser**. Semua gerbang sensitif (premium/admin/write) dipaksa di **server** Postgres via RLS + RPC `SECURITY DEFINER`. Browser pakai **publishable key** (read-only by RLS). Cron pakai **service-role** (bypass RLS, gak pernah di bundle). Secret (kode redeem, bearer cron) di Supabase Vault / Cloudflare env vars, **gak pernah** commit ke git.

🇺🇸 Core principle: **don't trust the browser**. Every sensitive gate (premium/admin/write) is enforced on the **server** Postgres via RLS + `SECURITY DEFINER` RPCs. The browser uses the **publishable key** (read-only by RLS). The cron uses the **service-role** key (bypasses RLS, never bundled). Secrets (redeem codes, cron bearer) live in Supabase Vault / Cloudflare env vars, **never** committed to git.

> Detail schema: [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md). Auth flow: [`../fsd/06-auth-entitlement.md`](../fsd/06-auth-entitlement.md).

---

## 🛡️ Threat model (ringan / lightweight)

| Aset / Asset | Ancaman / Threat | Pertahanan / Defense |
|---|---|---|
| `journal_trades` (data premium) | User free coba baca jurnal | RLS `journal_trades_premium_read` — authenticated + `is_premium()` only. Anon = 0 row |
| `journal_trades` (write) | User coba tulis/inject trade palsu | RLS: gak ada policy write untuk client. Cuma service-role (cron) bisa INSERT/UPDATE |
| `journal_assets` (admin) | User non-admin coba edit universe | RLS `journal_assets_admin_all` FOR ALL `is_admin()`. Premium cuma SELECT |
| `journal_settings` | User coba ubah pause/interval | RLS `journal_settings_admin_all` `is_admin()` |
| `access_codes` / `invitations` | User coba baca kode buat redeem sendiri | RLS **no policies** (locked) — client gak bisa SELECT. Akses cuma via RPC `redeem_*` |
| `profiles` (tier/admin) | User coba set `tier='premium'` / `is_admin=true` | RLS own-row SELECT only. Write: cuma RPC `admin_*` (SECURITY DEFINER, `is_admin()` guard) |
| Access code brute-force | Attacker tebak kode | RPC `redeem_access_code` row-locked, return generic `invalid` (gak reveal ada/tdk). `max_redemptions` cap |
| Admin self-block/delete | Admin iseng block/delete diri sendiri | RPC `admin_toggle_block_user`/`admin_delete_user` guard "can't self" |
| OAuth redirect tampering | Attacker ubah `?redirect=` ke phishing | `auth-redirect.ts` sanitize (lihat `tests/auth-redirect.test.mjs`) |
| Phantom trade close | Yahoo transient bad candle fake SL/TP | Cron cuma mutusin via candle **timestamped**; spot price ≥ SL diabaikan (`auto-journal-core` phantom guard) |

---

## 🔑 Key hierarchy & secret management

| Key | Scope | Akses / Access | Disimpan / Stored |
|---|---|---|---|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | RLS-bound (read-only per policy) | `.env` (gitignored) + Vault (cron bearer) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron edge function | Bypass RLS (full write) | **Auto-inject saat deploy** — JANGAN set via `secrets set`, gak pernah di bundle/git |
| `auto_journal_bearer` (publishable) | Cron pg_cron → gateway | Cuma lewat gateway; function tetap tulis service-role | Supabase Vault (`schedule-*.sql`) |
| Access codes / invitation codes | DB rows | RPC-only | DB (gak di git) |
| `DISCORD_WEBHOOK_URL` | Cron alert | Per edge function env | Supabase function env (dashboard) |
| `COINGECKO_DEMO_API_KEY` | CF proxy coingecko | Inject `x-cg-demo-api-key` header | Cloudflare Pages env vars (dashboard) |
| `YAHOO_PROXY_BASE` / `DISCOVERY_PROXY_BASE` | Cron fallback override | Optional | Supabase function env |

> ⚠️ 🇮🇩 **Aturan**: apapun yang bawa secret (kode, bearer, service-role) KELUAR dari git. `.env.example` cuma list `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (key name TANPA value). `.env` gitignored.
> 🇺🇸 **Rule**: anything carrying a secret stays OUT of git. `.env.example` only lists `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (key names WITHOUT values). `.env` is gitignored.

> 🇮🇩 Catatan: var env lama (`VITE_ACCESS_KEY`/`VITE_ACCESS_CODE`/`VITE_TRIAL_CODE`/`VITE_TRIAL_DURATION`) udah **dihapus** — model akses pindah ke DB `access_codes` + RPC `redeem_access_code` (migrasi #3).
> 🇺🇸 Note: the old env vars (`VITE_ACCESS_KEY`/`VITE_ACCESS_CODE`/`VITE_TRIAL_CODE`/`VITE_TRIAL_DURATION`) are **removed** — the access model moved to the DB `access_codes` table + `redeem_access_code` RPC (migration #3).

---

## 🏛️ RLS design rationale

### Kenapa RLS, bukan app-level check?
🇮🇩 Browser bisa diutak-atik user (DevTools, request replay). Kalau premium check cuma di React (hide button), user bypass dengan fetch langsung. RLS dieksekusi di Postgres **setiap query** — gak bisa di-skip client-side. UI cuma nyembunyiin buat UX; RLS yang ngunci beneran.

🇺🇸 The browser can be tampered with (DevTools, request replay). If the premium check is only in React (hide button), a user bypasses with a direct fetch. RLS runs in Postgres on **every query** — can't be skipped client-side. UI only hides for UX; RLS does the real locking.

### Kenapa RPC `SECURITY DEFINER` buat write?
- RPC jalan dengan privilege **pemilik function** (admin), bukan caller. Bisa lakuin operasi yang user gak punya hak langsung (e.g. `admin_create_user` insert ke `auth.users`).
- Guard `is_admin()` di awal function = gate server-side. User gak bisa bypass.
- Row-locked (advisory lock / `for update`) = anti race condition (brute-force redeem, double-claim invitation).

### Kenapa `journal_trades` read premium-only?
🇮🇩 Jurnal = output produk berbayar. Kalau free bisa baca, premium gak ada value. RLS `is_premium()` (premium OR trial aktif, respect `is_blocked`) = gate. Cron (service-role) tetap tulis.

🇺🇸 The journal is the paid product output. If free users could read it, premium has no value. RLS `is_premium()` gates it. The cron (service-role) still writes.

### Kenapa `access_codes`/`invitations` locked (no policy)?
🇮🇩 Kalau client bisa SELECT, user bisa dump semua kode lalu redeem. Locked = akses cuma via RPC `redeem_*` yang row-lock + return generic `invalid` (gak reveal kode ada/tdk). Admin list via `admin_list_*` (guard `is_admin()`).

🇺🇸 If the client could SELECT, a user dumps all codes then redeems. Locked = access only via `redeem_*` RPCs which row-lock + return generic `invalid` (don't reveal existence). Admin lists via `admin_list_*` (`is_admin()` guard).

---

## 🧱 Trust boundaries

```
┌─────────────────┐     publishable key (RLS)      ┌─────────────────┐
│  🌐 BROWSER     │ ──────────────────────────────▶ │  🗄️ POSTGRES    │
│  (UNTRUSTED)    │   read own profile,             │  RLS enforces:  │
│                 │   read premium data (if prem),  │  - own-row      │
│                 │   redeem via RPC,               │  - is_premium() │
│                 │   admin via RPC (if admin)      │  - is_admin()   │
│                 │   NO direct write to sensitive  │  - no-policy    │
│                 │   tables                        │    locked       │
└─────────────────┘                                 └─────────────────┘
                                                          ▲
                                                          │ service-role (bypass RLS)
                                                          │ auto-inject, never bundled
┌─────────────────┐     pg_cron + publishable bearer  │
│  ⏰ pg_cron     │ ──POST──▶ 🦾 EDGE FUNCTION ────────┘
│                 │           (Deno, trusted)
│                 │           writes journal_trades
└─────────────────┘
```

---

## ✅ Security checklist (buat review/audit)

- [ ] `.env` gitignored, `.env.example` tanpa value
- [ ] Service-role key gak pernah di `src/` (cuma di edge function server-side, auto-inject)
- [ ] Tiap tabel sensitif punya RLS policy (gak ada "RLS on, no policy" kecuali locked intentional `access_codes`/`invitations`)
- [ ] Tiap RPC write punya guard `is_admin()` / row-lock
- [ ] `redeem_*` return generic `invalid` (gak reveal existence)
- [ ] Admin self-block/delete guard "can't self"
- [ ] OAuth redirect sanitize (`auth-redirect.ts` + test)
- [ ] Phantom-close guard aktif (cuma candle timestamped mutusin TP/SL)
- [ ] CORS proxy `*` OK karena gak ada auth header di-lewat (API public, key gak di client)

---

## 🔗 Terkait / Related
- [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md) — schema + RLS policy detail
- [`../fsd/06-auth-entitlement.md`](../fsd/06-auth-entitlement.md) — auth flow
- [`runbook.md`](runbook.md) — incident & rollback
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — secret convention
