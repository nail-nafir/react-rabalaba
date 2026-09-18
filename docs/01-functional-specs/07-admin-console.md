# FSD 07 — Admin Console / Admin Console

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Users, Universe, Codes, Invites, Testimoni, Plans, Payments, Disclaimer

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Shell /admin/* di-guard di `admin-layout.tsx › guard` harus isAuthenticated plus isAdmin, bila bukan redirect /. Sidebar 2 grup: Overview berisi Statistics plus Management berisi Users/Assets/Codes/Invitations/Testimonials/Plans/Payments/Disclaimer. Alur gas dari statistik sampai moderasi terasa solid.

isOwner vs isAdmin hanya ubah judul konsol. Semua tabel memakai pola seragam Terminal-style data table: TanStack Table plus skeleton plus DataTablePagination plus EmptyState, CRUD via dialog pendamping. Skema kanonis 16 tabel plus 28 RPC. Migrasi 38 file.

## 🇮🇩 Halaman Admin

Komponen fitur di features/management/components. Hook admin di features/management/hooks. Router legacy /admin/billing redirect ke /admin/codes.

| Rute | Kelola | Komponen dan Hook |
|---|---|---|
| /admin/statistics | KPI plus growth plus sinyal plus diagnostics | useAdminUsers plus useJournalAssets plus useJournalTrades |
| /admin/users | Tier plus role plus last-active | RegisteredUsersTable plus UserDialog plus useAdminUsers |
| /admin/assets | Universe auto-jurnal plus settings | JournalAssetsTable plus AddJournalAsset plus useJournalAssets |

Tabel codes memakai AccessCodesTable plus AddAccessCodeDialog plus DeleteAccessCodeDialog. Tabel invitations memakai InvitationsTable plus AddInvitationDialog. Tabel testimonials memakai TestimonialsTable. Tabel plans memakai SubscriptionPlansTable plus PlanDialog. Tabel payments memakai PaymentMethodsTable plus PaymentMethodDialog. Disclaimer memakai DisclaimerEditor plus useDisclaimer.

| Rute | Kelola | Komponen dan Hook |
|---|---|---|
| /admin/codes | Access code full/trial plus max_redemptions | AccessCodesTable plus useAdminUsers |
| /admin/invitations | Invite premium/trial plus revoke | InvitationsTable plus useAdminInvitations |
| /admin/testimonials | Moderasi plus enam slot landing | TestimonialsTable plus useAdminTestimonials |

## 🇮🇩 Statistik dan User

Statistics memakai statistics page 1172 baris. KPI card: total akun, aset jurnal, redemption code, signal terpublikasi. LineChart growth signup/active. LineChart signal daily/cumulative. Diagnostics console log stream live plus grid status service.

User memakai `registered-users-table.tsx › RegisteredUsersTable`. Filter tier premium/trial/free plus role member/admin/owner. Edit via UserDialog react-hook-form plus zod, role/tier select, email, metadata. Delete via AlertDialog. Re-validasi password untuk operasi sensitif via ValidatePasswordDialog. RPC admin_list_users, admin_create_user, admin_update_user, admin_toggle_block_user, admin_delete_user.

## 🇮🇩 Aset dan Kode

Aset memakai `journal-assets-table.tsx › JournalAssetsTable`. Kelola journal_assets universe dibaca cron plus screener premium. Filter status active/inactive plus source admin/auto. Harga live via useMarketData. Toggle aktif/non-aktif Play/Pause, delete AlertDialog, settings JournalSettingsDialog toggle plus cadence plus last-run relative plus Discover Now plus Scan Sekarang, add AddJournalAssetDialog Yahoo search picker validasi simbol saat save. Toggle baris source auto flip source ke admin sebagai adopt.

Code memakai `access-codes-table.tsx › AccessCodesTable`. Mint code full/trial, max_redemptions, expiry, display masked, reveal via ValidatePasswordDialog, delete via DeleteAccessCodeDialog. RPC admin_list_access_codes, admin_create_access_code, admin_delete_access_code. Invite memakai `invitations-table.tsx › InvitationsTable` mint/copy /invite/:code/revoke. AddInvitationDialog buat lalu flip ke view created dengan link copyable. RPC admin_create_invitation 12-hex random, admin_list_invitations, admin_revoke_invitation, admin_delete_invitation.

## 🇮🇩 Testimoni Plan Payment Disclaimer

Testimoni memfilter antrean berdasar status, tampil rating/persona/isi/catatan privat, sedia approve, reject, feature/move slot 1-6, unfeature, delete permanen. Ganti slot terisi perlu konfirmasi. RPC feature atomic dan trigger DB salin snapshot publik.

Plan memakai `subscription-plans-table.tsx › SubscriptionPlansTable` add/edit via PlanDialog input bilingual EN/ID berpasangan ke JSONB, toggle-active, delete. Payment memakai `payment-methods-table.tsx › PaymentMethodsTable` add/edit via PaymentMethodDialog bank/ewallet/qris/crypto, note bilingual, toggle-active, delete.

Disclaimer memakai `disclaimer-editor.tsx › DisclaimerEditor`. Klausul bilingual plus versioned. Save edit in-place; Publish new version bump version lalu re-prompt semua akun. Tampil jumlah acceptance. Direct supabase plus useDisclaimer.

## 🇮🇩 Tautan Terkait

- Auth: docs/01-functional-specs/06-auth-entitlement.md
- Testimoni: docs/01-functional-specs/08-user-testimonials.md
- Skema: docs/02-technical-specs/03-database-schema.md
- Operasional: docs/04-operations/

---

<a id="english-part"></a>

## 🇺🇸 Summary

The /admin/* shell guards in `admin-layout.tsx › guard` requiring isAuthenticated plus isAdmin, else redirect /. Sidebar holds 2 groups: Overview with Statistics plus Management with Users/Assets/Codes/Invitations/Testimonials/Plans/Payments/Disclaimer. Deep-dive flow from statistics to moderation remains solid.

isOwner versus isAdmin only changes console title. All tables use uniform Terminal-style data table pattern: TanStack Table plus skeleton plus DataTablePagination plus EmptyState, CRUD via companion dialogs. Canonical schema 16 tables plus 28 RPCs. Migrations span 38 files.

## 🇺🇸 Admin Pages

Feature components live in features/management/components. Admin hooks live in features/management/hooks. Legacy /admin/billing router redirects to /admin/codes.

| Route | Manages | Components and Hooks |
|---|---|---|
| /admin/statistics | KPI plus growth plus signals plus diagnostics | useAdminUsers plus useJournalAssets plus useJournalTrades |
| /admin/users | Tier plus role plus last-active | RegisteredUsersTable plus UserDialog plus useAdminUsers |
| /admin/assets | Auto-journal universe plus settings | JournalAssetsTable plus AddJournalAsset plus useJournalAssets |

Codes table uses AccessCodesTable plus AddAccessCodeDialog plus DeleteAccessCodeDialog. Invitations table uses InvitationsTable plus AddInvitationDialog. Testimonials table uses TestimonialsTable. Plans table uses SubscriptionPlansTable plus PlanDialog. Payments table uses PaymentMethodsTable plus PaymentMethodDialog. Disclaimer uses DisclaimerEditor plus useDisclaimer.

| Route | Manages | Components and Hooks |
|---|---|---|
| /admin/codes | Full/trial access codes plus max_redemptions | AccessCodesTable plus useAdminUsers |
| /admin/invitations | Premium/trial invites plus revoke | InvitationsTable plus useAdminInvitations |
| /admin/testimonials | Moderation plus six landing slots | TestimonialsTable plus useAdminTestimonials |

## 🇺🇸 Statistics and Accounts

Statistics uses statistics page at 1172 lines. KPI cards: total accounts, journal assets, code redemptions, published signals. LineChart signup/active growth. LineChart daily/cumulative signals. Diagnostics console live log stream plus service status grid.

Accounts use `registered-users-table.tsx › RegisteredUsersTable`. Tier filter premium/trial/free plus role member/admin/owner. Edit via UserDialog react-hook-form plus zod, role/tier select, email, metadata. Delete via AlertDialog. Password re-validation for sensitive operations via ValidatePasswordDialog. RPCs admin_list_users, admin_create_user, admin_update_user, admin_toggle_block_user, admin_delete_user.

## 🇺🇸 Assets and Codes

Assets use `journal-assets-table.tsx › JournalAssetsTable`. Manage journal_assets universe read at cron plus premium screener. Status filter active/inactive plus source admin/auto. Live prices via useMarketData. Active/inactive Play/Pause toggle, AlertDialog delete, JournalSettingsDialog settings toggle plus cadence plus relative last-run plus Discover Now plus Scan Now, AddJournalAssetDialog Yahoo search picker validating symbols at save. Auto-source row toggle flips source to admin as adopt.

Codes use `access-codes-table.tsx › AccessCodesTable`. Mint full/trial codes, max_redemptions, expiry, masked display, reveal via ValidatePasswordDialog, delete via DeleteAccessCodeDialog. RPCs admin_list_access_codes, admin_create_access_code, admin_delete_access_code. Invites use `invitations-table.tsx › InvitationsTable` mint/copy /invite/:code/revoke. AddInvitationDialog creates then flips to created view with copyable link. RPCs admin_create_invitation 12-hex random, admin_list_invitations, admin_revoke_invitation, admin_delete_invitation.

## 🇺🇸 Testimonials Plans Payments Disclaimer

Testimonials filter queue at status, show rating/persona/body/private notes, offer approve, reject, feature/move slots 1-6, unfeature, permanent delete. Occupied-slot replacement needs confirmation. Feature RPC remains atomic and DB trigger copies public snapshot.

Plans use `subscription-plans-table.tsx › SubscriptionPlansTable` add/edit via PlanDialog paired bilingual EN/ID inputs to JSONB, toggle-active, delete. Payments use `payment-methods-table.tsx › PaymentMethodsTable` add/edit via PaymentMethodDialog bank/ewallet/qris/crypto, bilingual note, toggle-active, delete.

Disclaimer uses `disclaimer-editor.tsx › DisclaimerEditor`. Bilingual versioned clauses. Save edits in-place; Publish new version bumps version then re-prompts all accounts. Acceptance count shows. Direct supabase plus useDisclaimer.

## 🇺🇸 Related Links

- Auth: docs/01-functional-specs/06-auth-entitlement.md
- Testimonials: docs/01-functional-specs/08-user-testimonials.md
- Schema: docs/02-technical-specs/03-database-schema.md
- Operations: docs/04-operations/
