# FSD 06 — Auth & Entitlement

> 🇮🇩 Login, OAuth, tier premium/trial/free, redeem code, invite, subscription, disclaimer gate.
> 🇺🇸 Login, OAuth, premium/trial/free tiers, redeem code, invite, subscription, disclaimer gate.

---

## TL;DR

🇮🇩 Auth = Supabase (email/password + Google OAuth PKCE). Entitlement = **server truth** dari `profiles` row + RLS `is_premium()`/`is_admin()`/`is_owner()`. Tier di-grant lewat RPC `redeem_access_code` / `redeem_invitation` (SECURITY DEFINER, row-locked). Browser cuma **baca** profile sendiri (publishable key, RLS). Jurnal mentah tetap premium; anon/free hanya mendapat agregat success-rate per simbol lewat RPC publik. Cron pakai service-role. Disclaimer gate hybrid (DB untuk logged-in, localStorage untuk anon).

🇺🇸 Auth = Supabase (email/password + Google OAuth PKCE). Entitlement = **server truth** from the `profiles` row + RLS `is_premium()`/`is_admin()`/`is_owner()`. Tier granted via `redeem_access_code` / `redeem_invitation` RPCs (SECURITY DEFINER, row-locked). The browser only **reads** its own profile (publishable key, RLS). Raw journal rows remain premium; anonymous/free users only receive per-symbol success-rate aggregates through a public RPC. The cron uses the service-role key. Disclaimer gate is hybrid (DB for logged-in, localStorage for anon).

---

## 🔑 Auth

### Client hook — `src/hooks/use-auth.ts:32` (`useAuth`)
- Supabase session di-mirror ke Redux `auth` slice.
- `initAuth()` (`:19`) jalan sekali: `getSession()` + `onAuthStateChange`.
- Return: `session/user/ready/isAuthenticated` + `signIn` (password), `signUp`, `signInWithGoogle` (OAuth → `/auth/callback?redirect=…`), `signOut`.
- Free tetap anon; login cuma perlu buat redeem code.

### Halaman / Pages
| Rute | File | Flow |
|---|---|---|
| `/login` | `pages/login/index.tsx` | react-hook-form + zod (`auth-schema`), `AuthShell`, `GoogleAuthButton`, `?redirect=`, auto-redirect kalau sudah authed |
| `/register` | `pages/register/index.tsx` | mirror login + confirm-password refine |
| `/auth/callback` | `pages/auth-callback/index.tsx:18` | OAuth PKCE landing — tunggu session, forward ke `?redirect` (default `/terminal`); `?error`/8s timeout → `/login` + toast |

### Supabase client
`src/services/supabase/client.ts:20` — **publishable key only**. RLS membatasi row `journal_trades` ke premium/trial aktif; `get_public_journal_success_rates()` sengaja mengekspos hanya `symbol/wins/total` ke anon dan authenticated. Cron bangun client service-role sendiri server-side (gak pernah di bundle).

---

## 💎 Entitlement

### Premium access hook — `src/hooks/use-premium-access.ts:33` (`usePremiumAccess`)
- react-query `["profile", userId]` (`:39-54`) baca `profiles` row sendiri (RLS own-row).
- Derive `tier/hasAccess/expiresAt` dari server truth (`:68-80`).
- Wall-clock `now` tick tiap 60s (`:60-64`) → flip trial kedaluwarsa → free mid-session.
- `grantAccess(code)` (`:82-113`) → `redeem_access_code` RPC → invalidate profile.
- `isAdmin`/`isOwner` dari `profile.is_admin`/`is_owner` (`:124-125`), `isResolving` (`:131`).

### License dialog — `src/components/shared/license-dialog.tsx:30`
Reusable trigger-first dialog. Setiap CTA/badge memakai `LicenseDialog` + `DialogTrigger` langsung; visibility tidak disimpan di Redux. Dialog menampilkan plan saat ini + field redeem code kalau logged-in, atau CTA ke `/login` kalau logged-out.

### Tiers
| Tier | Sumber / Source | Kedaluwarsa |
|---|---|---|
| `free` | default (anon atau signup) | — |
| `trial` | access code `kind=trial` / invite | `trial_expires_at` (default 3 hari) |
| `premium` | access code `kind=full` / invite / admin grant | — |

---

## 🎟️ Redeem & Invite

### Access code
- RPC `redeem_access_code(p_code)` (SECURITY DEFINER, row-locked) → `premium|trial|invalid|exhausted|already|unauthenticated`.
- `access_codes` RLS no-policy (gak bisa dibaca client); `code_redemptions` own-row only.

### Invite (`/invite/:code`)
- `useInvitationPeek(code)` (`src/hooks/use-invitation.ts:28`) — anon-safe `peek_invitation` preview `{valid,reason,kind,trial_days}`.
- Authenticated → `useInvitation.claim(code)` (`:44`) → `redeem_invitation` RPC → invalidate `["profile",userId]` + peek.
- Halaman: anon → preview + CTA login/register bawa `?redirect=/invite/:code`; authed → claim sekali via ref guard, render hasil (premium/trial/already/invalid/dll).
- RPC: `peek_invitation` (anon), `redeem_invitation` (authed, row-locked, short-circuit already-premium), `admin_create_invitation` (12-hex random), `admin_list_invitations`, `admin_revoke_invitation`, `admin_delete_invitation`.

---

## 💳 Subscription

Halaman `/subscription` (`pages/subscription/index.tsx`). Kartu plan dari `useSubscriptionPlans` (DB-driven, `cta_kind` ∈ `link|payment|license|contact` → buka PaymentDialog atau LicenseDialog), kartu payment method dari `usePaymentMethods`, notice manual-activation.

### Plan/Payment management (admin)
- `subscription_plans` — slug PK, JSONB bilingual name/description/price/features, `highlighted`. Public read + admin write.
- `payment_methods` — category `bank|ewallet|qris|crypto`. Public read + admin write.
- Seed: 3 plan (Citizen/Veteran/Lord) + 6 channel (BCA/BNI/SEABANK/JAGO/E-Wallet/BEP20-USDT).

---

## ⚠️ Disclaimer Gate

Hook: `src/hooks/use-disclaimer.ts:34` (`useDisclaimer`).

🇮🇩 Disclaimer berbasis DB (singleton `disclaimer`, JSONB bilingual + version). **Hybrid acceptance**: logged-in → row `disclaimer_agreements`; anon → localStorage `rabalaba_disclaimer_v`. `needsAgreement` cuma true kalau klausa + status resolve (hindari flash). `agree()` + admin `update(patch, bumpVersion)` (bump version = re-prompt semua user). Komponen gate dirender **inline** di terminal sampai pengguna setuju; tidak memakai dialog yang dipaksa terbuka.

🇺🇸 The DB-backed disclaimer uses hybrid acceptance (`disclaimer_agreements` for signed-in users, localStorage for anonymous users). The terminal renders the gate inline until accepted; it is not a force-open modal.

---

## 🧍 Session activity

Hook: `src/hooks/use-session-activity.ts:37` (`useSessionActivity`). Headless: stamp `profiles.last_active_at` via `touch_last_active` RPC (throttle ≤1/5 min, piggyback react-query success). Idle logout 1 minggu (`IDLE_LIMIT_MS`), cek tiap 5 min, persist `localStorage("rabalaba-last-active")`.

---

## 🔗 Terkait / Related
- [`07-admin-console.md`](07-admin-console.md) — kelola user/code/invite/plan/disclaimer
- [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md) — RLS + RPC detail
- [`00-overview.md`](00-overview.md) — persona table
