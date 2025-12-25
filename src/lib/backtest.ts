import { Strategy, Candle, Signal, IndicatorFn } from './types';
import * as indicators from './indicators';

interface BacktestResult {
  strategyId: string;
  symbol: string;
  trades: Trade[];
  metrics: {
    totalTrades: number;
    winRate: number;
    netProfit: number;
    maxDrawdown: number;
    profitFactor: number;
  };
}

interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  type: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  pnl: number;
  pnlPercent: number;
  reason: string;
  target: number;
  stopLoss: number;
}

export interface TradeFilters {
  minRiskReward?: number;
  maxStopLossPercent?: number;
  minTargetPercent?: number;
}

export function runBacktest(strategy: Strategy, data: Candle[], filters?: TradeFilters): BacktestResult {
  const trades: Trade[] = [];
  let openTrade: Trade | null = null;
  let maxEquity = 0;
  let currentEquity = 10000; // Starting capital simulation
  let minEquity = 10000;

  // We need enough data for indicators
  const warmupPeriod = 200; 

  // Create a safe execution environment for the user code
  const executeStrategy = new Function(
    'data', 
    'params', 
    'indicators', 
    strategy.code
  );

  for (let i = warmupPeriod; i < data.length; i++) {
    const currentData = data.slice(0, i + 1);
    const candle = data[i];

    // Check exit conditions for open trade
    if (openTrade) {
      // Simple exit logic: hit target or stop loss
      // In a real engine, we'd check High/Low of the candle to see if SL/TP was hit within the day
      // For simplicity, we check Close vs SL/TP
      
      // Note: The strategy code currently returns 'stopLoss' and 'target'
      // We should store these in the trade object
      
      // Let's assume the trade object has these properties attached (we'll add them below)
      const tradeSL = (openTrade as any).stopLoss;
      const tradeTP = (openTrade as any).target;

      let exitPrice = 0;
      let exitReason = '';

      if (candle.low <= tradeSL) {
        exitPrice = tradeSL;
        exitReason = 'Stop Loss';
      } else if (candle.high >= tradeTP) {
        exitPrice = tradeTP;
        exitReason = 'Target Hit';
      }

      if (exitPrice > 0) {
        openTrade.exitDate = candle.date;
        openTrade.exitPrice = exitPrice;
        openTrade.status = 'CLOSED';
        openTrade.pnl = (exitPrice - openTrade.entryPrice) * (10000 / openTrade.entryPrice); // Simulate full equity investment
        openTrade.pnlPercent = ((exitPrice - openTrade.entryPrice) / openTrade.entryPrice) * 100;
        
        trades.push(openTrade);
        currentEquity += openTrade.pnl;
        openTrade = null;
      }
    }

    // Check entry conditions if no open trade
    if (!openTrade) {
      try {
        const signal = executeStrategy(currentData, strategy.parameters, indicators);
        
        if (signal && signal.signal === 'BUY') {
          // Safety Validation
          if (isNaN(signal.stopLoss) || isNaN(signal.target)) {
            // console.warn('Invalid Signal (NaN):', signal);
            continue;
          }
          if (signal.stopLoss >= candle.close) {
             // console.warn('Invalid Signal (SL >= Price):', signal);
             continue;
          }

          // Apply Filters
          if (filters) {
            const entryPrice = candle.close;
            const risk = entryPrice - signal.stopLoss;
            const reward = signal.target - entryPrice;
            
            // Calculate metrics
            const rr = risk > 0 ? reward / risk : 0;
            const stopLossPct = (risk / entryPrice) * 100;
            const targetPct = (reward / entryPrice) * 100;

            // Check Min Risk:Reward
            if (filters.minRiskReward && rr < filters.minRiskReward) {
              continue;
            }

            // Check Max Stop Loss %
            if (filters.maxStopLossPercent && stopLossPct > filters.maxStopLossPercent) {
              continue;
            }

            // Check Min Target %
            if (filters.minTargetPercent && targetPct < filters.minTargetPercent) {
              continue;
            }
          }

          openTrade = {
            entryDate: candle.date,
            entryPrice: candle.close,
            type: 'LONG',
            status: 'OPEN',
            pnl: 0,
            pnlPercent: 0,
            reason: signal.reason,
            // Attach SL/TP for management
            stopLoss: signal.stopLoss,
            target: signal.target
          } as Trade;
        }
      } catch (e) {
        console.error('Strategy Execution Error:', e);
      }
    }

    // Track Drawdown
    maxEquity = Math.max(maxEquity, currentEquity);
    minEquity = Math.min(minEquity, currentEquity);
  }

  // Calculate Metrics
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const wins = closedTrades.filter(t => t.pnl > 0).length;
  const totalPnl = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
  
  // Max Drawdown calculation (simplified)
  // Ideally this is calculated on a running equity curve
  
  return {
    strategyId: strategy.id,
    symbol: 'TEST', // Placeholder
    trades: closedTrades,
    metrics: {
      totalTrades: closedTrades.length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      netProfit: totalPnl,
      maxDrawdown: 0, // TODO: Implement proper DD calc
      profitFactor: 0 // TODO: Implement PF
    }
  };
}
