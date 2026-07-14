# FSD 07 — Admin Console

> 🇮🇩 Konsol admin di `/admin/*`: kelola user, universe jurnal, access code, invitation, testimoni, plan, payment, disclaimer, statistics.
> 🇺🇸 Admin console at `/admin/*`: manage users, journal universe, access codes, invitations, testimonials, plans, payments, disclaimer, statistics.

---

## TL;DR

🇮🇩 Shell `/admin/*` di-guard di `admin-layout.tsx:90-96` (harus `isAuthenticated && isAdmin`, kalau bukan redirect `/`). Sidebar 2 grup: **Overview** (Statistics) + **Management** (Users/Assets/Codes/Invitations/Testimonials/Plans/Payments/Disclaimer). `isOwner` vs `isAdmin` cuma ubah judul konsol. Semua tabel pakai pola seragam "Terminal-style data table": TanStack Table + skeleton + `DataTablePagination` + `EmptyState`, CRUD via dialog pendamping.

🇺🇸 The `/admin/*` shell is guarded at `admin-layout.tsx:90-96` (must be `isAuthenticated && isAdmin`, else redirect `/`). Sidebar has 2 groups: **Overview** (Statistics) + **Management** (Users/Assets/Codes/Invitations/Testimonials/Plans/Payments/Disclaimer). `isOwner` vs `isAdmin` only changes the console title. All tables follow a uniform "Terminal-style data table" pattern: TanStack Table + skeleton + `DataTablePagination` + `EmptyState`, CRUD via companion dialogs.

---

## 🗂️ Halaman admin / Admin pages

| Rute / Route | File | Kelola / Manages | Komponen kunci / Key component | Hook |
|---|---|---|---|---|
| `/admin` | `pages/admin/index.tsx:4` | redirect → `/admin/statistics` | — | — |
| `/admin/statistics` | `pages/admin/statistics.tsx` (1172 baris) | **Dashboard/overview**: KPI (Users, Journal Assets, Code Redemptions, Published Signals), LineChart signup/active growth, LineChart signal daily/cumulative, "diagnostics console" log stream + service-status grid | — | `useAdminUsers`, `useJournalAssets`, `useJournalSettings`, `useJournalTrades` |
| `/admin/users` | `pages/admin/users.tsx` | User terdaftar, tier, code usage, last-active | `RegisteredUsersTable` + `UserDialog` + `ValidatePasswordDialog` | `useAdminUsers` |
| `/admin/assets` | `pages/admin/assets.tsx` | **Universe auto-jurnal** (crypto/US/ID), toggle aktif + refresh | `JournalAssetsTable` + `AddJournalAssetDialog` + `JournalSettingsDialog` | `useJournalAssets`, `useJournalSettings`, `useMarketScan`, `useAssetDiscovery` |
| `/admin/codes` | `pages/admin/codes.tsx` | Access code (full/trial, `max_redemptions`), add dialog | `AccessCodesTable` + `AddAccessCodeDialog` + `DeleteAccessCodeDialog` | `useAdminUsers` |
| `/admin/invitations` | `pages/admin/invitations.tsx` | Invite link (premium/trial), create dialog | `InvitationsTable` + `AddInvitationDialog` | `useAdminInvitations` |
| `/admin/testimonials` | `pages/admin/testimonials.tsx` | Moderasi pengajuan + enam slot landing | `TestimonialsTable` | `useAdminTestimonials` |
| `/admin/plans` | `pages/admin/plans.tsx` | Subscription plan (price, benefit, `cta_kind`) | `SubscriptionPlansTable` + `PlanDialog` | `useSubscriptionPlans` |
| `/admin/payments` | `pages/admin/payments.tsx` | Payment method (bank/e-wallet/QRIS/crypto) | `PaymentMethodsTable` + `PaymentMethodDialog` | `usePaymentMethods` |
| `/admin/disclaimer` | `pages/admin/disclaimer.tsx` | Klausul risk disclaimer + agreement user | `DisclaimerEditor` | `useDisclaimer` (direct supabase) |
| `/admin/billing` | router redirect | legacy → `/admin/codes` | — | — |

> Komponen fitur: `src/features/admin/components/` (16 file). Hook admin: `src/hooks/`.

---

## 📊 Statistics Dashboard

