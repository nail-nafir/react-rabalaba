/**
 * Pure helpers for the login-gate flow. The premium gate (see [[hooks]]'
 * `openLicenseDialog`) sends logged-out users to `/login` and stashes where
 * they came from in a `redirect` query param, which `LoginPage` reads to send
 * them back after a successful sign-in.
 */

/** Where users land after login when there's nothing meaningful to return to. */
export const DEFAULT_REDIRECT = "/terminal";

/** The login route itself — never a valid place to redirect back to. */
const LOGIN_PATH = "/login";

const INTERNAL_ORIGIN = "https://rabalaba.internal";
const MAX_DECODE_PASSES = 12;
const AUTH_ENTRY_PATHS = new Set(["/login", "/register", "/auth/callback"]);

function hasAsciiControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

/**
 * Decode one layer of percent-encoded bytes for security inspection only.
 *
 * Decoding byte-by-byte intentionally keeps working when an otherwise invalid
 * escape is present next to a dangerous nested escape. The decoded value is
 * never returned to the router, so non-ASCII bytes becoming mojibake here
 * cannot change the user's destination.
 */
function decodePercentBytes(value: string): string {
  return value.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function hasAuthRedirectLoop(value: string): boolean {
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return true;

    const pathname =
      url.pathname.length > 1
        ? url.pathname.replace(/\/+$/, "").toLowerCase()
        : url.pathname;

    return AUTH_ENTRY_PATHS.has(pathname);
  } catch {
    return true;
  }
}

function isSafeInternalRedirect(value: string): boolean {
  if (!value || value !== value.trim()) return false;

  let inspected = value;
  for (let pass = 0; pass <= MAX_DECODE_PASSES; pass += 1) {
    // A redirect must remain a same-origin absolute path at every decoding
    // layer. Browsers may treat backslashes like slashes, so reject them
    // everywhere rather than attempting to normalize them.
    if (
      !inspected.startsWith("/") ||
      inspected.startsWith("//") ||
      inspected.includes("\\") ||
      hasAsciiControlCharacter(inspected) ||
      hasAuthRedirectLoop(inspected)
    ) {
      return false;
    }

    const decoded = decodePercentBytes(inspected);
    if (decoded === inspected) return true;
    if (pass === MAX_DECODE_PASSES) return false;
    inspected = decoded;
  }

  return false;
}

/**
 * Return a same-origin route that is safe to pass to React Router.
 *
 * The original, still-encoded route is preserved so legitimate query/hash
 * values keep their exact semantics. Every nested percent-encoding layer is
 * inspected to prevent protocol-relative URLs, backslashes, control
 * characters, and auth-page redirect loops from being smuggled through.
 */
export function sanitizeInternalRedirect(
  value: string | null | undefined,
): string {
  return value && isSafeInternalRedirect(value) ? value : DEFAULT_REDIRECT;
}

/** Build a login URL from a pre-composed, untrusted redirect target. */
export function buildLoginRedirectForTarget(
  target: string | null | undefined,
): string {
  const safeTarget = sanitizeInternalRedirect(target);
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(safeTarget)}`;
}

/**
 * Build the `/login?redirect=<target>` URL for the current location.
 *
 * `pathname`/`search` are taken at call-time (e.g. from `window.location`) so
 * the caller doesn't have to subscribe to router state. The target is the path
 * plus its query string, single-encoded once; the auth pages strip it back out
 * with `decodeURIComponent`/`URLSearchParams`. Returning to `/login` (or an
 * empty path) makes no sense, so those fall back to {@link DEFAULT_REDIRECT}.
 */
export function buildLoginRedirect(
  pathname: string | null | undefined,
  search: string | null | undefined = "",
  hash: string | null | undefined = "",
): string {
  const path = pathname ?? "";
  const query = search ?? "";
  const fragment = hash ?? "";

  // Normalize the query so we never double-prepend "?" and only keep it when
  // there's something after the "?".
  const normalizedQuery =
    query && query !== "?"
      ? query.startsWith("?")
        ? query
        : `?${query}`
      : "";
  const normalizedHash =
    fragment && fragment !== "#"
      ? fragment.startsWith("#")
        ? fragment
        : `#${fragment}`
      : "";

  return buildLoginRedirectForTarget(
    `${path}${normalizedQuery}${normalizedHash}`,
  );
}
