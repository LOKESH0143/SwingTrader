import { Candle } from '../lib/types';

export async function fetchHistory(symbol: string, range: '6m' | '1y' | '2y' | '5y' = '1y'): Promise<Candle[]> {
  try {
    const response = await fetch(`/api/history/${symbol}?range=${range}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[API] Error fetching ${symbol}:`, response.status, errorText);
      return []; // Return empty array on error
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`[API] Network error for ${symbol}:`, error);
    return []; // Return empty array on network error
  }
}
