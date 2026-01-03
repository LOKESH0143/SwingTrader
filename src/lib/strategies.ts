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
  {
    id: 'breakout-vol',
    name: 'Volume Breakout (Volume Profile)',
    description: 'Buys when price breaks 20-day high with 2x volume AND clears the Value Area High (VAH).',
    category: 'Volume Profile',
    parameters: { lookback: 20, volumeMult: 2.0, defaultRiskPct: 0.05 },
    opinionCode: `
      const lookback = 20;
      const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
      const maxHigh = Math.max(...recentHighs);
      const curr = data[data.length-1].close;
      if (curr > maxHigh) return 1;
      return 0;
    `,
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
    opinionCode: `
      const lookback = 50;
      const recentHighs = data.slice(-lookback - 1, -1).map(c => c.high);
      const maxHigh = Math.max(...recentHighs);
      const curr = data[data.length-1].close;
      if (curr > maxHigh) return 1;
      return 0;
    `,
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
    id: 'bb-squeeze',
    name: 'Bollinger Band Squeeze (True Expansion v2)',
    description: 'Buys when price breaks Upper Band with expanding bandwidth and high volume. Uses Advanced S&R.',
    category: 'Volatility',
    parameters: { period: 20, multiplier: 2, defaultRiskPct: 0.05 },
    opinionCode: `
      const { upper, lower } = indicators.bollingerBands(data, 20, 2);
      const curr = data[data.length-1].close;
      if (curr > upper) return 1;
      if (curr < lower) return -1;
      return 0;
    `,
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
    opinionCode: `
      const sma50 = indicators.sma(data, 50);
      const adx = indicators.adx(data, 14);
      const curr = data[data.length-1].close;
      const s50 = sma50[sma50.length-1];
      const currAdx = adx[adx.length-1];
      if (curr > s50 && currAdx > 25) return 1;
      if (curr < s50) return -1;
      return 0;
    `,
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
  },
  {
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
  },
  {
    id: 'inside-bar-nr7-v2',
    name: 'Inside Bar / NR7 (v2 - High Vol)',
    description: 'A version of the Inside Bar / NR7 strategy that requires a stronger volume confirmation (1.5x average volume).',
    category: 'Volatility',
    parameters: { defaultRiskPct: 0.03, trendSma: 50, minRsi: 50, volumeMultiplier: 1.5 },
    opinionCode: `
      const smaTrend = indicators.sma(data, 50);
      const curr = data[data.length-1].close;
      const trend = smaTrend[smaTrend.length-1];
      if (curr > trend) return 0.5;
      if (curr < trend) return -0.5;
      return 0;
    `,
    code: `
// Inside Bar / NR7 Strategy with Trend & High Volume
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

// 6. Volume Filter: Volume > 1.5x Avg Vol (20)
const recentVols = data.slice(-21, -1).map(c => c.volume);
const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
const isHighVol = current.volume > (avgVol * params.volumeMultiplier);

if ((isInsideBar || isNR7) && isBreakout && isUptrend && isMomentum && isHighVol) {
  // Find Support & Resistance
  const { supports, resistances } = indicators.findSupportResistance(data, 10);

  // Stop Loss: Low of the setup bar (prev)
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
    reason: \`V2 Vol Breakout: \${isInsideBar ? 'Inside Bar' : ''} \${isNR7 ? 'NR7' : ''} + Vol: \${(current.volume/avgVol).toFixed(1)}x\`
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
    opinionCode: `
      const sma50 = indicators.sma(data, 50);
      const curr = data[data.length-1].close;
      const prev = data[data.length-2].close;
      const trend = sma50[sma50.length-1];
      const gap = (data[data.length-1].open - prev) / prev;
      if (gap > 0.02 && curr > trend) return 1;
      if (curr < trend) return -1;
      return 0;
    `,
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
  },
  {
    id: 'smc-liquidity-sweep',
    name: 'SMC Liquidity Sweep (Turtle Soup)',
    description: 'Buys when price sweeps a major support level (taking out retail stops) and immediately reverses. High win rate reversal setup.',
    category: 'Reversal',
    parameters: { defaultRiskPct: 0.03 },
    opinionCode: `
      const { supports } = indicators.findSupportResistance(data, 50);
      const curr = data[data.length-1].close;
      const low = data[data.length-1].low;
      const nearest = indicators.getNearestLevel(curr, supports, 'SUPPORT');
      if (nearest && low < nearest && curr > nearest) return 1;
      return 0;
    `,
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
    id: 'candle-hammer',
    name: 'Hammer at Support',
    description: 'Buys when a Hammer candle forms near a key support level. Classic "buy the dip" setup.',
    category: 'Reversal',
    parameters: { defaultRiskPct: 0.03 },
    opinionCode: `
      const curr = data[data.length-1];
      if (indicators.isHammer(curr)) return 1;
      return 0;
    `,
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
];
