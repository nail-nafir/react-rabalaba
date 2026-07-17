export const TERMINAL_MARKET_PATH = "/terminal/market";
export const TERMINAL_JOURNAL_PATH = "/terminal/journal";
export const LEGACY_TERMINAL_PATH = "/terminal";

export const MARKET_SYMBOL_PARAM = "symbol";
export const JOURNAL_TRADE_PARAM = "trade";

export const TERMINAL_DIALOG_ORIGIN_STATE_KEY = "terminalDialogOrigin";

const MARKET_SYMBOL_PATTERN = /^[A-Z0-9.^=_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MarketDialogTarget = {
  kind: "market";
  symbol: string;
};

export type JournalDialogTarget = {
  kind: "journal";
  tradeId: string;
};

export type TerminalDialogTarget = MarketDialogTarget | JournalDialogTarget;

export type DialogParamState<T> =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "valid"; value: T };

export type ParsedTerminalDialogParams = {
  marketSymbol: DialogParamState<string>;
  journalTradeId: DialogParamState<string>;
  hasConflict: boolean;
  target: TerminalDialogTarget | null;
};

type TerminalDialogOrigin = {
  kind: TerminalDialogTarget["kind"];
  id: string;
};

function toSearchParams(search: string | URLSearchParams) {
  if (search instanceof URLSearchParams) {
    return new URLSearchParams(search);
  }

  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function parseSingleParam<T>(
  searchParams: URLSearchParams,
  name: string,
  normalize: (value: string) => T | null,
): DialogParamState<T> {
  const values = searchParams.getAll(name);
  if (values.length === 0) return { status: "absent" };

  // Duplicate semantic parameters are ambiguous and therefore rejected.
  if (values.length !== 1) return { status: "invalid" };

  const value = normalize(values[0]);
  return value === null
    ? { status: "invalid" }
    : { status: "valid", value };
}

function normalizeTarget(target: TerminalDialogTarget): TerminalDialogTarget {
  if (target.kind === "market") {
    const symbol = normalizeMarketSymbol(target.symbol);
    if (!symbol) throw new TypeError("Invalid Market symbol");
    return { kind: "market", symbol };
  }

  const tradeId = normalizeJournalTradeId(target.tradeId);
  if (!tradeId) throw new TypeError("Invalid journal trade ID");
  return { kind: "journal", tradeId };
}

function targetOrigin(target: TerminalDialogTarget): TerminalDialogOrigin {
  const normalized = normalizeTarget(target);
  return normalized.kind === "market"
    ? { kind: "market", id: normalized.symbol }
    : { kind: "journal", id: normalized.tradeId };
}

export function normalizeMarketSymbol(value: string | null | undefined) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  if (
    normalized.length < 1 ||
    normalized.length > 32 ||
    !MARKET_SYMBOL_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function normalizeJournalTradeId(value: string | null | undefined) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function parseTerminalDialogParams(
  search: string | URLSearchParams,
): ParsedTerminalDialogParams {
  const searchParams = toSearchParams(search);
  const marketSymbol = parseSingleParam(
    searchParams,
    MARKET_SYMBOL_PARAM,
    normalizeMarketSymbol,
  );
  const journalTradeId = parseSingleParam(
    searchParams,
    JOURNAL_TRADE_PARAM,
    normalizeJournalTradeId,
  );
  const hasConflict =
    marketSymbol.status !== "absent" && journalTradeId.status !== "absent";

  let target: TerminalDialogTarget | null = null;
  if (!hasConflict && marketSymbol.status === "valid") {
    target = { kind: "market", symbol: marketSymbol.value };
  } else if (!hasConflict && journalTradeId.status === "valid") {
    target = { kind: "journal", tradeId: journalTradeId.value };
  }

  return { marketSymbol, journalTradeId, hasConflict, target };
}

/**
 * Clones the current query and makes the semantic dialog parameters exclusive.
 * Passing `null` closes either detail dialog while retaining unrelated query.
 */
export function setTerminalDialogTarget(
  search: string | URLSearchParams,
  target: TerminalDialogTarget | null,
) {
  const searchParams = toSearchParams(search);
  searchParams.delete(MARKET_SYMBOL_PARAM);
  searchParams.delete(JOURNAL_TRADE_PARAM);

  if (!target) return searchParams;

  const normalized = normalizeTarget(target);
  if (normalized.kind === "market") {
    searchParams.set(MARKET_SYMBOL_PARAM, normalized.symbol);
  } else {
    searchParams.set(JOURNAL_TRADE_PARAM, normalized.tradeId);
  }

  return searchParams;
}

export function clearTerminalDialogParams(
  search: string | URLSearchParams,
) {
  return setTerminalDialogTarget(search, null);
}

export function terminalDialogPath(target: TerminalDialogTarget) {
  return target.kind === "market"
    ? TERMINAL_MARKET_PATH
    : TERMINAL_JOURNAL_PATH;
}

export function buildTerminalDialogHref(
  target: TerminalDialogTarget,
  currentSearch: string | URLSearchParams = "",
) {
  const normalized = normalizeTarget(target);
  const query = setTerminalDialogTarget(currentSearch, normalized).toString();
  return `${terminalDialogPath(normalized)}${query ? `?${query}` : ""}`;
}

export function buildTerminalDialogCloseHref(
  pathname: string,
  currentSearch: string | URLSearchParams,
) {
  const query = clearTerminalDialogParams(currentSearch).toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

/**
 * `/terminal?symbol=...` remains a supported legacy entry point. This helper
 * only changes the route and removes a conflicting journal target; it keeps a
 * malformed symbol intact so the Market boundary can show its generic,
 * non-reflective unavailable state.
 */
export function buildLegacyMarketCanonicalHref(
  pathname: string,
  currentSearch: string | URLSearchParams,
) {
  const searchParams = toSearchParams(currentSearch);
  if (pathname !== LEGACY_TERMINAL_PATH || !searchParams.has(MARKET_SYMBOL_PARAM)) {
    return null;
  }

  searchParams.delete(JOURNAL_TRADE_PARAM);
  const query = searchParams.toString();
  return `${TERMINAL_MARKET_PATH}${query ? `?${query}` : ""}`;
}

export function isMarketSymbolInUniverse(
  symbol: string | null | undefined,
  supportedSymbols: Iterable<string>,
) {
  const normalizedSymbol = normalizeMarketSymbol(symbol);
  if (!normalizedSymbol) return false;

  for (const candidate of supportedSymbols) {
    if (normalizeMarketSymbol(candidate) === normalizedSymbol) return true;
  }

  return false;
}

export type MarketSymbolAvailability =
  | "checking"
  | "available"
  | "unavailable";

/**
 * Resolve membership independently from table filters and Yahoo network state.
 * Callers pass the complete pre-filter access universe and only its own loading
 * state; a supported asset therefore remains supported when hidden by search,
 * pagination, or a failed market-data response.
 */
export function resolveMarketSymbolAvailability(
  symbol: string | null | undefined,
  supportedSymbols: Iterable<string>,
  membershipResolving: boolean,
): MarketSymbolAvailability {
  if (!normalizeMarketSymbol(symbol)) return "unavailable";
  if (membershipResolving) return "checking";
  return isMarketSymbolInUniverse(symbol, supportedSymbols)
    ? "available"
    : "unavailable";
}

/** Adds a small, serializable marker used to distinguish an in-app PUSH. */
export function withTerminalDialogOriginState(
  state: unknown,
  target: TerminalDialogTarget,
) {
  const base =
    state !== null && typeof state === "object" && !Array.isArray(state)
      ? state
      : {};

  return {
    ...base,
    [TERMINAL_DIALOG_ORIGIN_STATE_KEY]: targetOrigin(target),
  };
}

export function hasTerminalDialogOriginState(
  state: unknown,
  target: TerminalDialogTarget,
) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    return false;
  }

  const marker = (state as Record<string, unknown>)[
    TERMINAL_DIALOG_ORIGIN_STATE_KEY
  ];
  if (marker === null || typeof marker !== "object" || Array.isArray(marker)) {
    return false;
  }

  const expected = targetOrigin(target);
  const candidate = marker as Record<string, unknown>;
  return candidate.kind === expected.kind && candidate.id === expected.id;
}
