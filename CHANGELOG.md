# Changelog

> 🇮🇩 Catatan versi & perubahan. Format [Keep a Changelog](https://keepachangelog.com/), semantik [SemVer](https://semver.org/).
> 🇺🇸 Version & change notes. Format [Keep a Changelog](https://keepachangelog.com/), [SemVer](https://semver.org/) semantics.

---

## [Unreleased]

### Added

- **Overhaul dokumentasi profesional (2026-09-16)**: struktur rename deskriptif bernomor (`docs/01-fsd-spesifikasi-fungsional/`, `02-tsd-spesifikasi-teknis/`, `03-testing-pengujian/`, `04-ops-operasional/`, `05-penjelasan-explainer/`), pola bilingual sekuensial ID-penuh-lalu-EN-penuh dengan panjang setara, gaya Gen-Z santai tanpa pronomina standalone, diagram Mermaid di 14 file (arsitektur, data-flow, ER schema, cache proxy, sequence 3 cron, trust boundary, pie coverage, flowchart metodologi), dan rewrite total SDD auto-journal mengikuti engine v5 + episodes + progressive exit v4.
- **Professional documentation overhaul (2026-09-16)**: descriptive numbered structure (`docs/01-fsd-spesifikasi-fungsional/`, `02-tsd-spesifikasi-teknis/`, `03-testing-pengujian/`, `04-ops-operasional/`, `05-penjelasan-explainer/`), sequential full-ID-then-full-EN bilingual pattern with parity length, relaxed Gen-Z tone sans standalone pronouns, Mermaid diagrams in 14 files (architecture, data flow, schema ER, proxy cache, 3-cron sequence, trust boundary, coverage pie, methodology flowchart), plus total auto-journal SDD rewrite tracking engine v5 + episodes + progressive exit v4.

### Fixed

- **Angka kanonis dokumentasi dikunci**: 45 file / 422 case (`npm test`), 38 migrasi, 16 tabel, 28 RPC, `MIN_CALIBRATION_SAMPLE = 30`; durasi trial dinyatakan konfigurabel via `VITE_TRIAL_DURATION` (tanpa klaim fix 3/7 hari); typo flag `🇧🇧`/`🇮🇧` dikoreksi ke `🇺🇸`/`🇮🇩`; referensi `file:line` rapuh diganti format `file › fungsi`; email owner dan project ref hardcode disterilkan dari `supabase/README.md` menjadi placeholder.
- **Documentation canonical figures locked**: 45 files / 422 cases (`npm test`), 38 migrations, 16 tables, 28 RPCs, `MIN_CALIBRATION_SAMPLE = 30`; trial length stated configurable via `VITE_TRIAL_DURATION` (no fixed 3/7-day claim); `🇧🇧`/`🇮🇧` flag typos corrected to `🇺🇸`/`🇮🇩`; brittle `file:line` refs replaced with `file › function` format; hardcoded owner email plus project ref sterilized from `supabase/README.md` into placeholders.

### Added (previous)

- **Dokumentasi lengkap** bilingual (ID/EN): `docs/{fsd,tsd,testing,ops,explainer}/` + index `docs/README.md`, termasuk coverage inventory 35 file/325 case dan engine-internals mendalam.
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
