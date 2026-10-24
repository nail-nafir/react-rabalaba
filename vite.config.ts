import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

/** `npm run dev` runs the real Pages Functions, so dev and Cloudflare share one code path. */
const DEV_FUNCTIONS: [RegExp, string][] = [
  [/^\/api\/yahoo\//, "/functions/api/yahoo/[[path]].ts"],
  [/^\/api\/calendar\/(?<source>[^/]+)$/, "/functions/api/calendar/[source].ts"],
];
// Node has no Workers edge cache: a cache that never hits sends every dev request upstream.
const NO_EDGE_CACHE = {
  default: { match: async () => undefined, put: async () => {}, delete: async () => false },
};

function pagesFunctionsDevPlugin(): Plugin {
  return {
    name: "pages-functions-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const route = DEV_FUNCTIONS.find(([pattern]) => pattern.test(url.pathname));
        if (!route) return next();
        try {
          Object.assign(globalThis, { caches: NO_EDGE_CACHE });
          const { onRequest } = await server.ssrLoadModule(route[1]);
          // ponytail: no request body; the app only sends GET to these routes.
          const response: Response = await onRequest({
            request: new Request(url, { method: req.method }),
            params: route[0].exec(url.pathname)?.groups ?? {},
            waitUntil() {},
          });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(await response.text());
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pagesFunctionsDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
