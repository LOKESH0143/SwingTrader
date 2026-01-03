import { Strategy } from "../types";

export const gapAndGo: Strategy =  {
    id: 'gap-and-go',
    name: 'Gap and Go (Optimized)',
    description: 'Buys when a stock gaps up >2% in an uptrend (SMA 50) and holds the gain. Uses tight stops to fail fast.',
    category: 'Momentum',
    parameters: { gapPct: 0.02, defaultRiskPct: 0.05 },
    opinionCode: `
      const sma50 = indicators.sma(data, 50);
      const curr = data[data.length-1].close;
      const prev = data[data.length-2].close;
      const trend = sma50[sma50.length-1];
      const gap = (data[data.length-1].open - prev) / prev;
      if (gap > 0.02 && curr > trend) return 1;
      if (curr < trend) return -1;
      return 0;
    `,
    code: `
// Gap and Go (Optimized)
const current = data[data.length - 1];
const prev = data[data.length - 2];
const sma50 = indicators.sma(data, 50);

// 1. Gap Condition: Open is > X% above Prev Close
const gapSize = (current.open - prev.close) / prev.close;
const isGapUp = gapSize >= params.gapPct;

// 2. Strength Condition: Current Close > Current Open (Green Candle)
// We want to ensure the gap isn't being sold into
const isGreen = current.close > current.open;

// 3. Trend Filter (New): Only take gaps in an uptrend
// Gaps in downtrends are often "Dead Cat Bounces" or "Exhaustion Gaps"
const currentTrend = sma50[sma50.length - 1];
const isUptrend = current.close > currentTrend;

// 4. Fade Protection (New): Avoid massive gaps (> 5%)
// These are prone to immediate profit taking.
const isNotOverextended = gapSize < 0.05;

if (isGapUp && isGreen && isUptrend && isNotOverextended) {
  
  // Stop Loss: Low of the Gap Candle (Tight Stop)
  // The previous logic used 'Open', but 'Low' is safer if there's a lower wick.
  // If price breaks the Low of the gap day, the momentum is dead.
  let stopLoss = current.low;
  
  // Safety: If the candle is huge (> 3% risk), tighten stop to midpoint
  if ((current.close - stopLoss) / current.close > 0.03) {
     stopLoss = current.open; 
  }

  // Target: 2x Risk (Quick Scalp)
  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Gap and Go: \${(gapSize * 100).toFixed(1)}% Gap + Uptrend. SL: \${stopLoss.toFixed(2)}\`
  };
}
return null;
    `
  };