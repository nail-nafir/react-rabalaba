/**
 * Pure decision core for the asset-discovery cron. Given the raw high-volume
 * feeds (Binance futures quote volume, Yahoo most-actives screeners) and the
 * current journal_assets rows, it decides what to INSERT (new auto assets),
 * REACTIVATE / REFRESH (rediscovered auto rows) and PRUNE (stale auto rows) —
 * NO fetch, NO DB, NO Date.now (the caller passes `nowIso`), so it is fully
 * unit-testable. The Deno edge function just wires fetch + DB I/O around this,
 * exactly like auto-journal-core.
 *
 * Hard invariant: rows with source='admin' NEVER appear in any output list —
 * discovery may only ever touch what discovery itself created.
 */
import { DISCORD_MAX, DIVIDER } from "./alerts";

export type DiscoveryMarket = "crypto" | "us-stock" | "id-stock";

/** "coingecko-trending" / "yahoo-day-gainers" are retired attention sources
 *  (worst journal cohorts); kept only so historical rows still label. */
export type DiscoveryReason =
  | "coingecko-trending"
  | "binance-volume"
  | "yahoo-day-gainers"
  | "yahoo-most-actives"
  | "idx-most-actives";

export interface RawCandidate {
  market: DiscoveryMarket;
  /** Crypto: bare base ("PEPE") — resolved to a real Yahoo ticker later via
   *  search. Stocks: already a full Yahoo ticker ("OPEN", "BNBR.JK"). */
  query: string;
  name: string | null;
  reason: DiscoveryReason;
  /** Position within its source list (0 = hottest) — candidates are consumed
   *  in array order, so ranking IS the order rank* functions emit. */
  rank: number;
  /** Source USD price when the feed provides one (Binance last price, per
   *  unit) — cross-checked against the resolved Yahoo chart to catch a
   *  wrong-coin resolution. */
  sourcePriceUsd?: number;
}

/* ── Source payload lite-shapes + parsers ─────────────────────────────────
 * The edge function fetches raw JSON; these parsers normalize it defensively
 * (a malformed/changed payload → null, which marks the source as failed
 * upstream instead of throwing mid-run). Kept here so they're unit-tested. */

export interface BinanceTicker24h {
  symbol: string;
  quoteVolume: number;
  /** Last trade price of the contract (a 1000× perp quotes 1000 units). */
  lastPrice?: number;
}

/** Binance /fapi/v1/ticker/24hr → lite tickers (null = unusable payload). */
export function parseBinance24h(json: unknown): BinanceTicker24h[] | null {
  if (!Array.isArray(json)) return null;
  const out: BinanceTicker24h[] = [];
  for (const t of json as Record<string, unknown>[]) {
    if (typeof t?.symbol !== "string") continue;
    const quoteVolume = Number(t.quoteVolume);
    if (!Number.isFinite(quoteVolume)) continue;
    const lastPrice = Number(t.lastPrice);
    out.push({
      symbol: t.symbol,
      quoteVolume,
      ...(Number.isFinite(lastPrice) && lastPrice > 0 ? { lastPrice } : {}),
    });
  }
  return out;
}

export interface YahooScreenerQuote {
  symbol: string;
  shortName?: string | null;
  longName?: string | null;
  quoteType?: string | null;
  marketCap?: number | null;
  regularMarketPrice?: number | null;
  regularMarketVolume?: number | null;
}

/** Yahoo screener (predefined GET + custom POST share this envelope) → quotes.
 *  Null = unusable payload; [] = source healthy but empty. */
