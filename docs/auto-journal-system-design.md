# Auto-Journal System — Software Design Document

| | |
|---|---|
| **Project** | RabaLaba Terminal (`react-raba-laba`) |
| **Subsystem** | Trade Journal + Premium Entitlement |
| **Status** | Live (frontend shipped; cron + auth deployed) |
| **Last updated** | 2026-06-15 |
| **Supabase project ref** | `nravncsodgcxwkdaeqcw` |

---

## 1. Executive Summary

The trade journal was migrated from a **manual, client-side, per-device** model
(user clicks "Follow Trade", trades live in `localStorage`, TP/SL only closes
while the tab is open) to an **autonomous, server-side, global track-record**
driven by a scheduled cron job.

A Supabase **Edge Function** (Deno) runs every 30 minutes via **pg_cron**. It
re-runs the *same* signal engine the web app uses, emits every fresh long/short
signal into a `journal_trades` table, and closes open trades on TP/SL or signal
reversal — all without any browser open. The web app became a **read-only**
consumer of that journal.

A second pillar, **Phase 3 (Auth & Entitlements)**, moved premium access off the
forgeable `localStorage` grant onto **server-truth**: Supabase Auth (email +
password) + a `profiles.tier` row, with codes redeemed through a
`SECURITY DEFINER` RPC. The free tier stays fully anonymous; login is required
only to redeem a code.

---

## 2. Background & Motivation

### 2.1 The old model (manual follow-trade)

- **Storage:** a Zustand store persisted to `localStorage` (`follow-store.ts`).
- **Entry:** the user manually clicked a "Follow Trade" button on a signal,
  which snapshotted the asset into the store.
- **Exit:** `applyPriceSync()` evaluated TP/SL **client-side, only while the tab
  was open**. Close it overnight? Nothing happened until you reopened the app.
- **Entitlement:** premium was a base64 "granted" flag in `localStorage` +
  access codes shipped in the client bundle (`VITE_ACCESS_CODE`).

### 2.2 Why it had to change

| Problem | Consequence |
|---|---|
| Journal lived per-device in `localStorage` | Not shared, lost on clear-storage, no cross-device |
| TP/SL only synced while a tab was open | Missed exits, unreliable record |
| Entry was manual | Track record depended on the user remembering to click |
| Premium = `localStorage` flag | Trivially forged via devtools; codes leaked in the bundle |

The goal: an **autonomous, trustworthy, global** track record of what the engine
actually signalled and how those trades resolved — plus a premium gate that
can't be flipped from devtools.

---

## 3. Migration Overview (Before → After)

| Aspect | Before (manual) | After (auto cron) |
|---|---|---|
| Trigger | User clicks "Follow" | pg_cron every 30 min |
| Where it runs | Browser tab | Supabase Edge Function (Deno) |
| Storage | `localStorage` (per device) | Postgres `journal_trades` (global) |
| TP/SL close | Client, tab-open only | Server, every cron tick (candle replay) |
| Reversal close | n/a | Server, long↔short (secures touched TP) |
| Frontend role | Owner (read + write) | Read-only consumer (react-query) |
| Premium gate | `localStorage` flag (forgeable) | Supabase Auth + `profiles.tier` (server truth) |
| Access codes | Shipped in bundle | DB-only, redeemed via RPC |

**Removed** in the migration: the follow button, manual close/delete actions,
the client-side `applyPriceSync` loop, and the `follow-store` localStorage layer.

---

## 4. System Architecture

```
                          ┌──────────────────────────────────────────────┐
                          │  Supabase (project nravncsodgcxwkdaeqcw)       │
                          │                                                │
   pg_cron 'auto-journal-30m'  ── net.http_post (Bearer = publishable) ─┐  │
   (*/30 * * * *)             │                                         ▼  │
                          │   ┌────────────────────────────────────────┐  │
                          │   │ Edge Function: auto-journal (Deno)      │  │
                          │   │  1. fetch universe (Yahoo, 1mo/1h)      │  │
                          │   │  2. adaptYahooChart → UnifiedAsset      │  │
                          │   │  3. runAutoJournal(assets, openRows)    │  │
                          │   │     → { inserts, closures }             │  │
                          │   │  4. write (service-role key, bypass RLS)│  │
                          │   │     imports ./_engine.mjs (bundled src) │  │
                          │   └───────────────┬────────────────────────┘  │
                          │                   ▼                            │
                          │        Postgres: journal_trades                │
                          │        (RLS read = is_premium();               │
                          │         writes = service-role only)            │
                          │        profiles · access_codes ·               │
                          │        code_redemptions · auth.users           │
                          └───────────────────┬────────────────────────────┘
                                              │ publishable key (RLS-bound)
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │  Vite SPA (browser)                           │
                       │  use-journal-trades (react-query, 60s)        │
                       │   → JournalDashboard (charts)                 │
                       │   → FollowHistoryTable (transactions)         │
                       │  use-auth / use-premium-access (profiles)     │
                       └──────────────────────────────────────────────┘
```

