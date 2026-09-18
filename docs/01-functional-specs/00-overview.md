# FSD 00 — Ikhtisar Produk / Product Overview

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Terminal, Engine, Jurnal, Kalender, Auth, Admin, Testimoni

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

RabaLaba merupakan terminal riset trading multi-aset untuk kripto, saham USA, saham Indonesia, komoditas, dan forex. Terminal menerbitkan sinyal swing 1 jam plus rencana trading TP/SL plus jurnal otomatis. Alur sat-set dari data pasar sampai jurnal tertata rapi.

Produk berfungsi sebagai pendukung keputusan, bukan broker, bukan bot eksekusi, bukan penasihat keuangan. Sinyal mencerminkan keselarasan teknikal, bukan janji profit. Rencana trading berfungsi sebagai referensi, bukan order.

Stack memakai React 19 plus Vite 8 plus Supabase plus Cloudflare Pages. Cron auto-journal berjalan tiap 30 menit. Rekap harian berjalan hourly dengan self-gate WIB. Discovery aset berjalan daily.

- Basis uji: 45 file dengan 422 kasus.
- Migrasi: 38 file skema.
- Skema: 16 tabel plus 28 RPC.
- Kalibrasi butuh sampel minimal MIN_CALIBRATION_SAMPLE = 30.
- Durasi trial konfigurabel via VITE_TRIAL_DURATION tanpa default bawaan.

## 🇮🇩 Persona dan Hak Akses

Akses premium dan admin ditegakkan di server via RLS plus RPC SECURITY DEFINER. Browser hanya membaca profil sendiri. Jurnal mentah tetap premium; agregat publik tetap terbuka.

| Persona | Akses Server | Kemampuan |
|---|---|---|
| Anonim | free | Lihat landing, screener default, kalender, subscription |
| Trial | trial via kode/invite | Buka premium plus jurnal, universe DB, favorit, tambah ticker |
| Premium | premium via kode/invite/grant | Sama seperti trial tanpa kedaluwarsa |
| Admin | is_admin | Kelola akun, universe, kode, invite, plan, payment, disclaimer |
| Owner | is_owner | Sama seperti admin plus judul konsol Owner |

Trial kedaluwarsa otomatis kembali ke free saat wall-clock melewati batas.

## 🇮🇩 Peta Rute

Router memakai createBrowserRouter dengan lazy page. Guard premium bersifat soft; guard admin bersifat keras.

