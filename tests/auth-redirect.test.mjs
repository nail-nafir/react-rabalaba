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
const TESTIMONIAL_SRC = "/src/features/testimonials/constants.ts";

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

test("safe internal redirects preserve path, query, and hash exactly", async () => {
  const { sanitizeInternalRedirect } = await loadModule(SRC);
  const target = "/terminal/journal?trade=123#detail";

  assert.equal(sanitizeInternalRedirect(target), target);
});

test("external schemes and protocol-relative redirects are rejected", async () => {
  const { sanitizeInternalRedirect, DEFAULT_REDIRECT } = await loadModule(SRC);

  for (const target of [
    "https://evil.example/steal",
    "javascript:alert(1)",
    "data:text/html,boom",
    "//evil.example/steal",
    "/%2Fevil.example/steal",
    "/%252Fevil.example/steal",
  ]) {
    assert.equal(sanitizeInternalRedirect(target), DEFAULT_REDIRECT, target);
  }
});

test("backslashes and ASCII control characters are rejected at nested encoding layers", async () => {
  const { sanitizeInternalRedirect, DEFAULT_REDIRECT } = await loadModule(SRC);

  for (const target of [
    "/terminal\\journal",
    "/terminal%5Cjournal",
    "/terminal%255Cjournal",
    "/terminal\nset-cookie",
    "/terminal%0Aset-cookie",
    "/terminal%250Aset-cookie",
    "/terminal%25250Aset-cookie",
    "/terminal%7Fdelete",
  ]) {
    assert.equal(sanitizeInternalRedirect(target), DEFAULT_REDIRECT, target);
  }
});

test("auth entry routes cannot create a redirect loop", async () => {
  const { sanitizeInternalRedirect, DEFAULT_REDIRECT } = await loadModule(SRC);

  for (const target of [
    "/login",
    "/login?redirect=/terminal",
    "/LOGIN/",
    "/account/../login",
    "/%6Cogin",
    "/register",
    "/auth/callback?code=fake",
  ]) {
    assert.equal(sanitizeInternalRedirect(target), DEFAULT_REDIRECT, target);
  }
});

test("login URL builder sanitizes a pre-composed untrusted target", async () => {
  const { buildLoginRedirect, buildLoginRedirectForTarget, DEFAULT_REDIRECT } =
    await loadModule(SRC);
  const fallback = `/login?redirect=${encodeURIComponent(DEFAULT_REDIRECT)}`;

  assert.equal(
    buildLoginRedirectForTarget("https://evil.example"),
    fallback,
  );
  assert.equal(buildLoginRedirect("/terminal\n"), fallback);
});

test("login URL builder preserves a section hash", async () => {
  const { buildLoginRedirect } = await loadModule(SRC);

  assert.equal(
    buildLoginRedirect(
      "/terminal/journal",
      "?trade=65d4f534-6a14-4f42-9f56-65fe1397142e",
      "#history",
    ),
    "/login?redirect=%2Fterminal%2Fjournal%3Ftrade%3D65d4f534-6a14-4f42-9f56-65fe1397142e%23history",
  );
});

test("testimonial login deep link preserves its query and section hash", async () => {
  const { TESTIMONIAL_LOGIN_PATH, TESTIMONIAL_PATH } =
    await loadModule(TESTIMONIAL_SRC);
  const loginUrl = new URL(TESTIMONIAL_LOGIN_PATH, "https://rabalaba.app");
  const redirect = loginUrl.searchParams.get("redirect");

  assert.equal(loginUrl.pathname, "/login");
  assert.equal(redirect, TESTIMONIAL_PATH);

  const target = new URL(redirect, "https://rabalaba.app");
  assert.equal(target.pathname, "/");
  assert.equal(target.searchParams.get("testimonial"), "open");
  assert.equal(target.hash, "#testimonials");
});
