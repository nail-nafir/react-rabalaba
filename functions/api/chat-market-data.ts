import { TIMEFRAME_PRESETS, canonicalTimeframe } from "../../src/constants/timeframes";
import { normalizeYahooCandles, resampleCandles } from "../../src/core/market/candles";
import { adaptYahooChart } from "../../src/services/adapters/yahoo-adapter";
import type {
  YahooChartResult,
  YahooSearchQuote,
} from "../../src/services/api/yahoo-finance";
import {
  MAX_RESEARCH_CONTEXT_CANDLES,
  type MarketResearchContext,
} from "../../src/features/chat/terminal-context";

const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestedTimeframe(value?: string) {
  const normalized = value?.toLowerCase() ?? "";
  if (/scalp|5m|5min/.test(normalized)) return "scalp";
  if (/position|daily|1d|day/.test(normalized)) return "position";
  return canonicalTimeframe(normalized);
}

function resampleFactor(value?: string, preset: string = "swing") {
  const match = value?.toLowerCase().match(/^(\d+)\s*(m|min|h|hr)$/);
  if (!match) return 1;
  const count = Number(match[1]);
  const baseMinutes = preset === "scalp" ? 5 : preset === "position" ? 1_440 : 60;
  const requestedMinutes = count * (match[2]!.startsWith("h") ? 60 : 1);
  return requestedMinutes > baseMinutes && requestedMinutes % baseMinutes === 0
    ? requestedMinutes / baseMinutes
    : 1;
}

function staleAfterMs(assetType: string) {
  return (assetType === "crypto" ? 6 : 72) * 60 * 60_000;
}

async function yahooJson(url: URL, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": YAHOO_USER_AGENT },
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  });
  if (!response.ok) throw new Error(`Yahoo Finance returned ${response.status}`);
  return response.json();
}

async function searchYahoo(query: string, signal: AbortSignal) {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query);
  url.searchParams.set("quotesCount", "10");
  url.searchParams.set("newsCount", "0");
  url.searchParams.set("enableFuzzyQuery", "false");
  const data = await yahooJson(url, signal);
  const quotes = isRecord(data) && Array.isArray(data.quotes) ? data.quotes : [];
  return quotes.filter(
    (quote): quote is YahooSearchQuote =>
      isRecord(quote) &&
      typeof quote.symbol === "string" &&
      /^[A-Za-z0-9._^=-]{1,64}$/.test(quote.symbol) &&
      [quote.shortname, quote.longname].every((name) => name == null || typeof name === "string"),
  );
}

function resolveQuote(query: string, quotes: YahooSearchQuote[]) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = normalize(query.replace(/^\$/, ""));
  const exactSymbol = quotes.filter((quote) => normalize(quote.symbol) === wanted);
  if (exactSymbol.length === 1) return { quote: exactSymbol[0], candidates: [] };

  const usdPair = quotes.filter((quote) => normalize(quote.symbol) === `${wanted}-usd`);
  if (usdPair.length === 1) return { quote: usdPair[0], candidates: [] };

  const exactName = quotes.filter((quote) =>
    [quote.shortname, quote.longname].some((name) => name && normalize(name) === wanted),
  );
  if (exactName.length === 1) return { quote: exactName[0], candidates: [] };

  const prefixName = quotes.filter((quote) =>
    [quote.shortname, quote.longname].some(
      (name) => name && normalize(name).startsWith(`${wanted} `),
    ),
  );
  if (prefixName.length === 1) return { quote: prefixName[0], candidates: [] };

  const possible = quotes.filter((quote) => {
    const symbol = normalize(quote.symbol);
    return (
      symbol.startsWith(`${wanted}-`) ||
      symbol.startsWith(`${wanted}=`) ||
      [quote.shortname, quote.longname].some(
        (name) => name && normalize(name).startsWith(`${wanted} `),
      )
    );
  });
  const candidates = [...new Map(
    possible.map((quote) => [quote.symbol, {
      symbol: quote.symbol,
      name: quote.longname || quote.shortname || quote.symbol,
    }]),
  ).values()].slice(0, 5);
  return { quote: null, candidates };
}

async function fetchChart(symbol: string, range: string, interval: string, signal: AbortSignal) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("includePrePost", "false");
  const data = await yahooJson(url, signal);
  const chart = isRecord(data) && isRecord(data.chart) ? data.chart : null;
  const result = chart && Array.isArray(chart.result) ? chart.result[0] : null;
  if (!isRecord(result) || !isRecord(result.meta) || !Array.isArray(result.timestamp)) {
    return null;
  }
  return result as unknown as YahooChartResult;
}

async function resolveMarketContext(
  query: string,
  timeframe: string | undefined,
  signal: AbortSignal,
): Promise<{ status: string; context?: MarketResearchContext; candidates?: unknown[] }> {
  try {
    const resolved = resolveQuote(query, await searchYahoo(query, signal));
    if (!resolved.quote) {
      return {
        status: resolved.candidates.length ? "ambiguous" : "not_found",
        candidates: resolved.candidates,
      };
    }

    const presetKey = requestedTimeframe(timeframe);
    const preset = TIMEFRAME_PRESETS[presetKey];
    const result = await fetchChart(resolved.quote.symbol, preset.range, preset.interval, signal);
    const asset = adaptYahooChart(result);
    if (!asset?.quoteIndicators || !asset.timestamps?.length || !Number.isFinite(asset.price) || asset.price <= 0) {
      return { status: "unavailable" };
    }

    const candles = resampleCandles(
      normalizeYahooCandles(asset.quoteIndicators, asset.timestamps),
      resampleFactor(timeframe, presetKey),
    ).slice(-MAX_RESEARCH_CONTEXT_CANDLES);
    if (candles.length < 2) return { status: "insufficient_data" };

    const quoteTime = asset.quoteTime ?? candles.at(-1)!.timestamp * 1_000;
    const capturedAt = Date.now();
    return {
      status: "ok",
      context: {
        source: "Yahoo Finance",
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        price: asset.price,
        changePercent: asset.changePercent,
        quoteTime,
        capturedAt,
        stale: capturedAt - quoteTime > staleAfterMs(asset.assetType),
        timeframe: timeframe || presetKey,
        signalStatus: asset.outlook?.signal,
        outlook: asset.outlook,
        tradingPlan: asset.tradingPlan,
        recentCandles: candles,
      },
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return { status: "unavailable" };
  }
}

export async function lookupMarketData(
  args: unknown,
  timeframe: string | undefined,
  signal: AbortSignal,
) {
  if (
    !isRecord(args) ||
    Object.keys(args).some((key) => key !== "queries") ||
    !Array.isArray(args.queries) ||
    args.queries.length < 1 ||
    args.queries.length > 3 ||
    !args.queries.every(
      (query) =>
        typeof query === "string" &&
        /^[\p{L}\p{N} $.'^=_/-]{2,64}$/u.test(query.trim()),
    )
  ) {
    return {
      result: { error: "Market lookup requires one to three valid asset names or symbols." },
      contexts: [] as MarketResearchContext[],
    };
  }

  const queries = [...new Set((args.queries as string[]).map((query) => query.trim()))];
  const results = await Promise.all(
    queries.map((query) => resolveMarketContext(query, timeframe, signal)),
  );
  return {
    result: {
      source: "Yahoo Finance",
      results: queries.map((query, index) => ({ query, ...results[index] })),
    },
    contexts: results.flatMap((result) => result.context ? [result.context] : []),
  };
}