export function parseYahooScreener(json: unknown): YahooScreenerQuote[] | null {
  const result = (json as { finance?: { result?: unknown[] } })?.finance
    ?.result?.[0] as { quotes?: unknown } | undefined;
  const quotes = result?.quotes;
  if (!Array.isArray(quotes)) return null;
  return (quotes as Record<string, unknown>[])
    .filter((q) => typeof q?.symbol === "string")
    .map((q) => ({
      symbol: q.symbol as string,
      shortName: typeof q.shortName === "string" ? q.shortName : null,
      longName: typeof q.longName === "string" ? q.longName : null,
      quoteType: typeof q.quoteType === "string" ? q.quoteType : null,
      marketCap: typeof q.marketCap === "number" ? q.marketCap : null,
      regularMarketPrice:
        typeof q.regularMarketPrice === "number" ? q.regularMarketPrice : null,
      regularMarketVolume:
        typeof q.regularMarketVolume === "number"
          ? q.regularMarketVolume
          : null,
    }));
}

export interface YahooSearchQuoteLite {
  symbol: string;
  shortname?: string | null;
  longname?: string | null;
  quoteType?: string | null;
}

/** Yahoo /v1/finance/search → lite quotes (null = unusable payload). */
export function parseYahooSearch(json: unknown): YahooSearchQuoteLite[] | null {
  const quotes = (json as { quotes?: unknown })?.quotes;
  if (!Array.isArray(quotes)) return null;
  return (quotes as Record<string, unknown>[])
    .filter((q) => typeof q?.symbol === "string")
    .map((q) => ({
      symbol: q.symbol as string,
      shortname: typeof q.shortname === "string" ? q.shortname : null,
      longname: typeof q.longname === "string" ? q.longname : null,
      quoteType: typeof q.quoteType === "string" ? q.quoteType : null,
    }));
}

/* ── Crypto candidate ranking ───────────────────────────────────────────── */

/** Stablecoins are "high volume" by design, never a trade candidate. */
const STABLECOIN_BASES = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "USD1", "PYUSD",
  "USDS", "BUSD", "USDD", "USDP", "GUSD", "EURT", "EURC",
]);

/** Wrapped/staked derivatives shadow their underlying — the underlying is the
 *  tradeable signal, so these never enter the universe. */
const WRAPPED_BASES = new Set([
  "WBTC", "WETH", "STETH", "WSTETH", "WEETH", "CBBTC", "WBETH", "RETH",
]);

/** Binance multiplier prefixes for micro-priced perps, longest-first so
 *  1000000MOG doesn't half-strip. "1INCH" is a REAL base, so a bare "1" or
 *  "10" prefix must never be treated as a multiplier. */
const PERP_MULTIPLIERS = ["1000000", "10000", "1000", "1M"];

/**
 * Reverse of binance.ts `yahooToBinancePerp`: Binance USDT-M perp symbol →
 * bare base. Null for non-USDT pairs and dated delivery contracts
 * ("BTCUSDT_260327") — those are not spot-equivalent candidates.
 */
export function binancePerpBase(perpSymbol: string): string | null {
  const s = perpSymbol.toUpperCase();
  if (s.includes("_")) return null; // dated delivery contract
  if (!s.endsWith("USDT")) return null;
  let base = s.slice(0, -4);
  for (const prefix of PERP_MULTIPLIERS) {
    // Only strip when what remains starts with a letter (keeps 1INCH intact).
    if (base.startsWith(prefix) && /^[A-Z]/.test(base.slice(prefix.length))) {
      base = base.slice(prefix.length);
      break;
    }
  }
  if (!base || !/^[A-Z0-9]+$/.test(base)) return null;
  return base;
}

const isDenylisted = (base: string) =>
  STABLECOIN_BASES.has(base) || WRAPPED_BASES.has(base);

/**
 * Crypto candidates: Binance futures ranked by 24h quote volume — where the
 * money actually trades (CoinGecko trending chased attention and was the
 * worst-performing journal cohort). The full ranking is returned; the
 * shortlist window is applied in dedupeCandidates after admin rows drop out.
 * Binance names nothing, so each candidate carries its per-unit last price for
 * the wrong-coin check after Yahoo resolution.
 */
