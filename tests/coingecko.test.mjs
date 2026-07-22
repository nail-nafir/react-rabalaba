import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let server;

async function loadAdapter() {
  if (!server) {
    server = await createServer({
      appType: "custom",
      configFile: "vite.config.ts",
      logLevel: "silent",
      server: { middlewareMode: true, watch: null },
    });
  }
  return server.ssrLoadModule("/src/services/api/coingecko.ts");
}

test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    // Vite can reject while its SSR server tears down after all assertions.
  }
});

const UPDATED_AT_SECONDS = 1_752_390_000;

function makeGlobal(overrides = {}) {
  return {
    data: {
      market_cap_percentage: { btc: 56.1, eth: 12.8 },
      total_market_cap: { usd: 2_500_000_000_000 },
      market_cap_change_percentage_24h_usd: 2,
      updated_at: UPDATED_AT_SECONDS,
      ...overrides,
    },
  };
}

test("adapter returns a complete snapshot and calculates relative BTC.D change", async () => {
  const { adaptCoinGeckoDominance } = await loadAdapter();
  const bitcoinMarketCap = 1_400_000_000_000;
  const bitcoinChange = 1;
  const result = adaptCoinGeckoDominance(makeGlobal(), [
    {
      market_cap: bitcoinMarketCap,
      market_cap_change_percentage_24h: bitcoinChange,
    },
  ]);

  const previousBitcoinMarketCap = bitcoinMarketCap / (1 + bitcoinChange / 100);
  const previousTotalMarketCap = 2_500_000_000_000 / 1.02;
  const previousDominance =
    (previousBitcoinMarketCap / previousTotalMarketCap) * 100;
  const expectedChange = (56.1 / previousDominance - 1) * 100;

  assert.ok(result);
  assert.equal(result.btc, 56.1);
  assert.equal(result.eth, 12.8);
  assert.equal(result.updatedAt, UPDATED_AT_SECONDS * 1000);
  assert.ok(
    Math.abs(result.btcDominanceChangePercent24h - expectedChange) < 1e-12,
  );
});

test("adapter rejects an impossible primary global payload", async () => {
  const { adaptCoinGeckoDominance } = await loadAdapter();

  assert.equal(
    adaptCoinGeckoDominance(
      makeGlobal({ market_cap_percentage: { btc: 70, eth: 40 } }),
      [],
    ),
    null,
  );
  assert.equal(adaptCoinGeckoDominance({ data: {} }, []), null);
});

test("adapter keeps current BTC.D when 24-hour Bitcoin data is unavailable", async () => {
  const { adaptCoinGeckoDominance } = await loadAdapter();

  for (const bitcoinPayload of [undefined, [], [{ market_cap: "invalid" }]]) {
    const result = adaptCoinGeckoDominance(makeGlobal(), bitcoinPayload);
    assert.ok(result);
    assert.equal(result.btc, 56.1);
    assert.equal(result.btcDominanceChangePercent24h, undefined);
  }
});
