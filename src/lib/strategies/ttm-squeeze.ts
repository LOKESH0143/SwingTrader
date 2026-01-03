import { Strategy } from "../types";

export const ttmSqueeze: Strategy = {
    id: 'ttm-squeeze',
    name: 'TTM Squeeze (Optimized - ADX Filter)',
    description: 'Adds an ADX filter to the TTM Squeeze strategy to ensure it only fires in strongly trending markets (ADX > 25).',
    category: 'Volatility',
    parameters: { defaultRiskPct: 0.05, adxPeriod: 14, minAdx: 25 },
    opinionCode: `
      const { squeezeOn, histogram } = indicators.ttmSqueeze(data);
      const adx = indicators.adx(data, 14);
      const currHist = histogram[histogram.length-1];
      const currAdx = adx[adx.length-1];
      if (currHist > 0 && currAdx > 25) return 1;
      if (currHist < 0) return -1;
      return 0;
    `,
    code: `
// TTM Squeeze Optimized (Trend Aligned + Vol + ADX Filter)
const { squeezeOn, histogram } = indicators.ttmSqueeze(data);
const chandelier = indicators.chandelierExit(data, 22, 3.0);
const sma50 = indicators.sma(data, 50); // Trend Filter
const adx = indicators.adx(data, params.adxPeriod); // ADX Trend Strength

const i = data.length - 1;

// Indicators
const currentSqueeze = squeezeOn[i];
const prevSqueeze = squeezeOn[i-1];
const prev2Squeeze = squeezeOn[i-2];
const currentHist = histogram[i];
const prevHist = histogram[i-1];
const currentClose = data[i].close;
const currentTrend = sma50[sma50.length - 1];
const currentAdx = adx[i];

// 1. Setup: Was there a squeeze recently?
const wasSqueeze = prevSqueeze || prev2Squeeze;

// 2. Trigger: Squeeze Fired (Transition from ON to OFF)
const squeezeFired = !currentSqueeze && wasSqueeze;

// 3. Momentum: Histogram is Positive and Rising
const isBullishMomentum = currentHist > 0 && currentHist > prevHist;

// 4. Trend Direction Filter
const isUptrend = currentClose > currentTrend;

// 5. Volume Check
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isVolumeAlive = data[i].volume > (avgVol * 0.75);

// 6. Trend Strength Filter (ADX)
const isTrending = currentAdx > params.minAdx;

if (squeezeFired && isBullishMomentum && isUptrend && isVolumeAlive && isTrending) {
  
  // Stop Loss Logic
  let stopA = chandelier[i];
  let stopB = data[i].low;
  if (!stopA || isNaN(stopA) || stopA > currentClose) stopA = 0;
  let stopLoss = Math.max(stopA, stopB);
  if ((currentClose - stopLoss) / currentClose < 0.01) {
      stopLoss = currentClose * 0.97;
  }
  
  // Target: Aggressive 3R
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`TTM Squeeze Fired (ADX \${currentAdx.toFixed(0)}) > SMA50. Vol: \${(data[i].volume/avgVol).toFixed(1)}x\`
  };
}
return null;
    `
};