export function rankCryptoCandidates(input: {
  binance24h: BinanceTicker24h[] | null;
}): RawCandidate[] {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();
  const byVolume = [...(input.binance24h ?? [])].sort(
    (a, b) => b.quoteVolume - a.quoteVolume,
  );
  for (const ticker of byVolume) {
    const base = binancePerpBase(ticker.symbol);
    if (!base || seen.has(base) || isDenylisted(base)) continue;
    seen.add(base);
    // 1000PEPEUSDT quotes 1000 coins → divide back to a per-coin price.
    const prefix = ticker.symbol.toUpperCase().slice(0, -4 - base.length);
    const multiplier = prefix === "1M" ? 1e6 : Number(prefix) || 1;
    out.push({
      market: "crypto",
      query: base,
      name: null,
      reason: "binance-volume",
      rank: out.length,
      ...(ticker.lastPrice != null
        ? { sourcePriceUsd: ticker.lastPrice / multiplier }
        : {}),
    });
  }
  return out;
}

/* ── Stock candidate ranking ────────────────────────────────────────────── */

/** US floors: large/mid caps only — a $200M day-gainer is a pump, not a
 *  swing-tradeable signal candidate. Price floor dodges penny-stock churn. */
const US_MIN_MARKET_CAP = 1e9;
const US_MIN_PRICE = 5;

/** IDX floors (IDR): price ≥ 100 skips the 50-rupiah "gocap" zombie zone;
 *  turnover (price × volume) ≥ 50B IDR/day keeps only genuinely liquid names
 *  (raw share volume alone crowns micro-priced churn). */
const ID_MIN_PRICE = 100;
const ID_MIN_TURNOVER = 50e9;

const screenerName = (q: YahooScreenerQuote) =>
  q.shortName ?? q.longName ?? null;

/**
 * US candidates from Yahoo's most_actives screener (sustained volume; the
 * day_gainers "viral today" feed was the worst journal cohort and is retired).
 * EQUITY only — the list mixes in leveraged ETFs (SOXL and friends).
 */
export function rankUsCandidates(input: {
  mostActives: YahooScreenerQuote[] | null;
}): RawCandidate[] {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();
  for (const q of input.mostActives ?? []) {
    const symbol = q.symbol.toUpperCase();
    if (seen.has(symbol)) continue;
    if (q.quoteType !== "EQUITY") continue;
    if ((q.marketCap ?? 0) < US_MIN_MARKET_CAP) continue;
    if ((q.regularMarketPrice ?? 0) < US_MIN_PRICE) continue;
    seen.add(symbol);
    out.push({
      market: "us-stock",
      query: symbol,
      name: screenerName(q),
      reason: "yahoo-most-actives",
      rank: out.length,
    });
  }
  return out;
}

/**
 * IDX candidates from the Yahoo custom screener (region=id, sorted by day
 * volume upstream). Re-ranked here by TURNOVER (price × volume) so a 5000-IDR
 * stock trading 100M shares outranks a 50-IDR stock churning billions.
 */
export function rankIdCandidates(input: {
  mostActives: YahooScreenerQuote[] | null;
}): RawCandidate[] {
  const seen = new Set<string>();
  const eligible = (input.mostActives ?? []).flatMap((q) => {
    const symbol = q.symbol.toUpperCase();
    if (seen.has(symbol) || !symbol.endsWith(".JK")) return [];
    const price = q.regularMarketPrice ?? 0;
    const turnover = price * (q.regularMarketVolume ?? 0);
    if (price < ID_MIN_PRICE || turnover < ID_MIN_TURNOVER) return [];
    seen.add(symbol);
    return [{ q, symbol, turnover }];
  });

  return eligible
    .sort((a, b) => b.turnover - a.turnover)
    .map(({ q, symbol }, rank) => ({
      market: "id-stock" as const,
      query: symbol,
      name: screenerName(q),
      reason: "idx-most-actives" as const,
      rank,
    }));
}

