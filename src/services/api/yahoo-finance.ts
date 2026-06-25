/**
 * Yahoo Finance API service via Vite proxy.
 * Proxy: /api/yahoo/* → https://query1.finance.yahoo.com/*
 */

const BASE_URL = "/api/yahoo";

export interface TradingPeriod {
  timezone: string;
  start: number;
  end: number;
  gmtoffset: number;
}

export interface YahooChartMeta {
  currency?: string;
  symbol: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  firstTradeDate?: number;
  regularMarketTime?: number;
  hasPrePostMarketData?: boolean;
  gmtoffset?: number;
  timezone?: string;
  exchangeTimezoneName?: string;
  regularMarketPrice: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  longName?: string;
  shortName?: string;
  chartPreviousClose: number;
  previousClose?: number;
  regularMarketPreviousClose?: number;
  scale?: number;
  priceHint?: number;
  currentTradingPeriod?: {
    pre: TradingPeriod;
    regular: TradingPeriod;
    post: TradingPeriod;
  };
  tradingPeriods?: TradingPeriod[][];
  dataGranularity?: string;
  range?: string;
  validRanges?: string[];
}

export interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: Array<{
      close: (number | null)[];
      volume: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      open: (number | null)[];
    }>;
  };
}

export interface YahooSearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
  typeDisp?: string;
}

export interface YahooSearchResult {
  quotes: YahooSearchQuote[];
}

/**
 * Fetch chart data (OHLCV) for a single symbol.
 * Default range is 1 month with 1-hour intervals.
 */
export async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string,
): Promise<YahooChartResult | null> {
  const url = `${BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Yahoo Finance chart error: ${response.status}`);
  }

  const data = await response.json();
  return data?.chart?.result?.[0] ?? null;
}

/** A Yahoo numeric field — quoteSummary wraps numbers as { raw, fmt }. */
interface YahooRaw {
  raw?: number;
  fmt?: string;
}

/** Raw quoteSummary (v10) modules we request — a subset. Every field is
 *  optional: Yahoo omits modules it can't serve, and the v10 endpoint is
 *  sometimes gated behind a crumb, so all consumers must degrade gracefully. */
export interface YahooQuoteSummaryResult {
  summaryDetail?: {
    trailingPE?: YahooRaw;
    beta?: YahooRaw;
    dividendYield?: YahooRaw;
  };
  defaultKeyStatistics?: {
    trailingEps?: YahooRaw;
    priceToBook?: YahooRaw;
    forwardPE?: YahooRaw;
  };
  financialData?: {
    debtToEquity?: YahooRaw;
    recommendationKey?: string;
    targetMeanPrice?: YahooRaw;
    currentPrice?: YahooRaw;
  };
  recommendationTrend?: {
    trend?: Array<{
      period?: string;
      strongBuy?: number;
      buy?: number;
      hold?: number;
      sell?: number;
      strongSell?: number;
    }>;
  };
  calendarEvents?: {
    earnings?: {
      earningsDate?: YahooRaw[];
    };
  };
}

const QUOTE_SUMMARY_MODULES = [
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "recommendationTrend",
  "calendarEvents",
].join(",");

/**
 * Fetch fundamentals + analyst data (quoteSummary v10) for one symbol. Slow-
 * moving data — cache it for hours. Returns null when unavailable (the v10
 * endpoint is gated behind a crumb on some Yahoo edges) so every caller stays
 * graceful: no fundamentals simply means no fundamental overlay, never an error.
 */
export async function fetchYahooQuoteSummary(
  symbol: string,
): Promise<YahooQuoteSummaryResult | null> {
  const url = `${BASE_URL}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${QUOTE_SUMMARY_MODULES}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null; // network/CORS/proxy down → graceful
  }
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  return data?.quoteSummary?.result?.[0] ?? null;
}

/**
 * Search for assets by keyword (symbol or name).
 */
export async function searchYahooAssets(
  query: string,
): Promise<YahooSearchQuote[]> {
  if (!query || query.length < 2) return [];

  const url = `${BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data?.quotes ?? [];
}