### 4.1 Tech stack

- **Frontend:** React + Vite SPA, react-router-dom, react-i18next (en/id),
  TanStack Query, shadcn/ui, recharts, Zustand (UI state).
- **Market data proxy:** Cloudflare Pages Functions (`functions/api/*`) for the
  browser; the Edge Function hits Yahoo directly (UA-spoofed).
- **Backend:** Supabase — Postgres, Edge Functions (Deno), pg_cron + pg_net +
  Vault, Auth.

### 4.2 Single-source engine

The decision logic exists **once** in `src/` and is shared by both the app and
the cron:

```
src/core/edge-engine.ts   (façade: re-exports the PURE engine + EDGE_UNIVERSE)
        │  npm run build:edge  (esbuild --bundle --alias @→src)
        ▼
supabase/functions/auto-journal/_engine.mjs   (standalone ESM, gitignored)
        │  import { ... } from "./_engine.mjs"
        ▼
supabase/functions/auto-journal/index.ts   (Deno wiring: fetch + DB I/O)
```

Everything re-exported by the façade is **pure** (no React, DOM, Vite, or
`fetch`) so it bundles cleanly for Deno. The browser fetch path is imported
type-only and erased.

> **Rule:** any change to engine/journal logic (`auto-journal-core`,
> `follow-trade-model`, adapters, the universe) requires
> `npm run build:edge && npm run deploy:edge` for the cron to pick it up.
> `npm run build` (the app) alone does **not** update the cron.

---

## 5. Data Model

### 5.1 Tables

**`journal_trades`** — the global auto-journal (mirror of `FollowedTrade`).
Migration `20260613000001_journal_trades.sql`.

| Column | Notes |
|---|---|
| `id` uuid PK | `gen_random_uuid()` |
| `symbol`, `name`, `asset_type` | |
| `signal` | `long` \| `short` |
| `timeframe`, `entry_price`, `stop_loss` | |
| `take_profits` double[] | `[tp1, tp2, tp3?]`, finite levels only |
| `risk_reward_ratio`, `strength_at_entry`, `grade` | `grade` ∈ A/B/C |
| `status` | `open` \| `tp1` \| `tp2` \| `tp3` \| `sl` \| `manual` |
| `highest_tp_reached` int | monotonic milestone (0..3) |
| `opened_at`, `closed_at`, `close_price` | |
| `created_at`, `updated_at` | `updated_at` kept fresh by a trigger |

- **Dedup:** partial unique index `(symbol, timeframe) WHERE status = 'open'` —
  makes a double cron run idempotent (a 2nd insert for an already-open
  symbol/tf fails with `23505`, swallowed as non-fatal).
- **`status = 'manual'`** is reused as the "Reversed" close (the old manual
  close was removed). UI label: "Dibalik Arah" / "Reversed".

**`profiles`** — per-user entitlement (server truth). Migration
`20260614000001_auth_entitlements.sql`.

| Column | Notes |
|---|---|
| `user_id` uuid PK → `auth.users` | `on delete cascade` |
| `tier` | `free` \| `trial` \| `premium`, default `free` |
| `trial_expires_at` timestamptz | null unless on a trial |
| `updated_at` | |

**`access_codes`** — code catalog. Migration `20260613000002` (+ columns added
in `20260614000001`).

| Column | Notes |
|---|---|
| `code` text PK | |
| `kind` | `full` \| `trial` |
| `max_redemptions` int | null = unlimited (e.g. a shared trial code) |
| `trial_days` int | trial length for `kind = trial` |
| `note`, `created_at` | |

