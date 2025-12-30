import { StrategyScore } from './types';

export async function getStrategyScores(): Promise<Record<string, StrategyScore>> {
  try {
    const res = await fetch('/api/scores');
    if (!res.ok) return {};
    return res.json();
  } catch (e) {
    console.error("Failed to load strategy scores", e);
    return {};
  }
}

export async function saveStrategyScores(scores: Record<string, StrategyScore>) {
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scores),
    });
  } catch (e) {
    console.error("Failed to save strategy scores", e);
  }
}

export async function updateStrategyScore(
  strategyId: string, 
  pnl: number, 
  winRate: number, 
  trades: number,
  mode: 'avg' | 'recent'
) {
  try {
    const scores = await getStrategyScores();
    const current = scores[strategyId] || {
      strategyId,
      avgPnL: 0,
      avgWinRate: 0,
      avgTrades: 0,
      recentPnL: 0,
      recentWinRate: 0,
      recentTrades: 0
    };

    if (mode === 'avg') {
      current.avgPnL = pnl;
      current.avgWinRate = winRate;
      current.avgTrades = trades;
      current.lastUpdatedAvg = new Date().toISOString();
    } else {
      current.recentPnL = pnl;
      current.recentWinRate = winRate;
      current.recentTrades = trades;
      current.lastUpdatedRecent = new Date().toISOString();
    }

    scores[strategyId] = current;
    await saveStrategyScores(scores);
  } catch (e) {
    console.error("Failed to update strategy score", e);
  }
}
