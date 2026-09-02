# Auto-Journal — Cara Kerja "Robot"-nya (ELI5)

> 🇮🇩 Dokumen ini ngejelasin gimana jurnal otomatis jalan, pakai bahasa teknis tapi gampang. Tiap bagian: Indonesia dulu, terus English.
> 🇺🇸 This doc explains how the automated journal works in plain (but technical) terms. Each section: Indonesian first, then English.

> 📎 Butuh detail formal (skema tabel, RLS, dll)? Lihat `auto-journal-system-design.md`. Mau tahu apa yang jalan di server vs browser? Lihat `server-vs-browser.md`.

---

## TL;DR

🇮🇩 Ada **robot** yang bangun tiap 30 menit, narik harga pasar, mutusin trade mana yang dibuka/ditutup, terus nyatet ke database — **tanpa ada yang buka web**. Website lo cuma **baca** catatan robot itu.

🇺🇸 A **robot** wakes up every 30 minutes, pulls market prices, decides which trades to open/close, and writes them to the database — **with nobody's browser open**. Your website just **reads** what the robot wrote.

---

## 🎭 Para pemain / The cast

🇮🇩 Robotnya bukan 1 file. Dia tim kecil dengan peran beda:
🇺🇸 The robot isn't one file. It's a small team with distinct roles:

| File | 🤖 Peran (ID) | 🤖 Role (EN) |
|------|--------------|-------------|
| `supabase/functions/auto-journal/index.ts` | 🦾 **Badan** — fetch Yahoo, baca/tulis DB, jalan terjadwal | 🦾 **Body** — fetches Yahoo, reads/writes DB, runs on schedule |
| `src/core/automation/auto-journal-core.ts` | 🧠 **Otak** — keputusan: buka/tutup trade (murni, tanpa I/O) | 🧠 **Brain** — decisions: open/close trades (pure, no I/O) |
| `src/core/trade/follow-trade-model.ts` | 🧠 **Logika dasar** — hitung TP/SL, bikin trade | 🧠 **Core logic** — TP/SL math, build a trade |
| `src/core/edge-engine.ts` | 📦 **Pintu/etalase** — re-export otak buat dibundle | 📦 **Façade** — re-exports the brain for bundling |
| `supabase/functions/auto-journal/_engine.mjs` | 📦 **Otak terbungkus** — hasil build (jangan diedit tangan) | 📦 **Bundled brain** — build output (never hand-edit) |
| Tabel DB: `journal_trades`, `journal_assets`, `journal_settings` | 📒 **Buku catatan + daftar tugas + jadwal** | 📒 **Notebook + task list + schedule** |
| `pg_cron` | ⏰ **Alarm** — nyalain robot tiap interval | ⏰ **Alarm** — fires the robot each interval |

---

## 🧠 Otak vs 🦾 Badan / Brain vs Body

🇮🇩 Pemisahan paling penting: **otak mikir, badan bertindak.**
- **Otak** (`auto-journal-core.ts`) = murni mikir. Dikasih data → balikin keputusan "INSERT ini, CLOSE itu". **Gak** narik internet, **gak** nyentuh DB. Makanya bisa di-unit-test gampang (lihat `tests/auto-journal-core.test.mjs`).
- **Badan** (`index.ts`) = yang kotor-kotor: narik Yahoo, nulis DB, baca jadwal.

🇺🇸 The key split: **the brain thinks, the body acts.**
- **Brain** (`auto-journal-core.ts`) = pure thinking. Given data → returns decisions "INSERT this, CLOSE that". It does **not** hit the internet or touch the DB. That's why it's easy to unit-test (see `tests/auto-journal-core.test.mjs`).
- **Body** (`index.ts`) = the messy part: fetch Yahoo, write DB, read schedule.

> 🇮🇩 Otak yang sama ini **dipinjam website juga** — screener & dialog detail mikir sinyal/TP/SL pakai logika yang sama. Satu otak, dua "tubuh" (browser + robot). Itu yang disebut *single-source*.
> 🇺🇸 The same brain is **borrowed by the website too** — the screener & detail dialog compute signals/TP/SL with the same logic. One brain, two "bodies" (browser + robot). That's *single-source*.

---

## 📦 `edge-engine.ts` → `_engine.mjs` (kenapa ada bundle)

🇮🇩 Robot jalan di **Deno** (Supabase Edge Function), yang **gak bisa** resolve alias `@/...` lo atau import nyebrang dari `src/`. Daripada nyalin engine (jelek), kita **bundle**: `esbuild` ngikutin semua import dari `edge-engine.ts`, ngeratain jadi **satu file** `_engine.mjs` yang Deno bisa langsung makan. Jadi logika tetap di `src/` (gak ada copy-paste).

🇺🇸 The robot runs on **Deno** (a Supabase Edge Function) which **can't** resolve your `@/...` aliases or import across `src/`. Instead of copying the engine (bad), we **bundle**: `esbuild` follows every import from `edge-engine.ts` and flattens it into **one file** `_engine.mjs` that Deno imports directly. The logic stays in `src/` (no copy-paste).

```
edit src/ (logic)
  → edge-engine.ts (re-export the bits the cron needs)
    → npm run deploy:auto-journal  (builds _engine.mjs + ships to Supabase)
      → index.ts:  import { runAutoJournal, ... } from "./_engine.mjs"
```

