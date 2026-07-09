# TSD 00 — Arsitektur / Architecture

> 🇮🇩 Arsitektur high-level: 4 tempat kode jalan, layering, pure/IO split, single-source engine, diagram.
> 🇺🇸 High-level architecture: 4 places code runs, layering, pure/IO split, single-source engine, diagram.

---

## TL;DR

🇮🇩 Produk ini **frontend murni + serverless** — gak ada server backend bikinan sendiri. Kode jalan di **4 tempat**: Browser (React SPA), Supabase Edge Function (Deno cron), Supabase Postgres (DB+RLS+cron), Cloudflare (Pages host + proxy). Keamanan premium/admin **dipaksa di server** (RLS + RPC `SECURITY DEFINER`), bukan browser. Engine sinyal **single-source** di `src/` — di-bundle ke cron & di-pake browser.

🇺🇸 This product is **pure frontend + serverless** — no hand-built backend. Code runs in **4 places**: Browser (React SPA), Supabase Edge Function (Deno cron), Supabase Postgres (DB+RLS+cron), Cloudflare (Pages host + proxy). Premium/admin security is **enforced on the server** (RLS + `SECURITY DEFINER` RPCs), not the browser. The signal engine is **single-sourced** in `src/` — bundled to the cron & used by the browser.

---

## 🗺️ 4 tempat kode jalan / 4 places code runs

| Tempat / Place | 🇮🇩 Apa | 🇺🇸 What |
|---|---|---|
| 🌐 **Browser** (HP/laptop user) | Aplikasi React: UI, chart, dialog, screener, engine live. *The React app: UI, charts, dialogs, screener, live engine.* | |
| 🦾 **Supabase Edge Function** (Deno) | Robot cron (auto-journal 30m / daily-summary hourly / asset-discovery daily). *Cron robots.* | |
| 🗄️ **Supabase Postgres** (+ pg_cron + RLS) | Database, jadwal cron, keamanan, auth. *Database, cron schedule, security, auth.* | |
| ☁️ **Cloudflare** (Pages + Functions) | Hosting SPA statis + proxy data market (Yahoo/F&G lewat proxy; CoinGecko/Binance direct dari browser). *Static SPA host + market-data proxies.* | |

---

## 🧱 Layering / Pure-IO split

🇮🇩 Aturan load-bearing: **setiap fungsi keputusan (decision) pure** — gak ada DOM, fetch, atau `Date.now()` (timestamp di-inject). Cron Deno cuma **wire fetch + DB** di sekitar fungsi pure. Ini bikin engine bisa di-unit-test tanpa mock & di-bundle ke 2 rumah (browser + cron) tanpa perubahan.

🇺🇸 Load-bearing rule: **every decision function is pure** — no DOM, fetch, or `Date.now()` (timestamps injected). The Deno cron only **wires fetch + DB** around the pure functions. This makes the engine unit-testable without mocks & bundleable to both homes (browser + cron) unchanged.

### Dependency layering
```
edge-engine.ts (facade)
    ↓ re-export
{auto-journal-core, asset-discovery-core, context-pipeline, alerts, period-summary}
    ↓
features/engine/* (signals, indicators, regime, 3 contexts, enrichment, backtest, calibration, smart-money, accumulation, relative-strength, fundamentals, sentiment, trading-plan, analysis-text)
    ↓
features/follow-trade/lib (follow-trade-model, trade-chart-window)
    ↓
services/adapters (yahoo-adapter, yahoo-candles, yahoo-fundamentals) + services/supabase (database.types, journal-mapper)
```

---

## 🔁 Single-source engine — dua rumah / two homes

🇮🇩 "Otak" (engine sinyal/TP-SL di `src/features/engine/` + `src/core/`) **bukan** browser-only & **bukan** server-only — jalan di **dua-duanya**:
- **Browser** → sinyal live di screener (real-time pas buka web).
- **Cron (Deno)** → nulis jurnal otomatis (di-bundle jadi `_engine.mjs` lewat `npm run build:edge` — esbuild `--bundle --format=esm --platform=neutral --alias:@=./src`).

Satu sumber kode, dua tempat eksekusi. `edge-engine.ts` (`src/core/edge-engine.ts:12`) facade re-export simbol yang cron import.

