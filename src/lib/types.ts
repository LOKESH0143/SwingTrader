export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  symbol: string;
  strategyId: string;
  strategyName: string;
  type: 'BUY' | 'SELL';
  price: number;
  stopLoss: number;
  target: number;
  date: string;
  reason: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  category?: string;
  code: string; // Primary entry logic
  opinionCode?: string; // Logic to provide a -1 to +1 opinion
  parameters: Record<string, number>;
  bestScore?: {
    totalPnL: number;
    winRate: number;
    date: string;
  };
}

// Technical Analysis Helper Types
export type IndicatorFn = (data: Candle[], period: number) => number[];

export interface JournalTrade {
  id: string;
  symbol: string;
  strategyName: string;
  entryDate: string;
  entryPrice: number;
  stopLoss: number;
  target: number;
  quantity?: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  exitDate?: string;
  exitPrice?: number;
  pnl?: number;
  notes?: string;
  direction: 'LONG' | 'SHORT';
}

export interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  netProfit: number;
  maxDrawdown: number;
  profitFactor: number;
  // Future metrics can be added here
}

export interface StrategyScore {
  strategyId: string;
  avgPnL: number;
  avgWinRate: number;
  avgTrades?: number;
  avgHoldDays?: number;
  avgMaxDrawdown?: number;
  avgProfitFactor?: number;
  recentPnL: number;
  recentWinRate: number;
  recentTrades?: number;
  recentHoldDays?: number;
  recentMaxDrawdown?: number;
  recentProfitFactor?: number;
  lastUpdatedAvg?: string;
  lastUpdatedRecent?: string;
  trustScore?: number;
}
