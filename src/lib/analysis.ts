import { StrategyScore } from './types';

// Define reasonable maximums for normalization to a 0-10 scale
const MAX_MONTHLY_RETURN = 15; // 15% avg monthly return is exceptional
const MAX_WIN_RATE = 100; // 100%
const MAX_VELOCITY = 1.0; // 1% return per day held is exceptional

export function calculateArchitectScoreV2(s: StrategyScore | undefined): number {
  if (!s) return 0;

  // --- 1. Profitability ---
  const avgMonthlyReturn = s.avgTrades > 0 ? s.avgPnL / 60 : 0; // 5 years = 60 months
  const recentMonthlyReturn = s.recentTrades > 0 ? s.recentPnL / 6 : 0; // 6 months
  const blendedMonthlyReturn = (recentMonthlyReturn * 0.7) + (avgMonthlyReturn * 0.3);
  const profitabilityScore = (Math.min(blendedMonthlyReturn, MAX_MONTHLY_RETURN) / MAX_MONTHLY_RETURN) * 10;

  // --- 2. Consistency ---
  const blendedWinRate = (s.recentWinRate * 0.6) + (s.avgWinRate * 0.4);
  const consistencyScore = (blendedWinRate / MAX_WIN_RATE) * 10;

  // --- 3. Velocity (Yield per Day) ---
  const avgYieldPerTrade = s.avgTrades > 0 ? s.avgPnL / s.avgTrades : 0;
  const recentYieldPerTrade = s.recentTrades > 0 ? s.recentPnL / s.recentTrades : 0;
  
  const avgVelocity = s.avgHoldDays > 0 ? avgYieldPerTrade / s.avgHoldDays : 0;
  const recentVelocity = s.recentHoldDays > 0 ? recentYieldPerTrade / s.recentHoldDays : 0;

  const blendedVelocity = (recentVelocity * 0.7) + (avgVelocity * 0.3);
  const velocityScore = (Math.min(blendedVelocity, MAX_VELOCITY) / MAX_VELOCITY) * 10;

  // --- Final Weighted Score (out of 100) ---
  const finalScore = 
    (profitabilityScore * 4) + // 40%
    (consistencyScore * 3) +   // 30%
    (velocityScore * 3);       // 30%

  return Math.max(0, finalScore); // Ensure score isn't negative
}
