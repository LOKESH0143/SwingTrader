import { Strategy } from "../types";

export const insideBarNr7_v2: Strategy =  {
    id: 'inside-bar-nr7-v2',
    name: 'Inside Bar / NR7 (v2 - High Vol)',
    description: 'A version of the Inside Bar / NR7 strategy that requires a stronger volume confirmation (1.5x average volume).',
    category: 'Volatility',
    parameters: { defaultRiskPct: 0.03, trendSma: 50, minRsi: 50, volumeMultiplier: 1.5 },
    opinionCode: `
      const smaTrend = indicators.sma(data, 50);
      const curr = data[data.length-1].close;
      const trend = smaTrend[smaTrend.length-1];
      if (curr > trend) return 0.5;
      if (curr < trend) return -0.5;
      return 0;
    `,
    code: `
// Inside Bar / NR7 Strategy with Trend & High Volume
const current = data[data.length - 1];
const prev = data[data.length - 2];
const prev2 = data[data.length - 3];

// Indicators
const smaTrend = indicators.sma(data, params.trendSma);
const rsi = indicators.rsi(data, 14);
const currentTrend = smaTrend[smaTrend.length - 1];
const currentRsi = rsi[rsi.length - 1];

// 1. Inside Bar Condition: Prev is completely inside Prev2
const isInsideBar = prev.high < prev2.high && prev.low > prev2.low;

// 2. NR7 Condition: Prev has the narrowest range of the last 7 days
let minRange = Infinity;
const prevRange = prev.high - prev.low;
// Check previous 6 candles before 'prev'
for (let i = 3; i <= 8; i++) {
  if (i > data.length) break;
  const c = data[data.length - i];
  const r = c.high - c.low;
  if (r < minRange) minRange = r;
}
const isNR7 = prevRange <= minRange;

// 3. Breakout Condition: Current Close > Prev High
const isBreakout = current.close > prev.high;

// 4. Trend Filter: Price > SMA 50
const isUptrend = current.close > currentTrend;

// 5. Momentum Filter: RSI > 50 (Not weak)
const isMomentum = currentRsi > params.minRsi;

// 6. Volume Filter: Volume > 1.5x Avg Vol (20)
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isHighVol = current.volume > (avgVol * params.volumeMultiplier);

if ((isInsideBar || isNR7) && isBreakout && isUptrend && isMomentum && isHighVol) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Low of the setup bar (prev)
  let stopLoss = prev.low; 
  
  // Target: 2x Risk (Volatility breakouts tend to run)
  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2);

  // Check if there is a major resistance nearby
  const nearRes = indicators.getNearestLevel(current.close, resistances, 'RESISTANCE');
  if (nearRes && nearRes < target) {
    target = nearRes; // Be conservative if resistance is close
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`V2 Vol Breakout: \${isInsideBar ? 'Inside Bar' : ''} \${isNR7 ? 'NR7' : ''} + Vol: \${(current.volume/avgVol).toFixed(1)}x\`
  };
}
return null;
    `
  };