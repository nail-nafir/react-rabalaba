import { apiClient } from './client';
import type { CalendarEvent, EventImpact } from '@/types/calendar';

/**
 * Economic Calendar API service via Yahoo Finance (Unofficial internal endpoint).
 * Proxy: /api/yahoo/* → https://query1.finance.yahoo.com/*
 */

const BASE_URL = '/api/yahoo/ws/screeners/v1/finance/calendar-events';

interface YahooEconomicRecord {
  event: string;
  countryCode: string;
  eventTime: number; // ms
  actual?: string;
  prior?: string;
  description?: string;
}

interface YahooEconomicDaily {
  records: YahooEconomicRecord[];
}

interface YahooCalendarResponse {
  finance: {
    result: {
      economicEvents: YahooEconomicDaily[];
    };
  };
}

/**
 * Fetch economic calendar events from Yahoo Finance.
 * Defaults to the current month.
 */
export async function fetchEconomicCalendar(): Promise<CalendarEvent[]> {
  try {
    // Calculate current month range
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      modules: 'economicEvents',
      startDate: firstDay.getTime().toString(),
      endDate: lastDay.getTime().toString(),
    });

    const response = await apiClient.get<YahooCalendarResponse>(`${BASE_URL}?${params.toString()}`);
    
    const dailyGroups = response.finance.result?.economicEvents ?? [];
    const flattenedEvents: CalendarEvent[] = [];

    dailyGroups.forEach((group) => {
      group.records.forEach((event, index) => {
        const eventDate = new Date(event.eventTime);
        const dateStr = eventDate.toISOString().split('T')[0];
        const timeStr = eventDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: false,
          timeZoneName: 'short' 
        });

        // Auto impact logic
        let impact: EventImpact = 'medium';
        const titleLower = event.event.toLowerCase();
        if (titleLower.includes('gdp') || titleLower.includes('cpi') || titleLower.includes('interest rate') || titleLower.includes('fed')) {
          impact = 'high';
        } else if (titleLower.includes('sentiment') || titleLower.includes('sales') || titleLower.includes('pmi')) {
          impact = 'low';
        }

        flattenedEvents.push({
          id: `yh-${index}-${event.eventTime}-${event.countryCode}`,
          title: event.event,
          country: event.countryCode, // Use raw 2-letter code from API
          date: dateStr,
          time: timeStr,
          impact: impact,
          category: 'Economic',
          forecast: 'N/A',
          previous: event.prior || 'N/A',
          actual: event.actual || 'N/A',
          assetRelevance: ['stocks', 'crypto', 'commodities'],
          description: event.description || `Economic data release for ${event.countryCode}: ${event.event}`,
        });
      });
    });
    
    return flattenedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('Failed to fetch Yahoo economic calendar:', error);
    return [];
  }
}
