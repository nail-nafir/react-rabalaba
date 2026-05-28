import { useQuery } from '@tanstack/react-query';
import { fetchEconomicCalendar } from '@/services/api/calendar';

/**
 * Hook to fetch economic calendar data.
 */
export function useEconomicCalendar() {
  return useQuery({
    queryKey: ['economic-calendar'],
    queryFn: fetchEconomicCalendar,
    staleTime: 3600_000, // 1 hour
    refetchInterval: 3600_000,
  });
}
