export type EventImpact = 'high' | 'medium' | 'low';
export type EventAssetRelevance = 'stocks' | 'crypto' | 'commodities';
export type CalendarSource = 'bls' | 'bea' | 'fed' | 'yahoo';

export interface CalendarSourceState {
  source: CalendarSource;
  status: 'ok' | 'partial' | 'unavailable';
  stale: boolean;
  checkedAt: number | null;
}

export interface CalendarData {
  events: CalendarEvent[];
  sources: CalendarSourceState[];
}

export interface CalendarSourceResponse {
  events: CalendarEvent[];
  checkedAt: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  /** UTC milliseconds; null when the source only announces a date. */
  timestamp: number | null;
  source: CalendarSource;
  sourceUrl: string;
  impact: EventImpact;
  category: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  assetRelevance: EventAssetRelevance[];
  description?: string;
}
