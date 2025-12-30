import { Strategy } from './types';

export function loadCustomStrategies(): Strategy[] {
  try {
    const stored = localStorage.getItem('custom_strategies');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load custom strategies", e);
    return [];
  }
}

export function saveCustomStrategy(strategy: Strategy) {
  try {
    const existing = loadCustomStrategies();
    const updated = [...existing, strategy];
    localStorage.setItem('custom_strategies', JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save custom strategy", e);
  }
}

export const PREBUILT_STRATEGIES: Strategy[] = [
  // --- GOLDEN CROSS ---
  {
    id: 'golden-cross-v2',
    name: 'Golden Cross (v2: Advanced S&R)',
    description: 'Optimized Golden Cross with Advanced Support/Resistance logic. Relaxed filters to capture more moves.',
    category: 'Trend',
    parameters: { fastPeriod: 50, slowPeriod: 200, defaultRiskPct: 0.05 },
    code: `
// Optimized Golden Cross (Trend + Advanced S&R)
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
  
  // --- Filter 1: RSI Check ---
  // Ensure we aren't buying a massively overextended move (>80)
  // But allow strong momentum (>70 is okay for breakouts)
  const currentRsi = rsi[i];
  const isNotOverbought = currentRsi < 80;

  // --- Filter 2: Volume Sanity Check ---
  // Just ensure volume isn't dead (at least 50% of average)
  const recentVols = data.slice(-21, -1).map(c => c.volume);
  const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
  const isAlive = data[i].volume > (avgVol * 0.5);

  if (isNotOverbought && isAlive) {
    
    // Find Support & Resistance (Advanced v2)
    const { supports, resistances } = indicators.findSupportResistance(data, 30);
    
    // Stop Loss: Nearest Strong Support
    let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
    
    // Fallback: Use ATR based stop if support is too far or missing
    const atr = indicators.atr(data, 14);
    const currentAtr = atr[atr.length - 1];
    
    // If no support found, or support is > 10% away (too risky), use 3x ATR trailing stop equivalent
    if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.10) {
       stopLoss = currentClose - (currentAtr * 3); 
    }

    // Target: Nearest Strong Resistance
    let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
    
    // If no resistance or it's too close (< 1.5R), aim for 3R open space
    const risk = currentClose - stopLoss;
    if (!target || (target - currentClose) < (risk * 1.5)) {
       target = currentClose + (risk * 3); 
    }

    return {
      signal: 'BUY',
      stopLoss: stopLoss,
      target: target,
      reason: \`Golden Cross v2: S&R Stop \${stopLoss.toFixed(2)}\`
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
    category: 'Mean Reversion',
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
    id: 'vp-trend',
    name: 'Volume Profile Trend',
    description: 'Buys when price breaks out above Value Area High (VAH) in an uptrend. Uses POC as support.',
    category: 'Volume Profile',
    parameters: { lookback: 50, buckets: 24, defaultRiskPct: 0.05 },
    code: `
// Volume Profile Trend
const vp = indicators.getVolumeProfile(data, params.lookback, params.buckets);
if (!vp) return null;

const current = data[data.length - 1];
const prev = data[data.length - 2];
const sma50 = indicators.sma(data, 50);
const currentTrend = sma50[sma50.length - 1];

// 1. Trend Filter
const isUptrend = current.close > currentTrend;

// 2. VAH Breakout
// Price crosses above Value Area High
const isBreakout = prev.close < vp.vah && current.close > vp.vah;

if (isBreakout && isUptrend) {
  // Stop Loss: POC (Point of Control)
  // If price falls back below the "fair value" (POC), the breakout failed.
  let stopLoss = vp.poc;
  
  // Safety: If POC is too close or above price (shouldn't happen on breakout), use standard stop
  if (stopLoss >= current.close || (current.close - stopLoss)/current.close < 0.02) {
     stopLoss = current.close * 0.95;
  }

  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2.5);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`VP Breakout: Price > VAH (\${vp.vah.toFixed(2)}). SL at POC (\${vp.poc.toFixed(2)})\`
  };
}
return null;
    `
  },
  {
    id: 'vp-trend-v2',
    name: 'Volume Profile Trend (Optimized v2)',
    description: 'Volume Profile Breakout with Trailing Stop logic to capture larger moves and reduce drawdown.',
    category: 'Volume Profile',
    parameters: { lookback: 50, buckets: 24, defaultRiskPct: 0.05 },
    code: `
// Volume Profile Trend v2 (Trailing Stop)
const vp = indicators.getVolumeProfile(data, params.lookback, params.buckets);
if (!vp) return null;

const current = data[data.length - 1];
const prev = data[data.length - 2];
const sma50 = indicators.sma(data, 50);
const currentTrend = sma50[sma50.length - 1];

// 1. Trend Filter
const isUptrend = current.close > currentTrend;

// 2. VAH Breakout
const isBreakout = prev.close < vp.vah && current.close > vp.vah;

if (isBreakout && isUptrend) {
  // Stop Loss: POC (Point of Control)
  let stopLoss = vp.poc;
  
  // Safety check
  if (stopLoss >= current.close || (current.close - stopLoss)/current.close < 0.02) {
     stopLoss = current.close * 0.95;
  }

  const risk = current.close - stopLoss;
  
  // Target: Open Ended (We use a high target, but rely on trailing stop)
  // In a real execution engine, we would manage the trade tick-by-tick.
  // For this backtester, we simulate a wider target to allow the run.
  let target = current.close + (risk * 4); 

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`VP Trend v2: Breakout > VAH. Wide Target (4R) for Trailing\`
  };
}
return null;
    `
  },
  {
    id: 'breakout-vol',
    name: 'Volume Breakout (Volume Profile)',
    description: 'Buys when price breaks 20-day high with 2x volume AND clears the Value Area High (VAH).',
    category: 'Volume Profile',
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
    category: 'Breakout',
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
    name: 'MACD (Standard v2)',
    description: 'Standard MACD Crossover with Trend (SMA 200) and basic ADX (>20) filter. Uses Advanced S&R.',
    category: 'Trend',
    parameters: { fast: 12, slow: 26, signal: 9, trendSma: 200, maxRsi: 70, minAdx: 20 },
    code: `
// MACD Standard v2 (Smart Trend + Advanced S&R)
const { macdLine, signalLine } = indicators.macd(data, params.fast, params.slow, params.signal);
const trendSMA = indicators.sma(data, params.trendSma);
const rsi = indicators.rsi(data, 14);
const adx = indicators.adx(data, 14);

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
  
  // Find Support & Resistance (Advanced v2)
  const { supports, resistances } = indicators.findSupportResistance(data, 30);
  
  // Stop Loss: Nearest Strong Support
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  if (!stopLoss || stopLoss >= currentClose) {
     stopLoss = currentClose * 0.95; // Fallback 5%
  }

  const risk = currentClose - stopLoss;
  
  // Target: Nearest Strong Resistance
  let target = indicators.getNearestLevel(currentClose, resistances, 'RESISTANCE');
  
  if (!target || (target - currentClose) < (risk * 1.5)) {
     target = currentClose + (risk * 3); // 3R Target if no resistance or too close
  }

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`MACD v2: Cross + Uptrend + ADX > 20\`
  };
}
return null;
    `
  },

  {
    id: 'bb-squeeze',
    name: 'Bollinger Band Squeeze (True Expansion v2)',
    description: 'Buys when price breaks Upper Band with expanding bandwidth and high volume. Uses Advanced S&R.',
    category: 'Volatility',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    code: `
// Bollinger Band Squeeze v2 (True Expansion + Volume + Advanced S&R)
const { upper, middle, lower } = indicators.bollingerBands(data, params.period, params.multiplier);

const i = data.length - 1;
const currentClose = data[i].close;
const currentHigh = data[i].high;
const currentLow = data[i].low;

const currentUpper = upper[i];
const prevUpper = upper[i-1];
const currentLower = lower[i];
const prevLower = lower[i-1];

// 1. Calculate Bandwidth (The "Squeeze" Metric)
const currentBW = (currentUpper - currentLower) / middle[i];
const prevBW = (prevUpper - prevLower) / middle[i-1];

// 2. Expansion Condition (The "Pop")
const isExpanding = currentBW > prevBW;

// 3. Breakout Condition
const isBreakout = currentClose > currentUpper;

// 4. Candle Quality
const range = currentHigh - currentLow;
const closePosition = (currentClose - currentLow) / range;
const isStrongClose = closePosition > 0.75;

// 5. Volume Confirmation
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isVolumeHigh = data[i].volume > avgVol;

if (isBreakout && isExpanding && isStrongClose && isVolumeHigh) {
  
  // Stop Loss: Middle Band (20 SMA) or Nearest Strong Support
  const { supports } = indicators.findSupportResistance(data, 30);
  let stopLoss = indicators.getNearestLevel(currentClose, supports, 'SUPPORT');
  
  const sma20 = middle[i];
  
  // If support is too far (> 8%), use SMA 20
  if (!stopLoss || (currentClose - stopLoss) / currentClose > 0.08) {
      stopLoss = sma20;
  }
  
  // If SMA 20 is still too far, use Low of Candle
  if ((currentClose - stopLoss) / currentClose > 0.05) {
     stopLoss = currentLow;
  }

  const risk = currentClose - stopLoss;
  let target = currentClose + (risk * 2.5);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`BB Squeeze v2: Strong Close + Vol Expansion. SL: \${stopLoss.toFixed(2)}\`
  };
}
return null;
    `
  },
  {
    id: 'bb-trend-rider',
    name: 'Bollinger Trend Rider (Optimized)',
    description: 'Buys on a pullback to the Middle Band (SMA 20) in a strong uptrend (Above SMA 50 + ADX > 25). Avoids buying extended tops.',
    category: 'Trend',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
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
  },
  {
    id: 'stoch-dip-buyer',
    name: 'Stochastic Dip Buyer (Trend Filter + Green Candle)',
    description: 'Buys oversold dips ONLY in a long-term uptrend (Above SMA 200). Avoids catching falling knives.',
    category: 'Mean Reversion',
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
    category: 'Mean Reversion',
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
    category: 'Volatility',
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
    name: 'Gap and Go (Optimized)',
    description: 'Buys when a stock gaps up >2% in an uptrend (SMA 50) and holds the gain. Uses tight stops to fail fast.',
    category: 'Momentum',
    parameters: { gapPct: 0.02, defaultRiskPct: 0.05 },
    code: `
// Gap and Go (Optimized)
const current = data[data.length - 1];
const prev = data[data.length - 2];
const sma50 = indicators.sma(data, 50);

// 1. Gap Condition: Open is > X% above Prev Close
const gapSize = (current.open - prev.close) / prev.close;
const isGapUp = gapSize >= params.gapPct;

// 2. Strength Condition: Current Close > Current Open (Green Candle)
// We want to ensure the gap isn't being sold into
const isGreen = current.close > current.open;

// 3. Trend Filter (New): Only take gaps in an uptrend
// Gaps in downtrends are often "Dead Cat Bounces" or "Exhaustion Gaps"
const currentTrend = sma50[sma50.length - 1];
const isUptrend = current.close > currentTrend;

// 4. Fade Protection (New): Avoid massive gaps (> 5%)
// These are prone to immediate profit taking.
const isNotOverextended = gapSize < 0.05;

if (isGapUp && isGreen && isUptrend && isNotOverextended) {
  
  // Stop Loss: Low of the Gap Candle (Tight Stop)
  // The previous logic used 'Open', but 'Low' is safer if there's a lower wick.
  // If price breaks the Low of the gap day, the momentum is dead.
  let stopLoss = current.low;
  
  // Safety: If the candle is huge (> 3% risk), tighten stop to midpoint
  if ((current.close - stopLoss) / current.close > 0.03) {
     stopLoss = current.open; 
  }

  // Target: 2x Risk (Quick Scalp)
  const risk = current.close - stopLoss;
  let target = current.close + (risk * 2);

  return {
    signal: 'BUY',
    stopLoss: stopLoss,
    target: target,
    reason: \`Gap and Go: \${(gapSize * 100).toFixed(1)}% Gap + Uptrend. SL: \${stopLoss.toFixed(2)}\`
  };
}
return null;
    `
  },

  {
    id: 'ttm-squeeze',
    name: 'TTM Squeeze (Optimized)',
    description: 'Trend-aligned TTM Squeeze. Requires price > SMA 50 and active volume. Uses tighter structure-based stops.',
    category: 'Volatility',
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
    category: 'Reversal',
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
    category: 'Reversal',
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
    category: 'Reversal',
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
  },
  {
    id: 'fib-golden-zone',
    name: 'Fibonacci Golden Zone (Pullback)',
    description: 'Buys when price retraces to the 50%-61.8% zone in an uptrend and bounces. High probability setup.',
    category: 'Mean Reversion',
    parameters: { lookback: 50, defaultRiskPct: 0.05 },
    code: `
// Fibonacci Golden Zone Strategy
const i = data.length - 1;
const current = data[i];
const sma200 = indicators.sma(data, 200);
const currentTrend = sma200[sma200.length - 1];

// 1. Trend Filter: Must be in long-term uptrend
if (current.close < currentTrend) return null;

// 2. Find Swing High and Swing Low (Anchors)
// We look back 'params.lookback' periods to find the highest high
const lookback = params.lookback;
let highestHigh = -Infinity;
let highIndex = -1;

for (let j = 0; j < lookback; j++) {
  if (data[i - j].high > highestHigh) {
    highestHigh = data[i - j].high;
    highIndex = i - j;
  }
}

// Now find the lowest low BEFORE that high (within reasonable range)
let lowestLow = Infinity;
for (let j = highIndex; j >= Math.max(0, highIndex - lookback); j--) {
  if (data[j].low < lowestLow) {
    lowestLow = data[j].low;
  }
}

// 3. Calculate Fib Levels
const range = highestHigh - lowestLow;
const fib50 = highestHigh - (range * 0.5);
const fib618 = highestHigh - (range * 0.618);
const fib786 = highestHigh - (range * 0.786);

// 4. The "Golden Zone" Condition
// Price must be inside or just touched the 50% - 61.8% zone
// And we need a bounce (Green Candle)
const inZone = current.low <= fib50 && current.close >= fib618; 
const isGreen = current.close > current.open;

if (inZone && isGreen) {
  
  // 5. Confluence: RSI not overbought (room to run)
  const rsi = indicators.rsi(data, 14);
  const currentRsi = rsi[rsi.length - 1];
  
  if (currentRsi < 55) {
     // Stop Loss: Below the 78.6% level (Invalidation)
     const stopLoss = fib786;
     
     // Target: The Swing High (0% Retracement)
     const target = highestHigh;
     
     // Ensure Risk:Reward is decent (> 1.5)
     const risk = current.close - stopLoss;
     const reward = target - current.close;
     
     if (reward / risk > 1.5) {
        return {
          signal: 'BUY',
          stopLoss: stopLoss,
          target: target,
          reason: \`Fib Golden Zone: Bounce off \${fib618.toFixed(2)} (61.8%). Target: Highs\`
        };
     }
  }
}
return null;
    `
  }
];
