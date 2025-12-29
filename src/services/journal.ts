import { JournalTrade } from '../lib/types';

export const journalService = {
  async getTrades(): Promise<JournalTrade[]> {
    const res = await fetch(`/api/journal?t=${Date.now()}`);
    return res.json();
  },

  async addTrade(trade: Omit<JournalTrade, 'id'>): Promise<JournalTrade> {
    const id = crypto.randomUUID();
    const res = await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...trade, id }),
    });
    const data = await res.json();
    return data.trade;
  },

  async updateTrade(trade: JournalTrade): Promise<JournalTrade> {
    const res = await fetch(`/api/journal/${trade.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });
    const data = await res.json();
    return data.trade;
  },

  async deleteTrade(id: string): Promise<void> {
    // Try POST method which is more robust against URL issues
    const res = await fetch('/api/journal/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    if (!res.ok) {
        // Fallback to DELETE if POST fails (unlikely)
        const res2 = await fetch(`/api/journal/${id}`, { method: 'DELETE' });
        if (!res2.ok) throw new Error("Failed to delete trade");
    }
  },

  async clearAll(): Promise<void> {
    await fetch('/api/journal/clear', { method: 'POST' });
  }
};
