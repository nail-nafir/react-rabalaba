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
): string {
  const path = (pathname ?? "").trim();
  const query = (search ?? "").trim();

  // No path, or already on the login route → no point round-tripping; just
  // send them to the default landing spot after they authenticate.
  if (!path || path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`)) {
    return `${LOGIN_PATH}?redirect=${encodeURIComponent(DEFAULT_REDIRECT)}`;
  }

  // Normalize the query so we never double-prepend "?" and only keep it when
  // there's something after the "?".
  const normalizedQuery =
    query && query !== "?"
      ? query.startsWith("?")
        ? query
        : `?${query}`
      : "";

  const target = `${path}${normalizedQuery}`;
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`;
}