File: `src/pages/admin/statistics.tsx`. KPI card (`:632-700`): total user, aset jurnal, redemption code, signal terpublikasi. LineChart growth user signup/active (`:427-534`). LineChart signal daily/cumulative (`:378-414`). "Diagnostics console" — log stream live + grid status service (`:1077-1167`).

---

## 🧑‍💼 User Management

`RegisteredUsersTable` (`features/admin/components/registered-users-table.tsx:596`). Filter tier (premium/trial/free) + role (member/admin/owner). Edit (`UserDialog` — react-hook-form + zod, role/tier select, email, metadata). Delete (AlertDialog). Re-validasi password buat operasi sensitif (`ValidatePasswordDialog`). RPC: `admin_list_users`, `admin_create_user`, `admin_update_user`, `admin_toggle_block_user`, `admin_delete_user`.

---

## 📦 Journal Assets (Universe)

`JournalAssetsTable` (`features/admin/components/journal-assets-table.tsx:666`). Kelola `journal_assets` — universe yang di-baca auto-journal cron + screener premium. Filter status (active/inactive) + source (admin/auto). Harga live via `useMarketData`. Toggle aktif/non-aktif (Play/Pause), delete (AlertDialog), settings (`JournalSettingsDialog` — toggle, cadence, last-run relative time, manual "Discover Now" + "Scan Sekarang"), add (`AddJournalAssetDialog` — Yahoo search picker, validasi simbol di save). Toggle aktif pada baris `source='auto'` flip source→`admin` (adopt).

---

## 🎟️ Access Codes

`AccessCodesTable` (`features/admin/components/access-codes-table.tsx:327`). Mint code (full/trial, `max_redemptions`, expiry), display masked, reveal via `ValidatePasswordDialog`, delete via `DeleteAccessCodeDialog`. RPC: `admin_list_access_codes`, `admin_create_access_code`, `admin_delete_access_code`.

---

## 📨 Invitations

`InvitationsTable` (`features/admin/components/invitations-table.tsx:422`). Mint/copy `/invite/:code`/revoke. `AddInvitationDialog` — buat lalu flip ke view "created" dengan link copyable (date-fns localized date picker). RPC: `admin_create_invitation` (12-hex random), `admin_list_invitations`, `admin_revoke_invitation`, `admin_delete_invitation`.

---

## 💬 Testimonials

`TestimonialsTable` (`features/admin/components/testimonials-table.tsx`) memfilter antrean berdasarkan status, menampilkan rating/persona/isi/catatan privat, dan menyediakan approve, reject, feature/move slot 1–6, unfeature, serta delete permanen. Penggantian slot terisi memerlukan konfirmasi. RPC feature bersifat atomic dan snapshot publik disalin oleh trigger database.

`TestimonialsTable` filters the queue by status, shows rating/persona/body/private notes, and provides approve, reject, feature/move across slots 1–6, unfeature, and permanent delete. Replacing an occupied slot requires confirmation. The feature RPC is atomic and a database trigger copies the public snapshot.

---

## 💳 Plans & Payments

- `SubscriptionPlansTable` (`features/admin/components/subscription-plans-table.tsx:398`) — add/edit via `PlanDialog` (input bilingual EN/ID berpasangan → JSONB), toggle-active, delete.
- `PaymentMethodsTable` (`features/admin/components/payment-methods-table.tsx:363`) — add/edit via `PaymentMethodDialog` (bank/ewallet/qris/crypto, note bilingual), toggle-active, delete.

---

## ⚠️ Disclaimer Editor

`DisclaimerEditor` (`features/admin/components/disclaimer-editor.tsx:213`). Klausul bilingual + versioned. "Save" edit in-place; "Publish new version" bump version → re-prompt semua user. Tampilkan jumlah acceptance. Direct `supabase` + `useDisclaimer`.

---

## 🔗 Terkait / Related
- [`06-auth-entitlement.md`](06-auth-entitlement.md) — RLS + RPC entitlement
- [`08-user-testimonials.md`](08-user-testimonials.md) — user submission and moderation lifecycle
- [`03-auto-journal.md`](03-auto-journal.md) — universe & settings yang dikontrol
- [`../tsd/03-database-schema.md`](../tsd/03-database-schema.md) — schema admin table
- [`00-overview.md`](00-overview.md) — persona admin/owner
