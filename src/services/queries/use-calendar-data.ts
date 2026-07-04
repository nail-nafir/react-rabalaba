import { useQuery } from '@tanstack/react-query';
import { fetchEconomicCalendar } from '@/services/api/calendar';

/**
 * Hook to fetch economic calendar data.
 */
export function useEconomicCalendar() {
  return useQuery({
    queryKey: ['economic-calendar'],
    queryFn: fetchEconomicCalendar,
    // Actuals (CPI, NFP, etc.) fill in intraday, so this is "customizable" data —
    // aligned to the signal cadence (30 min). /calendar is only mounted on visit;
    // the component unmounts on navigate away, so the poll auto-stops (cheap).
    // NOTE: both must stay set — omitting them inherits the global 5 min defaults.
    staleTime: 1_800_000, // 30 minutes
    refetchInterval: 1_800_000, // 30 minutes (poll only runs while the page is open)
  });
}
