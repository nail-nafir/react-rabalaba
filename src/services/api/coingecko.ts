import { apiClient } from "./client";
import type { Dominance } from "@/types/market";

const BASE_URL = "https://api.coingecko.com";

interface CoinGeckoGlobalResponse {
  data?: {
    market_cap_percentage?: Record<string, number>;
  };
}

/**
 * Market dominance from CoinGecko's free `/global` endpoint (no key). Returns
 * the factual BTC/ETH share of total crypto market cap. Alt-season is a
 * performance comparison `/global` cannot provide, so it is intentionally left
 * undefined rather than fabricated.
 */
export async function fetchDominance(): Promise<Dominance> {
  const res = await apiClient.get<CoinGeckoGlobalResponse>(
    `${BASE_URL}/api/v3/global`,
  );
  const pct = res.data?.market_cap_percentage ?? {};
  return {
    btc: Number.isFinite(pct.btc) ? pct.btc : 0,
    eth: Number.isFinite(pct.eth) ? pct.eth : 0,
  };
}