| Rute | Komponen | Penjagaan |
|---|---|---|
| / | LandingPage | Publik |
| /terminal, /terminal/market | TerminalPage market | Publik |
| /terminal/journal | TerminalPage journal | Soft ke market plus dialog lisensi |
| /calendar | CalendarPage | Publik |
| /subscription | SubscriptionPage | Publik |
| /invite/:code | InvitePage | Klaim saat auth |
| /admin/* | Admin pages | Keras ke root bila non-admin |
| /login, /register, /auth/callback | Auth pages | Publik plus OAuth PKCE |
| * | NotFoundPage | Publik |

## 🇮🇩 Fitur Inti

Delapan fitur membentuk alur riset sampai jurnal. Diagram kanonis tersimpan di TSD signal-flow.

| Fitur | Dokumen | Sorotan |
|---|---|---|
| 1 Terminal screener | FSD 01 | Pulse, tabel sinyal, dialog detail, chart setup, share card |
| 2 Trading engine | FSD 02 | Pipeline 5-layer, regime, 3 benchmark, enrichment, backtest, kalibrasi |
| 3 Auto-journal | FSD 03 | Cron 30 menit, emit plus close, Discord alert |
| 4 Journal dashboard | FSD 04 | Kurva ekuitas, donut outcome, top performer, tabel transaksi |
| 5 Kalender ekonomi | FSD 05 | Event bulan berjalan, badge impact, dialog detail |
| 6 Auth entitlement | FSD 06 | Login OAuth, tier server-truth, redeem, invite, disclaimer |
| 7 Admin console | FSD 07 | Akun, aset, kode, invite, plan, payment, disclaimer, statistik |
| 8 Testimoni | FSD 08 | Satu per akun, moderasi, enam slot landing |

## 🇮🇩 Glosarium

Istilah kunci menjaga bahasa seragam lintas dokumen. Definisi ringkas tampil di bawah.

| Istilah | Definisi |
|---|---|
| Swing 1h | Timeframe default: range 60 hari, interval 1 jam |
| Signal | LONG/SHORT/NEUTRAL plus strength 0-100 plus grade A/B/C |
| Strength | Skor alignment teknikal, bukan probabilitas menang |
| Tier | A kuat, B sedang, C lemah via TIER_THRESHOLDS |
| Regime | trending/ranging/high_volatility/low_volatility dari Layer 1 |
| Context | Status risk benchmark: BTC, IHSG+USDIDR, S&P+VIX+DXY |
| Enrichment | Context de-rate; smart-money/accumulation/relative/fundamental display-only |
| Followed trade | Trade snapshot dengan TP/SL aktif dipantau cron |
| Journal parity | Setiap sinyal fresh actionable tercatat saat snapshot cron |
| Calibration | Hit-rate historis per tier+regime, sampel minimal 30 |
| Universe | Daftar aset: free konstanta, premium DB single-source |
| Edge engine | Core murni di browser plus cron Deno single-source |

## 🇮🇩 Batasan Produk

Produk bukan broker, bukan bot eksekusi, bukan penasihat keuangan. Data pasar memakai delay Yahoo. Disclaimer resmi tersimpan di DB.

Sinyal berarti alignment teknikal. Rencana berarti referensi. Keputusan akhir tetap pada operator akun.

## 🇮🇩 Tautan Terkait

- Terminal: docs/01-functional-specs/01-terminal-screener.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Testing: docs/03-testing/
- Operasional: docs/04-operations/
- Metodologi: docs/05-explainers/00-trading-methodology.md

---

<a id="english-part"></a>

## 🇺🇸 Summary

RabaLaba serves as multi-asset trading research terminal for crypto, USA stocks, Indonesia stocks, commodities, plus forex. Terminal publishes 1h swing signals plus TP/SL trade plans plus automated journal. Deep-dive flow from market data to tidy journal remains neat.

Product functions as decision support, not broker, not execution bot, not financial adviser. Signals reflect technical alignment, not profit promise. Trade plans function as reference, not orders.

Stack uses React 19 plus Vite 8 plus Supabase plus Cloudflare Pages. Auto-journal cron runs every 30 minutes. Daily recap runs hourly with WIB self-gate. Asset discovery runs daily.

- Test basis: 45 files with 422 cases.
- Migrations: 38 schema files.
- Schema: 16 tables plus 28 RPCs.
- Calibration needs minimum sample MIN_CALIBRATION_SAMPLE = 30.
- Trial duration configurable via VITE_TRIAL_DURATION with no built-in default.

## 🇺🇸 Personas and Entitlements

Premium plus admin access remains enforced on server via RLS plus SECURITY DEFINER RPCs. Browser only reads the own profile row. Raw journal remains premium; public aggregates remain open.

| Persona | Server Access | Capability |
|---|---|---|
| Anonymous | free | View landing, default screener, calendar, subscription |
| Trial | trial via code/invite | Unlock premium plus journal, DB universe, favorites, ticker add |
| Premium | premium via code/invite/grant | Same as trial with no expiry |
| Admin | is_admin | Manage accounts, universe, codes, invites, plans, payments, disclaimer |
| Owner | is_owner | Same as admin plus Owner console title |

Expired trial automatically returns to free once wall-clock passes the limit.

## 🇺🇸 Route Map

Router uses createBrowserRouter with lazy pages. Premium guard remains soft; admin guard remains hard.

| Route | Component | Guard |
|---|---|---|
| / | LandingPage | Public |
| /terminal, /terminal/market | TerminalPage market | Public |
| /terminal/journal | TerminalPage journal | Soft to market plus license dialog |
| /calendar | CalendarPage | Public |
| /subscription | SubscriptionPage | Public |
| /invite/:code | InvitePage | Claim during auth |
| /admin/* | Admin pages | Hard to root when non-admin |
| /login, /register, /auth/callback | Auth pages | Public plus OAuth PKCE |
| * | NotFoundPage | Public |

## 🇺🇸 Core Features

Eight features form research-to-journal flow. Canonical diagrams live in TSD signal-flow.

| Feature | Document | Highlight |
|---|---|---|
| 1 Terminal screener | FSD 01 | Pulse, signal table, detail dialog, setup chart, share card |
| 2 Trading engine | FSD 02 | 5-layer pipeline, regime, 3 benchmarks, enrichment, backtest, calibration |
| 3 Auto-journal | FSD 03 | 30-minute cron, emit plus close, Discord alert |
| 4 Journal dashboard | FSD 04 | Equity curve, outcome donut, top performers, transaction table |
| 5 Economic calendar | FSD 05 | Current-month events, impact badge, detail dialog |
| 6 Auth entitlement | FSD 06 | OAuth login, server-truth tier, redeem, invite, disclaimer |
| 7 Admin console | FSD 07 | Accounts, assets, codes, invites, plans, payments, disclaimer, stats |
| 8 Testimonials | FSD 08 | One per account, moderation, six landing slots |

## 🇺🇸 Glossary

Key terms keep language uniform across documents. Concise definitions appear below.

| Term | Definition |
|---|---|
| 1h swing | Default timeframe: 60-day range, 1h interval |
| Signal | LONG/SHORT/NEUTRAL plus strength 0-100 plus grade A/B/C |
| Strength | Technical alignment score, not win probability |
| Tier | A strong, B medium, C weak via TIER_THRESHOLDS |
| Regime | trending/ranging/high_volatility/low_volatility from Layer 1 |
| Context | Benchmark risk status: BTC, IHSG+USDIDR, S&P+VIX+DXY |
| Enrichment | Context de-rates; smart-money/accumulation/relative/fundamental display-only |
| Followed trade | Snapshot trade with active TP/SL monitored via cron |
| Journal parity | Each fresh actionable signal recorded at cron snapshot |
| Calibration | Historical hit-rate per tier+regime, minimum sample 30 |
| Universe | Asset list: free constants, premium DB single-source |
| Edge engine | Pure core in browser plus Deno cron single-source |

## 🇺🇸 Product Boundaries

Product remains not broker, not execution bot, not financial adviser. Market data uses Yahoo delay. Official disclaimer lives in the DB.

Signals mean technical alignment. Plans mean reference. Final decision remains with the account operator.

## 🇺🇸 Related Links

- Terminal: docs/01-functional-specs/01-terminal-screener.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Testing: docs/03-testing/
- Operations: docs/04-operations/
- Methodology: docs/05-explainers/00-trading-methodology.md
