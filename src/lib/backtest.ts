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
  // Debugging Metrics
  maxPrice: number; // Highest price reached during trade
  minPrice: number; // Lowest price reached during trade
  mfe: number;      // Max Favorable Excursion (% max profit)
  mae: number;      // Max Adverse Excursion (% max drawdown)
}

export interface TradeFilters {
  minRiskReward?: number;
  maxStopLossPercent?: number;
  minTargetPercent?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
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

  // Determine start and end indices based on date filters
  let startIndex = warmupPeriod;
  let endIndex = data.length - 1;

  if (filters?.startDate) {
    const startFilter = new Date(filters.startDate).getTime();
    const foundIndex = data.findIndex(c => new Date(c.date).getTime() >= startFilter);
    
    if (foundIndex === -1) {
       startIndex = data.length + 1; 
    } else if (foundIndex > warmupPeriod) {
       startIndex = foundIndex;
    }
  } else {
    // Default Behavior: If NO start date filter is provided, run on ALL available data
    // starting after the warmup period.
    startIndex = Math.min(warmupPeriod, data.length);
  }

  let endFilterTime = 0;
  if (filters?.endDate) {
    // Set to end of the day (23:59:59.999)
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999);
    endFilterTime = endDate.getTime();
    // console.log(`[Backtest] End Filter: ${filters.endDate} (${endFilterTime})`);
  }

  for (let i = startIndex; i <= endIndex; i++) {
    const currentData = data.slice(0, i + 1);
    const candle = data[i];
    
    // Check End Date Filter (Optimized)
    if (endFilterTime > 0) {
        const candleDate = new Date(candle.date).getTime();
        if (candleDate > endFilterTime) break;
    }

    // Check exit conditions for open trade
    if (openTrade) {
      // Update High/Low stats for MFE/MAE
      openTrade.maxPrice = Math.max(openTrade.maxPrice, candle.high);
      openTrade.minPrice = Math.min(openTrade.minPrice, candle.low);

      const tradeSL = (openTrade as any).stopLoss;
      const tradeTP = (openTrade as any).target;

      let exitPrice = 0;
      let exitReason = '';

      if (candle.low <= tradeSL) {
        exitPrice = tradeSL;
        exitReason = 'Stop Loss';
        // Ensure minPrice reflects the stop loss hit if it gapped down
        openTrade.minPrice = Math.min(openTrade.minPrice, exitPrice);
      } else if (candle.high >= tradeTP) {
        exitPrice = tradeTP;
        exitReason = 'Target Hit';
        // Ensure maxPrice reflects the target hit if it gapped up
        openTrade.maxPrice = Math.max(openTrade.maxPrice, exitPrice);
      }

      if (exitPrice > 0) {
        openTrade.exitDate = candle.date;
        openTrade.exitPrice = exitPrice;
        openTrade.status = 'CLOSED';
        openTrade.pnl = (exitPrice - openTrade.entryPrice) * (10000 / openTrade.entryPrice); // Simulate full equity investment
        openTrade.pnlPercent = ((exitPrice - openTrade.entryPrice) / openTrade.entryPrice) * 100;
        
        // Calculate Final MFE/MAE
        // MFE: Max Favorable Excursion (Highest High - Entry) / Entry
        // MAE: Max Adverse Excursion (Entry - Lowest Low) / Entry (Usually negative or positive depending on convention, but let's keep it as "Drawdown %")
        // Convention: MAE is typically negative to show drawdown, but user asked for "percentage price moved against the trade".
        // Let's store MAE as a negative number to indicate "Adverse".
        
        openTrade.mfe = ((openTrade.maxPrice - openTrade.entryPrice) / openTrade.entryPrice) * 100;
        openTrade.mae = ((openTrade.minPrice - openTrade.entryPrice) / openTrade.entryPrice) * 100;

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
              // console.log(`[Filter] Rejected ${strategy.id} on ${candle.date}: RR ${rr.toFixed(2)} < ${filters.minRiskReward}`);
              continue;
            }

            // Check Max Stop Loss %
            if (filters.maxStopLossPercent && stopLossPct > filters.maxStopLossPercent) {
              // console.log(`[Filter] Rejected ${strategy.id} on ${candle.date}: SL% ${stopLossPct.toFixed(2)} > ${filters.maxStopLossPercent}`);
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
            stopLoss: signal.stopLoss,
            target: signal.target,
            // Initialize Debug Metrics
            maxPrice: candle.close,
            minPrice: candle.close,
            mfe: 0,
            mae: 0
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
  // We return ALL trades (including open ones if we wanted, but standard backtest usually reports closed)
  // The user issue is that "Total Trades" in UI (metrics.totalTrades) != "All Trades" list length.
  // In the UI, we accumulate metrics.totalTrades.
  // But we also push ALL closed trades to sStats.allTrades.
  
  // If metrics.totalTrades is derived from closedTrades.length, they should match.
  // UNLESS, the loop in Tournament.tsx is doing something weird.
  
  // Let's ensure we are consistent.
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const wins = closedTrades.filter(t => t.pnl > 0).length;
  const totalPnl = closedTrades.reduce((acc, t) => acc + t.pnl, 0);
  
  return {
    strategyId: strategy.id,
    symbol: 'TEST', // Placeholder
    trades: closedTrades,
    metrics: {
      totalTrades: closedTrades.length,
      winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
      netProfit: totalPnl,
      maxDrawdown: 0, 
      profitFactor: 0 
    }
  };
}
