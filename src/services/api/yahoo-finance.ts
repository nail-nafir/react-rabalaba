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
