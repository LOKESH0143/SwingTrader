import { Strategy } from '../types';

export const institutionalBreakout: Strategy = {
    id: 'institutional-breakout',
    name: 'Institutional Breakout (50d High + Vol)',
    description: 'Buys new 50-day highs with strong volume and a solid close. Filters out weak "wick" breakouts.',
    category: 'Breakout',
    parameters: { lookback: 50, volumeMult: 1.5, defaultRiskPct: 0.05 },
    opinionCode: `
      const lookback = 50;
      const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
      const maxHigh = Math.max(...recentHighs);
      const curr = data[data.length-1].close;
      if (curr > maxHigh) return 1;
      return 0;
    `,
    code: `
// Institutional Breakout (50d High + Strong Close)
const lookback = 50; // Increased to 50 (Quarterly High) for significance
const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
const maxHigh = Math.max(...recentHighs);

const i = data.length - 1;
const currentClose = data[i].close;
const currentLow = data[i].low;
const currentHigh = data[i].high;
const currentVol = data[i].volume;

// 1. Breakout Condition
// Price must CLOSE above the 50-Day High (not just touch it)
const isBreakout = currentClose > maxHigh;

// 2. Volume Condition (Realistic)
// We look for 1.5x volume (Institutional Interest), not 2x.
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isHighVol = currentVol > (avgVol * 1.5);

// 3. Candle Strength (The "Anti-Trap" Filter)
// The price must close in the top 25% of the day's range.
// This ensures we aren't buying a "shooting star" or weak breakout.
const range = currentHigh - currentLow;
const closePos = (currentClose - currentLow) / range;
const isStrongClose = closePos > 0.75;

// 4. Trend Filter (Avoid Bear Market Rallies)
const sma200 = indicators.sma(data, 200);
const isUptrend = currentClose > sma200[sma200.length - 1];

if (isBreakout && isHighVol && isStrongClose && isUptrend) {
  
  // Stop Loss: Low of the Breakout Candle
  // This is the most logical stop. If price falls back below today's low,
  // the breakout has failed immediately.
  let stopLoss = currentLow;
  
  // Safety: If the candle is huge (> 5% risk), tighten stop to midpoint
  // or use a trailing ATR stop.
  const riskPct = (currentClose - stopLoss) / currentClose;
  if (riskPct > 0.05) {
     stopLoss = currentClose * 0.95; // Cap risk at 5%
  }

  // Target: Momentum (3R)
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Institutional Breakout: New 50d High + Strong Close + Vol \${(currentVol/avgVol).toFixed(1)}x\`
  };
}
return null;
    `
}