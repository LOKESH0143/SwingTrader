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
    name: 'Volume Breakout (Volume Profile)',
    description: 'Buys when price breaks 20-day high with 2x volume AND clears the Value Area High (VAH).',
    parameters: { lookback: 20, volumeMult: 2.0, defaultRiskPct: 0.05 },
    code: `
// Volume Breakout Strategy with Volume Profile
const lookback = params.lookback;
const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
const maxHigh = Math.max(...recentHighs);

const currentClose = data[data.length - 1].close;
const currentVol = data[data.length - 1].volume;

// Calculate Avg Volume
const recentVols = data.slice(-lookback - 1, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;

// Volume Profile Check (Last 50 days)
const vp = indicators.getVolumeProfile(data, 50, 20);
const isAboveVAH = vp ? currentClose > vp.vah : true; // Fallback to true if not enough data

if (currentClose > maxHigh && currentVol > (avgVol * params.volumeMult) && isAboveVAH) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Nearest Support or VAH (Value Area High acts as support now)
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  if (!stopLoss && vp) {
     stopLoss = vp.vah; // Use VAH as support
  }
  
  // Fallback
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.15) {
     stopLoss = currentClose * (1 - params.defaultRiskPct);
  }

  // Target: Nearest Resistance
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
    reason: \`Breakout > 20d High & VAH. Vol: \${(currentVol/avgVol).toFixed(1)}x\`
  };
}
return null;
    `
  },
  {
    id: 'macd-crossover',
    name: 'MACD Crossover (Smart Trend + Chandelier)',
    description: 'Buys when MACD crosses above Signal line in an uptrend. Uses Chandelier Exit (ATR x 3) to ride the trend.',
    parameters: { fast: 12, slow: 26, signal: 9, trendSma: 200, maxRsi: 70 },
    code: `
// MACD Crossover Strategy with Chandelier Exit
const { macdLine, signalLine } = indicators.macd(data, params.fast, params.slow, params.signal);
const trendSMA = indicators.sma(data, params.trendSma);
const rsi = indicators.rsi(data, 14);
const chandelier = indicators.chandelierExit(data, 22, 3.0); // PDF recommends 22 period, 3.0 mult

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
  // Stop Loss: Chandelier Exit (Dynamic Trailing Stop)
  let stopLoss = chandelier[chandelier.length - 1];
  
  // Validation: Ensure Chandelier is valid AND below current price
  // If Chandelier is above price, it means the trend is down/reversing, so we can't use it as a long stop
  const isValidChandelier = stopLoss && !isNaN(stopLoss) && stopLoss < currentClose;
  
  if (!isValidChandelier) {
     const { supports } = indicators.findSupportResistance(data, 10);
     const nearestSupport = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
     
     if (nearestSupport && nearestSupport < currentClose) {
        stopLoss = nearestSupport;
     } else {
        stopLoss = currentClose * 0.95; // Default 5% stop
     }
  }

  // Final Safety Check to prevent negative R:R
  if (stopLoss >= currentClose) {
     stopLoss = currentClose * 0.95;
  }

  // Target: Open-ended trend following, but we set a 3R target as a baseline
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`MACD Cross + Uptrend. Trailing SL: Chandelier Exit (\${stopLoss.toFixed(2)})\`
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
  },
  {
    id: 'ttm-squeeze',
    name: 'TTM Squeeze (Volatility Breakout)',
    description: 'Identifies periods of low volatility (Squeeze) followed by an explosive move. Uses Chandelier Exit for stops.',
    parameters: { defaultRiskPct: 0.05 },
    code: `
// TTM Squeeze Strategy
const { squeezeOn, histogram } = indicators.ttmSqueeze(data);
const chandelier = indicators.chandelierExit(data, 22, 3.0);

const i = data.length - 1;
const currentSqueeze = squeezeOn[i];
const prevSqueeze = squeezeOn[i-1];
const prev2Squeeze = squeezeOn[i-2];

const currentHist = histogram[i];
const prevHist = histogram[i-1];

// 1. Setup: Was there a squeeze recently? (Red Dot)
// We check if we were in a squeeze in the last few bars but NOW we are firing
const wasSqueeze = prevSqueeze || prev2Squeeze;

// 2. Trigger: Squeeze Fired (Green Dot) - No longer in squeeze
const squeezeFired = !currentSqueeze && wasSqueeze;

// 3. Momentum: Histogram is Positive and Rising (Cyan bars)
const isBullishMomentum = currentHist > 0 && currentHist > prevHist;

if (squeezeFired && isBullishMomentum) {
  const currentClose = data[i].close;
  
  // Stop Loss: Chandelier Exit
  let stopLoss = chandelier[i];
  
  // Fallback if Chandelier is NaN or too far
  if (!stopLoss || isNaN(stopLoss) || (currentClose - stopLoss) / currentClose > 0.15) {
     const { supports } = indicators.findSupportResistance(data, 10);
     stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT') || currentClose * 0.95;
  }

  // Target: VWAP + 2 StdDev (Approximated as BB Upper + buffer)
  // Or simply 2x Risk
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 2.5); // Explosive moves target higher RR

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`TTM Squeeze Fired + Bullish Momentum. SL: Chandelier Exit\`
  };
}
return null;
    `
  },
  {
    id: 'smc-liquidity-sweep',
    name: 'SMC Liquidity Sweep (Turtle Soup)',
    description: 'Buys when price sweeps a major support level (taking out retail stops) and immediately reverses. High win rate reversal setup.',
    parameters: { defaultRiskPct: 0.03 },
    code: `
// SMC Liquidity Sweep Strategy
const current = data[data.length - 1];
const prev = data[data.length - 2];

// 1. Identify Key Support (Swing Lows)
const { supports } = indicators.findSupportResistance(data, 50); // Look back 50 candles for major levels
const nearestSupport = indicators.getNearestLevel(current.close, supports, 'SUPPORT');

if (nearestSupport) {
  // 2. Sweep Condition: Price dipped below support but closed above it
  // We check if the Low was below support, but Close is back above
  const didSweep = current.low < nearestSupport && current.close > nearestSupport;
  
  // 3. Strength Condition: Green Candle (Close > Open)
  const isGreen = current.close > current.open;

  // 4. Volume Confirmation: High volume on the reversal candle (Stopping Volume)
  const recentVols = data.slice(-21, -1).map(c => c.volume);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const isHighVol = current.volume > avgVol;

  if (didSweep && isGreen && isHighVol) {
    // Stop Loss: Just below the sweep low (The "Pin Bar" low)
    const stopLoss = current.low;
    
    // Target: VWAP + 2 StdDev (Mean Reversion)
    // We calculate a rolling VWAP(20) and add bands
    const vwapLine = indicators.vwap(data, 20);
    const currentVWAP = vwapLine[vwapLine.length - 1];
    
    // Calculate StdDev of price relative to VWAP (simplified)
    const stdDevs = indicators.stdDev(data, 20);
    const currentStdDev = stdDevs[stdDevs.length - 1];
    
    let target = currentVWAP + (2 * currentStdDev);
    
    // Fallback if VWAP target is too close or below price
    if (target <= current.close) {
       target = current.close + ((current.close - stopLoss) * 3); // 3R Target for reversals
    }

    return {
      signal: 'BUY',
      stopLoss: stopLoss,
      target: target,
      reason: \`Liquidity Sweep of \${nearestSupport.toFixed(2)} + High Vol Reversal\`
    };
  }
}
return null;
    `
  },
  {
    id: 'candle-engulfing',
    name: 'Bullish Engulfing (Reversal)',
    description: 'Buys when a large green candle completely engulfs the previous red candle. Strong reversal signal.',
    parameters: { defaultRiskPct: 0.03 },
    code: `
// Bullish Engulfing Strategy
const current = data[data.length - 1];
const prev = data[data.length - 2];

// 1. Pattern Check
const isEngulfing = indicators.isBullishEngulfing(current, prev);

// 2. Context: Should be in a short-term downtrend or pullback
// Check if Close is below SMA 20 (Pullback)
const sma20 = indicators.sma(data, 20);
const currSma = sma20[sma20.length - 1];
const isPullback = current.close < currSma;

if (isEngulfing && isPullback) {
  // Stop Loss: Low of the engulfing candle
  const stopLoss = current.low;
  
  // Target: 2x Risk
  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: 'Bullish Engulfing Pattern in Pullback'
  };
}
return null;
    `
  },
  {
    id: 'candle-hammer',
    name: 'Hammer at Support',
    description: 'Buys when a Hammer candle forms near a key support level. Classic "buy the dip" setup.',
    parameters: { defaultRiskPct: 0.03 },
    code: `
// Hammer at Support Strategy
const current = data[data.length - 1];

// 1. Pattern Check
const isHammer = indicators.isHammer(current);

if (isHammer) {
  // 2. Context: Must be at Support
  const { supports, resistances } = indicators.findSupportResistance(data, 20);
  const nearestSupport = indicators.getNearestLevel(current.close, supports, 'SUPPORT');
  
  // Check if the Hammer's tail touched or pierced the support
  // And the support is close (within 2% of Low)
  const isAtSupport = nearestSupport && 
                      current.low <= nearestSupport * 1.01 && // Touched or near
                      current.low >= nearestSupport * 0.98;   // Not too far below

  if (isAtSupport) {
    // Stop Loss: Low of the Hammer
    const stopLoss = current.low;
    
    // Target: Nearest Resistance
    let target = indicators.getNearestLevel(current.close, resistances, 'RESISTANCE');
    if (!target) {
       target = current.close + ((current.close - stopLoss) * 2);
    }

    return {
      signal: 'BUY',
      stopLoss: stopLoss,
      target: target,
      reason: \`Hammer Candle at Support (\${nearestSupport.toFixed(2)})\`
    };
  }
}
return null;
    `
  }
];
