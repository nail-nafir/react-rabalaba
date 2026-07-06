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

const SRC = "/src/core/asset-discovery-core.ts";

// ── binancePerpBase ────────────────────────────────────────────────────────

test("binancePerpBase: strips USDT quote and 1000x multipliers, keeps 1INCH", async () => {
  const { binancePerpBase } = await loadModule(SRC);
  assert.equal(binancePerpBase("BTCUSDT"), "BTC");
  assert.equal(binancePerpBase("1000PEPEUSDT"), "PEPE");
  assert.equal(binancePerpBase("1000000MOGUSDT"), "MOG");
  assert.equal(binancePerpBase("1MBABYDOGEUSDT"), "BABYDOGE");
  assert.equal(binancePerpBase("1INCHUSDT"), "1INCH", "1INCH is a real base");
  assert.equal(binancePerpBase("ETHUSDC"), null, "non-USDT quote");
  assert.equal(binancePerpBase("BTCUSDT_260327"), null, "delivery contract");
});

// ── rankCryptoCandidates ───────────────────────────────────────────────────

const cgCoin = (symbol, rank, extra = {}) => ({
  symbol,
  name: extra.name ?? symbol,
  marketCapRank: rank,
  priceUsd: extra.priceUsd ?? null,
});

test("rankCryptoCandidates: trending first, denylists + rank gate applied, deduped", async () => {
  const { rankCryptoCandidates } = await loadModule(SRC);
  const out = rankCryptoCandidates({
    cgTrending: [
      cgCoin("USDT", 3), // stablecoin → out
      cgCoin("WBTC", 12), // wrapped → out
      cgCoin("SHEB", 4603), // wash-trade micro cap → out (rank > 300)
      cgCoin("RSPCX", null), // fake coin, no rank → out
      cgCoin("PEPE", 25, { priceUsd: 0.0000012 }),
    ],
    binance24h: [
      { symbol: "BTCUSDT", quoteVolume: 900 },
      { symbol: "1000PEPEUSDT", quoteVolume: 800 }, // dup of trending PEPE
      { symbol: "USDCUSDT", quoteVolume: 700 }, // stablecoin base → out
      { symbol: "SOLUSDT", quoteVolume: 600 },
      { symbol: "ETHUSDT_260327", quoteVolume: 999 }, // delivery → out
    ],
    shortlist: 10,
  });
  assert.deepEqual(
    out.map((c) => c.query),
    ["PEPE", "BTC", "SOL"],
    "trending first, then volume-ranked, deduped",
  );
  assert.equal(out[0].reason, "coingecko-trending", "first reason wins the dup");
  assert.equal(out[0].sourcePriceUsd, 0.0000012);
  assert.equal(out[1].reason, "binance-volume");
});

test("rankCryptoCandidates: tolerates null feeds and honors shortlist", async () => {
  const { rankCryptoCandidates } = await loadModule(SRC);
  assert.deepEqual(
    rankCryptoCandidates({ cgTrending: null, binance24h: null, shortlist: 5 }),
    [],
  );
  const out = rankCryptoCandidates({
    cgTrending: null,
    binance24h: [
      { symbol: "BTCUSDT", quoteVolume: 3 },
      { symbol: "ETHUSDT", quoteVolume: 2 },
      { symbol: "SOLUSDT", quoteVolume: 1 },
    ],
    shortlist: 2,
  });
  assert.deepEqual(out.map((c) => c.query), ["BTC", "ETH"]);
});

// ── pickYahooCryptoSymbol ──────────────────────────────────────────────────

