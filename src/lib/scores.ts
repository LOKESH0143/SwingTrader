import { StrategyScore } from './types';

export async function getStrategyScores(): Promise<Record<string, StrategyScore>> {
  try {
    const res = await fetch('/api/scores', { cache: 'no-cache' });
    if (!res.ok) return {};
    return res.json();
  } catch (e) {
    console.error("Failed to load strategy scores", e);
    return {};
  }
}

export async function saveStrategyScores(scores: Record<string, StrategyScore>) {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scores),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `Server responded with ${res.status}`);
    }
  } catch (e: any) {
    console.error("saveStrategyScores failed:", e);
    throw e;
  }
}

export async function updateStrategyScore(
  strategyId: string, 
  pnl: number, 
  winRate: number, 
  trades: number,
  holdDays: number,
  mode: 'avg' | 'recent'
) {
  try {
    const scores = await getStrategyScores();
    const current = scores[strategyId] || {
      strategyId,
      avgPnL: 0,
      avgWinRate: 0,
      avgTrades: 0,
      avgHoldDays: 0,
      recentPnL: 0,
      recentWinRate: 0,
      recentTrades: 0,
      recentHoldDays: 0
    };

    if (mode === 'avg') {
      current.avgPnL = pnl;
      current.avgWinRate = winRate;
      current.avgTrades = trades;
      current.avgHoldDays = holdDays;
      current.lastUpdatedAvg = new Date().toISOString();
    } else {
      current.recentPnL = pnl;
      current.recentWinRate = winRate;
      current.recentTrades = trades;
      current.recentHoldDays = holdDays;
      current.lastUpdatedRecent = new Date().toISOString();
    }

    scores[strategyId] = current;
    await saveStrategyScores(scores);
  } catch (e) {
    console.error("Failed to update strategy score", e);
  }
}

export async function bulkUpdateStrategyScores(
  updates: {
    strategyId: string;
    pnl: number;
    winRate: number;
    trades: number;
    holdDays: number;
  }[],
  mode: 'avg' | 'recent'
) {
  try {
    const scores = await getStrategyScores();
    const now = new Date().toISOString();

    for (const update of updates) {
      const current = scores[update.strategyId] || {
        strategyId: update.strategyId,
        avgPnL: 0,
        avgWinRate: 0,
        avgTrades: 0,
        avgHoldDays: 0,
        recentPnL: 0,
        recentWinRate: 0,
        recentTrades: 0,
        recentHoldDays: 0
      };

      if (mode === 'avg') {
        current.avgPnL = update.pnl;
        current.avgWinRate = update.winRate;
        current.avgTrades = update.trades;
        current.avgHoldDays = update.holdDays;
        current.lastUpdatedAvg = now;
      } else {
        current.recentPnL = update.pnl;
        current.recentWinRate = update.winRate;
        current.recentTrades = update.trades;
        current.recentHoldDays = update.holdDays;
        current.lastUpdatedRecent = now;
      }
      scores[update.strategyId] = current;
    }

    await saveStrategyScores(scores);
  } catch (e) {
    console.error("Failed to bulk update strategy scores", e);
  }
}

export async function getTournamentResults(): Promise<{ results: any[], executionDetails: any | null }> {
  try {
    const res = await fetch('/api/tournament/results', { cache: 'no-cache' });
    if (!res.ok) {
      if (res.status === 404) return { results: [], executionDetails: null };
      throw new Error(`Server responded with ${res.status}`);
    }
    
    const text = await res.text();
    if (!text) return { results: [], executionDetails: null };
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse tournament results JSON", parseError);
      return { results: [], executionDetails: null };
    }
  } catch (e) {
    console.error("Failed to load tournament results", e);
    return { results: [], executionDetails: null };
  }
}

export async function saveTournamentResults(results: any[], executionDetails: any | null) {
  try {
    const res = await fetch('/api/tournament/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, executionDetails }),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `Server responded with ${res.status}`);
    }
  } catch (e: any) {
    console.error("saveTournamentResults failed:", e);
    throw e;
  }
}
