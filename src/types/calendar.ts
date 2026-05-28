export type EventImpact = 'high' | 'medium' | 'low';
export type EventAssetRelevance = 'stocks' | 'crypto' | 'commodities';

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  time: string;
  impact: EventImpact;
  category: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  assetRelevance: EventAssetRelevance[];
  description?: string;
}
