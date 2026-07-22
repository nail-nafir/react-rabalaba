# Changelog

> 🇮🇩 Catatan versi & perubahan. Format [Keep a Changelog](https://keepachangelog.com/), semantik [SemVer](https://semver.org/).
> 🇺🇸 Version & change notes. Format [Keep a Changelog](https://keepachangelog.com/), [SemVer](https://semver.org/) semantics.

---

## [Unreleased]

### Added

- **Dokumentasi lengkap** bilingual (ID/EN): `docs/{fsd,tsd,testing,ops,explainer}/` (24 file) + index `docs/README.md`. FSD (8), TSD (8, termasuk engine-internals mendalam dengan formula), testing (3, coverage inventory 26 file/268 case + gap analysis), ops (runbook produksi + security & RLS rationale), explainer (3 legacy).
- `README.md` project-specific (replace stock Vite template).
- `CONTRIBUTING.md` — onboarding, convention, branching, PR flow, secret rules.
- `CHANGELOG.md` — ini.

### Changed

- **Notifikasi Sonner kini lebih ringkas dan konsisten**: semua aksi memanggil Sonner langsung tanpa helper tambahan, sementara copy ID/EN diseragamkan menjadi satu baris tanpa deskripsi (`Sip`/`Nice`, `Waduh`/`Yikes`, `Santai`/`Chill`). (`src/`, `src/assets/locales/{en,id}.json`)
- **Keberhasilan di Pemindai Aset sekarang informatif untuk semua akun**, termasuk pengunjung dan akun gratis. UI menampilkan persentase beserta sampel menang/total dari agregat publik yang aman; data jurnal mentah tetap premium. State loading, tanpa sampel, dan gagal dimuat kini dibedakan dengan jelas. (`src/features/market/`, `src/components/charts/success-rate-bar.tsx`, `supabase/migrations/20260722025846_public_journal_success_rates.sql`)
- **Menu admin/owner di profile header disatukan** jadi "Kelola Sistem" (id) / "Manage System" (en) — action verb, destination-consistent, ikon `SlidersHorizontal`. Akses tetap khusus admin & owner (`isAdmin` wrapper + route guard `admin-layout.tsx` tidak diubah). Pemisahan owner/admin tetap di judul konsol internal (`admin-layout.tsx`) & label role per-asset (`journal-assets-table.tsx`). (`src/components/layout/user-menu.tsx`, `src/assets/locales/{en,id}.json`)
- **Browser direct call CoinGecko `/global` + Binance derivatives** (sebelumnya lewat proxy CF, kena 429 IP-shared). Tiap visitor pakai IP sendiri = quota terisolasi. Proxy CoinGecko/Binance tetap dipakai cron. (`src/services/api/{coingecko,binance}.ts`, `vite.config.ts`)
- **`.env.example` dibenerin** — hapus var legacy (`VITE_ACCESS_KEY`/`VITE_ACCESS_CODE`/`VITE_TRIAL_CODE`/`VITE_TRIAL_DURATION`) yang udah pindah ke DB `access_codes`. Sekarang cuma list `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Drift fix `docs/explainer/auto-journal-system-design.md` (Zustand→Redux) & `auto-journal-explained.md`/`server-vs-browser.md` (cron 15m→30m).
- Reorganize `docs/`: 3 legacy explainer dipindah ke `docs/explainer/`.

### Security

- RLS + RPC `SECURITY DEFINER` tetap jadi gate server-side (tidak ada perubahan). Lihat `docs/ops/security.md`.

---

## [0.0.0] — Initial baseline

🇮🇩 Baseline sebelum dokumentasi formal. Fitur yang udah shipped:

- Terminal screener (market pulse + tabel sinyal + asset detail dialog + share card)
- Trading engine 5-layer + 3 benchmark context + enrichment + backtest + calibration
- Auto-journal cron 30m + daily/weekly/monthly recap + asset-discovery daily
- Journal dashboard (equity curve, outcome donut, top performers, transactions)
- Economic calendar
- Auth (email/password + Google OAuth) + entitlement (free/trial/premium) + redeem + invite + subscription + disclaimer
- Admin console (users/assets/codes/invitations/plans/payments/disclaimer/statistics)
- 28 DB migrasi, 13 tabel, 22 RPC, RLS penuh
- 26 file test / 268 case (pure core)

🇺🇸 Baseline before formal documentation. Shipped features:

- Terminal screener (market pulse + signal table + asset detail dialog + share card)
- Trading engine 5-layer + 3 benchmark contexts + enrichment + backtest + calibration
- Auto-journal cron 30m + daily/weekly/monthly recap + asset-discovery daily
- Journal dashboard (equity curve, outcome donut, top performers, transactions)
- Economic calendar
- Auth (email/password + Google OAuth) + entitlement (free/trial/premium) + redeem + invite + subscription + disclaimer
- Admin console (users/assets/codes/invitations/plans/payments/disclaimer/statistics)
- 28 DB migrations, 13 tables, 22 RPCs, full RLS
- 26 test files / 268 cases (pure core)

---

## Konvensi / Conventions

| Header       | Arti / Meaning                                                          |
| ------------ | ----------------------------------------------------------------------- |
| `Added`      | Fitur baru / new features                                               |
| `Changed`    | Perubahan di fungsi/sistem existing / changes in existing functionality |
| `Deprecated` | Akan dihapus segera / soon-to-be removed                                |
| `Removed`    | Dihapus / removed                                                       |
| `Fixed`      | Bug fix                                                                 |
| `Security`   | Vulnerability / security-relevant                                       |

> 🇮🇩 **Cara nambah entry**: tiap PR/contribusi yang user-facing, tambah bullet di `[Unreleased]`. Saat rilis, pindah `[Unreleased]` → `[x.y.z] — YYYY-MM-DD` + buat `[Unreleased]` baru kosong.
> 🇺🇸 **How to add**: every user-facing PR/contribution, add a bullet under `[Unreleased]`. On release, move `[Unreleased]` → `[x.y.z] — YYYY-MM-DD` + start a fresh empty `[Unreleased]`.
