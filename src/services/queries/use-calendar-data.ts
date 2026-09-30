import { useQuery } from '@tanstack/react-query';
import { fetchEconomicCalendar } from '@/services/api/calendar';
import { CALENDAR_FRESH_MS } from '@/features/economic-calendar/model/calendar';

export function useEconomicCalendar(month: string) {
  return useQuery({
    queryKey: ['economic-calendar', month],
    queryFn: () => fetchEconomicCalendar(month),
    // Keep both explicit; the app defaults to five-minute polling.
    staleTime: CALENDAR_FRESH_MS,
    refetchInterval: CALENDAR_FRESH_MS,
  });
}
