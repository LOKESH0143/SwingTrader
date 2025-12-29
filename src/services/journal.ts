import { JournalTrade } from '../lib/types';

export const journalService = {
  async getTrades(): Promise<JournalTrade[]> {
    // Add timestamp to prevent caching
    const res = await fetch(`/api/journal?t=${Date.now()}`);
    if (!res.ok) throw new Error("Failed to fetch trades");
    return res.json();
  },

  async addTrade(trade: Omit<JournalTrade, 'id'>): Promise<JournalTrade> {
    // Generate ID here to ensure it exists before sending
    const payload = { ...trade, id: crypto.randomUUID() }; 
    
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) throw new Error("Failed to add trade");
    
    const data = await res.json();
    return data.trade || data; 
  },

  async updateTrade(trade: JournalTrade): Promise<JournalTrade> {
    const res = await fetch(`/api/journal/${trade.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    
    if (!res.ok) throw new Error("Failed to update trade");
    
    const data = await res.json();
    return data.trade || data;
  },

  async deleteTrade(id: string): Promise<void> {
    if (!id) throw new Error("Cannot delete trade with missing ID");

    // Standard REST DELETE request
    const res = await fetch(`/api/journal/${id}`, { 
      method: 'DELETE' 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to delete trade: ${errorText}`);
    }
  },

  async clearAll(): Promise<void> {
    await fetch('/api/journal/clear', { method: 'POST' });
  }
};
