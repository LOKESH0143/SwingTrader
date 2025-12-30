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
  minConsensusScore: number;
  useProbabilisticExecution: boolean;
  allowFractionalShares: boolean;
  useTrailingStop: boolean;
  useMarketRegimeFilter: boolean;
  useDynamicRisk: boolean;
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
  consensusScore: number;
  stopLoss: number;
  target: number;
  highestPrice: number; // For trailing stop
  pnl?: number;
  pnlPercent?: number;
  status: 'OPEN' | 'CLOSED';
  reason: string;
}

export function runPortfolioSimulation(
  strategies: Strategy[], 
  allData: Record<string, Candle[]>, 
  settings: PortfolioSettings,
  scores: Record<string, StrategyScore>,
  marketData?: Candle[] // Nifty 50 data for regime filter
): PortfolioState & { maxDrawdown: number; profitFactor: number } {
  
  // 1. Setup
  let cash = settings.initialCapital;
  let equity = settings.initialCapital;
  let peakEquity = settings.initialCapital;
  let maxDrawdown = 0;
  const openTrades: PortfolioTrade[] = [];
  const tradeHistory: PortfolioTrade[] = [];
  const equityCurve: { date: string; equity: number }[] = [];

  // Market Regime Calculation (SMA 200 of Nifty 50)
  let marketSma200: number[] = [];
  if (marketData && settings.useMarketRegimeFilter) {
    marketSma200 = indicators.sma(marketData, 200);
  }

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
      
      const avgYield = data ? (data.avgPnL / (data.avgTrades || 1)) : 0;
      const recentYield = data ? (data.recentPnL / (data.recentTrades || 1)) : 0;
      
      const monthlyScore = (recentMonthly * 0.6) + (avgMonthly * 0.4);
      const yieldScore = (recentYield * 0.6) + (avgYield * 0.4);
      
      const score = data ? (monthlyScore * Math.abs(yieldScore)) : -1000;
      
      return {
        ...s,
        execute: new Function('data', 'params', 'indicators', s.code),
        getOpinion: s.opinionCode ? new Function('data', 'params', 'indicators', s.opinionCode) : null,
        score: score
      };
    });

  // 4. Chronological Simulation
  for (const date of sortedDates) {
    // Market Regime Check
    let isMarketBullish = true;
    if (settings.useMarketRegimeFilter && marketData) {
      const marketIndex = marketData.findIndex(c => c.date === date);
      if (marketIndex >= 200) {
        const currentMarketPrice = marketData[marketIndex].close;
        const currentMarketSma = marketSma200[marketIndex];
        isMarketBullish = currentMarketPrice > currentMarketSma;
      }
    }

    // A. Update Open Trades (Check for Exits)
    for (let i = openTrades.length - 1; i >= 0; i--) {
      const trade = openTrades[i];
      const symbolData = allData[trade.symbol];
      const candle = symbolData?.find(c => c.date === date);
      
      if (candle) {
        // Update Highest Price for Trailing Stop
        if (candle.high > trade.highestPrice) {
          trade.highestPrice = candle.high;
          
          // If trailing stop is on, move stop loss up
          if (settings.useTrailingStop) {
            const initialRiskPercent = (trade.entryPrice - trade.stopLoss) / trade.entryPrice;
            const newStopLoss = trade.highestPrice * (1 - initialRiskPercent);
            if (newStopLoss > trade.stopLoss) {
              trade.stopLoss = newStopLoss;
            }
          }
        }

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
    // Only enter if market is bullish (if filter is on)
    if (isMarketBullish && cash > settings.initialCapital * 0.05 && openTrades.length < settings.maxOpenTrades) { 
      const dailySignals: { strategy: any; symbol: string; signal: any; score: number; consensusScore: number }[] = [];

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
              // --- CONSENSUS ENGINE (WEIGHTED) ---
              // Consult other strategies for their opinion on this symbol
              // We weight opinions by the strategy's Architect Score
              // Strategies with negative scores get 0 weight (ignored)
              
              let weightedOpinionSum = 0;
              let totalWeight = 0;

              // 1. Add the triggering strategy's opinion (Triggering strategy always says +1)
              const triggerWeight = Math.max(0, strategy.score);
              if (triggerWeight > 0) {
                weightedOpinionSum += (1 * triggerWeight);
                totalWeight += triggerWeight;
              }

              // 2. Poll other strategies
              for (const other of strategyFunctions) {
                if (other.id === strategy.id) continue;
                if (other.getOpinion) {
                  const weight = Math.max(0, other.score);
                  if (weight <= 0) continue;

                  try {
                    const opinion = other.getOpinion(historicalData, other.parameters, indicators);
                    if (typeof opinion === 'number') {
                      weightedOpinionSum += (opinion * weight);
                      totalWeight += weight;
                    }
                  } catch (e) {}
                }
              }

              // Normalize score to 0-100
              // Weighted average opinion is in range [-1, 1]
              const avgWeightedOpinion = totalWeight > 0 ? (weightedOpinionSum / totalWeight) : 0;
              const normalizedScore = totalWeight > 0 ? ((avgWeightedOpinion + 1) * 50) : 0;

              if (normalizedScore >= settings.minConsensusScore) {
                dailySignals.push({ 
                  strategy, 
                  symbol, 
                  signal, 
                  score: strategy.score,
                  consensusScore: normalizedScore
                });
              }
            }
          } catch (e) {}
        }
      }

      // Sort signals by Consensus Score first, then Strategy Score
      dailySignals.sort((a, b) => {
        if (b.consensusScore !== a.consensusScore) return b.consensusScore - a.consensusScore;
        return b.score - a.score;
      });

      // Execute top signals
      for (const item of dailySignals) {
        if (openTrades.length >= settings.maxOpenTrades) break;
        if (openTrades.some(t => t.symbol === item.symbol)) continue;

        // --- PROBABILISTIC EXECUTION ---
        if (settings.useProbabilisticExecution) {
          const roll = Math.random() * 100;
          if (roll > item.consensusScore) continue;
        }

        const entryPrice = allData[item.symbol].find(c => c.date === date)!.close;
        const risk = entryPrice - item.signal.stopLoss;
        if (risk <= 0) continue;

        const rr = (item.signal.target - entryPrice) / risk;
        const slPct = (risk / entryPrice) * 100;

        if (rr < settings.minRiskReward) continue;
        if (slPct > settings.maxStopLossPercent) continue;

        // Dynamic Risk Scaling
        let riskMultiplier = 1.0;
        if (settings.useDynamicRisk) {
          if (item.consensusScore >= 80) riskMultiplier = 1.5;
          else if (item.consensusScore < 60) riskMultiplier = 0.5;
        }

        const amountToRisk = equity * (settings.riskPerTrade / 100) * riskMultiplier;
        const equalAllocation = equity / settings.maxOpenTrades;

        // SAFE EQUAL SIZING:
        const riskBasedAllocation = amountToRisk * (entryPrice / risk);
        let capitalRequired = Math.min(cash, equalAllocation, riskBasedAllocation);
        
        let shares = settings.allowFractionalShares 
          ? (capitalRequired / entryPrice) 
          : Math.floor(capitalRequired / entryPrice);
        capitalRequired = shares * entryPrice;

        if (shares > 0 && capitalRequired <= cash) {
          const newTrade: PortfolioTrade = {
            strategyId: item.strategy.id,
            strategyName: item.strategy.name,
            symbol: item.symbol,
            entryDate: date,
            entryPrice: entryPrice,
            shares: shares,
            capitalUsed: capitalRequired,
            consensusScore: item.consensusScore,
            stopLoss: item.signal.stopLoss,
            target: item.signal.target,
            highestPrice: entryPrice,
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
