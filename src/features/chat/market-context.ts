import type { MarketResearchContext } from "./terminal-context";

export function refreshMarketContext(context: MarketResearchContext) {
  return {
    ...context,
    stale:
      context.stale ||
      Date.now() - (context.quoteTime ?? context.capturedAt) >
        (context.assetType === "crypto" ? 6 : 72) * 60 * 60_000,
  };
}
