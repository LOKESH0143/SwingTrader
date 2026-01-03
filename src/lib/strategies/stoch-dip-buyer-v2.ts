import { Strategy } from "../types";

export const stochDipBuyer_v2: Strategy =  {
    id: 'stoch-dip-buyer-v2',
    name: 'Stochastic Dip Buyer (v2 - Dynamic Target)',
    description: 'Improved version with dynamic profit target based on 50-period SMA for mean reversion.',
    category: 'Mean Reversion',
    parameters: { kPeriod: 14, dPeriod: 3, oversold: 20, defaultRiskPct: 0.05, targetSmaPeriod: 50 },
    opinionCode: `
      const { k, d } = indicators.stochastic(data, 14, 3, 3);
      const currK = k[k.length-1];
      if (currK < 20) return 1; // Oversold
      if (currK > 80) return -1; // Overbought
      return 0;
    `,
    code: `
// Stochastic Dip Buyer v2 (Dynamic Target)
const { k, d } = indicators.stochastic(data, params.kPeriod, 3, params.dPeriod);
const sma200 = indicators.sma(data, 200); // Long-Term Trend
const smaTarget = indicators.sma(data, params.targetSmaPeriod); // Dynamic Target SMA

const i = data.length - 1;
const currK = k[i];
const currD = d[i];
const prevK = k[i-1];
const prevD = d[i-1];

const currentClose = data[i].close;
const currentOpen = data[i].open;
const currentTrend = sma200[sma200.length - 1];

// 1. Oversold Condition (The Dip)
const isOversold = prevK < params.oversold && prevD < params.oversold;

// 2. Crossover Condition (The Trigger)
const isCrossover = prevK < prevD && currK > currD;

// 3. Trend Filter (The Safety Net)
const isUptrend = currentClose > currentTrend;

// 4. Confirmation (Green Candle)
const isGreen = currentClose > currentOpen;

if (isOversold && isCrossover && isUptrend && isGreen) {

  // Stop Loss: Recent Low
  const lowOfDip = Math.min(data[i].low, data[i-1].low, data[i-2].low);
  let stopLoss = lowOfDip;
  
  // Safety: If the dip low is too close (< 2%), give it some room
  if ((currentClose - stopLoss) / currentClose < 0.02) {
     stopLoss = currentClose * 0.97; // 3% wiggle room
  }

  // --- DYNAMIC TARGET LOGIC ---
  let target = smaTarget[i];
  const risk = currentClose - stopLoss;

  // Fallback: If SMA target is not valid or too close, use 2R
  if (!target || target <= currentClose || (target - currentClose) < (risk * 1.5)) {
    target = currentClose + (risk * 2);
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Stoch Dip v2 (Dyn. Target): K/D Cross > SMA 200. Tgt @ SMA\${params.targetSmaPeriod}\`
  };
}
return null;
    `
  };