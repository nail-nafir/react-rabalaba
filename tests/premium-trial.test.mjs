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

const SRC = "/src/lib/premium-trial.ts";

test("active within the 3-day window", async () => {
  const { isTrialActive, TRIAL_DURATION_MS } = await loadModule(SRC);
  const start = 1_000_000;
  assert.equal(isTrialActive(start, start), true);
  assert.equal(isTrialActive(start, start + TRIAL_DURATION_MS - 1), true);
});

test("inactive once past the window (boundary is exclusive)", async () => {
  const { isTrialActive, TRIAL_DURATION_MS } = await loadModule(SRC);
  const start = 1_000_000;
  assert.equal(isTrialActive(start, start + TRIAL_DURATION_MS), false);
  assert.equal(isTrialActive(start, start + TRIAL_DURATION_MS + 1), false);
});

test("null activation is never active", async () => {
  const { isTrialActive } = await loadModule(SRC);
  assert.equal(isTrialActive(null), false);
});

test("decode of missing/garbage returns null", async () => {
  const { decodeTrialStamp } = await loadModule(SRC);
  assert.equal(decodeTrialStamp(null), null);
  assert.equal(decodeTrialStamp(""), null);
  assert.equal(decodeTrialStamp("@@@not-base64@@@"), null);
  assert.equal(decodeTrialStamp(btoa("not-a-number")), null);
});

test("encode/decode round-trips a timestamp", async () => {
  const { encodeTrialStamp, decodeTrialStamp } = await loadModule(SRC);
  const ts = 1_717_000_000_000;
  assert.equal(decodeTrialStamp(encodeTrialStamp(ts)), ts);
});
