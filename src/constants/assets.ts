/** Default/seed ticker universes per asset class. The asset-type taxonomy
 *  (values, label keys, options) lives in @/constants/taxonomy/asset.
 *
 *  NOTE: the premium crypto/US/ID universes are NOT here anymore — they're
 *  admin-managed in the `journal_assets` DB table (single source with the cron;
 *  see use-screener-universe / use-journal-assets). These DEFAULT_* lists are the
 *  free-tier universe + the fallback when the DB is unreadable. Commodity & forex
 *  stay constant-driven everywhere (screener + cron). */
export const DEFAULT_CRYPTO_TICKERS = [
  "BTC-USD",
  "ETH-USD",
  "BNB-USD",
  "SOL-USD",
  "XRP-USD",
];

export const DEFAULT_US_STOCK_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
];

export const DEFAULT_ID_STOCK_TICKERS = [
  "BBCA.JK",
  "BBRI.JK",
  "BMRI.JK",
  "TLKM.JK",
  "ASII.JK",
  "BBNI.JK",
  "UNVR.JK",
  "ANTM.JK",
];

export const DEFAULT_COMMODITY_TICKERS = [
  "GC=F", // Gold
  "SI=F", // Silver
  "CL=F", // Crude Oil
  "NG=F", // Natural Gas
  "HG=F", // Copper
];

export const DEFAULT_FOREX_TICKERS = [
  "EURUSD=X",
  "GBPUSD=X",
  "USDJPY=X",
  "AUDUSD=X",
  "USDCAD=X",
  "USDCHF=X",
  "USDIDR=X",
  "SGDIDR=X",
  "JPYIDR=X",
  "CNYIDR=X",
  "KRWIDR=X",
  "EURIDR=X",
];

export const MARKET_INDICES = [
  { symbol: "^JKSE", name: "IHSG", region: "id" },
  { symbol: "^GSPC", name: "S&P 500", region: "us" },
  { symbol: "^IXIC", name: "NASDAQ", region: "us" },
  { symbol: "^DJI", name: "Dow Jones", region: "us" },
  { symbol: "^N225", name: "Nikkei", region: "asia" },
  { symbol: "^KS11", name: "KOSPI", region: "asia" },
  { symbol: "BTC-USD", name: "BTC-USD", region: "global" },
  { symbol: "ETH-USD", name: "ETH-USD", region: "global" },
  { symbol: "GC=F", name: "Gold", region: "global" },
  { symbol: "SI=F", name: "Silver", region: "global" },
  { symbol: "CL=F", name: "Crude Oil", region: "global" },
  { symbol: "DX-Y.NYB", name: "DXY", region: "global" },
];
