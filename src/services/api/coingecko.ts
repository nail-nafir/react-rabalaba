import { apiClient } from "./client";
import type { Dominance } from "@/types/market";

const BASE_URL = "https://api.coingecko.com";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstMarket(payload: unknown): UnknownRecord | null {
  if (!Array.isArray(payload) || !isRecord(payload[0])) return null;
  return payload[0];
}

/**
 * Validate CoinGecko payloads and derive BTC dominance's relative 24-hour
 * change. Kept pure so payload edge cases can be tested without network mocks.
 */
export function adaptCoinGeckoDominance(
  globalPayload: unknown,
  bitcoinMarketsPayload?: unknown,
): Dominance | null {
  if (!isRecord(globalPayload) || !isRecord(globalPayload.data)) return null;

  const data = globalPayload.data;
  const percentages = data.market_cap_percentage;
  const totalMarketCap = data.total_market_cap;
  if (!isRecord(percentages) || !isRecord(totalMarketCap)) return null;

  const btc = finiteNumber(percentages.btc);
  const eth = finiteNumber(percentages.eth);
  const totalMarketCapUsd = finiteNumber(totalMarketCap.usd);
  const updatedAtSeconds = finiteNumber(data.updated_at);
  const updatedAt = updatedAtSeconds === null ? null : updatedAtSeconds * 1000;

  if (
    btc === null ||
    eth === null ||
    totalMarketCapUsd === null ||
    updatedAtSeconds === null ||
    updatedAt === null ||
    btc <= 0 ||
    eth <= 0 ||
    btc > 100 ||
    eth > 100 ||
    btc + eth > 100 ||
    totalMarketCapUsd <= 0 ||
    updatedAtSeconds <= 0 ||
    !Number.isFinite(updatedAt)
  ) {
    return null;
  }

  const snapshot: Dominance = {
    btc,
    eth,
    updatedAt,
  };

  const bitcoinMarket = firstMarket(bitcoinMarketsPayload);
  const bitcoinMarketCapUsd = finiteNumber(bitcoinMarket?.market_cap);
  const bitcoinMarketCapChange = finiteNumber(
    bitcoinMarket?.market_cap_change_percentage_24h,
  );
  const totalMarketCapChange = finiteNumber(
    data.market_cap_change_percentage_24h_usd,
  );

  if (
    bitcoinMarketCapUsd === null ||
    bitcoinMarketCapChange === null ||
    totalMarketCapChange === null ||
    bitcoinMarketCapUsd <= 0 ||
    bitcoinMarketCapUsd > totalMarketCapUsd
  ) {
    return snapshot;
  }

  const bitcoinChangeFactor = 1 + bitcoinMarketCapChange / 100;
  const totalChangeFactor = 1 + totalMarketCapChange / 100;
  if (bitcoinChangeFactor <= 0 || totalChangeFactor <= 0) return snapshot;

  const previousBitcoinMarketCap = bitcoinMarketCapUsd / bitcoinChangeFactor;
  const previousTotalMarketCap = totalMarketCapUsd / totalChangeFactor;
  const previousDominance =
    (previousBitcoinMarketCap / previousTotalMarketCap) * 100;
  const changePercent = (btc / previousDominance - 1) * 100;

  if (
    previousDominance > 0 &&
    previousDominance <= 100 &&
    Number.isFinite(changePercent)
  ) {
    snapshot.btcDominanceChangePercent24h = changePercent;
  }

  return snapshot;
}

/**
 * Browser-direct CoinGecko requests intentionally use the visitor's IP. The
 * global payload is required; Bitcoin market data is optional so current BTC.D
 * remains available when the supporting 24-hour payload fails.
 */
export async function fetchDominance(): Promise<Dominance> {
  const [globalPayload, bitcoinMarketsPayload] = await Promise.all([
    apiClient.get<unknown>(`${BASE_URL}/api/v3/global`),
    apiClient
      .get<unknown>(
        `${BASE_URL}/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&price_change_percentage=24h`,
      )
      .catch(() => undefined),
  ]);

  const snapshot = adaptCoinGeckoDominance(
    globalPayload,
    bitcoinMarketsPayload,
  );
  if (!snapshot) {
    throw new Error("CoinGecko returned an invalid global market snapshot");
  }

  return snapshot;
}
