# TSD 04 — Cloudflare Proxy

> 🇮🇩 Tier proxy JSON caching di Cloudflare Pages Functions: 3 route + engine cache fresh/stale/error + Yahoo crumb.
> 🇺🇸 JSON caching proxy tier on Cloudflare Pages Functions: 3 routes + fresh/stale/error cache engine + Yahoo crumb.

---

## TL;DR

🇮🇩 `functions/api/` adalah tier proxy JSON caching. Satu engine (`_shared/proxy.ts`) + 3 route (`coingecko`/`binance`/`yahoo`). Cache pakai Cloudflare `caches.default` (per-colo) + coalescing in-isolate + SWR on 429/5xx + error caching. Yahoo `/quoteSummary`+`/screener` butuh crumb/cookie auth (proxy minta sendiri). **Browser** sekarang direct CoinGecko/Binance (IP visitor); proxy CoinGecko tetap dipake cron asset-discovery.

🇺🇸 `functions/api/` is a JSON caching proxy tier. One engine (`_shared/proxy.ts`) + 3 routes. Cache uses Cloudflare `caches.default` (per-colo) + in-isolate coalescing + SWR on 429/5xx + error caching. Yahoo `/quoteSummary`+`/screener` need crumb/cookie auth (the proxy mints it). The **browser** calls CoinGecko/Binance direct (visitor IP); the CoinGecko proxy remains for asset-discovery cron.

---

## 🧠 Engine — `functions/api/_shared/proxy.ts` (585 baris)

### Exports
`proxyJsonGet` (GET/HEAD entry, bangun upstream URL dari `routePrefix`), `proxyJsonRequest` (core, terima `fetchUpstream` thunk), `fetchWithTimeout`, `jsonOptionsResponse`, `jsonErrorResponse`, `responseHeaders`, `envString`, type `ProxyCachePolicy`.

### Cache policy (`:27-71`)
`freshTtlSeconds` / `staleTtlSeconds` / `errorTtlSeconds` / `cacheable` / `bypassSearchParams` (default `['_']`) / `staleOnStatuses` (default `[429, [500,599]]`). Per-kind cache key (`fresh`/`stale`/`error`) via query param `__rabalaba_cache=<kind>`.

### Diagnostics headers
`X-Rabalaba-Proxy`, `X-Rabalaba-Cache` (`hit|miss|stale|error|error-hit|bypass`), `X-Rabalaba-Upstream-Status`, `X-Rabalaba-Stale-Reason`.

### Coalescing
In-isolate `inFlight` Map dedupe concurrent identical GET (`:525-539`).

### Bypass (`cacheAllowed`, `:259-280`)
Non-GET, `cacheable` false, request `Cache-Control: no-cache|no-store`, `Pragma: no-cache`, atau `bypassSearchParams` param (e.g. `_` cache-buster).

### Recoverable flow (`serveFromUpstream`, `:391-484`)
- Upstream ok → cache fresh (+stale) + delete error key.
- Upstream status in `staleOnStatuses` → serve stale kalau ada, else `recoverableErrorResponse` (preserve `Retry-After`) + cache error.
- Fetch throw → stale-then-502.

### Defaults
`DEFAULT_TIMEOUT_MS=8000`, `DEFAULT_ERROR_TTL_SECONDS=30`, CORS `*` + methods/headers standar, UA `RabaLaba/1.0`.

---

## 🛣️ Route (3)

| Route file | Upstream | Cache (fresh/stale/error) | Recoverable | Headers | Notes |
|---|---|---|---|---|---|
| `coingecko/[[path]].ts:12` | `api.coingecko.com` | 1800s / 6h / 60s | `[429, 500-599]` | inject `x-cg-demo-api-key` dari env `COINGECKO_DEMO_API_KEY`??`COINGECKO_API_KEY` | Demo key server-side; cuman healthy JSON di-cache. **Dipake cron (trending); browser direct** |
| `binance/[[path]].ts:53` | `fapi.binance.com` | per-path: openInterestHist/globalLongShort 1800s/6h; premiumIndex 900s/2h; ticker/24hr 300s/1h; default 300s/1h. error 60s | `[403,418,429,451,500-599]` | real browser UA | timeout 5000ms. **Dipake cron (24h ticker); browser direct** |
| `yahoo/[[path]].ts:132` | `query1.finance.yahoo.com` | per-path: `/v8/finance/chart/` 1800s/6h; `/v10/quoteSummary/` 6h/2d; `/v1/search` 300s/1h; `/screener`/`/calendar` 1800s/6h; default 300s/1h | `[429, 500-599]` | real UA, forward `Accept`/`Content-Type` | **Crumb/cookie auth** buat `/quoteSummary`+`/screener` (`:69-130`): seed cookie `fc.yahoo.com`, exchange crumb `/v1/test/getcrumb`, cache in-isolate 30min, refresh on 401+retry |

---

## 🧭 Browser vs cron path

| Caller | CoinGecko `/global` + `/coins/markets` | Binance derivatives | Yahoo |
|---|---|---|---|
| **Browser** | **direct** `api.coingecko.com` (IP visitor) | **direct** `fapi.binance.com` (IP visitor) | proxy `/api/yahoo` (crumb gating) |
| **Cron** | proxy `/api/coingecko` (trending 1x/hari) | proxy `/api/binance` (24h ticker) | proxy `/api/yahoo` |

> 🇮🇩 **Kenapa split?** IP egress Cloudflare Worker shared antar semua tenant CF di colo → CoinGecko free tier (per-IP) gampang 429 padahal traffic visitor dikit. Browser direct = tiap visitor pakai IP sendiri = quota sendiri. CORS upstream dua-duanya `*` jadi aman. Cron tetap lewat proxy (traffic dikit, cache warm).
> 🇺🇸 **Why split?** Cloudflare Worker egress IPs are shared across all CF tenants in a colo → CoinGecko's free per-IP limit 429s easily despite low visitor traffic. Direct browser calls use each visitor's own IP = isolated quota. Both upstreams are CORS `*`. The cron still uses the proxy (low traffic, warm cache).

> Vite dev parity: `vite.config.ts` proxy `/api/yahoo` (+ custom `yahooCrumbDevPlugin` buat crumb dev-only). Entry proxy CoinGecko/Binance dihapus dari vite config karena browser direct.

---

## 🔗 Terkait / Related
- [`00-architecture.md`](00-architecture.md) — jalur data diagram
- [`05-edge-functions.md`](05-edge-functions.md) — cron yang pakai proxy
- [`../explainer/server-vs-browser.md`](../explainer/server-vs-browser.md) — explainer
