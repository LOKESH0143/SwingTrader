import { Strategy, Candle, Signal, StrategyScore } from './types';
import * as indicators from './indicators';
import { TradeFilters } from './backtest';

export interface PortfolioSettings {
  initialCapital: number;
  riskPerTrade: number; // Percentage of total equity
  selectedStrategies: string[]; // Array of strategy IDs
  minRiskReward: number;
  maxStopLossPercent: number;
  maxOpenTrades: number;
  allowFractionalShares: boolean;
  startDate?: string;
  endDate?: string;
  dataPeriod?: '1y' | '2y' | '5y';
}

export interface PortfolioState {
  equity: number;
  cash: number;
  openTrades: PortfolioTrade[];
  tradeHistory: PortfolioTrade[];
  equityCurve: { date: string; equity: number }[];
}

export interface PortfolioTrade {
  strategyId: string;
  strategyName: string;
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  shares: number;
  capitalUsed: number;
  stopLoss: number;
  target: number;
  pnl?: number;
  pnlPercent?: number;
  status: 'OPEN' | 'CLOSED';
  reason: string;
}

export function runPortfolioSimulation(
  strategies: Strategy[], 
  allData: Record<string, Candle[]>, 
  settings: PortfolioSettings,
  scores: Record<string, StrategyScore>
): PortfolioState & { maxDrawdown: number; profitFactor: number } {
  
  // 1. Setup
  let cash = settings.initialCapital;
  let equity = settings.initialCapital;
  let peakEquity = settings.initialCapital;
  let maxDrawdown = 0;
  const openTrades: PortfolioTrade[] = [];
  const tradeHistory: PortfolioTrade[] = [];
  const equityCurve: { date: string; equity: number }[] = [];

  // 2. Get all unique dates
  const allDates = new Set<string>();
  Object.values(allData).forEach(candles => {
    candles.forEach(c => allDates.add(c.date));
  });
  
  let sortedDates = Array.from(allDates).sort();

  // Apply Date Filters
  let effectiveStart = settings.startDate;
  if (!effectiveStart && settings.dataPeriod) {
    const now = new Date();
    if (settings.dataPeriod === '1y') now.setFullYear(now.getFullYear() - 1);
    else if (settings.dataPeriod === '2y') now.setFullYear(now.getFullYear() - 2);
    else if (settings.dataPeriod === '5y') now.setFullYear(now.getFullYear() - 5);
    effectiveStart = now.toISOString().split('T')[0];
  }

  if (effectiveStart) {
    const start = new Date(effectiveStart).getTime();
    sortedDates = sortedDates.filter(d => new Date(d).getTime() >= start);
  }
  if (settings.endDate) {
    const end = new Date(settings.endDate).getTime();
    sortedDates = sortedDates.filter(d => new Date(d).getTime() <= end);
  }

  // 3. Map strategy code to executable functions
  const strategyFunctions = strategies
    .filter(s => settings.selectedStrategies.includes(s.id))
    .map(s => {
      const data = scores[s.id];
      const avgMonthly = data ? data.avgPnL / 60 : 0;
      const recentMonthly = data ? data.recentPnL / 6 : 0;
      const score = data ? (recentMonthly * 0.6) + (avgMonthly * 0.4) : -1000;
      
      return {
        ...s,
        execute: new Function('data', 'params', 'indicators', s.code),
        score: score
      };
    });

  // 4. Chronological Simulation
  for (const date of sortedDates) {
    // A. Update Open Trades (Check for Exits)
    for (let i = openTrades.length - 1; i >= 0; i--) {
      const trade = openTrades[i];
      const symbolData = allData[trade.symbol];
      const candle = symbolData?.find(c => c.date === date);
      
      if (candle) {
        let exitPrice = 0;
        let reason = '';

        // Realistic Gap Handling: If Open is already below Stop Loss, exit at Open
        if (candle.open <= trade.stopLoss) {
          exitPrice = candle.open;
          reason = 'Stop Loss (Gap)';
        } else if (candle.low <= trade.stopLoss) {
          exitPrice = trade.stopLoss;
          reason = 'Stop Loss';
        } else if (candle.high >= trade.target) {
          exitPrice = trade.target;
          reason = 'Target Hit';
        }

        if (exitPrice > 0) {
          trade.exitDate = date;
          trade.exitPrice = exitPrice;
          trade.status = 'CLOSED';
          trade.pnl = (exitPrice - trade.entryPrice) * trade.shares;
          trade.pnlPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
          trade.reason = reason;

          cash += (trade.shares * exitPrice); // Return the actual market value to cash
          tradeHistory.push(trade);
          openTrades.splice(i, 1);
        }
      }
    }

    // B. Check for New Entries (Global Signal Auction)
    if (cash > settings.initialCapital * 0.05 && openTrades.length < settings.maxOpenTrades) { 
      const dailySignals: { strategy: any; symbol: string; signal: any; score: number }[] = [];

      // Collect ALL signals for today
      for (const strategy of strategyFunctions) {
        for (const symbol of Object.keys(allData)) {
          if (openTrades.some(t => t.symbol === symbol)) continue;

          const symbolData = allData[symbol];
          const dateIndex = symbolData.findIndex(c => c.date === date);
          if (dateIndex < 50) continue;

          const historicalData = symbolData.slice(0, dateIndex + 1);

          try {
            const signal = strategy.execute(historicalData, strategy.parameters, indicators);
            if (signal && signal.signal === 'BUY') {
              dailySignals.push({ strategy, symbol, signal, score: strategy.score });
            }
          } catch (e) {}
        }
      }

      // Sort signals by Strategy Score (Best logic gets priority)
      dailySignals.sort((a, b) => b.score - a.score);

      // Execute top signals
      for (const item of dailySignals) {
        if (openTrades.length >= settings.maxOpenTrades) break;
        if (openTrades.some(t => t.symbol === item.symbol)) continue;

        const entryPrice = allData[item.symbol].find(c => c.date === date)!.close;
        const risk = entryPrice - item.signal.stopLoss;
        const reward = item.signal.target - entryPrice;
        
        if (risk <= 0) continue;

        const rr = reward / risk;
        const slPct = (risk / entryPrice) * 100;

        if (rr < settings.minRiskReward) continue;
        if (slPct > settings.maxStopLossPercent) continue;

        const amountToRisk = equity * (settings.riskPerTrade / 100);
        let shares = settings.allowFractionalShares 
          ? (amountToRisk / risk) 
          : Math.floor(amountToRisk / risk);
        
        let capitalRequired = shares * entryPrice;

        // --- SMART SIZING ---
        // If we can't afford the "ideal" size, try to buy as many as we can with available cash
        // But never put more than 25% of total equity into a single stock (Concentration Risk)
        const maxAllocation = equity * 0.25;
        if (capitalRequired > Math.min(cash, maxAllocation)) {
          capitalRequired = Math.min(cash, maxAllocation);
          shares = settings.allowFractionalShares 
            ? (capitalRequired / entryPrice) 
            : Math.floor(capitalRequired / entryPrice);
          capitalRequired = shares * entryPrice;
        }

        if (shares > 0 && capitalRequired <= cash) {
          const newTrade: PortfolioTrade = {
            strategyId: item.strategy.id,
            strategyName: item.strategy.name,
            symbol: item.symbol,
            entryDate: date,
            entryPrice: entryPrice,
            shares: shares,
            capitalUsed: capitalRequired,
            stopLoss: item.signal.stopLoss,
            target: item.signal.target,
            status: 'OPEN',
            reason: item.signal.reason
          };

          cash -= capitalRequired;
          openTrades.push(newTrade);
        }
      }
    }

    // C. Update Current Equity & Drawdown
    let currentMarketValue = 0;
    openTrades.forEach(t => {
      const symbolData = allData[t.symbol];
      const candle = symbolData?.find(c => c.date === date);
      if (candle) {
        currentMarketValue += (candle.close * t.shares);
      } else {
        currentMarketValue += (t.entryPrice * t.shares);
      }
    });
    equity = cash + currentMarketValue;
    equityCurve.push({ date, equity });

    // Track Drawdown
    if (equity > peakEquity) peakEquity = equity;
    const currentDrawdown = (peakEquity - equity) / peakEquity * 100;
    if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
  }

  // Calculate Profit Factor
  const grossProfit = tradeHistory.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(tradeHistory.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

  return {
    equity,
    cash,
    openTrades,
    tradeHistory,
    equityCurve,
    maxDrawdown,
    profitFactor
  };
}
