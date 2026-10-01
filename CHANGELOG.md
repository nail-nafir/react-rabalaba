# Changelog

> 🇮🇩 Catatan versi & perubahan. Format [Keep a Changelog](https://keepachangelog.com/), semantik [SemVer](https://semver.org/).
> 🇺🇸 Version & change notes. Format [Keep a Changelog](https://keepachangelog.com/), [SemVer](https://semver.org/) semantics.

---

## [Unreleased]

### Changed (Alert Discord, 2026-10-01)

- **Checkpoint TP1/TP2 di Discord**: trade yang masih open dan menyentuh TP mengirim blok `📍 CHECKPOINT` berisi TP yang kena, PARTIAL (leg yang ditutup, contoh `TP1 50%`), dan SL BARU (entry setelah TP1, TP sebelumnya setelah TP2). Alert baru terkirim setelah milestone tersimpan, jadi cron yang mengulang tidak mengirim dobel. (`src/core/automation/alerts.ts`, `src/core/automation/auto-journal-core.ts`, `supabase/functions/auto-journal/index.ts`)
- **HASIL trade v7 memakai PARTIAL, bukan SEMPAT**, jadi persen akhir yang lebih kecil dari pergerakan harga terlihat jelas asalnya; trade lama tanpa partial tetap memakai SEMPAT. (`src/core/automation/alerts.ts`)
- **TP1/TP2 checkpoints on Discord**: a still-open trade that reaches a TP sends a `📍 CHECKPOINT` block with the TP hit, PARTIAL (legs closed, e.g. `TP1 50%`), and SL BARU (entry after TP1, the previous TP after TP2). The alert goes out only after the milestone is saved, so a retried cron never double-sends. (`src/core/automation/alerts.ts`, `src/core/automation/auto-journal-core.ts`, `supabase/functions/auto-journal/index.ts`)
- **v7 RESULT lines use PARTIAL instead of SEMPAT**, so a final percent smaller than the price move shows where it came from; older trades without partials keep SEMPAT. (`src/core/automation/alerts.ts`)

### Fixed (Alert Discord, 2026-10-01)

- **`TP n/3` di Discord sama dengan dashboard**: alert close memakai `deriveFollowProgress` seperti badge dashboard, jadi trade v7 yang kena stop di entry setelah TP1 tertulis `TP 1/3`, bukan `TP 0/3`; tangga SL dipakai bersama lewat `activeStopFor`. (`src/core/automation/auto-journal-core.ts`, `src/core/trade/follow-trade-model.ts`)
- **Discord `TP n/3` matches the dashboard**: close alerts use `deriveFollowProgress` like the dashboard badge, so a v7 trade stopped at entry after TP1 reads `TP 1/3`, not `TP 0/3`; the stop ladder is shared through `activeStopFor`. (`src/core/automation/auto-journal-core.ts`, `src/core/trade/follow-trade-model.ts`)

### Changed (Pemindai Aset, 2026-10-01)

- **Urutan default tabel mendahulukan sinyal yang bisa ditindaklanjuti**: LONG/SHORT aktif paling atas, lalu kandidat yang menunggu candle eksekusi, lalu netral lain, terakhir Tidak tersedia; kekuatan besar ke kecil mengurutkan isi tiap grup (panah Sinyal ↓) dan klik header Kekuatan tetap memberi urutan murni kekuatan. (`src/features/market/components/asset-signal-table.tsx`, `src/core/automation/signal-episode.ts › compareTerminalSignal`)
- **Default table order puts actionable signals first**: active LONG/SHORT on top, then candidates awaiting the execution candle, then other neutral rows, then Unavailable; strength from high to low orders each group (Signal arrow ↓) and clicking the Strength header still gives a pure strength order. (`src/features/market/components/asset-signal-table.tsx`, `src/core/automation/signal-episode.ts › compareTerminalSignal`)

### Changed (engine v7, 2026-09-30)

- **Gate tren multi-timeframe**: LONG/SHORT hanya terbit di sisi yang sama dengan EMA200 candle sinyal, EMA200 timeframe atas, dan EMA50 harian (dari jendela 60d yang sama, tanpa fetch tambahan). Riset walk-forward holdout: expectancy −0,108R → +0,006R, reversal whipsaw 25% → ~6%. (`src/core/engine/signals.ts`, `src/core/market/candles.ts › deriveTrendAnchors`)
- **Partial TP 50/30/20 untuk trade v7**: tangga stop sama, akuntansi `computePnl` + SQL win rate publik memblend leg yang sudah terjual; backtest dialog memakai exit `scaleOut` yang sama. (`src/core/trade/follow-trade-model.ts`, `supabase/migrations/20260930000001_scale_out_public_win_rate.sql`)
- **Discovery mengikuti volume**: Binance quote volume (dengan cek harga per koin) dan Yahoo most-actives; CoinGecko trending dan day gainers dipensiunkan; baris admin tidak lagi memakan jendela shortlist. (`src/core/automation/asset-discovery-core.ts`, `supabase/functions/asset-discovery/index.ts`)
- **Multi-timeframe trend gate**: LONG/SHORT only publish on the same side as the signal-candle EMA200, higher-timeframe EMA200, and daily EMA50 (from the same 60d window, no extra fetch). Walk-forward holdout: expectancy −0.108R → +0.006R, reversal whipsaws 25% → ~6%. (`src/core/engine/signals.ts`, `src/core/market/candles.ts › deriveTrendAnchors`)
- **50/30/20 partial take profit for v7 trades**: same stop ladder; `computePnl` plus the public win-rate SQL blend the sold legs; the dialog backtest uses the same `scaleOut` exit. (`src/core/trade/follow-trade-model.ts`, `supabase/migrations/20260930000001_scale_out_public_win_rate.sql`)
- **Volume-led discovery**: Binance quote volume (with a per-coin price check) and Yahoo most-actives; CoinGecko trending and day gainers are retired; admin rows no longer consume the shortlist window. (`src/core/automation/asset-discovery-core.ts`, `supabase/functions/asset-discovery/index.ts`)

### Fixed (engine v7, 2026-09-30)

- **Replay jurnal dimulai dari candle yang memuat entry** (toleransi 5 menit), jadi SL/TP jam pertama tidak lagi terlewat; **IDX dan komoditas bisa entry lagi** lewat jendela 45 menit untuk feed Yahoo yang terlambat; **impas memakai toleransi 1e-9** di satu tempat; **mapping perp Binance** membuang suffix angka Yahoo (`PEPE24478-USD` → `1000PEPEUSDT`); copy keberhasilan tidak lagi menyebut impas dihitung. (`src/core/automation/auto-journal-core.ts`, `src/services/api/binance.ts`, `src/assets/locales/{en,id}.json`)
- **Journal replay starts at the candle holding the entry** (5-minute tolerance), so first-hour SL/TP hits are no longer skipped; **IDX and commodities can enter again** through a 45-minute window for lagging Yahoo feeds; **breakeven uses a 1e-9 tolerance** in one place; **Binance perp mapping** drops Yahoo numeric suffixes (`PEPE24478-USD` → `1000PEPEUSDT`); success-rate copy no longer claims breakeven counts. (`src/core/automation/auto-journal-core.ts`, `src/services/api/binance.ts`, `src/assets/locales/{en,id}.json`)

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
