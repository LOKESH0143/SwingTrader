import { Strategy } from './types';

export const PREBUILT_STRATEGIES: Strategy[] = [
  {
    id: 'golden-cross',
    name: 'Golden Cross (Optimized)',
    description: 'Buys when SMA 50 > SMA 200 with RSI, Volume, and Trend Slope filters. Uses ATR for stops.',
    parameters: { fastPeriod: 50, slowPeriod: 200, defaultRiskPct: 0.05 },
    code: `
// Optimized Golden Cross (Trend + Momentum + Volume)
const fastSMA = indicators.sma(data, params.fastPeriod); // 50
const slowSMA = indicators.sma(data, params.slowPeriod); // 200
const rsi = indicators.rsi(data, 14);

// Get current and previous values
const i = data.length - 1;
const currentFast = fastSMA[i];
const currentSlow = slowSMA[i];
const prevFast = fastSMA[i-1];
const prevSlow = slowSMA[i-1];

// 1. The Crossover Signal
const isGoldenCross = prevFast < prevSlow && currentFast > currentSlow;

if (isGoldenCross) {
  const currentClose = data[i].close;
  
  // --- IMPROVEMENT 1: RSI Filter ---
  // Avoid buying if RSI is already overbought (>70). 
  // We want momentum (>50) but plenty of room to run.
  const currentRsi = rsi[i];
  const isHealthyMomentum = currentRsi > 50 && currentRsi < 70;

  // --- IMPROVEMENT 2: 200 SMA Slope ---
  // Ensure the long-term trend isn't pointing down.
  // We check if the 200 SMA is higher than it was 5 days ago.
  const slowSma5DaysAgo = slowSMA[i-5];
  const isTrendFlatOrUp = currentSlow >= slowSma5DaysAgo;

  // --- IMPROVEMENT 3: Volume Confirmation ---
  // Check if current volume is at least 10% higher than the 20-day average
  const recentVols = data.slice(-21, -1).map(c => c.volume);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const isVolumeSupported = data[i].volume > (avgVol * 1.1);

  // Combine all conditions
  if (isHealthyMomentum && isTrendFlatOrUp && isVolumeSupported) {
    
    // Find Support & Resistance
    const { supports, resistances } = indicators.findSupportResistance(data, 20); // Increased lookback to 20 for better levels
    
    // Stop Loss: Nearest Support
    let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
    
    // Fallback: Use ATR based stop if support is too far or missing
    // (ATR is better than fixed % because it adapts to volatility)
    const atr = indicators.atr(data, 14);
    const currentAtr = atr[atr.length - 1];
    
    if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.08) {
       stopLoss = currentClose - (currentAtr * 2); // 2 ATR Stop
    }

    // Target: Nearest Resistance
    let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
    
    if (!target) {
       const risk = currentClose - stopLoss;
       target = currentClose + (risk * 2); // 2R Target
    }

    return {
      signal: 'BUY',
      stopLoss: stopLoss,
      target: target,
      reason: \`Golden Cross Optimized: RSI \${currentRsi.toFixed(1)} + Rising 200SMA + Vol Support\`
    };
  }
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
    id: 'institutional-breakout',
    name: 'Institutional Breakout (50d High + Vol)',
    description: 'Buys new 50-day highs with strong volume and a solid close. Filters out weak "wick" breakouts.',
    parameters: { lookback: 50, volumeMult: 1.5, defaultRiskPct: 0.05 },
    code: `
// Institutional Breakout (50d High + Strong Close)
const lookback = 50; // Increased to 50 (Quarterly High) for significance
const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
const maxHigh = Math.max(...recentHighs);

const i = data.length - 1;
const currentClose = data[i].close;
const currentLow = data[i].low;
const currentHigh = data[i].high;
const currentVol = data[i].volume;

// 1. Breakout Condition
// Price must CLOSE above the 50-Day High (not just touch it)
const isBreakout = currentClose > maxHigh;

// 2. Volume Condition (Realistic)
// We look for 1.5x volume (Institutional Interest), not 2x.
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isHighVol = currentVol > (avgVol * 1.5);

// 3. Candle Strength (The "Anti-Trap" Filter)
// The price must close in the top 25% of the day's range.
// This ensures we aren't buying a "shooting star" or weak breakout.
const range = currentHigh - currentLow;
const closePos = (currentClose - currentLow) / range;
const isStrongClose = closePos > 0.75;

// 4. Trend Filter (Avoid Bear Market Rallies)
const sma200 = indicators.sma(data, 200);
const isUptrend = currentClose > sma200[sma200.length - 1];

if (isBreakout && isHighVol && isStrongClose && isUptrend) {
  
  // Stop Loss: Low of the Breakout Candle
  // This is the most logical stop. If price falls back below today's low,
  // the breakout has failed immediately.
  let stopLoss = currentLow;
  
  // Safety: If the candle is huge (> 5% risk), tighten stop to midpoint
  // or use a trailing ATR stop.
  const riskPct = (currentClose - stopLoss) / currentClose;
  if (riskPct > 0.05) {
     stopLoss = currentClose * 0.95; // Cap risk at 5%
  }

  // Target: Momentum (3R)
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Institutional Breakout: New 50d High + Strong Close + Vol \${(currentVol/avgVol).toFixed(1)}x\`
  };
}
return null;
    `
  },
  {
    id: 'macd-standard',
    name: 'MACD (Standard)',
    description: 'Standard MACD Crossover with Trend (SMA 200) and basic ADX (>20) filter.',
    parameters: { fast: 12, slow: 26, signal: 9, trendSma: 200, maxRsi: 70, minAdx: 20 },
    code: `
// MACD Standard (Smart Trend + Chandelier)
const { macdLine, signalLine } = indicators.macd(data, params.fast, params.slow, params.signal);
const trendSMA = indicators.sma(data, params.trendSma);
const rsi = indicators.rsi(data, 14);
const adx = indicators.adx(data, 14);
const chandelier = indicators.chandelierExit(data, 22, 3.0);

const currMacd = macdLine[macdLine.length - 1];
const currSig = signalLine[signalLine.length - 1];
const prevMacd = macdLine[macdLine.length - 2];
const prevSig = signalLine[signalLine.length - 2];

const currentClose = data[data.length - 1].close;
const currentTrend = trendSMA[trendSMA.length - 1];
const currentRsi = rsi[rsi.length - 1];
const currentAdx = adx[adx.length - 1];

// 1. Bullish Crossover
const isCrossover = prevMacd < prevSig && currMacd > currSig;

// 2. Trend Filter
const isUptrend = currentClose > currentTrend;

// 3. Momentum Check
const isHealthy = currentRsi < params.maxRsi;

// 4. Chop Filter
const isTrending = currentAdx > params.minAdx;

if (isCrossover && isUptrend && isHealthy && isTrending) {
  let stopLoss = chandelier[chandelier.length - 1];
  
  const isValidChandelier = stopLoss && !isNaN(stopLoss) && stopLoss < currentClose;
  
  if (!isValidChandelier) {
     const { supports } = indicators.findSupportResistance(data, 10);
     const nearestSupport = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
     stopLoss = nearestSupport || currentClose * 0.95;
  }

  if (stopLoss >= currentClose) stopLoss = currentClose * 0.95;

  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`MACD Standard: Cross + Uptrend + ADX > 20\`
  };
}
return null;
    `
  },

  {
    id: 'bb-squeeze',
    name: 'Bollinger Band Squeeze (True Expansion)',
    description: 'Buys when price breaks Upper Band with expanding bandwidth and high volume. Filters out fakeouts.',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    code: `
// Bollinger Band Squeeze (True Expansion + Volume)
const { upper, middle, lower } = indicators.bollingerBands(data, params.period, params.multiplier);

const i = data.length - 1;
const currentClose = data[i].close;
const currentOpen = data[i].open;
const currentHigh = data[i].high;
const currentLow = data[i].low;

const currentUpper = upper[i];
const prevUpper = upper[i-1];
const currentLower = lower[i];
const prevLower = lower[i-1];

// 1. Calculate Bandwidth (The "Squeeze" Metric)
// Formula: (Upper - Lower) / Middle
const currentBW = (currentUpper - currentLower) / middle[i];
const prevBW = (prevUpper - prevLower) / middle[i-1];

// 2. Expansion Condition (The "Pop")
// We want the bands to be opening up (volatility increasing)
const isExpanding = currentBW > prevBW;

// 3. Breakout Condition
// Price closes ABOVE the Upper Band
const isBreakout = currentClose > currentUpper;

// 4. Candle Quality (Avoid "Shooting Stars")
// The Close should be in the upper 25% of the day's range.
// If there is a huge upper wick, it means sellers pushed it down -> AVOID.
const range = currentHigh - currentLow;
const closePosition = (currentClose - currentLow) / range;
const isStrongClose = closePosition > 0.75;

// 5. Volume Confirmation
// Volume must be higher than the 20-period average
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isVolumeHigh = data[i].volume > avgVol;

if (isBreakout && isExpanding && isStrongClose && isVolumeHigh) {
  
  // Stop Loss: The Middle Band (20 SMA)
  // In a true "Walk the Bands" breakout, price rarely touches the 20 SMA.
  // Using the 20 SMA is standard, but if it's too far, use the Low of the Breakout Candle.
  const sma20 = middle[i];
  const lowOfCandle = currentLow;
  
  // Use the tighter of the two to manage risk, but default to SMA 20 for trend riding
  let stopLoss = sma20;
  
  // Safety: If SMA 20 is > 5% away, tighten to the breakout candle's low
  if ((currentClose - stopLoss) / currentClose > 0.05) {
     stopLoss = lowOfCandle;
  }

  // Target: Momentum play (Open ended) -> But we set 2.5R for the system
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 2.5);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`BB Squeeze Breakout: Strong Close + Vol Expansion. SL: \${stopLoss.toFixed(2)}\`
  };
}
return null;
    `
  },
  {
    id: 'bb-breakout-simple',
    name: 'Bollinger Band Breakout (Simple)',
    description: 'Buys when price breaks above the Upper Bollinger Band. Simple volatility breakout.',
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
    id: 'bb-trend-rider',
    name: 'Bollinger Trend Rider (Simple + Trend Filter)',
    description: 'Buys when price breaks Upper Band while above SMA 50. Uses SMA 20 as dynamic stop.',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    code: `
// Bollinger Trend Rider (Simple + Trend Filter)
const { upper, middle, lower } = indicators.bollingerBands(data, params.period, params.multiplier);
const sma50 = indicators.sma(data, 50);

const i = data.length - 1;
const currentClose = data[i].close;
const prevClose = data[i-1].close;

const currentUpper = upper[i];
const prevUpper = upper[i-1];
const currentTrend = sma50[sma50.length - 1];

// 1. The Simple Breakout (Cross over Upper Band)
// We go back to the raw signal: Price crossed the line.
const isBreakout = prevClose < prevUpper && currentClose > currentUpper;

// 2. The ONLY Filter: Trend Alignment
// If price is below 50 SMA, the stock is structurally weak. Breakouts here fail often.
// If price is above 50 SMA, the "Wind is at your back."
const isUptrend = currentClose > currentTrend;

if (isBreakout && isUptrend) {
  
  // Stop Loss: The Middle Band (20 SMA)
  // Why? In a strong trend, price 'surfs' the upper band and respects the 20 SMA.
  // "Nearest Support" can sometimes be too far away (10%+ risk).
  // SMA 20 is dynamic and trails the price up.
  let stopLoss = middle[i];
  
  // Target: Momentum (Let it ride)
  // We use a 3R target, but ideally, you would trail the stop using the 20 SMA.
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Bollinger Trend Rider: Breakout > SMA 50. Stop: SMA 20\`
  };
}
return null;
    `
  },
  {
    id: 'stoch-dip-buyer',
    name: 'Stochastic Dip Buyer (Trend Filter + Green Candle)',
    description: 'Buys oversold dips ONLY in a long-term uptrend (Above SMA 200). Avoids catching falling knives.',
    parameters: { kPeriod: 14, dPeriod: 3, oversold: 20, defaultRiskPct: 0.05 },
    code: `
// Stochastic Dip Buyer (Trend Filter + Green Candle)
const { k, d } = indicators.stochastic(data, params.kPeriod, 3, params.dPeriod);
const sma200 = indicators.sma(data, 200); // The Long-Term Trend Line

const i = data.length - 1;
const currK = k[i];
const currD = d[i];
const prevK = k[i-1];
const prevD = d[i-1];

const currentClose = data[i].close;
const currentOpen = data[i].open;
const currentTrend = sma200[sma200.length - 1];

// 1. Oversold Condition (The Dip)
// We look for deep value (< 20 or 25)
const isOversold = prevK < params.oversold && prevD < params.oversold;

// 2. Crossover Condition (The Trigger)
const isCrossover = prevK < prevD && currK > currD;

// 3. Trend Filter (The Safety Net)
// We ONLY buy dips if the long-term trend is UP.
const isUptrend = currentClose > currentTrend;

// 4. Confirmation (Green Candle)
// We want to see actual buyers on the day of the crossover.
// Avoid buying if the crossover happened on a red "doji" or weak candle.
const isGreen = currentClose > currentOpen;

if (isOversold && isCrossover && isUptrend && isGreen) {

  // Stop Loss: Recent Low
  // Since we are buying a dip, the "Low" of the dip is our invalidation point.
  const lowOfDip = Math.min(data[i].low, data[i-1].low, data[i-2].low);
  let stopLoss = lowOfDip;
  
  // Safety: If the dip low is too close (< 2%), give it some room
  if ((currentClose - stopLoss) / currentClose < 0.02) {
     stopLoss = currentClose * 0.97; // 3% wiggle room
  }

  // Target: The Mean (Reversion)
  // In mean reversion, price usually snaps back to the 50 SMA or previous High.
  // We set a standard 3R target to let winners run.
  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 3);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Stochastic Dip in Uptrend: K/D Cross > SMA 200\`
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
    name: 'TTM Squeeze (Optimized)',
    description: 'Trend-aligned TTM Squeeze. Requires price > SMA 50 and active volume. Uses tighter structure-based stops.',
    parameters: { defaultRiskPct: 0.05 },
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
