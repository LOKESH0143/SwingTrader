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
  code: string; // The actual logic as a string
  parameters: Record<string, number>;
  bestScore?: {
    totalPnL: number;
    winRate: number;
    date: string;
  };
}

// Technical Analysis Helper Types
export type IndicatorFn = (data: Candle[], period: number) => number[];
