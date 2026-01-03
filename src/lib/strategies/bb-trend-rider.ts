import { Strategy } from "../types";

export const bbTrendRider: Strategy = {
    id: 'bb-trend-rider',
    name: 'Bollinger Trend Rider (Optimized)',
    description: 'Buys on a pullback to the Middle Band (SMA 20) in a strong uptrend (Above SMA 50 + ADX > 25). Avoids buying extended tops.',
    category: 'Trend',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    opinionCode: `
      const sma50 = indicators.sma(data, 50);
      const adx = indicators.adx(data, 14);
      const curr = data[data.length-1].close;
      const s50 = sma50[sma50.length-1];
      const currAdx = adx[adx.length-1];
      if (curr > s50 && currAdx > 25) return 1;
      if (curr < s50) return -1;
      return 0;
    `,
    code: `
// Bollinger Trend Rider (Optimized: Pullback + Momentum)
const { upper, middle, lower } = indicators.bollingerBands(data, params.period, params.multiplier);
const sma50 = indicators.sma(data, 50);
const adx = indicators.adx(data, 14);

const i = data.length - 1;
const currentClose = data[i].close;
const currentLow = data[i].low;
const currentOpen = data[i].open;
const prevClose = data[i-1].close;

const currentMiddle = middle[i];
const currentTrend = sma50[sma50.length - 1];
const currentAdx = adx[adx.length - 1];

// 1. Trend Filter: Strong Uptrend
// Price above SMA 50 AND ADX > 25 (Trend Strength)
const isUptrend = currentClose > currentTrend && currentAdx > 25;

// 2. Pullback Condition: "Buy the Dip"
// Instead of buying the breakout (which fails often as per MAE analysis),
// we buy when price touches or dips near the Middle Band (SMA 20) and bounces.
// Logic: Low of candle touched SMA 20, but closed GREEN (Bounce).
const touchedMiddle = currentLow <= currentMiddle * 1.01; // Within 1% of SMA 20
const isGreenCandle = currentClose > currentOpen;
const isBounce = touchedMiddle && isGreenCandle;

if (isUptrend && isBounce) {
  
  // Stop Loss: Below the Low of the bounce candle (Tight Risk)
  // If it breaks the bounce low, the trend might be changing.
  let stopLoss = Math.min(data[i].low, currentMiddle * 0.98);
  
  // Target: The Upper Band (Mean Reversion to the upside)
  // We aim for the price to return to the top of the channel.
  const risk = currentClose - stopLoss;
  let target = upper[i];
  
  // Ensure minimum 2R
  if ((target - currentClose) < (risk * 2)) {
      target = currentClose + (risk * 2.5);
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`BB Trend Rider: Bounce off SMA 20 in Uptrend (ADX \${currentAdx.toFixed(0)})\`
  };
}
return null;
    `
  };