import { useMemo } from "react";
import { useMarketData } from "./use-market-data";
import { deriveCryptoContext } from "@/core/engine/crypto-context";
import { computeWindowReturns } from "@/core/engine/relative-strength";
import {
  normalizeYahooCandles,
  resampleCandlesToDaily,
} from "@/core/market/candles";
import { useCryptoDominance } from "./use-crypto-dominance";

/** BTC is the macro driver for the crypto card. */
const BTC_SYMBOLS = ["BTC-USD"];

/**
 * Compute the shared top-down CryptoContext once (BTC regime/trend/score).
 * Reuses the full per-asset pipeline (adaptYahooChart → computeSignal) on BTC,
 * so the context's regime classification stays identical to what the engine
 * produces everywhere else. Consumed by the screener (de-rate + rank), the
 * market summary row, and the detail dialog.
 */
export function useCryptoContext() {
  // Dominance is optional context — fetched separately and cached longer. If it
  // fails (rate limit / unavailable) the context simply omits it (graceful).
  const { data: dominance } = useCryptoDominance();

  const market = useMarketData(BTC_SYMBOLS);
  const btc = market.data[0];
  const btcReturns = useMemo(
    () =>
      btc
        ? computeWindowReturns(
            resampleCandlesToDaily(
              normalizeYahooCandles(btc.quoteIndicators, btc.timestamps),
            ).map((c) => c.close),
          )
        : undefined,
    [btc],
  );
  const data = useMemo(
    () =>
      btc?.outlook
        ? deriveCryptoContext(btc.outlook, dominance ?? undefined, btcReturns)
        : null,
    [btc, dominance, btcReturns],
  );
  return { ...market, data };
}