**`code_redemptions`** — audit + single-use enforcement. PK `(code, user_id)`.

### 5.2 Functions (RPC)

- **`redeem_access_code(p_code)`** `SECURITY DEFINER` — the ONLY path to
  premium/trial. Runs as `auth.uid()`, `FOR UPDATE` locks the code row (race-free
  cap), records the redemption, writes `profiles.tier`. Returns
  `premium | trial | invalid | exhausted | already | unauthenticated`.
- **`is_premium()`** `SECURITY DEFINER` (`20260614000002`) — true for `premium`
  or an active `trial`; false for anon. Used by the journal read policy.
- **`handle_new_user()`** trigger on `auth.users` — auto-creates a `free`
  `profiles` row on signup.
- **`verify_access_code(p_code)`** — legacy anon kind-check, superseded by
  `redeem_access_code` (kept; grants nothing on its own).

### 5.3 Row-Level Security

| Table | Policy |
|---|---|
| `journal_trades` | SELECT for `authenticated` **only if `is_premium()`** (`20260614000002` replaced the old `using(true)` public read). Writes: none for client → service-role key only. |
| `profiles` | SELECT own row only (`auth.uid() = user_id`). No insert/update/delete policy → only the RPC writes tier. |
| `code_redemptions` | SELECT own rows only. |
| `access_codes` | RLS on, no policies → unreadable by client; only `SECURITY DEFINER` fns touch it. |

### 5.4 Migrations (apply in order)

```
20260613000001_journal_trades.sql      table + dedup index + (old) public read
20260613000002_access_codes.sql        access_codes + verify_access_code
20260614000001_auth_entitlements.sql   profiles, code_redemptions, redeem RPC, trigger
20260614000002_journal_premium_rls.sql is_premium() + journal read gated to premium
```

---

## 6. Detailed Flows

### 6.1 Autonomous journaling pipeline (every 30 min)

1. **pg_cron** job `auto-journal-30m` (`*/30 * * * *`) runs
   `net.http_post` to the function URL (from Vault), `Authorization: Bearer`
   = the publishable key (also from Vault — it only needs to pass the Functions
   gateway).
