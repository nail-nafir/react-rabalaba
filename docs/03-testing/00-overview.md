# Pengujian 00 — Gambaran / Testing 00 — Overview

> Status verifikasi: angka dan path diverifikasi pada 2026-09-16. Kanonis: 45 file / 422 case (`node --test tests/*.test.mjs`); 38 migrasi; 16 tabel; 28 RPC; `MIN_CALIBRATION_SAMPLE=30`.
> Verification status: figures and paths verified on 2026-09-16. Canonical: 45 files / 422 cases (`node --test tests/*.test.mjs`); 38 migrations; 16 tables; 28 RPCs; `MIN_CALIBRATION_SAMPLE=30`.

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

## Bagian ID

### TL;DR

Test memakai **Node.js built-in test runner** (`node --test`) dan `node:assert/strict`. Total **45 file / 422 case**, semua di `tests/*.test.mjs`. Test me-load **real shipping `.ts` source** lewat middleware Vite SSR (`ssrLoadModule`) atau audit source langsung untuk invariant komposisi UI — sehingga test mengeksekusi production code, bukan salinan. Fokus utama: pure trading-engine core, ditambah helper auth/form, adapter market, dan pola overlay UI. Setup alur dibuat sat-set: satu perintah `npm test`.

### Framework

| Aspek | Nilai |
|---|---|
| Runner | `node --test tests/*.test.mjs` (`package.json`) |
| Assertion | `node:assert/strict` |
| Pola file | `tests/*.test.mjs` (45 file) |
| Total case | 422 |
| Module load | Vite SSR `server.ssrLoadModule(path)` |
| Skrip npm | `test`, plus `gate:compare` untuk riset filter entry |

### Cara test me-load real `.ts`

Setiap file memakai pola bootstrap yang sama:

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

Vite di-boot dalam mode SSR middleware dengan `watch: null` (tanpa file watcher), lalu `ssrLoadModule("@/core/engine/signals.ts")` me-resolve alias `@` ke `./src` dan mentranspile `.ts` on the fly. Test menerima export asli dari shipping source. Beberapa file memasang handler `process.on("unhandledRejection", () => {})` untuk meredam noise teardown Vite.

### Cara run

```bash
npm test                                     # semua 45 file / 422 case
node --test tests/signal-engine.test.mjs    # satu file
node --test tests/*.test.mjs --test-reporter=spec  # verbose
npm run gate:compare                         # riset filter entry hipotetis
```

### Fakta kanonis terkait testing

- Kalibrasi memakai `MIN_CALIBRATION_SAMPLE=30`; win-rate diekspos hanya bila sampel mencukupi.
- Durasi trial bersifat konfigurabel melalui `VITE_TRIAL_DURATION` (tanpa default bawaan).
- Cron berjalan pada cadence 30m/hourly/daily untuk auto-journal, recap, dan discovery.
- `.env.example` hanya memuat 2 vars: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Terkait

- [`01-coverage-inventory.md`](01-coverage-inventory.md) — peta 45 file / 422 case per area
- [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md) — gap dan rekomendasi
- [`../02-technical-specs/06-engine-internals.md`](../02-technical-specs/06-engine-internals.md) — modul yang di-test

## English Part

### TL;DR

Tests use the **Node.js built-in test runner** (`node --test`) and `node:assert/strict`. The total stands at **45 files / 422 cases**, all under `tests/*.test.mjs`. Tests load the **real shipping `.ts` source** through the Vite SSR middleware (`ssrLoadModule`) or inspect source directly for UI composition invariants — so tests exercise production code, not a copy. The main focus: the pure trading-engine core, plus auth/form helpers, market adapters, and UI overlay patterns. The flow stays relaxed and professional: a single `npm test` command.

### Framework

| Aspect | Value |
|---|---|
| Runner | `node --test tests/*.test.mjs` (`package.json`) |
| Assertion | `node:assert/strict` |
| File pattern | `tests/*.test.mjs` (45 files) |
| Total cases | 422 |
| Module loading | Vite SSR `server.ssrLoadModule(path)` |
| npm scripts | `test`, plus `gate:compare` for entry-filter research |

### How tests load real `.ts`

Every file uses the same bootstrap pattern:

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

Vite boots in SSR middleware mode with `watch: null` (no file watcher), then `ssrLoadModule("@/core/engine/signals.ts")` resolves the `@` alias to `./src` and transpiles `.ts` on the fly. Tests receive the genuine exports from shipping source. Some files install a `process.on("unhandledRejection", () => {})` handler to dampen Vite teardown noise.

### How to run

```bash
npm test                                     # all 45 files / 422 cases
node --test tests/signal-engine.test.mjs    # single file
node --test tests/*.test.mjs --test-reporter=spec  # verbose
npm run gate:compare                         # hypothetical entry-filter research
```

### Canonical testing facts

- Calibration uses `MIN_CALIBRATION_SAMPLE=30`; win rates surface only with sufficient samples.
- The trial length remains configurable through `VITE_TRIAL_DURATION` (no built-in default).
- Cron runs on a 30m/hourly/daily cadence for auto-journal, recaps, and discovery.
- `.env.example` lists only 2 vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

### Related

- [`01-coverage-inventory.md`](01-coverage-inventory.md) — 45-file / 422-case map per area
- [`02-gaps-and-conventions.md`](02-gaps-and-conventions.md) — gaps and recommendations
- [`../02-technical-specs/06-engine-internals.md`](../02-technical-specs/06-engine-internals.md) — modules under test