/* ── Crypto base → Yahoo ticker resolution ──────────────────────────────── */

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `^BASE(\d+)?-USD$` — Yahoo dedups crypto ticker collisions with a numeric
 *  suffix (the real Pepe is PEPE24478-USD; the bare PEPE-USD is PEPEGOLD). */
const yahooCryptoPattern = (base: string) =>
  new RegExp(`^${escapeRegExp(base.toUpperCase())}(\\d+)?-USD$`);

const normalizeCoinName = (name: string) =>
  name.replace(/\s+usd$/i, "").trim().toLowerCase();

/**
 * Pick the right Yahoo crypto ticker for a base from search results — the
 * PEPE defense. Only `^BASE(\d+)?-USD$` quotes with quoteType CRYPTOCURRENCY
 * qualify; when the source gave a coin name, an exact name match (shortname/
 * longname minus the trailing " USD") wins over list order. Null when nothing
 * qualifies — an unresolvable coin is SKIPPED, never guessed.
 */
export function pickYahooCryptoSymbol(
  base: string,
  coinName: string | null,
  quotes: YahooSearchQuoteLite[],
): string | null {
  const pattern = yahooCryptoPattern(base);
  const matches = quotes.filter(
    (q) =>
      q.quoteType === "CRYPTOCURRENCY" && pattern.test(q.symbol.toUpperCase()),
  );
  if (matches.length === 0) return null;
  if (coinName) {
    const wanted = normalizeCoinName(coinName);
    const named = matches.find((q) =>
      [q.shortname, q.longname].some(
        (n) => n != null && normalizeCoinName(n) === wanted,
      ),
    );
    if (named) return named.symbol;
  }
  return matches[0].symbol;
}

/* ── Dedup against the existing universe ────────────────────────────────── */

/** The slice of a journal_assets row discovery decisions need. */
export interface ExistingAssetLite {
  symbol: string;
  source: string;
  active: boolean;
  asset_type: string | null;
  last_discovered_at: string | null;
}

/** Match a candidate to an existing row: stocks by exact symbol; crypto by the
 *  same `^BASE(\d+)?-USD$` pattern resolution would use, so "PEPE" recognizes
 *  an already-tracked PEPE24478-USD without a search round-trip. */
function findExisting(
  candidate: RawCandidate,
  existing: ExistingAssetLite[],
): ExistingAssetLite | undefined {
  if (candidate.market !== "crypto") {
    const symbol = candidate.query.toUpperCase();
    return existing.find((a) => a.symbol.toUpperCase() === symbol);
  }
  const pattern = yahooCryptoPattern(candidate.query);
  return existing.find(
    (a) => a.asset_type === "crypto" && pattern.test(a.symbol.toUpperCase()),
  );
}

/**
 * Pre-I/O dedup: split ranked candidates into what needs the (expensive)
 * resolve+validate pipeline vs what just needs a timestamp refresh or a
 * reactivation. Admin rows are silently dropped — rediscovering an asset the
 * admin already manages is a no-op, and an admin-PAUSED asset must stay
 * paused. Only the top `shortlist` NON-admin candidates per market count —
 * admin-owned majors (which top every volume feed) no longer eat the window.
 * `toValidate` is capped at 2× the per-market cap: enough headroom for
 * validation attrition without fetching charts for a whole feed.
 */
