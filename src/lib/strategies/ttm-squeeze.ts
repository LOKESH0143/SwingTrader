import { Strategy } from "../types";

export const ttmSqueeze: Strategy = {
    id: 'ttm-squeeze',
    name: 'TTM Squeeze (Optimized)',
    description: 'Trend-aligned TTM Squeeze. Requires price > SMA 50 and active volume. Uses tighter structure-based stops.',
    category: 'Volatility',
    parameters: { defaultRiskPct: 0.05 },
    opinionCode: `
      const { squeezeOn, histogram } = indicators.ttmSqueeze(data);
      const currHist = histogram[histogram.length-1];
      const prevHist = histogram[histogram.length-2];
      if (currHist > 0 && currHist > prevHist) return 1;
      if (currHist < 0) return -1;
      return 0;
    `,
    code: `
// TTM Squeeze Optimized (Trend Aligned + Vol)
const { squeezeOn, histogram } = indicators.ttmSqueeze(data);
const chandelier = indicators.chandelierExit(data, 22, 3.0);
const sma50 = indicators.sma(data, 50); // Trend Filter

const i = data.length - 1;

// Indicators
const currentSqueeze = squeezeOn[i];
const prevSqueeze = squeezeOn[i-1];
const prev2Squeeze = squeezeOn[i-2];
const currentHist = histogram[i];
const prevHist = histogram[i-1];
const currentClose = data[i].close;
const currentTrend = sma50[sma50.length - 1];

// 1. Setup: Was there a squeeze recently?
const wasSqueeze = prevSqueeze || prev2Squeeze;

// 2. Trigger: Squeeze Fired (Transition from ON to OFF)
const squeezeFired = !currentSqueeze && wasSqueeze;

// 3. Momentum: Histogram is Positive and Rising (Cyan bars)
// This confirms the explosion is to the UPSIDE
const isBullishMomentum = currentHist > 0 && currentHist > prevHist;

// --- IMPROVEMENT 1: Trend Filter ---
// Never buy a squeeze in a downtrend. 
// Price must be above the 50 SMA.
const isUptrend = currentClose > currentTrend;

// --- IMPROVEMENT 2: Volume Check ---
// We don't need massive volume, but we need "alive" volume.
// Avoid days where volume is < 75% of average.
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isVolumeAlive = data[i].volume > (avgVol * 0.75);

if (squeezeFired && isBullishMomentum && isUptrend && isVolumeAlive) {
  
  // Stop Loss Logic:
  // Option A: Chandelier Exit (Trailing)
  let stopA = chandelier[i];
  
  // Option B: Low of the Firing Candle (Structure)
  // If the breakout is real, price shouldn't fall back below today's low.
  let stopB = data[i].low;

  // Validation: Filter out invalid Chandelier values
  if (!stopA || isNaN(stopA) || stopA > currentClose) stopA = 0;

  // PICK THE TIGHTER STOP (Higher Price) to reduce risk
  // But ensure it's not TOO close (noise). 
  let stopLoss = Math.max(stopA, stopB);
  
  // Fallback: If stops are too close (< 1%), give it breathing room (3%)
  if ((currentClose - stopLoss) / currentClose < 0.01) {
      stopLoss = currentClose * 0.97;
  }
  
  // Target: Aggressive 3R (Squeezes move fast)
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`TTM Squeeze Fired + Trend (Above SMA50). Vol: \${(data[i].volume/avgVol).toFixed(2)}x\`
  };
}
return null;
    `
};