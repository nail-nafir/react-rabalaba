import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    // 5-min cadence app-wide: this is a 1h-swing tool (data only meaningfully
    // changes on the hour), so a 60s poll just re-rendered/churned views (the
    // journal table felt like it "refreshed" on every paginate) for no fresher
    // data. Live floating P/L still updates — just every 5 min instead of every
    // minute. Tighten per-query where a view genuinely needs to be more live.
    queries: {
      staleTime: 300_000,
      refetchInterval: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
      gcTime: 5 * 60_000,
    },
  },
});
