import { Strategy } from '../types';

 export const vpTrendV3Robust: Strategy = {
    id: 'vp-trend-v3-robust',
    name: 'Volume Profile Trend (v3 - Robust)',
    description: 'Dynamic target, volume confirmation, and data length checks for stability.',
    category: 'Volume Profile',
    parameters: { lookback: 50, buckets: 24, volumeMultiplier: 1.5, defaultRiskPct: 0.05 },
    opinionCode: `
      const { vah, poc, val } = indicators.volumeProfile(data, 50, 24);
      const curr = data[data.length-1].close;
      if (curr > vah) return 1;
      if (curr < val) return -1;
      return 0.2;
    `,
    code: `
// Volume Profile Trend v3 (Dynamic Target + Volume Filter + Safety)
if (data.length < 51) return null; // Safety check for lookback periods

const vp = indicators.getVolumeProfile(data, params.lookback, params.buckets);
if (!vp) return null;

const i = data.length - 1;
const current = data[i];
const prev = data[i-1];
const sma50 = indicators.sma(data, 50);

if (sma50.length <= i) return null; // Ensure SMA has calculated

const currentTrend = sma50[i];

// 1. Trend Filter
const isUptrend = current.close > currentTrend;

// 2. VAH Breakout
const isBreakout = prev.close < vp.vah && current.close > vp.vah;

// 3. Volume Confirmation
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isHighVolume = current.volume > (avgVol * params.volumeMultiplier);

if (isBreakout && isUptrend && isHighVolume) {
  let stopLoss = vp.poc;
  
  if (stopLoss >= current.close || (current.close - stopLoss)/current.close < 0.02) {
     stopLoss = current.close * (1 - params.defaultRiskPct);
  }

  const risk = current.close - stopLoss;
  if (risk <= 0) return null;

  const { resistances } = indicators.findSupportResistance(data, 30);
  let target = indicators.getNearestLevel(current.close, resistances, 'RESISTANCE');

  if (!target || (target - current.close) < (risk * 1.5)) {
    target = current.close + (risk * 2.5);
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`VP Trend v3. Vol: \${(current.volume/avgVol).toFixed(1)}x\`
  };
}
return null;
    `
  }