import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import type {
  ClientRequest,
  IncomingMessage,
  ServerResponse,
} from "node:http";

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_PROXY_UA = "RabaLaba/1.0";
const COINGECKO_DEMO_API_KEY =
  process.env.COINGECKO_DEMO_API_KEY ?? process.env.COINGECKO_API_KEY;

function applyCleanProxyHeaders(
  proxyReq: ClientRequest,
  userAgent = DEFAULT_PROXY_UA,
) {
  proxyReq.removeHeader("origin");
  proxyReq.removeHeader("referer");
  proxyReq.removeHeader("cookie");
  proxyReq.setHeader("Accept", "application/json");
  proxyReq.setHeader("User-Agent", userAgent);
}

/**
 * Dev parity with the Cloudflare proxy (functions/api/yahoo): Yahoo's v10
 * quoteSummary (fundamentals/analyst) is gated behind a cookie + crumb. The
 * generic Vite proxy below can't do that, so this middleware intercepts only
 * quoteSummary requests, mints a cookie/crumb pair (cached, refreshed on 401),
 * and forwards them. Everything else falls through to the proxy untouched.
 */
function yahooCrumbDevPlugin(): Plugin {
  let cache: { cookie: string; crumb: string; at: number } | null = null;
  const TTL = 30 * 60 * 1000;

  const cookieFrom = (res: Response): string => {
    const getSetCookie = (
      res.headers as unknown as { getSetCookie?: () => string[] }
    ).getSetCookie;
    const list = getSetCookie
      ? getSetCookie.call(res.headers)
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
    return list
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
  };

  const getCrumb = async (
    force = false,
  ): Promise<{ cookie: string; crumb: string } | null> => {
    if (!force && cache && Date.now() - cache.at < TTL && cache.crumb) {
      return cache;
    }
    try {
      const seed = await fetch("https://fc.yahoo.com/", {
        headers: { "User-Agent": YAHOO_UA },
      });
      const cookie = cookieFrom(seed);
      if (!cookie) return null;
      const cr = await fetch(
        "https://query1.finance.yahoo.com/v1/test/getcrumb",
        { headers: { "User-Agent": YAHOO_UA, Cookie: cookie } },
      );
      const crumb = (await cr.text()).trim();
      if (!crumb || crumb.includes("<")) return null;
      cache = { cookie, crumb, at: Date.now() };
      return cache;
    } catch {
      return null;
    }
  };

  return {
    name: "yahoo-crumb-dev",
    configureServer(server) {
      server.middlewares.use(
        async (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void,
        ) => {
          if (
            !req.url ||
            !req.url.startsWith("/api/yahoo/v10/finance/quoteSummary")
          ) {
            return next();
          }
          try {
            const target = new URL(
              `https://query1.finance.yahoo.com${req.url.replace("/api/yahoo", "")}`,
            );
            const call = async (
              creds: { cookie: string; crumb: string } | null,
            ) => {
              const u = new URL(target);
              if (creds) u.searchParams.set("crumb", creds.crumb);
              return fetch(u.toString(), {
                headers: {
                  "User-Agent": YAHOO_UA,
                  ...(creds ? { Cookie: creds.cookie } : {}),
                },
              });
            };
            let creds = await getCrumb();
            let upstream = await call(creds);
            if (upstream.status === 401) {
              creds = await getCrumb(true);
              if (creds) upstream = await call(creds);
            }
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              "Content-Type",
              upstream.headers.get("content-type") ?? "application/json",
            );
            res.end(body);
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "crumb proxy failed" }));
          }
        },
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), yahooCrumbDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            applyCleanProxyHeaders(proxyReq, YAHOO_UA);
          });
        },
      },
      "/api/fng": {
        target: "https://api.alternative.me",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fng/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            applyCleanProxyHeaders(proxyReq);
          });
        },
      },
      "/api/coingecko": {
        target: "https://api.coingecko.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            applyCleanProxyHeaders(proxyReq);
            if (COINGECKO_DEMO_API_KEY) {
              proxyReq.setHeader(
                "x-cg-demo-api-key",
                COINGECKO_DEMO_API_KEY,
              );
            }
          });
        },
      },
      "/api/binance": {
        target: "https://fapi.binance.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/binance/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            applyCleanProxyHeaders(proxyReq, YAHOO_UA);
          });
        },
      },
    },
  },
});
