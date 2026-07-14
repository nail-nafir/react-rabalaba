import {
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  JOURNAL_TRADE_PARAM,
  LEGACY_TERMINAL_PATH,
  MARKET_SYMBOL_PARAM,
  TERMINAL_DIALOG_ORIGIN_STATE_KEY,
  TERMINAL_JOURNAL_PATH,
  TERMINAL_MARKET_PATH,
  buildTerminalDialogCloseHref,
  buildTerminalDialogHref,
  hasTerminalDialogOriginState,
  parseTerminalDialogParams,
  withTerminalDialogOriginState,
  type TerminalDialogTarget,
} from "@/features/terminal/lib/dialog-url";

export type TerminalDialogRequest =
  | { kind: "market"; symbol: string | null; isValid: boolean }
  | { kind: "journal"; tradeId: string | null; isValid: boolean }
  | null;

function buildCanonicalHref(
  pathname: string,
  search: string,
  hash: string,
) {
  const parsed = parseTerminalDialogParams(search);
  const params = new URLSearchParams(search);
  const hasMarket = parsed.marketSymbol.status !== "absent";
  const hasJournal = parsed.journalTradeId.status !== "absent";

  let nextPath = pathname;

  if (pathname === LEGACY_TERMINAL_PATH) {
    nextPath = hasJournal && !hasMarket
      ? TERMINAL_JOURNAL_PATH
      : TERMINAL_MARKET_PATH;
  }

  if (parsed.hasConflict) {
    const keepJournal = nextPath === TERMINAL_JOURNAL_PATH;
    params.delete(keepJournal ? MARKET_SYMBOL_PARAM : JOURNAL_TRADE_PARAM);
    nextPath = keepJournal ? TERMINAL_JOURNAL_PATH : TERMINAL_MARKET_PATH;
  } else if (hasMarket) {
    nextPath = TERMINAL_MARKET_PATH;
  } else if (hasJournal) {
    nextPath = TERMINAL_JOURNAL_PATH;
  }

  // Canonicalize valid identifiers but deliberately retain malformed input in
  // the URL so its boundary can render a generic, non-reflective error state.
  const remaining = parseTerminalDialogParams(params);
  if (remaining.marketSymbol.status === "valid") {
    params.set(MARKET_SYMBOL_PARAM, remaining.marketSymbol.value);
  }
  if (remaining.journalTradeId.status === "valid") {
    params.set(JOURNAL_TRADE_PARAM, remaining.journalTradeId.value);
  }

  const query = params.toString();
  return `${nextPath}${query ? `?${query}` : ""}${hash}`;
}

function withoutDialogOriginState(state: unknown) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }
  const nextState = { ...(state as Record<string, unknown>) };
  delete nextState[TERMINAL_DIALOG_ORIGIN_STATE_KEY];
  return nextState;
}

/**
 * The single React owner of terminal detail navigation. The request is derived
 * from location on every render—there is no mirrored dialog state—so browser
 * Back/Forward and reload naturally close/reopen the same detail.
 */
export function useTerminalDialogUrl() {
  const location = useLocation();
  const navigate = useNavigate();

  const parsed = useMemo(
    () => parseTerminalDialogParams(location.search),
    [location.search],
  );

  const request = useMemo<TerminalDialogRequest>(() => {
    const marketRoute =
      location.pathname === TERMINAL_MARKET_PATH ||
      location.pathname === LEGACY_TERMINAL_PATH;

    if (marketRoute && parsed.marketSymbol.status !== "absent") {
      return parsed.marketSymbol.status === "valid"
        ? { kind: "market", symbol: parsed.marketSymbol.value, isValid: true }
        : { kind: "market", symbol: null, isValid: false };
    }

    if (
      location.pathname === TERMINAL_JOURNAL_PATH &&
      parsed.journalTradeId.status !== "absent"
    ) {
      return parsed.journalTradeId.status === "valid"
        ? {
            kind: "journal",
            tradeId: parsed.journalTradeId.value,
            isValid: true,
          }
        : { kind: "journal", tradeId: null, isValid: false };
    }

    return null;
  }, [location.pathname, parsed]);

  // Route aliases, identifier casing, wrong-route semantic params, and
  // conflicts all converge via REPLACE, preserving both scroll and history.
  useEffect(() => {
    const currentHref = `${location.pathname}${location.search}${location.hash}`;
    const canonicalHref = buildCanonicalHref(
      location.pathname,
      location.search,
      location.hash,
    );
    if (canonicalHref === currentHref) return;

    navigate(canonicalHref, {
      replace: true,
      state: location.state,
      preventScrollReset: true,
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  const openTarget = useCallback(
    (target: TerminalDialogTarget) => {
      navigate(buildTerminalDialogHref(target, location.search) + location.hash, {
        state: withTerminalDialogOriginState(location.state, target),
        preventScrollReset: true,
      });
    },
    [location.hash, location.search, location.state, navigate],
  );

  const openMarket = useCallback(
    (symbol: string) => openTarget({ kind: "market", symbol }),
    [openTarget],
  );

  const openJournal = useCallback(
    (tradeId: string) => openTarget({ kind: "journal", tradeId }),
    [openTarget],
  );

  const target = useMemo<TerminalDialogTarget | null>(() => {
    if (!request?.isValid) return null;
    return request.kind === "market"
      ? { kind: "market", symbol: request.symbol! }
      : { kind: "journal", tradeId: request.tradeId! };
  }, [request]);

  const close = useCallback(() => {
    if (target && hasTerminalDialogOriginState(location.state, target)) {
      navigate(-1);
      return;
    }

    navigate(
      buildTerminalDialogCloseHref(location.pathname, location.search) +
        location.hash,
      {
        replace: true,
        state: withoutDialogOriginState(location.state),
        preventScrollReset: true,
      },
    );
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
    target,
  ]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close],
  );

  return {
    request,
    openMarket,
    openJournal,
    close,
    onOpenChange,
  };
}