2. **Edge Function** (`index.ts`):
   1. Read all `journal_trades WHERE status = 'open'` — these are both the dedup
      set and the sync targets.
   2. Fetch the **whole universe** (`EDGE_UNIVERSE`) from Yahoo at `range=1mo`,
      `interval=1h` (the app's default swing window), bounded concurrency 8,
      UA-spoofed, **per-symbol fault-tolerant** (one failure ≠ run failure).
   3. `adaptYahooChart` each result → `UnifiedAsset` (outlook + trading plan).
   4. `runAutoJournal(assets, openRows)` → `{ inserts, closures }` (pure core).
   5. Apply: bulk `insert` (tolerate `23505`), then per-row `update` for each
      closure. Writes use the **service-role key** (bypasses RLS).
   6. Return a JSON summary (`universe`, `fetched`, `emitted`, `closed`).

`EDGE_UNIVERSE` = `TOP_CRYPTO_TICKERS + TOP_US_STOCK_TICKERS +
TOP_ID_STOCK_TICKERS + DEFAULT_COMMODITY_TICKERS + DEFAULT_FOREX_TICKERS` (the
premium screener universe, ~114 symbols).

### 6.2 Decision core — `runAutoJournal()` (pure, unit-testable)

`src/core/auto-journal-core.ts`. No fetch, no DB — just data in, plan out.

- **EMIT:** for each asset with a long/short signal **and a trading plan** and
  **no open trade for that symbol** → `buildFollowedTrade()` →
  `followedTradeToInsert()`.
- **SYNC / Close 1 (TP/SL):** rebuild each open trade's candles since
  `followedAt`, run `applyPriceSync()` (replays candles + the live tick). A trade
  closes on the **final TP** or **SL**; partial TP touches update
  `highest_tp_reached` but keep it open.
- **Close 2 (signal reversal, long↔short only):** for trades still open after
  Close 1, if the engine's current signal is the opposite direction:
  - if `highest_tp_reached >= 1` → close as `tp{n}` at that TP's price
    (**secures the touched milestone**, mirroring the SL-after-TP rule);
  - else → close as `manual` ("Reversed") at the current price.
  - **Neutral never closes** — conviction merely faded, let the SL do its job.

### 6.3 Trade lifecycle (state machine)

```
            emit (cron)
                │
                ▼
            ┌────────┐   final TP / SL (candle replay)   ┌──────────────┐
            │  open  │ ─────────────────────────────────▶│ tp1/tp2/tp3  │
            │(running)│                                   │  / sl        │
            └───┬────┘                                    └──────────────┘
                │ signal reversal (long↔short)
                ├─ touched a TP (highest_tp_reached ≥ 1) ─▶ tp{n}  (secured)
                └─ no TP touched ───────────────────────▶ manual  (Reversed)
```

### 6.4 Frontend read path

- **`use-journal-trades.ts`** — react-query (`queryKey ["journal-trades"]`,
  `staleTime`/`refetchInterval` 60s) reading via the **publishable key**
  (RLS-bound). Gated `enabled: hasAccess` — non-entitled users never poll the
  (now empty-for-them) table. Splits rows into `openTrades` / `history`
  (identity-stable `useMemo` to avoid recharts re-render storms).
- **`JournalDashboard`** — `buildTrackerStats()` (pure) →
  - Daily P/L (%) bars + cumulative line (ComposedChart),
  - Status distribution (pie), Wins vs Losses (bar), Profit Loss by Asset Type
    (bar), Signal distribution (pie).
- **`FollowHistoryTable`** — every trade (open on top, then closed). Filters:
  asset-type tabs + direction / status / profit-loss selects + search; refresh
  button; pagination; detail dialog (candlestick with entry/close markers).

### 6.5 Auth & entitlement (Phase 3)

- **Free = anonymous.** No login wall; the screener and the rest work without an
  account. Login is required **only** to redeem a code.
- **Sign up / log in** happen on dedicated pages `/login` and `/register`
  (shadcn `Card` + react-hook-form + zod). The Subscription dialog
  (`license-dialog.tsx`) shows the current plan + a code-redeem field when logged
  in, or CTA buttons to those pages when logged out.
- **`use-auth.ts`** — Zustand wrapper over `supabase.auth` (session, sign
  in/up/out, `onAuthStateChange`).
- **`use-premium-access.ts`** — reads the `profiles` row of the session user via
  react-query (server truth) and derives `tier` / `hasAccess` /
  `expiresAt`. `grantAccess(code)` → `redeem_access_code` RPC → invalidates the
  profile query. (Replaced the old forgeable `localStorage` grant; the public
  return shape was preserved so consumers didn't change.)
- **Account menu** lives in the header (`user-menu.tsx`, shadcn dropdown):
  language switch, theme, and log out.

**Redeem flow:** open Subscription → (logged out) go to `/login` or `/register`
→ authenticate → back to the dialog → enter code → `redeem_access_code` sets
`profiles.tier` server-side → the gate updates from the refreshed profile.

---

## 7. Key Modules / File Map

| Area | Path |
|---|---|
| Edge entrypoint (Deno) | `supabase/functions/auto-journal/index.ts` |
| Engine façade (bundled) | `src/core/edge-engine.ts` → `_engine.mjs` |
| Pure decision core | `src/core/auto-journal-core.ts` |
| Trade model (emit/close/stats) | `src/features/follow-trade/lib/follow-trade-model.ts` |
| Row ↔ trade mapper | `src/services/supabase/journal-mapper.ts` |
| DB types (hand-written) | `src/services/supabase/database.types.ts` |
| Browser Supabase client | `src/services/supabase/client.ts` (publishable key) |
| Journal read hook | `src/features/journal/hooks/use-journal-trades.ts` |
| Dashboard | `src/features/journal/components/journal-dashboard.tsx` |
| Transactions table | `src/features/follow-trade/components/follow-history-table.tsx` |
| Auth session | `src/hooks/use-auth.ts` |
| Entitlement | `src/hooks/use-premium-access.ts` |
| Subscription dialog | `src/components/shared/license-dialog.tsx` |
| Login / Register pages | `src/pages/login`, `src/pages/register` |
| Cron schedule (run once) | `supabase/schedule-auto-journal.sql` |

---

## 8. Deployment & Operations

### 8.1 First-time / schema changes

1. **Apply migrations:** `npx supabase db push` (project is linked) or paste each
   file into the SQL Editor.
2. **Deploy the function:** `npm run deploy:edge`
   (= `build:edge` then `npx supabase functions deploy auto-journal`).
3. **Schedule the cron (once):** run `supabase/schedule-auto-journal.sql` in the
   SQL Editor — enables `pg_cron` + `pg_net`, stores the function URL + bearer in
   **Vault**, and registers the `auto-journal-30m` job.
4. **Auth config:** Dashboard → Auth → Providers → Email on; choose the
   "Confirm email" toggle (the flow handles both on/off).
5. **Seed access codes** (SQL Editor), e.g.:
   ```sql
   insert into public.access_codes (code, kind, max_redemptions)
     values ('PREMIUM-XXXX', 'full', 1) on conflict (code) do nothing;
   insert into public.access_codes (code, kind, trial_days)
     values ('TRIAL-2026', 'trial', 7) on conflict (code) do nothing;
   ```

### 8.2 Routine ops

- **Ship an engine/journal change:** `npm run deploy:edge` (rebuilds
  `_engine.mjs` + redeploys). The app build alone won't update the cron.
- **Wipe the journal:** `truncate table public.journal_trades;` (full) or
  `delete from public.journal_trades where status <> 'open';` (closed only).
- **Inspect cron:** `select jobid, schedule, jobname from cron.job;` /
  `select * from cron.job_run_details order by start_time desc limit 10;`
- **Verify a deploy:** Dashboard → Edge Functions → auto-journal → Logs.

### 8.3 Environment

| Var | Used by |
|---|---|
| `VITE_SUPABASE_URL` | browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client (RLS read) + cron bearer (Vault) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | auto-injected into the Edge Function (write, bypass RLS) |

`VITE_ACCESS_KEY` / `VITE_TRIAL_DURATION` from the old grant are obsolete.

---

## 9. Security Model

- **Entitlement is server truth:** `profiles.tier` is writable only by the
  `SECURITY DEFINER` redeem RPC; users can read only their own row (RLS). No more
  "edit `localStorage` → premium".
- **Codes never ship to the client** and are single-use / capped via
  `code_redemptions` + `max_redemptions`.
- **Cron writes** use the service-role key (server-only, never in the bundle);
  the browser only ever holds the RLS-bound publishable key.
- **Journal reads are gated** to premium/active-trial via `is_premium()`.

> **Honest caveat (by design):** this is a pure-frontend SPA — the signal engine
> runs in the browser, so anything the client can *compute* is ultimately
> extractable regardless of auth. The auth migration kills the realistic threat
> (casual `localStorage` tampering), stops trial-farming, and makes premium
> portable across devices. The only *fully* enforceable surface is server-gated
> data, which `journal_trades` now is.

---

## 10. Change Log (phases)

| Phase | What |
|---|---|
| 1 | DB migration + write path (`journal_trades`, dedup, RLS) |
| 2 | Frontend rewired to read the DB; manual follow/close/delete + client sync removed |
| 3 | Auth + entitlements: Supabase Auth, `profiles`, `redeem_access_code`, login/register pages, account menu; `journal_trades` reads RLS-gated to premium |
| 3.1 | Reversal-close refinement: secure the touched TP (`tp{n}`) instead of "Reversed" when a milestone was reached |

---

## 11. Known Limitations & Future Work

- **Cadence:** 30-minute ticks can miss sub-bar wicks between runs (mitigated by
  the candle replay since `opened_at`, but not tick-perfect).
- **CoinGecko dominance** (free tier) is rate-limited and optional — the market
  summary degrades gracefully (per-section "unavailable" states; no error toast,
  via `meta.silent`).
- **Email confirmation** is a Supabase dashboard toggle, not enforced in code.
- **Possible next steps:** richer per-grade analytics, SSR/OG share pages (a
  Worker, not Next.js), and finer-grained server entitlement checks if any
  premium computation moves server-side.

---

## Appendix — Commands

```bash
# App
npm run dev                 # Vite dev server
npm run build               # tsc -b + vite build  (the REAL typecheck)

# Edge function (cron engine)
npm run build:edge          # bundle src → _engine.mjs
npm run deploy:edge         # build:edge + deploy auto-journal

# Supabase
npx supabase db push        # apply migrations
# then run supabase/schedule-auto-journal.sql once (Vault + cron)
```
