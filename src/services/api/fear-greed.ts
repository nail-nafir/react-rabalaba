import { apiClient } from './client';

const BASE_URL = '/api/fng';

export interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

export async function fetchFearGreedIndex(): Promise<FearGreedResponse> {
  return apiClient.get<FearGreedResponse>(`${BASE_URL}/fng/?limit=2`);
}
