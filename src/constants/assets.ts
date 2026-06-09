import type { AssetFilterType } from "@/types/asset";

export const ASSET_TYPE_LABELS: Record<AssetFilterType, string> = {
  all: "All Assets",
  favorite: "Favorites",
  crypto: "Crypto",
  "us-stock": "U.S Stocks",
  "id-stock": "Indonesia Stocks",
  commodity: "Commodities",
  forex: "Forex",
};

export const ASSET_TYPE_OPTIONS = [
  { value: "all" as const, label: "All Assets" },
  { value: "crypto" as const, label: "Crypto" },
  { value: "us-stock" as const, label: "U.S Stocks" },
  { value: "id-stock" as const, label: "ID Stocks" },
  { value: "commodity" as const, label: "Commodities" },
  { value: "forex" as const, label: "Forex" },
];

export const DEFAULT_CRYPTO_TICKERS = [
  "BTC-USD",
  "ETH-USD",
  "BNB-USD",
  "SOL-USD",
  "XRP-USD",
];

export const TOP_CRYPTO_TICKERS = [
  "BTC-USD",
  "ETH-USD",
  "BNB-USD",
  "SOL-USD",
  "DOGE-USD",
  "SHIB-USD",
  "ZEC-USD",
  "WLD-USD",
  "HYPE32196-USD",
  "SUI20947-USD",
  "TON11419-USD",
  "FET-USD",
  "ONDO-USD",
  "SEI-USD",
  "RENDER-USD",
  "UNI7083-USD",
  "PENGU34466-USD",
  "GMT18069-USD",
  "ENA-USD",
  "PENDLE-USD",
  "ARKM-USD",
  "OP-USD",
  "TIA-USD",
  "ARB11841-USD",
  "JTO-USD",
  "JUP29210-USD",
  "SKYAI-USD",
  "RAY-USD",
  "EIGEN-USD",
  "QNT-USD",
  "S32684-USD",
  "MYX36410-USD",
  "INJ-USD",
  "LINK-USD",
  "PEPE24478-USD",
  "MORPHO34104-USD",
  "XRP-USD",
  "TRX-USD",
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

export const TOP_US_STOCK_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "TSM",
  "INTC",
  "AMD",
  "META",
  "MSTR",
  "PLTR",
  "HOOD",
  "MU",
  "JPM",
  "NOK",
  "TSLA",
  "QCOM",
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

export const TOP_ID_STOCK_TICKERS = [
  "BBCA.JK",
  "BBRI.JK",
  "BMRI.JK",
  "DCII.JK",
  "TLKM.JK",
  "BRPT.JK",
  "BREN.JK",
  "PTRO.JK",
  "TPIA.JK",
  "CUAN.JK",
  "CDIA.JK",
  "BUMI.JK",
  "BRMS.JK",
  "ENRG.JK",
  "DEWA.JK",
  "BNBR.JK",
  "VKTR.JK",
  "RAJA.JK",
  "RATU.JK",
  "MINA.JK",
  "UANG.JK",
  "BUVA.JK",
  "MORA.JK",
  "PANI.JK",
  "EMAS.JK",
  "ANTM.JK",
  "BRIS.JK",
  "DSSA.JK",
  "UNVR.JK",
  "ADRO.JK",
  "ADMR.JK",
  "MDKA.JK",
  "GOTO.JK",
  "SUPA.JK",
  "WBSA.JK",
  "RLCO.JK",
  "COIN.JK",
  "SINI.JK",
  "BUKA.JK",
  "BKSL.JK",
  "ARTO.JK",
  "KETR.JK",
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
