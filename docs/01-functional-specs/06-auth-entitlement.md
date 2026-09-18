# FSD 06 — Auth dan Entitlement / Auth and Entitlement

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Login OAuth, Tier Server-Truth, Redeem, Invite, Subscription, Disclaimer

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Auth memakai Supabase email/password plus Google OAuth PKCE. Entitlement memakai server truth dari row profiles plus RLS is_premium/is_admin/is_owner. Tier di-grant via RPC redeem_access_code/redeem_invitation SECURITY DEFINER row-locked. Alur gas dari login sampai redeem terasa ringan.

Browser hanya baca profil sendiri via publishable key plus RLS. Jurnal mentah tetap premium; anon/free hanya dapat agregat success-rate per simbol via RPC publik. Cron memakai service-role server-side tanpa bundle. Disclaimer gate hybrid: DB untuk logged-in, localStorage untuk anon.

Durasi trial konfigurabel via VITE_TRIAL_DURATION tanpa default bawaan. Skema kanonis: 16 tabel plus 28 RPC. Basis uji: 45 file dengan 422 kasus.

## 🇮🇩 Auth

Client hook memakai `use-auth.ts › useAuth`. Session Supabase di-mirror ke Redux auth slice. initAuth jalan sekali: getSession plus onAuthStateChange. Return session/user/ready/isAuthenticated plus signIn password, signUp, signInWithGoogle OAuth ke /auth/callback, signOut. Free tetap anon; login perlu untuk redeem code.

| Rute | File | Flow |
|---|---|---|
| /login | login page | Form zod plus AuthShell plus Google button plus redirect |
| /register | register page | Mirror login plus confirm-password refine |
| /auth/callback | auth-callback page | Landing PKCE, forward redirect, error ke login plus toast |

Supabase client memakai `client.ts` publishable key only. RLS membatasi row journal_trades ke premium/trial aktif. RPC get_public_journal_success_rates ekspos simbol/wins/total ke anon dan authenticated. Cron bangun client service-role sendiri server-side tanpa bundle.

## 🇮🇩 Entitlement

Hook memakai `use-premium-access.ts › usePremiumAccess`. Query profile ["profile", userId] baca row sendiri via RLS own-row. Derive tier/hasAccess/expiresAt dari server truth. Wall-clock now tick tiap 60 detik membuat trial kedaluwarsa flip ke free mid-session. grantAccess via redeem_access_code RPC lalu invalidate profile. isAdmin/isOwner dari profile.is_admin/is_owner.

License dialog memakai `license-dialog.tsx` trigger-first reusable. Setiap CTA/badge memakai LicenseDialog plus DialogTrigger langsung; visibility tidak disimpan di Redux. Dialog tampil plan saat ini plus field redeem code bila logged-in, atau CTA ke /login bila logged-out.

| Tier | Sumber | Kedaluwarsa |
|---|---|---|
| free | default anon atau signup | Tanpa batas |
| trial | access code trial/invite | trial_expires_at via env duration |
| premium | access code full/invite/grant | Tanpa batas |

## 🇮🇩 Redeem dan Invite

RPC redeem_access_code memakai SECURITY DEFINER row-locked menjadi premium/trial/invalid/exhausted/already/unauthenticated. Tabel access_codes no-policy sehingga tidak terbaca client; code_redemptions own-row only.

- Peek invite via `use-invitation.ts › useInvitationPeek` peek_invitation anon-safe preview valid/reason/kind/trial_days.
- Claim invite via redeem_invitation authed row-locked short-circuit already-premium, lalu invalidate profile plus peek.
- Halaman anon tampil preview plus CTA login/register bawa redirect /invite/:code; authed claim sekali via ref guard, lalu render hasil premium/trial/already/invalid.
- RPC admin: admin_create_invitation 12-hex random, admin_list_invitations, admin_revoke_invitation, admin_delete_invitation.

## 🇮🇩 Subscription dan Disclaimer

Halaman /subscription memakai subscription page. Kartu plan dari useSubscriptionPlans DB-driven, cta_kind link/payment/license/contact membuka PaymentDialog atau LicenseDialog. Kartu payment dari usePaymentMethods. Notice manual-activation tampil. Tabel subscription_plans slug PK, JSONB bilingual name/description/price/features, highlighted. Public read plus admin write. Tabel payment_methods kategori bank/ewallet/qris/crypto. Public read plus admin write. Seed 3 plan Citizen/Veteran/Lord plus 6 channel BCA/BNI/SEABANK/JAGO/E-Wallet/BEP20-USDT.

Disclaimer berbasis DB singleton disclaimer JSONB bilingual plus version. Hybrid acceptance: logged-in via disclaimer_agreements; anon via localStorage rabalaba_disclaimer_v. Hook `use-disclaimer.ts › useDisclaimer` needsAgreement true hanya bila klausa plus status resolve hindari flash. agree plus admin update patch bumpVersion; bump version re-prompt semua akun. Komponen gate render inline di terminal sampai setuju; tanpa dialog paksa terbuka.

Session activity memakai `use-session-activity.ts › useSessionActivity` headless: stamp profiles.last_active_at via touch_last_active RPC throttle 1 per 5 menit piggyback react-query success. Idle logout 1 minggu, cek tiap 5 menit, persist localStorage rabalaba-last-active.