🇺🇸 The "brain" (signal/TP-SL engine in `src/features/engine/` + `src/core/`) is **neither** browser-only **nor** server-only — it runs in **both**:
- **Browser** → live signals in the screener.
- **Cron (Deno)** → auto-journal writes (bundled as `_engine.mjs` via `npm run build:edge`).

One source, two execution sites. `edge-engine.ts` (`src/core/edge-engine.ts:12`) is the facade re-exporting the symbols the cron imports.

---

## 🌐 + 🛰️ Jalur Data Market / Market Data Path

🇮🇩 Browser & cron **sebagian lewat proxy Cloudflare, sebagian langsung** (split = hindari IP-shared rate-limit):
- **Browser** → Yahoo + F&G lewat proxy CF (`/api/yahoo`, `/api/fng`); CoinGecko `/global` + Binance derivatives **direct** ke upstream (IP visitor sendiri).
- **Cron** → semua lewat proxy CF (cache selalu warm, traffic dikit).

🇺🇸 Browser & cron **partly through the Cloudflare proxy, partly direct** (split avoids shared-IP rate-limiting):
- **Browser** → Yahoo + F&G via CF proxy; CoinGecko `/global` + Binance derivatives **direct** to upstream (visitor's own IP).
- **Cron** → all via CF proxy (cache always warm, low traffic).

> Detail: [`04-cloudflare-proxy.md`](04-cloudflare-proxy.md).

---

## 🔒 Jangan percaya browser / Don't trust the browser

🇮🇩 Browser bisa di-hack/diutak-atik user. Gerbang penting **gak boleh** cuma di UI:
- **Premium/admin** → RLS + `is_premium()`/`is_admin()`/`is_owner()` di Postgres. UI cuma nyembunyiin tombol; RLS yang ngunci.
- **Redeem code** → RPC `SECURITY DEFINER` (kode rahasia gak pernah sampai browser).
- **Tulis jurnal** → cuma cron (service-role). Browser **read-only**.

🇺🇸 The browser can be tampered with. Important gates **must not** live only in the UI:
- **Premium/admin** → RLS + `is_premium()`/`is_admin()`/`is_owner()` in Postgres. UI only hides buttons; RLS locks.
- **Code redemption** → `SECURITY DEFINER` RPC (secret codes never reach the browser).
- **Journal writes** → cron only (service-role). Browser is **read-only**.

---

## 📐 Diagram

```
        🌐 BROWSER (untrusted)                 ☁️ CLOUDFLARE
        - React UI / charts                    - Pages (host situs statis)
        - screener: engine live                - Functions: market-data proxy
        - market data:                              (fresh/stale/error cache)
            Yahoo + F&G  ──proxy──▶  ☁️  ──▶  upstream
            CoinGecko /global  ────────────▶  api.coingecko.com  (IP visitor)
            Binance derivatives ───────────▶  fapi.binance.com   (IP visitor)
                                       ▲
        🦾 EDGE FUNCTION (Deno) ──────┘  (cron, lewat proxy CF)
        - auto-journal / daily-summary / asset-discovery
        - baca journal_trades  ─────────┐
        - /admin tulis universe ──────┐ │
                                       │ │
                                       ▼ ▼  (RLS nentuin boleh/enggak)
        🗄️ SUPABASE POSTGRES (server, trusted)
        - 13 tabel (journal_trades / journal_assets / journal_settings / profiles ...)
        - RLS + is_premium()/is_admin()/is_owner() + RPC redeem  ← keamanan
        - pg_cron ⏰ ──POST──▶ 🦾 EDGE FUNCTION (Deno)
                                 - 3 robot cron
                                 - market data via CF proxy by default
                                 - service-role → tulis journal_trades
```

---

## 🔗 Terkait / Related
- [`01-tech-stack.md`](01-tech-stack.md) — tech stack detail
- [`02-data-flow.md`](02-data-flow.md) — flow data + state
- [`../explainer/server-vs-browser.md`](../explainer/server-vs-browser.md) — explainer lama
- [`../fsd/00-overview.md`](../fsd/00-overview.md) — produk view
