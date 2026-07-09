# FSD 00 — Ikhtisar Produk / Product Overview

> 🇮🇩 Dokumen ini ngejelasin apa itu RabaLaba, siapa pemakainya, dan istilah-istilah penting.
> 🇺🇸 This document explains what RabaLaba is, who uses it, and the key terms.

---

## TL;DR

🇮🇩 **RabaLaba** adalah terminal riset trading multi-aset (crypto / saham US / saham ID / komoditas / forex) yang ngasih **sinyal swing 1-jam** + rencana trading (TP/SL) + jurnal otomatis. Bukan sistem eksekusi — ini alat bantu keputusan (*decision support*). Dijalankan sebagai SPA React 19 + Supabase + Cloudflare Pages, dengan robot cron yang nulis jurnal tanpa browser terbuka.

🇺🇸 **RabaLaba** is a multi-asset trading-research terminal (crypto / US stocks / ID stocks / commodity / forex) that produces **1-hour swing signals** + a trade plan (TP/SL) + an automated journal. It is **not** an execution system — it's a *decision-support* tool. Runs as a React 19 SPA + Supabase + Cloudflare Pages, with a cron robot that journals trades without a browser open.

---

## 🎯 Produk satu kalimat / One-sentence product

🇮🇩 Terminal yang narik data pasar, jalanin engine sinyal murni, nampilin sinyal + rencana trading di screener, dan nyatat trade yang diikuti ke jurnal otomatis lewat cron.

🇺🇸 A terminal that pulls market data, runs a pure signal engine, shows signals + trade plans in a screener, and records followed trades to an automated journal via cron.

---

## 👥 Persona / Personas

| Persona | 🇮🇩 Hak akses / Akses | 🇺🇸 Entitlement | Bisa apa / Can do |
|---|---|---|---|
| **Anonim / Anonymous** | `free` | free | Lihat landing, screener dengan universe `DEFAULT_*` konstanta, kalender, subscription page. *Landing, screener with constant universe, calendar, subscription.* |
| **Trial** | `trial` (3 hari dari access code / invite) | trial | Semua premium + jurnal dashboard, universe DB, favorites, add-ticker. *All premium + journal dashboard, DB universe, favorites, add-ticker.* |
| **Premium** | `premium` (redeem code / invite / admin grant) | premium | Sama trial, tapi tanpa kedaluwarsa. *Same as trial but no expiry.* |
| **Admin** | `is_admin` | admin | Kelola user, universe jurnal, access code, invitation, plan, payment, disclaimer. *Manage users, journal universe, access codes, invitations, plans, payments, disclaimer.* |
| **Owner** | `is_owner` | owner | Sama admin + judul konsol "Owner". *Same as admin + console title "Owner".* |

> 🇮🇩 **Penting:** keamanan premium/admin dipaksa di **server** (RLS + RPC `SECURITY DEFINER`), bukan cuma di UI. Browser bisa diutak-atik.
> 🇺🇸 **Key:** premium/admin security is enforced on the **server** (RLS + `SECURITY DEFINER` RPCs), not just the UI. The browser can be tampered with.

---

## 🗺️ Peta rute / Route map

| Rute / Route | Komponen / Component | Layout | Guard |
|---|---|---|---|
| `/` | LandingPage | Root | — |
| `/terminal` `/terminal/market` | TerminalPage (market view) | Root | — |
| `/terminal/journal` | TerminalPage (journal view) | Root | soft: non-premium → redirect `/terminal/market` + buka license dialog |
| `/calendar` | CalendarPage | Root | — |
| `/subscription` | SubscriptionPage | Root | — |
| `/invite/:code` | InvitePage | Root | — (claim saat auth) |
| `/admin/*` (9 sub-route) | Admin* pages | Admin | **admin** (redirect `/` kalau bukan admin) |
| `/login` `/register` | Login/Register | Auth | — |
| `/auth/callback` | AuthCallbackPage | — | OAuth PKCE landing |
| `*` | NotFoundPage | — | — |

> Sumber / Source: `src/app/router/index.tsx:29` (`createBrowserRouter`), `src/app/router/lazy-pages.ts:3` (lazy import semua page).

---

## 🧩 Fitur inti / Core features

