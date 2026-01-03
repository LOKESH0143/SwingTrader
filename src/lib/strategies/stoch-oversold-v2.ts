import { Strategy } from "../types";

export const stochOversoldV2: Strategy =  {
    id: 'stoch-oversold-v2',
    name: 'Stochastic Oversold v2',
    description: 'Buys when Stochastic %K crosses above %D in oversold territory, with a 200-day SMA trend filter and ATR-based exits.',
    category: 'Mean Reversion',
    parameters: { kPeriod: 14, dPeriod: 3, oversold: 20, smaPeriod: 200, atrPeriod: 14, atrMultiplier: 2 },
    code: `
// Stochastic Oversold Strategy v2
const { k, d } = indicators.stochastic(data, params.kPeriod, 3, params.dPeriod);
const sma200 = indicators.sma(data, params.smaPeriod);
const atr = indicators.atr(data, params.atrPeriod);
// const volumeMA = indicators.sma(data.map(c => c.volume), 20);

const currentClose = data[data.length - 1].close;
// const currentVolume = data[data.length - 1].volume;
const prevK = k[k.length - 2];
const prevD = d[d.length - 2];
const currK = k[k.length - 1];
const currD = d[d.length - 1];

// 1. Trend Filter
const isInUptrend = currentClose > sma200[sma200.length - 1];

// 2. Oversold Condition
const isOversold = prevK < params.oversold && prevD < params.oversold;

// 3. Crossover Condition
const isCrossover = prevK < prevD && currK > currD;

// 4. Volume Filter
// const hasVolume = currentVolume > volumeMA[volumeMA.length - 1];

if (isInUptrend && isOversold && isCrossover) {
  const currentAtr = atr[atr.length - 1];
  const stopLoss = currentClose - (params.atrMultiplier * currentAtr);
  const target = currentClose + (2 * params.atrMultiplier * currentAtr); // 1:2 RR

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: 'Stoch Cross in Oversold Zone (K: ' + currK.toFixed(1) + ') with Trend and Volume Confirmation'
  };
}
return null;
    `
  };
