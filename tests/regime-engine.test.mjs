import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Dedicated tests for the regime engine (now its own module). These lock the
// public contract of `classifyRegime` directly via the new path, including the
// fixed squeeze edge case where a fully collapsed Bollinger band (bandwidth 0)
// must be treated as maximum compression (low_volatility), not excluded.

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

const REGIME = "/src/features/engine/regime.ts";

const base = {
  strongAdx: 25,
  highVolAtrPercent: 5,
  squeezeBandwidthPercent: 3,
  squeezeMaxAdx: 20,
};

test("regime-engine module exports classifyRegime", async () => {
  const mod = await loadModule(REGIME);
  assert.equal(typeof mod.classifyRegime, "function");
});

test("classifyRegime: strong ADX → trending", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  assert.equal(
    classifyRegime({ adx: 30, atrPercent: 2, bbBandwidthPercent: 8, ...base }),
    "trending",
  );
});

test("classifyRegime: weak ADX + normal vol → ranging", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  assert.equal(
    classifyRegime({ adx: 15, atrPercent: 2, bbBandwidthPercent: 8, ...base }),
    "ranging",
  );
});

test("classifyRegime: weak ADX + elevated ATR → high_volatility", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  assert.equal(
    classifyRegime({ adx: 15, atrPercent: 7, bbBandwidthPercent: 8, ...base }),
    "high_volatility",
  );
});

test("classifyRegime: tight bands + weak ADX → low_volatility (squeeze)", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  assert.equal(
    classifyRegime({ adx: 12, atrPercent: 1, bbBandwidthPercent: 1.5, ...base }),
    "low_volatility",
  );
});

test("classifyRegime: FIXED — fully collapsed band (bbBW 0) → low_volatility", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  // bandwidth 0 is maximum compression; previously the `> 0` guard wrongly
  // excluded it, mislabeling it ranging and letting signals slip through.
  assert.equal(
    classifyRegime({ adx: 10, atrPercent: 1, bbBandwidthPercent: 0, ...base }),
    "low_volatility",
  );
});

test("classifyRegime: collapsed band but strong ADX → trending (not squeeze)", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  // ADX >= squeezeMaxAdx breaks the squeeze condition; strong trend wins.
  assert.equal(
    classifyRegime({ adx: 30, atrPercent: 2, bbBandwidthPercent: 0, ...base }),
    "trending",
  );
});

test("classifyRegime: squeeze takes priority over high_volatility", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  // Tight bands + weak ADX, yet elevated ATR — squeeze must still win.
  assert.equal(
    classifyRegime({ adx: 10, atrPercent: 10, bbBandwidthPercent: 1, ...base }),
    "low_volatility",
  );
});

test("classifyRegime: bandwidth exactly at threshold is NOT a squeeze", async () => {
  const { classifyRegime } = await loadModule(REGIME);
  // strictly-less-than threshold: 3 is the boundary → ranging here.
  assert.equal(
    classifyRegime({ adx: 12, atrPercent: 1, bbBandwidthPercent: 3, ...base }),
    "ranging",
  );
});