| # | Fitur / Feature | Doc | Highlight |
|---|---|---|---|
| 1 | Terminal screener (market view) | `fsd/01` | Market pulse cards + tabel sinyal + asset detail dialog + share card |
| 2 | Trading engine | `fsd/02` | Pipeline 5-layer, regime, 3 benchmark context, enrichment, backtest, calibration |
| 3 | Auto-journal robot | `fsd/03` | Cron 30m, emit + close trade, Discord alert |
| 4 | Journal dashboard | `fsd/04` | Equity curve, outcome donut, top performers, transactions table |
| 5 | Economic calendar | `fsd/05` | Event bulan ini, impact badge, detail dialog |
| 6 | Auth & entitlement | `fsd/06` | Login/OAuth, premium/trial, redeem, invite, subscription, disclaimer |
| 7 | Admin console | `fsd/07` | Users, assets, codes, invitations, plans, payments, disclaimer, statistics |

---

## 📖 Glossary

| Istilah / Term | 🇮🇩 Arti | 🇺🇸 Meaning |
|---|---|---|
| **Swing 1h** | Timeframe default: range 1 bulan, interval 1 jam. *Default timeframe: 1-month range, 1-hour interval.* | |
| **Signal / Outlook** | LONG / SHORT / NEUTRAL + strength 0-100 + grade A/B/C. *Direction + strength + grade.* | |
| **Strength** | Skor *alignment teknis* (bukan probabilitas menang) = `round(|directionScore|×100)`. *Technical alignment score, not win probability.* | |
| **Tier / Grade** | A (kuat) / B (sedang) / C (lemah) — ambang di `TIER_THRESHOLDS`. *Strength band.* | |
| **Regime** | `trending` / `ranging` / `high_volatility` / `low_volatility` — klasifikasi Layer 1. *Layer 1 market-state classifier.* | |
| **Context** | Risk-state benchmark top-down: BTC (crypto), IHSG+USDIDR (ID), S&P+VIX+DXY (US). *Top-down benchmark risk state.* | |
| **Enrichment** | Rantai pasca-sinyal: context de-rate → flow nudge (smart-money/accumulation) → relative-strength → fundamentals. *Post-signal enrichment chain.* | |
| **Smart money** | Posisi derivatives crypto (OI × price, funding, L/S ratio) dari Binance. *Crypto derivatives positioning.* | |
| **Accumulation** | Aliran A/D equity (CMF/MFI/up-down volume) — analog "bandarmology" ID. *Equity A/D flow.* | |
| **Followed trade** | Trade yang di-snapshot & diikuti TP/SL-nya (dulu manual, sekarang cron). *A snapshotted trade tracked to TP/SL.* | |
| **Emission gate** | Filter cron: sinyal counter-trend vs context di-blok kecuali strength pasca-de-rate ≥ 60. *Cron filter blocking counter-trend signals unless post-derate strength ≥ 60.* | |
| **Calibration** | Win-rate historis per tier+regime dari backtest (sample ≥ 8). *Historical hit-rate per tier+regime.* | |
| **Universe** | Daftar aset yang dianalisis: free = konstanta `DEFAULT_*`, premium = `journal_assets` DB (single-source dengan cron). *Analyzed asset list.* | |
| **Edge engine** | Engine pure di `src/core/`+`src/features/engine/` yang di-bundle juga ke Deno cron (single-source). *Pure engine bundled to both browser & cron.* | |

---

## ⚠️ Batasan produk / Product boundaries

🇮🇩 RabaLaba **bukan**: broker, bot eksekusi, penasihat keuangan, atau jaminan profit. Sinyal = alignment teknikal, bukan janji. Trade plan = referensi, bukan order. Data punya delay (Yahoo). Lihat disclaimer DB untuk disclaimer resmi.

🇺🇸 RabaLaba is **not**: a broker, execution bot, financial advisor, or profit guarantee. Signals = technical alignment, not promises. Trade plans = references, not orders. Data is delayed (Yahoo). See the DB disclaimer for the official risk disclaimer.

---

## 🔗 Terkait / Related
- [`00-overview.md`](00-overview.md) → lanjut [`01-terminal-screener.md`](01-terminal-screener.md)
- [`../tsd/00-architecture.md`](../tsd/00-architecture.md) — arsitektur teknis
- [`../README.md`](../README.md) — index
