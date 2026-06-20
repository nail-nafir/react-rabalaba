import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;
async function loadModule(path) {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule(path);
}
test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    /* vite SSR teardown can reject; not a test failure */
  }
});

const SRC = "/src/features/market/lib/screener-universe.ts";
const ASSETS = "/src/constants/assets.ts";

test("groupUniverse: null / undefined / empty → DEFAULT_* fallback", async () => {
  const { groupUniverse, FALLBACK_UNIVERSE } = await loadModule(SRC);
  assert.deepEqual(groupUniverse(null), FALLBACK_UNIVERSE);
  assert.deepEqual(groupUniverse(undefined), FALLBACK_UNIVERSE);
  assert.deepEqual(groupUniverse([]), FALLBACK_UNIVERSE);
});

test("groupUniverse: groups active rows by asset_type", async () => {
  const { groupUniverse } = await loadModule(SRC);
  const rows = [
    { symbol: "BTC-USD", asset_type: "crypto", active: true },
    { symbol: "SOL-USD", asset_type: "crypto", active: true },
    { symbol: "AAPL", asset_type: "us-stock", active: true },
    { symbol: "BBCA.JK", asset_type: "id-stock", active: true },
  ];
  const u = groupUniverse(rows);
  assert.deepEqual(u.crypto, ["BTC-USD", "SOL-USD"]);
  assert.deepEqual(u.usStock, ["AAPL"]);
  assert.deepEqual(u.idStock, ["BBCA.JK"]);
});

test("groupUniverse: ignores inactive rows and commodity/forex types", async () => {
  const { groupUniverse } = await loadModule(SRC);
  const { DEFAULT_CRYPTO_TICKERS } = await loadModule(ASSETS);
  const rows = [
    { symbol: "ETH-USD", asset_type: "crypto", active: true },
    { symbol: "DEAD-USD", asset_type: "crypto", active: false }, // inactive → skip
    { symbol: "GC=F", asset_type: "commodity", active: true }, // ignored type
    { symbol: "EURUSD=X", asset_type: "forex", active: true }, // ignored type
    { symbol: "AAPL", asset_type: "us-stock", active: true },
    { symbol: "BBCA.JK", asset_type: "id-stock", active: true },
  ];
  const u = groupUniverse(rows);
  assert.deepEqual(u.crypto, ["ETH-USD"], "only the active crypto kept");
  const all = [...u.crypto, ...u.usStock, ...u.idStock];
  assert.ok(
    !all.includes("GC=F") && !all.includes("EURUSD=X"),
    "commodity/forex never appear in the DB-driven lists",
  );
  assert.notDeepEqual(u.crypto, DEFAULT_CRYPTO_TICKERS, "real rows, not fallback");
});

test("groupUniverse: a present-but-empty category falls back to its DEFAULT", async () => {
  const { groupUniverse, FALLBACK_UNIVERSE } = await loadModule(SRC);
  // Rows exist (non-empty) but no us-stock / id-stock → only those fall back.
  const rows = [{ symbol: "BTC-USD", asset_type: "crypto", active: true }];
  const u = groupUniverse(rows);
  assert.deepEqual(u.crypto, ["BTC-USD"]);
  assert.deepEqual(u.usStock, FALLBACK_UNIVERSE.usStock, "no us-stock → DEFAULT");
  assert.deepEqual(u.idStock, FALLBACK_UNIVERSE.idStock, "no id-stock → DEFAULT");
});
