# Testing 00 — Overview

> 🇮🇩 Framework test, cara test load real `.ts` via Vite SSR, cara run.
> 🇺🇸 Test framework, how tests load real `.ts` via Vite SSR, how to run.

---

## TL;DR

🇮🇩 Test pakai **Node.js built-in test runner** (`node --test`) + `node:assert/strict`. 31 file / 306 case, semua di `tests/*.test.mjs`. Test load **real shipping `.ts` source** lewat Vite SSR middleware (`ssrLoadModule`) atau audit source langsung untuk invariant komposisi UI — jadi test exercise production code, bukan copy. Fokus utama pure trading-engine core, ditambah helper auth/form, adapter market, dan pola overlay UI. Run: `npm test`.

🇺🇸 Tests use the **Node.js built-in test runner** (`node --test`) + `node:assert/strict`. 31 files / 306 cases, all in `tests/*.test.mjs`. Tests load the **real shipping `.ts` source** via Vite SSR middleware (`ssrLoadModule`) or inspect source directly for UI composition invariants — so tests exercise production code, not a copy. The main focus is the pure trading-engine core, plus auth/form helpers, market adapters, and UI overlay patterns. Run: `npm test`.

---

## 🧪 Framework

| Aspect | Value |
|---|---|
| Runner | `node --test tests/*.test.mjs` (`package.json:11`) |
| Assertion | `node:assert/strict` |
| File pattern | `tests/*.test.mjs` (31 file) |
| Total cases | 306 |
| Module load | Vite SSR `server.ssrLoadModule(path)` |

---

## 🔌 Cara test load real `.ts` / How tests load real `.ts`

Setiap file pakai pola bootstrap yang sama:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

let server;
test.before(async () => {
  server = await createServer({
    appType: "custom",
    configFile: "vite.config.ts",
    logLevel: "silent",
    server: { middlewareMode: true, watch: null },
  });
});
test.after(async () => { await server.close(); });

const load = (path) => server.ssrLoadModule(path);
```

🇮🇩 Vite di-boot dalam mode SSR middleware, `watch:null` (gak watch file), lalu `ssrLoadModule("@/features/engine/signals.ts")` resolve alias `@ → ./src` & transpile `.ts` on the fly. Test dapat export real dari source shipping. Beberapa file pasang `process.on("unhandledRejection", ()=>{})` buat swallow Vite-teardown noise.
🇧🇧 Vite boots in SSR middleware mode, `watch:null`, then `ssrLoadModule` resolves the `@` alias & transpiles `.ts` on the fly. Tests get the real exports from shipping source. Some files install `process.on("unhandledRejection", ()=>{})` to swallow Vite-teardown noise.

---

## ▶️ Cara run / How to run

```bash
npm test                              # semua 31 file
node --test tests/signal-engine.test.mjs   # satu file
node --test tests/*.test.mjs --test-reporter=spec  # verbose
```

---

## 📂 Coverage

Detail per file: [`01-coverage-inventory.md`](01-coverage-inventory.md). Gap + rekomendasi test baru: [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md).

---

## 🔗 Terkait / Related
- [`01-coverage-inventory.md`](01-coverage-inventory.md) — 31 file/306 case map
- [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md) — gap + rekomendasi
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — modul yang di-test
