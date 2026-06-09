import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Swallow stray async rejections emitted while Vite's SSR server tears down at
// end-of-file. Real test failures surface synchronously as assertion errors.
process.on("unhandledRejection", () => {});

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
    // Vite's SSR server can reject on teardown; not a test failure.
  }
});

function makeMetrics(tierA, trending) {
  const zero = { trades: 0, winRate: 0, expectancy: 0 };
  return {
    trades: 10,
    winRate: 0.6,
    expectancy: 0.2,
    profitFactor: 1.5,
    maxDrawdownR: 1,
    perRegime: {
      trending: trending ?? zero,
      ranging: { ...zero },
      high_volatility: { ...zero },
      low_volatility: { ...zero },
    },
    perTier: { A: tierA, B: { ...zero }, C: { ...zero } },
  };
}

test("calibrateConfidence returns null win-rate below the min sample", async () => {
  const { calibrateConfidence } = await loadModule(
    "/src/features/engine/calibration.ts",
  );
  const metrics = makeMetrics({ trades: 3, winRate: 0.66, expectancy: 0.3 });
  const c = calibrateConfidence(metrics, "A", "trending");

  assert.equal(c.sufficient, false);
  assert.equal(c.winRate, null);
  assert.equal(c.expectancy, null);
  assert.equal(c.sample, 3);
});

test("calibrateConfidence exposes win-rate when the sample is large enough", async () => {
  const { calibrateConfidence } = await loadModule(
    "/src/features/engine/calibration.ts",
  );
  const metrics = makeMetrics(
    { trades: 20, winRate: 0.55, expectancy: 0.25 },
    { trades: 12, winRate: 0.5, expectancy: 0.1 },
  );
  const c = calibrateConfidence(metrics, "A", "trending");

  assert.equal(c.sufficient, true);
  assert.equal(c.winRate, 0.55);
  assert.equal(c.sample, 20);
  assert.equal(c.regimeWinRate, 0.5);
  assert.equal(c.regimeSample, 12);
});