export function dedupeCandidates(input: {
  raw: RawCandidate[];
  existing: ExistingAssetLite[];
  maxPerMarket: number;
  shortlist: number;
}): { toValidate: RawCandidate[]; refresh: string[]; reactivate: string[] } {
  const toValidate: RawCandidate[] = [];
  const refresh = new Set<string>();
  const reactivate = new Set<string>();
  const windowPerMarket: Partial<Record<DiscoveryMarket, number>> = {};
  const perMarket: Partial<Record<DiscoveryMarket, number>> = {};
  const shortlistPerMarket = input.maxPerMarket * 2;

  for (const candidate of input.raw) {
    const row = findExisting(candidate, input.existing);
    if (row && row.source !== "auto") continue; // admin-owned → never touched
    const seen = windowPerMarket[candidate.market] ?? 0;
    if (seen >= input.shortlist) continue;
    windowPerMarket[candidate.market] = seen + 1;
    if (row) {
      if (row.active) refresh.add(row.symbol);
      else reactivate.add(row.symbol);
      continue;
    }
    const count = perMarket[candidate.market] ?? 0;
    if (count >= shortlistPerMarket) continue;
    perMarket[candidate.market] = count + 1;
    toValidate.push(candidate);
  }

  return {
    toValidate,
    refresh: [...refresh],
    reactivate: [...reactivate],
  };
}

/* ── Final plan ─────────────────────────────────────────────────────────── */

/** A candidate that survived Yahoo chart validation in the edge function. */
export interface ValidatedCandidate {
  /** Final Yahoo ticker (crypto already resolved via search). */
  symbol: string;
  name: string | null;
  assetType: DiscoveryMarket;
  reason: DiscoveryReason;
}

export interface DiscoveryInsert {
  symbol: string;
  name: string | null;
  asset_type: DiscoveryMarket;
  active: true;
  source: "auto";
  discovery_reason: DiscoveryReason;
  last_discovered_at: string;
  sort_order: null;
  created_by: null;
}

