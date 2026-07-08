import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

process.on("unhandledRejection", () => {});

let server;
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

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

class MemoryCache {
  map = new Map();

  async match(request) {
    const cached = this.map.get(request.url);
    return cached?.clone();
  }

  async put(request, response) {
    this.map.set(request.url, response.clone());
  }

  async delete(request) {
    return this.map.delete(request.url);
  }

  deleteKind(kind) {
    for (const key of [...this.map.keys()]) {
      if (key.includes(`__rabalaba_cache=${kind}`)) {
        this.map.delete(key);
      }
    }
  }
}

function installCache() {
  const cache = new MemoryCache();
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    writable: true,
    value: { default: cache },
  });
  return cache;
}

function restoreGlobals() {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) {
    delete globalThis.caches;
  } else {
    globalThis.caches = originalCaches;
  }
}

function context(url, headers = {}) {
  const waits = [];
  return {
    request: new Request(url, { headers }),
    env: {},
    waitUntil(promise) {
      waits.push(Promise.resolve(promise));
    },
    flush: () => Promise.all(waits),
  };
}

function options(overrides = {}) {
  return {
    upstreamOrigin: "https://upstream.example",
    routePrefix: "/api/test",
    serviceName: "Test",
    cacheTtlSeconds: 60,
    staleTtlSeconds: 300,
    errorTtlSeconds: 30,
    ...overrides,
  };
}

test.afterEach(restoreGlobals);

test.after(async () => {
  try {
    if (server) await server.close();
  } catch {
    // Vite may reject while tearing down SSR middleware.
  }
});

test("proxyJsonGet caches successful JSON responses", async () => {
  installCache();
  let calls = 0;
  globalThis.fetch = async () => Response.json({ calls: ++calls });

  const { proxyJsonGet } = await loadModule("/functions/api/_shared/proxy.ts");

  const first = context("https://rabalaba.pages.dev/api/test/global");
  const firstResponse = await proxyJsonGet(first, options());
  assert.deepEqual(await firstResponse.json(), { calls: 1 });
  assert.equal(firstResponse.headers.get("X-Rabalaba-Cache"), "miss");
  await first.flush();

  const second = context("https://rabalaba.pages.dev/api/test/global");
  const secondResponse = await proxyJsonGet(second, options());
  assert.deepEqual(await secondResponse.json(), { calls: 1 });
  assert.equal(secondResponse.headers.get("X-Rabalaba-Cache"), "hit");
  assert.equal(calls, 1);
});

test("proxyJsonGet coalesces concurrent identical GETs", async () => {
  installCache();
  let calls = 0;
  let resolveFetch;
  let fetchStarted;
  const fetchReady = new Promise((resolve) => {
    fetchStarted = resolve;
  });
  globalThis.fetch = async () => {
    calls++;
    fetchStarted();
    return new Promise((resolve) => {
      resolveFetch = () => resolve(Response.json({ ok: true }));
    });
  };

  const { proxyJsonGet } = await loadModule("/functions/api/_shared/proxy.ts");
  const first = context("https://rabalaba.pages.dev/api/test/global");
  const second = context("https://rabalaba.pages.dev/api/test/global");

  const firstPending = proxyJsonGet(first, options());
  const secondPending = proxyJsonGet(second, options());
  await fetchReady;
  assert.equal(calls, 1);

  resolveFetch();
  const [firstResponse, secondResponse] = await Promise.all([
    firstPending,
    secondPending,
  ]);
  assert.deepEqual(await firstResponse.json(), { ok: true });
  assert.deepEqual(await secondResponse.json(), { ok: true });
});

test("proxyJsonGet serves stale data when upstream returns 429", async () => {
  const cache = installCache();
  let calls = 0;
  globalThis.fetch = async () => Response.json({ seed: ++calls });

  const { proxyJsonGet } = await loadModule("/functions/api/_shared/proxy.ts");
  const seeded = context("https://rabalaba.pages.dev/api/test/global");
  await proxyJsonGet(seeded, options());
  await seeded.flush();
  cache.deleteKind("fresh");

  globalThis.fetch = async () =>
    new Response("too many", {
      status: 429,
      headers: { "Content-Type": "text/plain" },
    });

  const staleCtx = context("https://rabalaba.pages.dev/api/test/global");
  const stale = await proxyJsonGet(staleCtx, options());
  assert.equal(stale.status, 200);
  assert.deepEqual(await stale.json(), { seed: 1 });
  assert.equal(stale.headers.get("X-Rabalaba-Cache"), "stale");
  assert.equal(stale.headers.get("X-Rabalaba-Upstream-Status"), "429");
});

test("proxyJsonGet returns controlled CORS error when no stale data exists", async () => {
  installCache();
  globalThis.fetch = async () =>
    new Response("too many", {
      status: 429,
      headers: { "Retry-After": "5" },
    });

  const { proxyJsonGet } = await loadModule("/functions/api/_shared/proxy.ts");
  const ctx = context("https://rabalaba.pages.dev/api/test/global");
  const response = await proxyJsonGet(ctx, options());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal(response.headers.get("X-Rabalaba-Cache"), "error");
  assert.deepEqual(await response.json(), {
    error: "Test temporarily unavailable",
  });
});

test("proxyJsonGet bypasses cache for no-cache headers and cache-buster params", async () => {
  installCache();
  let calls = 0;
  globalThis.fetch = async () => Response.json({ calls: ++calls });

  const { proxyJsonGet } = await loadModule("/functions/api/_shared/proxy.ts");
  const baseUrl = "https://rabalaba.pages.dev/api/test/global";
  const seeded = context(baseUrl);
  await proxyJsonGet(seeded, options());
  await seeded.flush();

  const noCache = context(baseUrl, { "Cache-Control": "no-cache" });
  const noCacheResponse = await proxyJsonGet(noCache, options());
  assert.deepEqual(await noCacheResponse.json(), { calls: 2 });
  assert.equal(noCacheResponse.headers.get("X-Rabalaba-Cache"), "bypass");

  const bustedUrl = `${baseUrl}?_=123`;
  const firstBusted = await proxyJsonGet(context(bustedUrl), options());
  const secondBusted = await proxyJsonGet(context(bustedUrl), options());
  assert.deepEqual(await firstBusted.json(), { calls: 3 });
  assert.deepEqual(await secondBusted.json(), { calls: 4 });
});