test("pickYahooCryptoSymbol: exact name match beats list order (the PEPE defense)", async () => {
  const { pickYahooCryptoSymbol } = await loadModule(SRC);
  const quotes = [
    // The trap: bare PEPE-USD resolves to a DIFFERENT coin on Yahoo.
    { symbol: "PEPE-USD", shortname: "PEPEGOLD USD", quoteType: "CRYPTOCURRENCY" },
    { symbol: "PEPE24478-USD", shortname: "Pepe USD", quoteType: "CRYPTOCURRENCY" },
    { symbol: "PEPE29783-USD", shortname: "SUPER PEPE USD", quoteType: "CRYPTOCURRENCY" },
    { symbol: "PWH-USD", shortname: "Pepe Wif Hat USD", quoteType: "CRYPTOCURRENCY" },
    { symbol: "PEPE", shortname: "Pepe Inc", quoteType: "EQUITY" },
  ];
  assert.equal(
    pickYahooCryptoSymbol("PEPE", "Pepe", quotes),
    "PEPE24478-USD",
    "name match wins over the first-listed trap",
  );
  assert.equal(
    pickYahooCryptoSymbol("PEPE", null, quotes),
    "PEPE-USD",
    "without a source name the first pattern match is taken",
  );
});

test("pickYahooCryptoSymbol: pattern + quoteType gates, null when nothing fits", async () => {
  const { pickYahooCryptoSymbol } = await loadModule(SRC);
  assert.equal(
    pickYahooCryptoSymbol("BTC", "Bitcoin", [
      { symbol: "BTCX-USD", shortname: "BitcoinX USD", quoteType: "CRYPTOCURRENCY" },
      { symbol: "BTC-EUR", shortname: "Bitcoin EUR", quoteType: "CRYPTOCURRENCY" },
      { symbol: "BTC", shortname: "Grayscale BTC Trust", quoteType: "ETF" },
    ]),
    null,
    "no ^BASE(\\d+)?-USD$ crypto quote → skipped, never guessed",
  );
  assert.equal(
    pickYahooCryptoSymbol("BTC", "Bitcoin", [
      { symbol: "BTC-USD", shortname: "Bitcoin USD", quoteType: "CRYPTOCURRENCY" },
    ]),
    "BTC-USD",
  );
});

// ── rankUsCandidates ───────────────────────────────────────────────────────

const usQuote = (symbol, extra = {}) => ({
  symbol,
  shortName: extra.name ?? symbol,
  quoteType: extra.quoteType ?? "EQUITY",
  marketCap: extra.marketCap ?? 5e9,
  regularMarketPrice: extra.price ?? 50,
  regularMarketVolume: extra.volume ?? 1e7,
});

test("rankUsCandidates: EQUITY only, floors applied, gainers before actives", async () => {
  const { rankUsCandidates } = await loadModule(SRC);
  const out = rankUsCandidates({
    dayGainers: [
      usQuote("SOXL", { quoteType: "ETF" }), // leveraged ETF → out
      usQuote("PUMP", { marketCap: 2e8 }), // micro cap → out
      usQuote("PNNY", { price: 2.5 }), // penny → out
      usQuote("OPEN"),
    ],
    mostActives: [usQuote("OPEN"), usQuote("NVDA")],
    shortlist: 10,
  });
  assert.deepEqual(out.map((c) => c.query), ["OPEN", "NVDA"]);
  assert.equal(out[0].reason, "yahoo-day-gainers", "gainers ranked first");
  assert.equal(out[1].reason, "yahoo-most-actives");
});

// ── rankIdCandidates ───────────────────────────────────────────────────────

test("rankIdCandidates: .JK only, turnover ordering demotes gocap churn", async () => {
  const { rankIdCandidates } = await loadModule(SRC);
  const out = rankIdCandidates({
    mostActives: [
      // 50 IDR × 1.5B shares = 75B turnover, but price < 100 → out entirely
      usQuote("GOCP.JK", { price: 50, volume: 1.5e9 }),
      // 200 IDR × 100M = 20B turnover → below the 50B floor → out
      usQuote("THIN.JK", { price: 200, volume: 1e8 }),
      // 500 IDR × 400M = 200B turnover
      usQuote("BUMI.JK", { price: 500, volume: 4e8 }),
      // 5000 IDR × 100M = 500B turnover → highest, outranks BUMI
      usQuote("BBRI.JK", { price: 5000, volume: 1e8 }),
      usQuote("AAPL", { price: 5000, volume: 1e9 }), // not .JK → out
    ],
    shortlist: 10,
  });
  assert.deepEqual(out.map((c) => c.query), ["BBRI.JK", "BUMI.JK"]);
  assert.equal(out[0].reason, "idx-most-actives");
});

