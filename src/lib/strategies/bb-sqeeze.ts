import { Strategy } from "../types";

export const bbSqueeze: Strategy = {
    id: 'bb-squeeze',
    name: 'Bollinger Band Squeeze (True Expansion v2)',
    description: 'Buys when price breaks Upper Band with expanding bandwidth and high volume. Uses Advanced S&R.',
    category: 'Volatility',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    opinionCode: `
      const { upper, lower } = indicators.bollingerBands(data, 20, 2);
      const curr = data[data.length-1].close;
      if (curr > upper) return 1;
      if (curr < lower) return -1;
      return 0;
    `,
    code: `
// Bollinger Band Squeeze v2 (True Expansion + Volume + Advanced S&R)
const { upper, middle, lower } = indicators.bollingerBands(data, params.period, params.multiplier);

const i = data.length - 1;
const currentClose = data[i].close;
const currentHigh = data[i].high;
const currentLow = data[i].low;

const currentUpper = upper[i];
const prevUpper = upper[i-1];
const currentLower = lower[i];
const prevLower = lower[i-1];

// 1. Calculate Bandwidth (The "Squeeze" Metric)
const currentBW = (currentUpper - currentLower) / middle[i];
const prevBW = (prevUpper - prevLower) / middle[i-1];

// 2. Expansion Condition (The "Pop")
const isExpanding = currentBW > prevBW;

// 3. Breakout Condition
const isBreakout = currentClose > currentUpper;

// 4. Candle Quality
const range = currentHigh - currentLow;
const closePosition = (currentClose - currentLow) / range;
const isStrongClose = closePosition > 0.75;

// 5. Volume Confirmation
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isVolumeHigh = data[i].volume > avgVol;

if (isBreakout && isExpanding && isStrongClose && isVolumeHigh) {
  
  // Stop Loss: Middle Band (20 SMA) or Nearest Strong Support
  const { supports } = indicators.findSupportResistance(data, 30);
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  const sma20 = middle[i];
  
  // If support is too far (> 8%), use SMA 20
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.08) {
      stopLoss = sma20;
  }
  
  // If SMA 20 is still too far, use Low of Candle
  if ((currentClose - stopLoss) / currentClose > 0.05) {
     stopLoss = currentLow;
  }

  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 2.5);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`BB Squeeze v2: Strong Close + Vol Expansion. SL: \${stopLoss.toFixed(2)}\`
  };
}
return null;
    `
};