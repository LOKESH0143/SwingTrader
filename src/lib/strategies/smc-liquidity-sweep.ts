import { Strategy } from '../types';

export const smcLiquiditySweep: Strategy = {
    id: 'smc-liquidity-sweep',
    name: 'SMC Liquidity Sweep (Turtle Soup)',
    description: 'Buys when price sweeps a major support level (taking out retail stops) and immediately reverses. High win rate reversal setup.',
    category: 'Reversal',
    parameters: { defaultRiskPct: 0.03 },
    opinionCode: `
      const { supports } = indicators.findSupportResistance(data, 50);
      const curr = data[data.length-1].close;
      const low = data[data.length-1].low;
      const nearest = indicators.getNearestLevel(curr, supports, 'SUPPORT');
      if (nearest && low < nearest && curr > nearest) return 1;
      return 0;
    `,
    code: `
// SMC Liquidity Sweep Strategy
const current = data[data.length - 1];
const prev = data[data.length - 2];

// 1. Identify Key Support (Swing Lows)
const { supports } = indicators.findSupportResistance(data, 50); // Look back 50 candles for major levels
const nearestSupport = indicators.getNearestLevel(current.close, supports, 'SUPPORT');

if (nearestSupport) {
  // 2. Sweep Condition: Price dipped below support but closed above it
  // We check if the Low was below support, but Close is back above
  const didSweep = current.low < nearestSupport && current.close > nearestSupport;
  
  // 3. Strength Condition: Green Candle (Close > Open)
  const isGreen = current.close > current.open;

  // 4. Volume Confirmation: High volume on the reversal candle (Stopping Volume)
  const recentVols = data.slice(-21, -1).map(c => c.volume);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const isHighVol = current.volume > avgVol;

  if (didSweep && isGreen && isHighVol) {
    // Stop Loss: Just below the sweep low (The "Pin Bar" low)
    const stopLoss = current.low;
    
    // Target: VWAP + 2 StdDev (Mean Reversion)
    // We calculate a rolling VWAP(20) and add bands
    const vwapLine = indicators.vwap(data, 20);
    const currentVWAP = vwapLine[vwapLine.length - 1];
    
    // Calculate StdDev of price relative to VWAP (simplified)
    const stdDevs = indicators.stdDev(data, 20);
    const currentStdDev = stdDevs[stdDevs.length - 1];
    
    let target = currentVWAP + (2 * currentStdDev);
    
    // Fallback if VWAP target is too close or below price
    if (target <= current.close) {
       target = current.close + ((current.close - stopLoss) * 3); // 3R Target for reversals
    }

    return {
      signal: 'BUY',
      stopLoss: stopLoss,
      target: target,
      reason: \`Liquidity Sweep of \${nearestSupport.toFixed(2)} + High Vol Reversal\`
    };
  }
}
return null;
    `
};