// ── dedupeCandidates ───────────────────────────────────────────────────────

const rawCand = (market, query, extra = {}) => ({
  market,
  query,
  name: extra.name ?? null,
  reason: extra.reason ?? "binance-volume",
  rank: extra.rank ?? 0,
});

const existingRow = (symbol, extra = {}) => ({
  symbol,
  source: extra.source ?? "auto",
  active: extra.active ?? true,
  asset_type: extra.asset_type ?? "crypto",
  last_discovered_at: extra.last_discovered_at ?? null,
});

test("dedupeCandidates: admin dropped, auto routed to refresh/reactivate, new validated", async () => {
  const { dedupeCandidates } = await loadModule(SRC);
  const { toValidate, refresh, reactivate } = dedupeCandidates({
    raw: [
      rawCand("crypto", "BTC"), // exists as ADMIN row → dropped silently
      rawCand("crypto", "PEPE"), // exists as auto+active PEPE24478-USD → refresh
      rawCand("crypto", "BONK"), // exists as auto+INACTIVE → reactivate
      rawCand("crypto", "TAIKO"), // brand new → validate
      rawCand("us-stock", "OPEN", { reason: "yahoo-day-gainers" }), // new
      rawCand("us-stock", "AAPL"), // exists as ADMIN us-stock → dropped
    ],
    existing: [
      existingRow("BTC-USD", { source: "admin" }),
      existingRow("PEPE24478-USD", { active: true }),
      existingRow("BONK-USD", { active: false }),
      existingRow("AAPL", { source: "admin", asset_type: "us-stock" }),
    ],
    maxPerMarket: 5,
  });
  assert.deepEqual(toValidate.map((c) => c.query), ["TAIKO", "OPEN"]);
  assert.deepEqual(refresh, ["PEPE24478-USD"], "crypto matched via BASE(\\d+)?-USD");
  assert.deepEqual(reactivate, ["BONK-USD"]);
});

test("dedupeCandidates: toValidate capped at 2× maxPerMarket per market", async () => {
  const { dedupeCandidates } = await loadModule(SRC);
  const raw = Array.from({ length: 10 }, (_, i) =>
    rawCand("crypto", `NEW${i}`, { rank: i }),
  );
  const { toValidate } = dedupeCandidates({
    raw,
    existing: [],
    maxPerMarket: 2,
  });
  assert.equal(toValidate.length, 4, "2 × cap shortlist");
  assert.deepEqual(toValidate.map((c) => c.query), ["NEW0", "NEW1", "NEW2", "NEW3"]);
});

// ── planDiscovery ──────────────────────────────────────────────────────────

const NOW_ISO = "2026-07-02T00:00:00.000Z";
const daysAgoIso = (days) =>
  new Date(Date.parse(NOW_ISO) - days * 24 * 60 * 60 * 1000).toISOString();

const validatedCand = (symbol, assetType = "crypto", extra = {}) => ({
  symbol,
  name: extra.name ?? null,
  assetType,
  reason: extra.reason ?? "binance-volume",
});

const basePlanInput = (overrides = {}) => ({
  validated: [],
  refresh: [],
  reactivate: [],
  existing: [],
  openTradeSymbols: [],
  nowIso: NOW_ISO,
  pruneDays: 14,
  maxPerMarket: 5,
  maxAutoActive: 60,
  prunableMarkets: ["crypto", "us-stock", "id-stock"],
  ...overrides,
});

