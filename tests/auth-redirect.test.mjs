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

const SRC = "/src/lib/auth-redirect.ts";

test("plain path round-trips as an encoded redirect", async () => {
  const { buildLoginRedirect } = await loadModule(SRC);
  assert.equal(
    buildLoginRedirect("/terminal/journal"),
    "/login?redirect=%2Fterminal%2Fjournal",
  );
});

test("path with query string is preserved and encoded", async () => {
  const { buildLoginRedirect } = await loadModule(SRC);
  assert.equal(
    buildLoginRedirect("/terminal", "?view=journal&tab=open"),
    "/login?redirect=%2Fterminal%3Fview%3Djournal%26tab%3Dopen",
  );
});

test("query without a leading ? is normalized", async () => {
  const { buildLoginRedirect } = await loadModule(SRC);
  assert.equal(
    buildLoginRedirect("/subscription", "plan=pro"),
    "/login?redirect=%2Fsubscription%3Fplan%3Dpro",
  );
});

test("decoding the redirect param recovers the original target", async () => {
  const { buildLoginRedirect } = await loadModule(SRC);
  const url = buildLoginRedirect("/terminal", "?view=journal");
  const param = new URLSearchParams(url.split("?").slice(1).join("?")).get(
    "redirect",
  );
  assert.equal(param, "/terminal?view=journal");
});

test("empty path falls back to the default redirect", async () => {
  const { buildLoginRedirect, DEFAULT_REDIRECT } = await loadModule(SRC);
  assert.equal(
    buildLoginRedirect("", ""),
    `/login?redirect=${encodeURIComponent(DEFAULT_REDIRECT)}`,
  );
  assert.equal(
    buildLoginRedirect(null),
    `/login?redirect=${encodeURIComponent(DEFAULT_REDIRECT)}`,
  );
});

test("the login route never redirects back to itself", async () => {
  const { buildLoginRedirect, DEFAULT_REDIRECT } = await loadModule(SRC);
  const expected = `/login?redirect=${encodeURIComponent(DEFAULT_REDIRECT)}`;
  assert.equal(buildLoginRedirect("/login"), expected);
  assert.equal(buildLoginRedirect("/login", "?redirect=/terminal"), expected);
});

test("a lone '?' search is treated as no query", async () => {
  const { buildLoginRedirect } = await loadModule(SRC);
  assert.equal(
    buildLoginRedirect("/terminal", "?"),
    "/login?redirect=%2Fterminal",
  );
});