## 🇮🇩 Tautan Terkait

- Admin: docs/01-functional-specs/07-admin-console.md
- Skema: docs/02-technical-specs/03-database-schema.md
- Overview: docs/01-functional-specs/00-overview.md
- Operasional: docs/04-operations/

---

<a id="english-part"></a>

## 🇺🇸 Summary

Auth uses Supabase email/password plus Google OAuth PKCE. Entitlement uses server truth from profiles rows plus is_premium/is_admin/is_owner RLS. Tiers grant via redeem_access_code/redeem_invitation SECURITY DEFINER row-locked RPCs. Deep-dive flow from login to redeem remains light.

Browser only reads the own profile via publishable key plus RLS. Raw journal remains premium; anonymous/free receive per-symbol success-rate aggregates via public RPC. Cron uses server-side service-role without bundling. Disclaimer gate remains hybrid: DB for signed-in, localStorage for anonymous.

Trial duration remains configurable via VITE_TRIAL_DURATION with no built-in default. Canonical schema: 16 tables plus 28 RPCs. Test basis: 45 files with 422 cases.

## 🇺🇸 Auth

Client hook uses `use-auth.ts › useAuth`. Supabase session mirrors to Redux auth slice. initAuth runs once: getSession plus onAuthStateChange. Returns session/user/ready/isAuthenticated plus password signIn, signUp, signInWithGoogle OAuth to /auth/callback, signOut. Free stays anonymous; login needed for code redeem.

| Route | File | Flow |
|---|---|---|
| /login | login page | Zod form plus AuthShell plus Google button plus redirect |
| /register | register page | Mirror login plus confirm-password refine |
| /auth/callback | auth-callback page | PKCE landing, forward redirect, error to login plus toast |

Supabase client uses `client.ts` publishable key only. RLS limits journal_trades rows to active premium/trial. RPC get_public_journal_success_rates exposes symbol/wins/total to anonymous plus authenticated. Cron builds own server-side service-role client without bundling.

## 🇺🇸 Entitlement

Hook uses `use-premium-access.ts › usePremiumAccess`. Profile query ["profile", userId] reads own row via own-row RLS. Derives tier/hasAccess/expiresAt from server truth. Wall-clock now ticks every 60 seconds flipping expired trial to free mid-session. grantAccess via redeem_access_code RPC then profile invalidation. isAdmin/isOwner from profile.is_admin/is_owner.

License dialog uses `license-dialog.tsx` trigger-first reusable. Each CTA/badge uses LicenseDialog plus DialogTrigger directly; visibility never stores in Redux. Dialog shows current plan plus redeem-code field when signed-in, or CTA to /login when signed-out.

| Tier | Source | Expiry |
|---|---|---|
| free | default anonymous or signup | No limit |
| trial | trial access code/invite | trial_expires_at via env duration |
| premium | full access code/invite/grant | No limit |

## 🇺🇸 Redeem and Invite

RPC redeem_access_code uses SECURITY DEFINER row-locked returning premium/trial/invalid/exhausted/already/unauthenticated. access_codes table holds no-policy so client never reads; code_redemptions remains own-row only.

- Invite peek via `use-invitation.ts › useInvitationPeek` peek_invitation anonymous-safe preview valid/reason/kind/trial_days.
- Invite claim via redeem_invitation authed row-locked short-circuit already-premium, then profile plus peek invalidation.
- Anonymous page shows preview plus login/register CTA carrying /invite/:code redirect; signed-in claims once via ref guard, then renders premium/trial/already/invalid result.
- Admin RPCs: admin_create_invitation 12-hex random, admin_list_invitations, admin_revoke_invitation, admin_delete_invitation.

## 🇺🇸 Subscription and Disclaimer

The /subscription page uses subscription page. Plan cards from DB-driven useSubscriptionPlans, cta_kind link/payment/license/contact opening PaymentDialog or LicenseDialog. Payment cards from usePaymentMethods. Manual-activation notice shows. subscription_plans table slug PK, bilingual JSONB name/description/price/features, highlighted. Public read plus admin write. payment_methods table categories bank/ewallet/qris/crypto. Public read plus admin write. Seed 3 plans Citizen/Veteran/Lord plus 6 channels BCA/BNI/SEABANK/JAGO/E-Wallet/BEP20-USDT.

Disclaimer uses DB singleton disclaimer bilingual JSONB plus version. Hybrid acceptance: signed-in via disclaimer_agreements; anonymous via localStorage rabalaba_disclaimer_v. Hook `use-disclaimer.ts › useDisclaimer` needsAgreement true only when clauses plus status resolve avoiding flash. agree plus admin update patch bumpVersion; version bump re-prompts all accounts. Gate component renders inline in terminal until acceptance; without force-open modal.

Session activity uses `use-session-activity.ts › useSessionActivity` headless: stamp profiles.last_active_at via touch_last_active RPC throttled 1 per 5 minutes piggyback react-query success. Idle logout 1 week, check every 5 minutes, persist localStorage rabalaba-last-active.

## 🇺🇸 Related Links

- Admin: docs/01-functional-specs/07-admin-console.md
- Schema: docs/02-technical-specs/03-database-schema.md
- Overview: docs/01-functional-specs/00-overview.md
- Operations: docs/04-operations/