test("planDiscovery: inserts capped per market and by auto-active headroom", async () => {
  const { planDiscovery } = await loadModule(SRC);
  const plan = planDiscovery(
    basePlanInput({
      validated: [
        validatedCand("A-USD"),
        validatedCand("B-USD"),
        validatedCand("C-USD"), // over the per-market cap of 2
        validatedCand("OPEN", "us-stock"),
      ],
      maxPerMarket: 2,
      // 2 active auto rows + 1 reactivation → headroom = 4 − 2 − 1 = 1 insert.
      existing: [
        existingRow("X-USD", { last_discovered_at: daysAgoIso(1) }),
        existingRow("Y-USD", { last_discovered_at: daysAgoIso(1) }),
        existingRow("Z-USD", { active: false }),
      ],
      reactivate: ["Z-USD"],
      maxAutoActive: 4,
    }),
  );
  assert.deepEqual(
    plan.inserts.map((i) => i.symbol),
    ["A-USD"],
    "headroom (not the per-market cap) binds here",
  );
  const row = plan.inserts[0];
  assert.equal(row.source, "auto");
  assert.equal(row.active, true);
  assert.equal(row.last_discovered_at, NOW_ISO);
  assert.equal(row.created_by, null);
});

test("planDiscovery: validated symbol colliding with an existing row is routed, never re-inserted", async () => {
  const { planDiscovery } = await loadModule(SRC);
  const plan = planDiscovery(
    basePlanInput({
      validated: [
        validatedCand("BTC-USD"), // admin row → dropped
        validatedCand("BONK-USD"), // auto inactive row → reactivate
        validatedCand("NEW-USD"),
      ],
      existing: [
        existingRow("BTC-USD", { source: "admin" }),
        existingRow("BONK-USD", { active: false }),
      ],
    }),
  );
  assert.deepEqual(plan.inserts.map((i) => i.symbol), ["NEW-USD"]);
  assert.deepEqual(plan.reactivate, ["BONK-USD"]);
});

test("planDiscovery: prune only stale auto rows without open trades, in healthy markets, not seen this run", async () => {
  const { planDiscovery } = await loadModule(SRC);
  const plan = planDiscovery(
    basePlanInput({
      refresh: ["FRESH-USD"],
      existing: [
        // Stale (20d) → pruned.
        existingRow("STALE-USD", { last_discovered_at: daysAgoIso(20) }),
        // Stale but holds an OPEN trade → kept.
        existingRow("HODL-USD", { last_discovered_at: daysAgoIso(20) }),
        // Stale but seen this run (refresh) → kept.
        existingRow("FRESH-USD", { last_discovered_at: daysAgoIso(20) }),
        // Stale but its market's feed failed this run → kept.
        existingRow("BNBR.JK", {
          asset_type: "id-stock",
          last_discovered_at: daysAgoIso(20),
        }),
        // Recent (5d) → kept.
        existingRow("RECENT-USD", { last_discovered_at: daysAgoIso(5) }),
        // No stamp at all → never pruned.
        existingRow("NOSTAMP-USD", { last_discovered_at: null }),
        // Stale ADMIN row → discovery has no business touching it.
        existingRow("ADMIN-USD", {
          source: "admin",
          last_discovered_at: daysAgoIso(20),
        }),
        // Stale but already INACTIVE → nothing to prune.
        existingRow("OFF-USD", {
          active: false,
          last_discovered_at: daysAgoIso(20),
        }),
      ],
      openTradeSymbols: ["HODL-USD"],
      prunableMarkets: ["crypto", "us-stock"], // id-stock feed failed
    }),
  );
  assert.deepEqual(plan.prune, ["STALE-USD"]);
  assert.deepEqual(plan.refresh, ["FRESH-USD"]);
});

test("planDiscovery: admin rows never appear in any output list", async () => {
  const { planDiscovery } = await loadModule(SRC);
  const plan = planDiscovery(
    basePlanInput({
      validated: [validatedCand("ADMIN-USD")],
      existing: [
        existingRow("ADMIN-USD", {
          source: "admin",
          last_discovered_at: daysAgoIso(30),
        }),
      ],
    }),
  );
  const everywhere = [
    ...plan.inserts.map((i) => i.symbol),
    ...plan.reactivate,
    ...plan.refresh,
    ...plan.prune,
  ];
  assert.deepEqual(everywhere, []);
});

