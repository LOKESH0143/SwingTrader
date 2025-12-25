import { Candle } from '../lib/types';

export async function fetchHistory(symbol: string, range: '6m' | '1y' | '2y' | '5y' = '1y'): Promise<Candle[]> {
  console.log(`[API] Fetching history for ${symbol} (${range})...`);
  try {
    const response = await fetch(`/api/history/${symbol}?range=${range}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Error fetching ${symbol}:`, response.status, errorText);
      throw new Error(`Failed to fetch history for ${symbol}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`[API] Success ${symbol}: ${data.length} candles`);
    return data;
  } catch (error) {
    console.error(`[API] Network error for ${symbol}:`, error);
    throw error;
  }
}
