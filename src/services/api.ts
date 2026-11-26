import { Candle } from '../lib/types';

export async function fetchHistory(symbol: string, range: '6m' | '1y' | '2y' | '5y' = '1y', forceRefresh = false, diagnostics = false): Promise<any> {
  try {
    const diagParam = diagnostics ? '&diagnostics=true' : '';
    const response = await fetch(`/api/history/${encodeURIComponent(symbol)}?range=${range}&force=${forceRefresh}${diagParam}`);
    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;
      try {
        const json = JSON.parse(errorText);
        if (json.details) errorDetails = json.details;
      } catch (e) {}

      console.warn(`[API] Error fetching ${symbol}:`, response.status, errorDetails);
      
      // Dispatch Error Event
      window.dispatchEvent(new CustomEvent('api-status-change', { 
        detail: { status: 'error', message: `API Error: ${response.status}` } 
      }));
      
      throw new Error(errorDetails);
    }
    
    // Dispatch Success Event
    window.dispatchEvent(new CustomEvent('api-status-change', { 
      detail: { status: 'connected', message: 'Connected' } 
    }));

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`[API] Network error for ${symbol}:`, error);
    
    // Dispatch Network Error Event
    window.dispatchEvent(new CustomEvent('api-status-change', { 
      detail: { status: 'error', message: 'Network Error' } 
    }));
    
    return []; // Return empty array on network error
  }
}
