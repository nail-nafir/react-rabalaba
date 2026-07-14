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

const SRC = "/src/features/terminal/lib/dialog-url.ts";
const UUID = "A8098C1A-F86E-11DA-BD1A-00112444BE1E";

test("Market symbols are trimmed, uppercased, and Yahoo-safe", async () => {
  const { normalizeMarketSymbol } = await loadModule(SRC);

  assert.equal(normalizeMarketSymbol(" btc-usd "), "BTC-USD");
  assert.equal(normalizeMarketSymbol("gc=f"), "GC=F");
  assert.equal(normalizeMarketSymbol("^jkse"), "^JKSE");
  assert.equal(normalizeMarketSymbol("A".repeat(32)), "A".repeat(32));
  assert.equal(normalizeMarketSymbol("A".repeat(33)), null);
  assert.equal(normalizeMarketSymbol("BTC/USD"), null);
  assert.equal(normalizeMarketSymbol("<script>"), null);
  assert.equal(normalizeMarketSymbol(""), null);
});

test("journal trade IDs require canonical UUID shape and normalize case", async () => {
  const { normalizeJournalTradeId } = await loadModule(SRC);

  assert.equal(normalizeJournalTradeId(UUID), UUID.toLowerCase());
  assert.equal(normalizeJournalTradeId(` ${UUID} `), UUID.toLowerCase());
  assert.equal(normalizeJournalTradeId("not-a-uuid"), null);
  assert.equal(normalizeJournalTradeId("a8098c1af86e11dabd1a00112444be1e"), null);
  assert.equal(
    normalizeJournalTradeId("00000000-0000-0000-0000-000000000000"),
    null,
  );
});

test("parser distinguishes absent, invalid, valid, duplicate, and conflict", async () => {
  const { parseTerminalDialogParams } = await loadModule(SRC);

  assert.deepEqual(parseTerminalDialogParams(""), {
    marketSymbol: { status: "absent" },
    journalTradeId: { status: "absent" },
    hasConflict: false,
    target: null,
  });

  const invalid = parseTerminalDialogParams("?symbol=BTC%2FUSD");
  assert.equal(invalid.marketSymbol.status, "invalid");
  assert.equal(invalid.hasConflict, false);
  assert.equal(invalid.target, null);

  const duplicate = parseTerminalDialogParams("?symbol=AAPL&symbol=MSFT");
  assert.equal(duplicate.marketSymbol.status, "invalid");
  assert.equal(duplicate.target, null);

  const valid = parseTerminalDialogParams("?symbol=btc-usd");
  assert.deepEqual(valid.target, { kind: "market", symbol: "BTC-USD" });

  const conflict = parseTerminalDialogParams(
    `?symbol=AAPL&trade=${UUID}`,
  );
  assert.equal(conflict.hasConflict, true);
  assert.equal(conflict.target, null);
});

test("canonical builders encode Yahoo tickers and preserve unrelated query", async () => {
  const { buildTerminalDialogHref } = await loadModule(SRC);

  assert.equal(
    buildTerminalDialogHref(
      { kind: "market", symbol: "gc=f" },
      "?tab=signals&trade=00000000-0000-0000-0000-000000000000",
    ),
    "/terminal/market?tab=signals&symbol=GC%3DF",
  );
  assert.equal(
    buildTerminalDialogHref(
      { kind: "journal", tradeId: UUID },
      "?symbol=AAPL&range=30d",
    ),
    `/terminal/journal?range=30d&trade=${UUID.toLowerCase()}`,
  );
});

test("close removes both semantic parameters without dropping other query", async () => {
  const { buildTerminalDialogCloseHref, clearTerminalDialogParams } =
    await loadModule(SRC);

  assert.equal(
    clearTerminalDialogParams("?symbol=AAPL&trade=bad&tab=history").toString(),
    "tab=history",
  );
  assert.equal(
    buildTerminalDialogCloseHref(
      "/terminal/market",
      "?theme=dark&symbol=BTC-USD",
    ),
    "/terminal/market?theme=dark",
  );
});

test("legacy Market alias canonicalizes while retaining invalid input for a generic state", async () => {
  const { buildLegacyMarketCanonicalHref } = await loadModule(SRC);

  assert.equal(
    buildLegacyMarketCanonicalHref(
      "/terminal",
      `?foo=1&symbol=BTC%2FUSD&trade=${UUID}`,
    ),
    "/terminal/market?foo=1&symbol=BTC%2FUSD",
  );
  assert.equal(buildLegacyMarketCanonicalHref("/terminal", "?foo=1"), null);
  assert.equal(
    buildLegacyMarketCanonicalHref("/terminal/market", "?symbol=AAPL"),
    null,
  );
});

test("market membership is normalized but rejects malformed symbols", async () => {
  const { isMarketSymbolInUniverse } = await loadModule(SRC);
  const universe = new Set(["BTC-USD", "gc=f", "BBCA.JK"]);

  assert.equal(isMarketSymbolInUniverse("btc-usd", universe), true);
  assert.equal(isMarketSymbolInUniverse("GC=F", universe), true);
  assert.equal(isMarketSymbolInUniverse("BTC/USD", universe), false);
  assert.equal(isMarketSymbolInUniverse("MSFT", universe), false);
});

test("market availability uses the full access universe, not filters or network state", async () => {
  const { resolveMarketSymbolAvailability } = await loadModule(SRC);
  const freeUniverse = new Set(["BTC-USD", "GC=F"]);
  const premiumUniverse = new Set(["BTC-USD", "MSFT", "BBCA.JK"]);
  const withFavorite = new Set([...freeUniverse, "DOGE-USD"]);

  assert.equal(
    resolveMarketSymbolAvailability("MSFT", freeUniverse, false),
    "unavailable",
  );
  assert.equal(
    resolveMarketSymbolAvailability("MSFT", premiumUniverse, false),
    "available",
  );
  assert.equal(
    resolveMarketSymbolAvailability("doge-usd", withFavorite, false),
    "available",
  );
  // Search/filter and Yahoo error flags are deliberately not inputs: a listed
  // asset stays available even when its row is hidden or its fetch later fails.
  assert.equal(
    resolveMarketSymbolAvailability("BBCA.JK", premiumUniverse, false),
    "available",
  );
  assert.equal(
    resolveMarketSymbolAvailability("BTC/USD", premiumUniverse, false),
    "unavailable",
  );
  assert.equal(
    resolveMarketSymbolAvailability("MSFT", premiumUniverse, true),
    "checking",
  );
});

test("history marker identifies only the matching in-app dialog entry", async () => {
  const {
    TERMINAL_DIALOG_ORIGIN_STATE_KEY,
    hasTerminalDialogOriginState,
    withTerminalDialogOriginState,
  } = await loadModule(SRC);
  const market = { kind: "market", symbol: "btc-usd" };
  const journal = { kind: "journal", tradeId: UUID };
  const state = withTerminalDialogOriginState({ preserved: true }, market);

  assert.equal(state.preserved, true);
  assert.deepEqual(state[TERMINAL_DIALOG_ORIGIN_STATE_KEY], {
    kind: "market",
    id: "BTC-USD",
  });
  assert.equal(hasTerminalDialogOriginState(state, market), true);
  assert.equal(
    hasTerminalDialogOriginState(state, {
      kind: "market",
      symbol: "ETH-USD",
    }),
    false,
  );
  assert.equal(hasTerminalDialogOriginState(state, journal), false);
  assert.equal(hasTerminalDialogOriginState(null, market), false);
});