// ── formatDiscoveryForDiscord ──────────────────────────────────────────────

test("formatDiscoveryForDiscord: null on no-news, sections + cap otherwise", async () => {
  const { formatDiscoveryForDiscord, planDiscovery } = await loadModule(SRC);
  assert.equal(
    formatDiscoveryForDiscord({
      inserts: [],
      reactivate: [],
      refresh: ["X-USD"], // refresh alone is not news
      prune: [],
    }),
    null,
  );

  const bigPlan = planDiscovery(
    basePlanInput({
      validated: Array.from({ length: 60 }, (_, i) =>
        validatedCand(`LONGNAME${i}-USD`, "crypto", {
          name: `Some Very Long Coin Name ${i}`,
          reason: "coingecko-trending",
        }),
      ),
      maxPerMarket: 20,
      maxAutoActive: 100,
      reactivate: ["BACK-USD"],
    }),
  );
  bigPlan.prune = ["GONE-USD"];
  const msg = formatDiscoveryForDiscord(bigPlan);
  assert.ok(msg.includes("ASET TREN BARU"));
  assert.ok(msg.includes("KEMBALI DIPANTAU"));
  assert.ok(msg.includes("KELUAR DARI UNIVERSE"));
  assert.ok(msg.includes("CoinGecko Trending"));
  assert.ok(msg.length <= 1900, `capped at 1900, got ${msg.length}`);
});

// ── feed parsers ───────────────────────────────────────────────────────────

test("parsers: normalize real envelopes, null on malformed payloads", async () => {
  const { parseCgTrending, parseBinance24h, parseYahooScreener, parseYahooSearch } =
    await loadModule(SRC);

  assert.deepEqual(
    parseCgTrending({
      coins: [
        {
          item: {
            symbol: "PEPE",
            name: "Pepe",
            market_cap_rank: 25,
            data: { price: 0.0000012 },
          },
        },
        { item: { symbol: "OK", name: "OKB", market_cap_rank: null } },
        { broken: true },
      ],
    }),
    [
      { symbol: "PEPE", name: "Pepe", marketCapRank: 25, priceUsd: 0.0000012 },
      { symbol: "OK", name: "OKB", marketCapRank: null, priceUsd: null },
    ],
  );
  assert.equal(parseCgTrending({ error: "rate limited" }), null);

  assert.deepEqual(
    parseBinance24h([
      { symbol: "BTCUSDT", quoteVolume: "123.45" },
      { symbol: "ETHUSDT", quoteVolume: "not-a-number" },
    ]),
    [{ symbol: "BTCUSDT", quoteVolume: 123.45 }],
  );
  assert.equal(parseBinance24h({ code: -1121 }), null);

  const screener = parseYahooScreener({
    finance: {
      result: [
        {
          quotes: [
            {
              symbol: "OPEN",
              shortName: "Opendoor",
              quoteType: "EQUITY",
              marketCap: 3e9,
              regularMarketPrice: 4.2,
              regularMarketVolume: 9e7,
            },
          ],
        },
      ],
    },
  });
  assert.equal(screener.length, 1);
  assert.equal(screener[0].symbol, "OPEN");
  assert.equal(parseYahooScreener({ finance: { error: "crumb" } }), null);

  assert.deepEqual(
    parseYahooSearch({
      quotes: [{ symbol: "PEPE24478-USD", shortname: "Pepe USD", quoteType: "CRYPTOCURRENCY" }],
    }),
    [
      {
        symbol: "PEPE24478-USD",
        shortname: "Pepe USD",
        longname: null,
        quoteType: "CRYPTOCURRENCY",
      },
    ],
  );
  assert.equal(parseYahooSearch("nope"), null);
});
