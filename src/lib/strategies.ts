import { Strategy } from './types';

export const PREBUILT_STRATEGIES: Strategy[] = [
  {
    id: 'golden-cross',
    name: 'Golden Cross (Smart S/R)',
    description: 'Buys when SMA 50 > SMA 200. Uses recent Swing Low for Stop Loss and Swing High for Target.',
    parameters: { fastPeriod: 50, slowPeriod: 200, defaultRiskPct: 0.05 },
    code: `
// Golden Cross Strategy with Support/Resistance
const fastSMA = indicators.sma(data, params.fastPeriod);
const slowSMA = indicators.sma(data, params.slowPeriod);

const currentFast = fastSMA[fastSMA.length - 1];
const currentSlow = slowSMA[slowSMA.length - 1];
const prevFast = fastSMA[fastSMA.length - 2];
const prevSlow = slowSMA[slowSMA.length - 2];

if (prevFast < prevSlow && currentFast > currentSlow) {
  const currentClose = data[data.length - 1].close;
  
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);
  
  // Stop Loss: Nearest Support below current price
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  // Fallback if no support found nearby (use percentage)
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.15) {
     stopLoss = currentClose * (1 - params.defaultRiskPct);
  }

  // Target: Nearest Resistance above current price
  let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
  
  // Fallback if no resistance found (use 2x Risk)
  if (!target) {
     const risk = currentClose - stopLoss;
     target = currentClose + (risk * 2);
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Golden Cross + S/R Levels (SL: \${stopLoss.toFixed(2)}, TGT: \${target.toFixed(2)})\`
  };
}
return null;
    `
  },
  {
    id: 'rsi-pullback',
    name: 'RSI Pullback (Smart S/R)',
    description: 'Buys when the stock is in an uptrend but temporarily oversold. Uses Support/Resistance for exits.',
    parameters: { rsiPeriod: 14, rsiThreshold: 30, trendSma: 200, defaultRiskPct: 0.08 },
    code: `
// RSI Pullback Strategy with Support/Resistance
const rsi = indicators.rsi(data, params.rsiPeriod);
const trendSMA = indicators.sma(data, params.trendSma);

const currentRSI = rsi[rsi.length - 1];
const currentClose = data[data.length - 1].close;
const currentTrend = trendSMA[trendSMA.length - 1];

// Condition 1: In an Uptrend
const isUptrend = currentClose > currentTrend;

// Condition 2: Oversold
const isOversold = currentRSI < params.rsiThreshold;

if (isUptrend && isOversold) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Nearest Support below current price
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  // Fallback
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.15) {
     stopLoss = currentClose * (1 - params.defaultRiskPct);
  }

  // Target: Nearest Resistance above
  let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
  
  // Fallback
  if (!target) {
     const risk = currentClose - stopLoss;
     target = currentClose + (risk * 2); // Default 2R if no resistance
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`RSI Pullback + S/R Levels (SL: \${stopLoss.toFixed(2)}, TGT: \${target.toFixed(2)})\`
  };
}
return null;
    `
  },
  {
    id: 'breakout-vol',
    name: 'Volume Breakout (Smart S/R)',
    description: 'Buys when price breaks 20-day high with 2x average volume. Uses Support/Resistance for exits.',
    parameters: { lookback: 20, volumeMult: 2.0, defaultRiskPct: 0.05 },
    code: `
// Volume Breakout Strategy with Support/Resistance
const lookback = params.lookback;
const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
const maxHigh = Math.max(...recentHighs);

const currentClose = data[data.length - 1].close;
const currentVol = data[data.length - 1].volume;

// Calculate Avg Volume
const recentVols = data.slice(-lookback - 1, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;

if (currentClose > maxHigh && currentVol > (avgVol * params.volumeMult)) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Nearest Support below current price (likely the breakout level or recent low)
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  // Fallback
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.15) {
     stopLoss = currentClose * (1 - params.defaultRiskPct);
  }

  // Target: Nearest Resistance above
  let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
  
  // Fallback
  if (!target) {
     const risk = currentClose - stopLoss;
     target = currentClose + (risk * 2.5); // Breakouts often run further
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Breakout + S/R Levels (SL: \${stopLoss.toFixed(2)}, TGT: \${target.toFixed(2)})\`
  };
}
return null;
    `
  },
  {
    id: 'macd-crossover',
    name: 'MACD Crossover (Smart Trend)',
    description: 'Buys when MACD crosses above Signal line, BUT only if price is above 200 SMA (Trend) and RSI is not overbought.',
    parameters: { fast: 12, slow: 26, signal: 9, trendSma: 200, maxRsi: 70, defaultRiskPct: 0.05 },
    code: `
// MACD Crossover Strategy with Trend Filter
const { macdLine, signalLine } = indicators.macd(data, params.fast, params.slow, params.signal);
const trendSMA = indicators.sma(data, params.trendSma);
const rsi = indicators.rsi(data, 14);

const currMacd = macdLine[macdLine.length - 1];
const currSig = signalLine[signalLine.length - 1];
const prevMacd = macdLine[macdLine.length - 2];
const prevSig = signalLine[signalLine.length - 2];

const currentClose = data[data.length - 1].close;
const currentTrend = trendSMA[trendSMA.length - 1];
const currentRsi = rsi[rsi.length - 1];

// 1. Bullish Crossover
const isCrossover = prevMacd < prevSig && currMacd > currSig;

// 2. Trend Filter: Price must be above 200 SMA
const isUptrend = currentClose > currentTrend;

// 3. Momentum Check: RSI should not be overbought (>70)
const isHealthy = currentRsi < params.maxRsi;

if (isCrossover && isUptrend && isHealthy) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Nearest Support
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.15) {
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
    reason: \`MACD Cross + Uptrend (Price > SMA200) + Healthy RSI (\${currentRsi.toFixed(0)})\`
  };
}
return null;
    `
  },
  {
    id: 'bb-squeeze',
    name: 'Bollinger Band Squeeze',
    description: 'Buys when price breaks above the Upper Bollinger Band after a period of low volatility (squeeze).',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    code: `
// Bollinger Band Squeeze Strategy
const { upper, middle, lower } = indicators.bollingerBands(data, params.period, params.multiplier);

const currentClose = data[data.length - 1].close;
const prevClose = data[data.length - 2].close;
const currentUpper = upper[upper.length - 1];
const prevUpper = upper[upper.length - 2];

// 1. Breakout Condition: Price crosses above Upper Band
const isBreakout = prevClose < prevUpper && currentClose > currentUpper;

// 2. Squeeze Condition (Optional but good): Band width is relatively narrow
// For simplicity, we just check for the breakout here as the primary signal

if (isBreakout) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Middle Band (SMA 20) or Nearest Support
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.10) {
     stopLoss = middle[middle.length - 1]; // Use Middle Band as dynamic support
  }

  // Target: 2x Risk or Nearest Resistance
  let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
  if (!target) {
     const risk = currentClose - stopLoss;
     target = currentClose + (risk * 2.5); // Breakouts run hard
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Bollinger Breakout: Price (\${currentClose.toFixed(2)}) > Upper Band (\${currentUpper.toFixed(2)})\`
  };
}
return null;
    `
  },
  {
    id: 'stoch-oversold',
    name: 'Stochastic Oversold',
    description: 'Buys when Stochastic %K crosses above %D while in oversold territory (< 20). Good for range-bound markets.',
    parameters: { kPeriod: 14, dPeriod: 3, oversold: 20, defaultRiskPct: 0.05 },
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
  },
  {
    id: 'inside-bar-nr7',
    name: 'Inside Bar / NR7 (Smart Trend)',
    description: 'Buys when price breaks out of a volatility contraction pattern (Inside Bar or NR7), aligned with trend and volume.',
    parameters: { defaultRiskPct: 0.03, trendSma: 50, minRsi: 50 },
    code: `
// Inside Bar / NR7 Strategy with Trend & Volume
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

// 6. Volume Filter: Volume > Avg Vol (20)
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isHighVol = current.volume > avgVol;

if ((isInsideBar || isNR7) && isBreakout && isUptrend && isMomentum && isHighVol) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Low of the setup bar (prev) or Nearest Support
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
    reason: \`Smart Volatility Breakout: \${isInsideBar ? 'Inside Bar' : ''} \${isNR7 ? 'NR7' : ''} + Trend + Vol\`
  };
}
return null;
    `
  },
  {
    id: 'gap-and-go',
    name: 'Gap and Go (Momentum)',
    description: 'Buys when a stock gaps up >2% and holds the gain. Signals strong institutional buying.',
    parameters: { gapPct: 0.02, defaultRiskPct: 0.05 },
    code: `
// Gap and Go Strategy
const current = data[data.length - 1];
const prev = data[data.length - 2];

// 1. Gap Condition: Open is > X% above Prev Close
const gapSize = (current.open - prev.close) / prev.close;
const isGapUp = gapSize >= params.gapPct;

// 2. Strength Condition: Current Close > Current Open (Green Candle)
// We want to ensure the gap isn't being sold into
const isGreen = current.close > current.open;

if (isGapUp && isGreen) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: The Gap Support (Prev Close) or Low of current day
  // Aggressive: Low of current day. Conservative: Prev Close.
  let stopLoss = current.open; // Using Open as the support level
  
  // Target: 2x Risk
  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Gap and Go: \${(gapSize * 100).toFixed(1)}% Gap Up + Strong Close\`
  };
}
return null;
    `
  {
    id: 'ttm-squeeze',
    name: 'TTM Squeeze (Momentum Physics)',
    description: 'The "Coil and Burst". Buys when Bollinger Bands squeeze inside Keltner Channels, then fires on momentum expansion.',
    parameters: { bbPeriod: 20, bbMult: 2.0, kcMult: 1.5, defaultRiskPct: 0.05 },
    code: `
// TTM Squeeze Strategy
const bb = indicators.bollingerBands(data, params.bbPeriod, params.bbMult);
const kc = indicators.keltnerChannels(data, params.bbPeriod, params.kcMult);

// Calculate Momentum (Linear Reg of Price delta)
// Simplified proxy: Delta of Close vs Avg(High, Low)
const prices = data.map(c => c.close - (c.high + c.low)/2);
const momentum = indicators.linearRegression(prices, 20); // 20 period LinReg

const current = data[data.length - 1];
const prev = data[data.length - 2];
const i = data.length - 1;
const iPrev = data.length - 2;

// 1. Squeeze Condition (Red Dot): BB inside KC
// We check if the Squeeze WAS on recently (coiling)
const wasSqueeze = bb.upper[iPrev] < kc.upper[iPrev] && bb.lower[iPrev] > kc.lower[iPrev];

// 2. Fire Condition (Green Dot): BB expands outside KC
const isFired = bb.upper[i] > kc.upper[i] || bb.lower[i] < kc.lower[i];

// 3. Momentum Condition: Histogram is positive and rising
const momCurr = momentum[i];
const momPrev = momentum[iPrev];
const isBullishMom = momCurr > 0 && momCurr > momPrev;

if (wasSqueeze && isFired && isBullishMom) {
  // Chandelier Exit Logic for Stop Loss (ATR * 3)
  const atr = indicators.atr(data, 22);
  const currentAtr = atr[atr.length - 1];
  const chandelierStop = Math.max(...data.slice(-22).map(c => c.high)) - (currentAtr * 3.0);
  
  // Use Chandelier or Swing Low, whichever is tighter/sensible
  let stopLoss = chandelierStop;
  if (stopLoss > current.close) stopLoss = current.close * 0.95; // Safety fallback

  // Target: VWAP + 2 StdDev (Approximated here as SMA + 2*BB Width)
  // Or simply 2x Risk as per standard
  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`TTM Squeeze Fired: Volatility Expansion + Rising Momentum\`
  };
}
return null;
    `
  },
  {
    id: 'smc-liquidity-sweep',
    name: 'SMC Liquidity Sweep (Turtle Soup)',
    description: 'Smart Money Concept. Buys when price sweeps a key support level (taking stops) and immediately reclaims it.',
    parameters: { lookback: 20, defaultRiskPct: 0.03 },
    code: `
// SMC Liquidity Sweep Strategy
const current = data[data.length - 1];
const prev = data[data.length - 2];

// 1. Identify Key Liquidity Level (Swing Low)
// We look for a significant low in the last X days
const lookback = params.lookback;
const recentLows = data.slice(-lookback - 5, -5).map(c => c.low); // Exclude recent few candles to find "old" support
const keySupport = Math.min(...recentLows);

// 2. The Sweep: Price went below support...
const didSweep = current.low < keySupport;

// 3. The Reclaim: ...but Closed ABOVE it (Failed Breakdown)
const didReclaim = current.close > keySupport;

// 4. Validation: Green Candle
const isBullish = current.close > current.open;

if (didSweep && didReclaim && isBullish) {
  // Stop Loss: Below the sweep wick (the absolute low of the move)
  const stopLoss = current.low - (current.low * 0.005); // 0.5% buffer below wick

  // Target: The next major liquidity pool (Swing High)
  const recentHighs = data.slice(-lookback).map(c => c.high);
  const keyResistance = Math.max(...recentHighs);
  
  let target = keyResistance;
  
  // Ensure min 1:2 RR
  const risk = current.close - stopLoss;
  if ((target - current.close) / risk < 2) {
    target = current.close + (risk * 3); // Aim for 3R on reversals
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Liquidity Sweep: Swept \${keySupport.toFixed(2)} and reclaimed. Bear Trap.\`
  };
}
return null;
    `
  }
];