export interface DiscoveryPlan {
  inserts: DiscoveryInsert[];
  reactivate: string[];
  refresh: string[];
  prune: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Assemble the final plan: cap inserts (per market + total auto headroom) and
 * decide prunes. Prune fires only for source='auto' ACTIVE rows whose
 * last_discovered_at went stale, that hold NO open trade, weren't seen this
 * run, and whose market's feed was HEALTHY this run — a dead feed must not
 * slowly drain its whole book. Admin rows can never appear in any list (the
 * edge function re-asserts this with `.eq("source","auto")` guards anyway).
 */
export function planDiscovery(input: {
  validated: ValidatedCandidate[];
  refresh: string[];
  reactivate: string[];
  existing: ExistingAssetLite[];
  openTradeSymbols: string[];
  nowIso: string;
  pruneDays: number;
  maxPerMarket: number;
  maxAutoActive: number;
  prunableMarkets: DiscoveryMarket[];
}): DiscoveryPlan {
  const bySymbol = new Map(
    input.existing.map((a) => [a.symbol.toUpperCase(), a]),
  );
  const refresh = new Set(input.refresh);
  const reactivate = new Set(input.reactivate);

  // Auto-active headroom: reactivations re-enter the active pool, so they
  // consume headroom before any brand-new insert does.
  const activeAutoCount = input.existing.filter(
    (a) => a.source === "auto" && a.active,
  ).length;
  let headroom = Math.max(
    0,
    input.maxAutoActive - activeAutoCount - reactivate.size,
  );

  const inserts: DiscoveryInsert[] = [];
  const perMarket: Partial<Record<DiscoveryMarket, number>> = {};
  const insertedSymbols = new Set<string>();
  for (const v of input.validated) {
    const key = v.symbol.toUpperCase();
    if (insertedSymbols.has(key)) continue;
    // Resolution may land on a symbol that already exists (e.g. a crypto base
    // that resolved onto a tracked ticker the pattern-match missed) — route it
    // to the right bucket instead of inserting a duplicate.
    const row = bySymbol.get(key);
    if (row) {
      if (row.source !== "auto") continue;
      if (row.active) refresh.add(row.symbol);
      else reactivate.add(row.symbol);
      continue;
    }
    const count = perMarket[v.assetType] ?? 0;
    if (count >= input.maxPerMarket || headroom <= 0) continue;
    perMarket[v.assetType] = count + 1;
    headroom--;
    insertedSymbols.add(key);
    inserts.push({
      symbol: v.symbol,
      name: v.name,
      asset_type: v.assetType,
      active: true,
      source: "auto",
      discovery_reason: v.reason,
      last_discovered_at: input.nowIso,
      sort_order: null,
      created_by: null,
    });
  }

  // A row can't be both refreshed and reactivated; reactivation wins (it also
  // refreshes the stamp in the same UPDATE).
  for (const symbol of reactivate) refresh.delete(symbol);

  const now = Date.parse(input.nowIso);
  const cutoff = now - input.pruneDays * DAY_MS;
  const openSet = new Set(input.openTradeSymbols);
  const prunable = new Set<string>(input.prunableMarkets);
  const seenThisRun = new Set([...refresh, ...reactivate, ...insertedSymbols]);
  const prune = input.existing
    .filter(
      (a) =>
        a.source === "auto" &&
        a.active &&
        a.last_discovered_at != null &&
        // An unparseable stamp yields NaN, and NaN < cutoff is false → kept.
        Date.parse(a.last_discovered_at) < cutoff &&
        !openSet.has(a.symbol) &&
        !seenThisRun.has(a.symbol) &&
        !seenThisRun.has(a.symbol.toUpperCase()) &&
        a.asset_type != null &&
        prunable.has(a.asset_type as DiscoveryMarket),
    )
    .map((a) => a.symbol);

  return { inserts, reactivate: [...reactivate], refresh: [...refresh], prune };
}

/* ── Discord broadcast ──────────────────────────────────────────────────── */

/** Human labels for the reason tags (Discord only — the app uses i18n). */
const REASON_LABELS: Record<DiscoveryReason, string> = {
  "coingecko-trending": "CoinGecko Trending",
  "binance-volume": "Binance Futures Volume",
  "yahoo-day-gainers": "Yahoo Day Gainers",
  "yahoo-most-actives": "Yahoo Most Actives",
  "idx-most-actives": "IDX Most Actives",
};

const MARKET_LABELS: Record<DiscoveryMarket, string> = {
  crypto: "CRYPTO",
  "us-stock": "US STOCK",
  "id-stock": "ID STOCK",
};

/**
 * Render a discovery plan into one Discord message: 🔭 new assets (with market +
 * source), ♻️ reactivations and 🍂 prunes, each section split by a divider
 * rule. Returns null when there is no news (a refresh-only run is not worth a
 * ping) so the caller skips the POST.
 */
export function formatDiscoveryForDiscord(plan: DiscoveryPlan): string | null {
  if (
    plan.inserts.length === 0 &&
    plan.reactivate.length === 0 &&
    plan.prune.length === 0
  ) {
    return null;
  }

  const insertBody = plan.inserts
    .map((ins) => {
      const detail = [
        ...(ins.name ? [ins.name] : []),
        `\`${REASON_LABELS[ins.discovery_reason]}\``,
      ].join(" • ");
      return `🆕 **${ins.symbol}** • ${MARKET_LABELS[ins.asset_type]}\n↳ ${detail}`;
    })
    .join("\n\n");
  const listBody = (symbols: string[]) =>
    symbols.map((s) => `**${s}**`).join("\n");

  const sections: string[] = [];
  if (plan.inserts.length > 0) {
    sections.push("🔭 ASET TREN BARU:\n\n" + insertBody);
  }
  if (plan.reactivate.length > 0) {
    sections.push("♻️ KEMBALI DIPANTAU:\n\n" + listBody(plan.reactivate));
  }
  if (plan.prune.length > 0) {
    sections.push(
      "🍂 KELUAR DARI UNIVERSE (tren memudar):\n\n" + listBody(plan.prune),
    );
  }

  let msg = sections.join(`\n\n${DIVIDER}\n\n`);
  if (msg.length > DISCORD_MAX) {
    msg = msg.slice(0, DISCORD_MAX - 20) + "\n… (truncated)";
  }
  return msg;
}
