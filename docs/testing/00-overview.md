# Testing 00 — Overview

> 🇮🇩 Framework test, cara test load real `.ts` via Vite SSR, cara run.
> 🇺🇸 Test framework, how tests load real `.ts` via Vite SSR, how to run.

---

## TL;DR

🇮🇩 Test pakai **Node.js built-in test runner** (`node --test`) + `node:assert/strict`. 26 file / 268 case, semua di `tests/*.test.mjs`. Test load **real shipping `.ts` source** lewat Vite SSR middleware (`ssrLoadModule`) — jadi test exercise production code, bukan copy. Fokus: pure trading-engine core. Run: `npm test`.

🇺🇸 Tests use the **Node.js built-in test runner** (`node --test`) + `node:assert/strict`. 26 files / 268 cases, all in `tests/*.test.mjs`. Tests load the **real shipping `.ts` source** via Vite SSR middleware (`ssrLoadModule`) — so tests exercise production code, not a copy. Focus: pure trading-engine core. Run: `npm test`.

---

## 🧪 Framework

| Aspect | Value |
|---|---|
| Runner | `node --test tests/*.test.mjs` (`package.json:11`) |
| Assertion | `node:assert/strict` |
| File pattern | `tests/*.test.mjs` (26 file) |
| Total cases | 268 |
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
npm test                              # semua 26 file
node --test tests/signal-engine.test.mjs   # satu file
node --test tests/*.test.mjs --test-reporter=spec  # verbose
```

---

## 📂 Coverage

Detail per file: [`01-coverage-inventory.md`](01-coverage-inventory.md). Gap + rekomendasi test baru: [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md).

---

## 🔗 Terkait / Related
- [`01-coverage-inventory.md`](01-coverage-inventory.md) — 26 file/268 case map
- [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md) — gap + rekomendasi
- [`../tsd/06-engine-internals.md`](../tsd/06-engine-internals.md) — modul yang di-test
