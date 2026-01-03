import { StrategyScore } from './types';

// Define reasonable maximums for normalization to a 0-10 scale
const MAX_MONTHLY_RETURN = 15; // 15% avg monthly return is exceptional
const MAX_WIN_RATE = 100; // 100%
const MAX_VELOCITY = 1.0; // 1% return per day held is exceptional



const MAX_DRAWDOWN = 30; // 30% drawdown is significant
const MAX_PROFIT_FACTOR = 3; // a profit factor of 3 is very good
const MAX_TRADES = 250; // for a 5-year period, this is about one trade per week

export function calculateArchitectScoreV3(s: StrategyScore | undefined): number {
  if (!s) return 0;

  // --- 1. Profitability (35%) ---
  const avgMonthlyReturn = s.avgTrades > 0 ? s.avgPnL / 60 : 0; // 5 years = 60 months
  const recentMonthlyReturn = s.recentTrades > 0 ? s.recentPnL / 6 : 0; // 6 months
  const blendedMonthlyReturn = (recentMonthlyReturn * 0.8) + (avgMonthlyReturn * 0.2);
  const profitabilityScore = (Math.min(blendedMonthlyReturn, MAX_MONTHLY_RETURN) / MAX_MONTHLY_RETURN) * 10;

  // --- 2. Consistency (30%) ---
  const blendedWinRate = (s.recentWinRate * 0.8) + (s.avgWinRate * 0.2);
  const consistencyScore = (blendedWinRate / MAX_WIN_RATE) * 10;

  // --- 3. Quality (20%) ---
  const blendedMaxDrawdown = ((s.recentMaxDrawdown || 0) * 0.8) + ((s.avgMaxDrawdown || 0) * 0.2);
  const blendedProfitFactor = ((s.recentProfitFactor || 0) * 0.8) + ((s.avgProfitFactor || 0) * 0.2);
  const drawdownScore = 10 - (Math.min(blendedMaxDrawdown, MAX_DRAWDOWN) / MAX_DRAWDOWN) * 10;
  const profitFactorScore = (Math.min(blendedProfitFactor, MAX_PROFIT_FACTOR) / MAX_PROFIT_FACTOR) * 10;
  const qualityScore = (drawdownScore * 0.5) + (profitFactorScore * 0.5);

  // --- 4. Velocity & Frequency (15%) ---
  const avgYieldPerTrade = s.avgTrades > 0 ? s.avgPnL / s.avgTrades : 0;
  const recentYieldPerTrade = s.recentTrades > 0 ? s.recentPnL / s.recentTrades : 0;
  const avgVelocity = s.avgHoldDays > 0 ? avgYieldPerTrade / s.avgHoldDays : 0;
  const recentVelocity = s.recentHoldDays > 0 ? recentYieldPerTrade / s.recentHoldDays : 0;
  const blendedVelocity = (recentVelocity * 0.8) + (avgVelocity * 0.2);
  const velocityScore = (Math.min(blendedVelocity, MAX_VELOCITY) / MAX_VELOCITY) * 10;
  
  const blendedTrades = ((s.recentTrades || 0) * 0.8) + ((s.avgTrades || 0) * 0.2);
  const frequencyScore = (Math.min(blendedTrades, MAX_TRADES) / MAX_TRADES) * 10;
  
  const velocityAndFrequencyScore = (velocityScore * 0.7) + (frequencyScore * 0.3);

  // --- Final Weighted Score (out of 100) ---
  const finalScore = 
    (profitabilityScore * 3.5) + // 35%
    (consistencyScore * 3) +     // 30%
    (qualityScore * 2) +         // 20%
    (velocityAndFrequencyScore * 1.5); // 15%

  return Math.max(0, finalScore); // Ensure score isn't negative
}

