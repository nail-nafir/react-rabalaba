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
      server: { middlewareMode: true },
    });
  }
  return server.ssrLoadModule(path);
}

test.after(async () => {
  if (server) await server.close();
});

const SRC = "/src/features/trading-plan/lib/signal-text.ts";

const outlook = { signal: "long", strength: 72.4 };
const plan = {
  entry: 100,
  stopLoss: 90,
  takeProfit1: 110,
  takeProfit2: 120,
  takeProfit3: 130,
  riskRewardRatio: 1.5,
};

test("contains symbol, signal, strength and R:R header", async () => {
  const { buildSignalText } = await loadModule(SRC);
  const text = buildSignalText("BTC", outlook, plan, "crypto");
  assert.match(text, /BTC/);
  assert.match(text, /LONG/);
  assert.match(text, /72%/);
  assert.match(text, /R:R 1:1\.5\b/);
});

test("includes every level price and a disclaimer", async () => {
  const { buildSignalText } = await loadModule(SRC);
  const text = buildSignalText("BTC", outlook, plan, "crypto");
  for (const label of ["Entry", "SL", "TP1", "TP2", "TP3"]) {
    assert.ok(text.includes(label), `missing ${label}`);
  }
  assert.match(text.toLowerCase(), /not financial advice/);
});

test("omits TP3 line when absent", async () => {
  const { buildSignalText } = await loadModule(SRC);
  const text = buildSignalText("ETH", outlook, { ...plan, takeProfit3: undefined }, "crypto");
  assert.ok(!text.includes("TP3"));
  assert.ok(text.includes("TP2"));
});
