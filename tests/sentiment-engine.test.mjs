import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

// Dedicated tests for the sentiment engine (Fear & Greed). Sentiment is
// intentionally NOT scored into directionScore; it only surfaces a contextual
// risk warning at extremes that lean against the setup, plus a narrative. These
// lock both behaviours.

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

const SENT = "/src/features/engine/sentiment.ts";

// ─── fearGreedContextWarning ─────────────────────────────────
test("fearGreedContextWarning: undefined value → null", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  assert.equal(fearGreedContextWarning(undefined, -0.5), null);
});

test("fearGreedContextWarning: null value → null", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  assert.equal(fearGreedContextWarning(null, -0.5), null);
});

test("fearGreedContextWarning: extreme fear + bearish lean → fires", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  const w = fearGreedContextWarning(15, -0.4);
  assert.ok(typeof w === "string" && w.includes("Extreme Fear"));
});

test("fearGreedContextWarning: extreme fear but bullish lean → null (aligned)", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  // Only fires when sentiment leans AGAINST the score, i.e. the dangerous side.
  assert.equal(fearGreedContextWarning(15, 0.4), null);
});

test("fearGreedContextWarning: extreme greed + bullish lean → fires", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  const w = fearGreedContextWarning(85, 0.4);
  assert.ok(typeof w === "string" && w.includes("Extreme Greed"));
});

test("fearGreedContextWarning: extreme greed but bearish lean → null", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  assert.equal(fearGreedContextWarning(85, -0.4), null);
});

test("fearGreedContextWarning: neutral reading → null", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  assert.equal(fearGreedContextWarning(50, -0.4), null);
});

test("fearGreedContextWarning: boundary 20 (fear) with zero score → null (needs <0)", async () => {
  const { fearGreedContextWarning } = await loadModule(SENT);
  assert.equal(fearGreedContextWarning(20, 0), null);
});

// ─── generateSentimentAnalysis ───────────────────────────────
test("generateSentimentAnalysis: undefined → unavailable note", async () => {
  const { generateSentimentAnalysis } = await loadModule(SENT);
  assert.ok(generateSentimentAnalysis(undefined).toLowerCase().includes("unavailable"));
});

test("generateSentimentAnalysis: extreme fear band", async () => {
  const { generateSentimentAnalysis } = await loadModule(SENT);
  assert.ok(generateSentimentAnalysis(10).includes("Extreme Fear"));
});

test("generateSentimentAnalysis: fear band", async () => {
  const { generateSentimentAnalysis } = await loadModule(SENT);
  assert.ok(generateSentimentAnalysis(30).includes("(Fear)"));
});

test("generateSentimentAnalysis: neutral band", async () => {
  const { generateSentimentAnalysis } = await loadModule(SENT);
  assert.ok(generateSentimentAnalysis(50).includes("(Neutral)"));
});

test("generateSentimentAnalysis: greed band", async () => {
  const { generateSentimentAnalysis } = await loadModule(SENT);
  assert.ok(generateSentimentAnalysis(70).includes("(Greed)"));
});

test("generateSentimentAnalysis: extreme greed band", async () => {
  const { generateSentimentAnalysis } = await loadModule(SENT);
  assert.ok(generateSentimentAnalysis(90).includes("Extreme Greed"));
});