> ⚠️ 🇮🇩 **Jangan pernah edit `_engine.mjs` tangan** — bakal ketimpa pas build berikutnya. Edit `src/` + `edge-engine.ts`, terus `deploy:auto-journal`.
> ⚠️ 🇺🇸 **Never hand-edit `_engine.mjs`** — it's overwritten on the next build. Edit `src/` + `edge-engine.ts`, then `deploy:auto-journal`.

---

## 🔄 Satu putaran penuh / One full cycle

🇮🇩 Contoh konkret: jam **14:30 WIB**, interval 30 menit, ada 1 trade open (`SOL-USD` short), dan `BTC-USD` lagi kasih sinyal short baru.
🇺🇸 Concrete example: **14:30**, 30-min interval, one open trade (`SOL-USD` short), and `BTC-USD` is firing a fresh short signal.

| # | 🇮🇩 Yang terjadi | 🇺🇸 What happens | Aktor |
|---|---|---|---|
| 0 | ⏰ pg_cron jam 14:30 kirim HTTP POST ke function | ⏰ pg_cron at 14:30 sends an HTTP POST to the function | `schedule-auto-journal.sql` |
| 1 | 🦾 Badan bangun, ambil service-role key (bypass RLS) | 🦾 Body wakes, grabs the service-role key (bypasses RLS) | `index.ts` |
| 2 | 🚦 Cek `journal_settings`: aktif? udah waktunya? → ya, lanjut | 🚦 Check `journal_settings`: enabled? due? → yes, continue | `index.ts` + 📒 |
| 3 | 📥 Baca trade open + universe (`journal_assets` + commodity/forex konstanta) | 📥 Read open trades + universe (`journal_assets` + commodity/forex constants) | `index.ts` + 📒 |
| 4 | 🌐 Fetch Yahoo tiap simbol (8 paralel) → `adaptYahooChart` → aset (harga, candle, sinyal, plan) | 🌐 Fetch Yahoo per symbol (8 parallel) → `adaptYahooChart` → asset (price, candles, signal, plan) | `index.ts` + 🧠 adapter |
| 5 | 🧠 `runAutoJournal(aset, openRows)` mutusin: **EMIT** BTC short baru, **CLOSE** SOL (kena TP) | 🧠 `runAutoJournal(assets, openRows)` decides: **EMIT** new BTC short, **CLOSE** SOL (hit TP) | `auto-journal-core.ts` |
| 6 | ✍️ Badan UPDATE SOL dulu, lalu INSERT sinyal aktif ke `journal_trades` | ✍️ Body UPDATEs SOL first, then INSERTs the current signal into `journal_trades` | `index.ts` + 📒 |
| 7 | 🏁 Stamp `last_run_at`, balikin ringkasan JSON, robot tidur | 🏁 Stamp `last_run_at`, return a JSON summary, robot sleeps | `index.ts` + 📒 |

🇮🇩 Di Step 5, otak skip data basi (`isStaleQuote`) dan dedup trade yang masih open. Setelah TP/SL, arah lama diblokir sampai sinyal mentah sempat netral; reversal boleh langsung membuka arah lawan.
🇺🇸 In Step 5, the brain skips stale data and trades that remain open. After TP/SL, the old direction stays blocked until the raw signal turns neutral; a reversal may immediately open the opposite direction.

---

## 📐 Diagram

```
⏰ pg_cron ──POST──▶ 🦾 index.ts (Deno)
                       │ 1. gate  (journal_settings)
                       │ 2. read  (journal_trades open + journal_assets)
                       │ 3. fetch Yahoo → adaptYahooChart
                       ▼
                     🧠 runAutoJournal()           ← pure brain, no I/O
                       │   returns { inserts, closures }
                       ▼
                     🦾 index.ts → ✍️ write journal_trades + stamp last_run
                                         │
                          🌐 website (browser) ──reads──┘  (read-only)
```

---

## ✅ Aturan emas / Golden rules

🇮🇩
1. Mau ubah **logika keputusan** → edit `auto-journal-core.ts` (atau `follow-trade-model.ts`).
2. Mau ubah **I/O / jadwal** (fetch, tulis DB) → edit `index.ts`.
3. Habis ubah engine → **`npm run deploy:auto-journal`** (build ulang `_engine.mjs` + deploy). Jangan sentuh `_engine.mjs`.
4. Universe (crypto/saham) diatur di **`/admin`** (DB), bukan ngoding. Commodity/forex = konstanta.

🇺🇸
1. Change **decision logic** → edit `auto-journal-core.ts` (or `follow-trade-model.ts`).
2. Change **I/O / schedule** (fetch, DB writes) → edit `index.ts`.
3. After an engine change → **`npm run deploy:auto-journal`** (rebuilds `_engine.mjs` + deploys). Don't touch `_engine.mjs`.
4. The universe (crypto/stocks) is managed in **`/admin`** (DB), not in code. Commodity/forex = constants.

---

## 🔗 Terkait / Related
- `auto-journal-system-design.md` — desain formal lengkap (skema, RLS, fase) / full formal design (schema, RLS, phases)
- `server-vs-browser.md` — apa yang jalan di server vs browser / what runs server-side vs in the browser
- `../../supabase/README.md` — runbook setup & recovery DB / DB setup & recovery runbook
