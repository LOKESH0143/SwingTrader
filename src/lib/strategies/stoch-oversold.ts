import { Strategy } from "../types";

export const stochOversold: Strategy =  {
    id: 'stoch-oversold',
    name: 'Stochastic Oversold',
    description: 'Buys when Stochastic %K crosses above %D while in oversold territory (< 20). Good for range-bound markets.',
    category: 'Mean Reversion',
    parameters: { kPeriod: 14, dPeriod: 3, oversold: 20, defaultRiskPct: 0.05 },
    opinionCode: `
      const { k, d } = indicators.stochastic(data, 14, 3, 3);
      const currK = k[k.length-1];
      if (currK < 20) return 1; // Oversold
      if (currK > 80) return -1; // Overbought
      return 0;
    `,
    code: `
// Stochastic Oversold Strategy
const { k, d } = indicators.stochastic(data, params.kPeriod, 3, params.dPeriod);

const currK = k[k.length - 1];
const currD = d[d.length - 1];
const prevK = k[k.length - 2];
const prevD = d[d.length - 2];

// 1. Oversold Condition
const isOversold = prevK < params.oversold && prevD < params.oversold;

// 2. Crossover Condition: K crosses above D
const isCrossover = prevK < prevD && currK > currD;

if (isOversold && isCrossover) {
  const currentClose = data[data.length - 1].close;

  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Recent Low / Support
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.10) {
     stopLoss = currentClose * (1 - params.defaultRiskPct);
  }

  // Target: Nearest Resistance
  let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
  if (!target) {
     const risk = currentClose - stopLoss;
     target = currentClose + (risk * 2);
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Stochastic Cross in Oversold Zone (K: \${currK.toFixed(1)}, D: \${currD.toFixed(1)})\`
  };
}
return null;
    `
  };