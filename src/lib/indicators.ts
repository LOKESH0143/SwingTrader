import { Candle } from './types';

// Simple Moving Average
export function sma(data: Candle[], period: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      results.push(NaN);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
    results.push(sum / period);
  }
  return results;
}

// Exponential Moving Average
export function ema(data: Candle[], period: number): number[] {
  const results: number[] = [];
  const k = 2 / (period + 1);
  
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += data[i].close;
  }
  let prevEma = initialSum / period;
  
  // Fill initial NaNs
  for(let i=0; i<period-1; i++) results.push(NaN);
  results.push(prevEma);

  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i].close * k) + (prevEma * (1 - k));
    results.push(currentEma);
    prevEma = currentEma;
  }
  return results;
}

// Relative Strength Index
export function rsi(data: Candle[], period: number = 14): number[] {
  const results: number[] = [];
  const changes = data.map((c, i) => i === 0 ? 0 : c.close - data[i-1].close);
  
  let avgGain = 0;
  let avgLoss = 0;

  // First calculation
  for (let i = 1; i <= period; i++) {
    const change = changes[i];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  for (let i = 0; i < period; i++) results.push(NaN);
  
  results.push(100 - (100 / (1 + avgGain / avgLoss)));

  for (let i = period + 1; i < data.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    if (avgLoss === 0) results.push(100);
    else {
      const rs = avgGain / avgLoss;
      results.push(100 - (100 / (1 + rs)));
    }
  }
  return results;
}

// MACD
export function macd(data: Candle[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);
  
  const macdLine = fastEma.map((f, i) => f - slowEma[i]);
  
  // Calculate Signal Line (EMA of MACD Line)
  // We need to create a dummy Candle array to reuse the EMA function, or implement a simple array EMA
  const signalLine: number[] = [];
  const k = 2 / (signalPeriod + 1);
  
  // Find first valid MACD value
  let firstValidIndex = 0;
  while (isNaN(macdLine[firstValidIndex])) firstValidIndex++;
  
  // Initialize NaNs
  for (let i = 0; i < firstValidIndex + signalPeriod - 1; i++) {
    signalLine.push(NaN);
  }

  // Initial SMA for Signal Line
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLine[firstValidIndex + i];
  }
  let prevEma = sum / signalPeriod;
  signalLine.push(prevEma);

  // Calculate EMA for the rest
  for (let i = firstValidIndex + signalPeriod; i < macdLine.length; i++) {
    const currentEma = (macdLine[i] * k) + (prevEma * (1 - k));
    signalLine.push(currentEma);
    prevEma = currentEma;
  }

  // Histogram
  const histogram = macdLine.map((m, i) => m - signalLine[i]);

  return { macdLine, signalLine, histogram }; 
}

// Standard Deviation
export function stdDev(data: Candle[], period: number): number[] {
  const results: number[] = [];
  const smaValues = sma(data, period);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      results.push(NaN);
      continue;
    }
    
    const slice = data.slice(i - period + 1, i + 1);
    const mean = smaValues[i];
    const squaredDiffs = slice.map(c => Math.pow(c.close - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    results.push(Math.sqrt(variance));
  }
  return results;
}

// Bollinger Bands
export function bollingerBands(data: Candle[], period: number = 20, multiplier: number = 2) {
  const smaLine = sma(data, period);
  const stdDevLine = stdDev(data, period);
  
  const upper = smaLine.map((val, i) => val + (stdDevLine[i] * multiplier));
  const lower = smaLine.map((val, i) => val - (stdDevLine[i] * multiplier));
  
  return { upper, middle: smaLine, lower };
}

// Stochastic Oscillator
export function stochastic(data: Candle[], period: number = 14, smoothK: number = 3, smoothD: number = 3) {
  const kLine: number[] = [];
  
  // Calculate %K
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      kLine.push(NaN);
      continue;
    }
    
    const slice = data.slice(i - period + 1, i + 1);
    const low = Math.min(...slice.map(c => c.low));
    const high = Math.max(...slice.map(c => c.high));
    const close = data[i].close;
    
    const k = ((close - low) / (high - low)) * 100;
    kLine.push(k);
  }

  // Smooth %K to get %D (using SMA logic)
  const dLine: number[] = [];
  for (let i = 0; i < kLine.length; i++) {
    if (i < period + smoothD - 2) {
      dLine.push(NaN);
      continue;
    }
    
    const slice = kLine.slice(i - smoothD + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    dLine.push(sum / smoothD);
  }

  return { k: kLine, d: dLine };
}

// True Range
export function trueRange(current: Candle, prev: Candle): number {
  const hl = current.high - current.low;
  const hpc = Math.abs(current.high - prev.close);
  const lpc = Math.abs(current.low - prev.close);
  return Math.max(hl, hpc, lpc);
}

// Average True Range (ATR)
export function atr(data: Candle[], period: number = 14): number[] {
  const trValues: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trValues.push(data[i].high - data[i].low);
    } else {
      trValues.push(trueRange(data[i], data[i-1]));
    }
  }
  
  // Wilder's Smoothing (RMA)
  const atrValues: number[] = [];
  let currentATR = 0;
  
  // First ATR is SMA of TR
  if (data.length < period) return Array(data.length).fill(NaN);
  
  let sumTR = 0;
  for(let i=0; i<period; i++) sumTR += trValues[i];
  currentATR = sumTR / period;
  
  // Fill initial NaNs
  for(let i=0; i<period-1; i++) atrValues.push(NaN);
  atrValues.push(currentATR);
  
  for(let i=period; i<data.length; i++) {
    currentATR = ((currentATR * (period - 1)) + trValues[i]) / period;
    atrValues.push(currentATR);
  }
  
  return atrValues;
}

// Keltner Channels
export function keltnerChannels(data: Candle[], period: number = 20, multiplier: number = 1.5) {
  const middle = ema(data, period);
  const atrLine = atr(data, period); // Usually ATR period 10 or 20. Using same period for simplicity.
  
  const upper: number[] = [];
  const lower: number[] = [];
  
  for(let i=0; i<data.length; i++) {
    if (isNaN(middle[i]) || isNaN(atrLine[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      upper.push(middle[i] + (atrLine[i] * multiplier));
      lower.push(middle[i] - (atrLine[i] * multiplier));
    }
  }
  
  return { upper, middle, lower };
}

// Chandelier Exit
export function chandelierExit(data: Candle[], period: number = 22, multiplier: number = 3.0) {
  const atrLine = atr(data, period);
  const longStops: number[] = [];
  
  for(let i=0; i<data.length; i++) {
    if (i < period || isNaN(atrLine[i])) {
      longStops.push(NaN);
      continue;
    }
    
    // Highest High of last 'period' days
    let highestHigh = -Infinity;
    for(let j=0; j<period; j++) {
      if (data[i-j].high > highestHigh) highestHigh = data[i-j].high;
    }
    
    longStops.push(highestHigh - (atrLine[i] * multiplier));
  }
  
  return longStops;
}

// TTM Squeeze Helper
export function ttmSqueeze(data: Candle[]) {
  // BB (20, 2)
  const bb = bollingerBands(data, 20, 2.0);
  // KC (20, 1.5)
  const kc = keltnerChannels(data, 20, 1.5);
  
  // Momentum (Using MACD Histogram as robust proxy)
  const { histogram } = macd(data, 12, 26, 9);
  
  const squeezeOn: boolean[] = [];
  
  for(let i=0; i<data.length; i++) {
    // Squeeze ON if BB is inside KC
    const isSqueeze = bb.upper[i] < kc.upper[i] && bb.lower[i] > kc.lower[i];
    squeezeOn.push(isSqueeze);
  }
  
  return { squeezeOn, histogram };
}

// VWAP (Rolling)
export function vwap(data: Candle[], period: number = 20): number[] {
  const vwapLine: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      vwapLine.push(NaN);
      continue;
    }
    
    let sumPV = 0;
    let sumVol = 0;
    
    for (let j = 0; j < period; j++) {
      const c = data[i-j];
      const typicalPrice = (c.high + c.low + c.close) / 3;
      sumPV += typicalPrice * c.volume;
      sumVol += c.volume;
    }
    
    vwapLine.push(sumPV / sumVol);
  }
  
  return vwapLine;
}

// Volume Profile (Simplified)
export function getVolumeProfile(data: Candle[], period: number = 50, buckets: number = 20) {
  if (data.length < period) return null;
  
  const slice = data.slice(-period);
  const maxPrice = Math.max(...slice.map(c => c.high));
  const minPrice = Math.min(...slice.map(c => c.low));
  const range = maxPrice - minPrice;
  const bucketSize = range / buckets;
  
  const volumeProfile: number[] = new Array(buckets).fill(0);
  
  slice.forEach(c => {
    // Distribute volume across the candle's range
    // Simplified: Add volume to the bucket of the Close price
    // Better: Add to bucket of (High+Low+Close)/3
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const bucketIndex = Math.min(Math.floor((typicalPrice - minPrice) / bucketSize), buckets - 1);
    volumeProfile[bucketIndex] += c.volume;
  });
  
  // Find POC (Point of Control) - Bucket with max volume
  let maxVol = 0;
  let pocIndex = 0;
  volumeProfile.forEach((vol, i) => {
    if (vol > maxVol) {
      maxVol = vol;
      pocIndex = i;
    }
  });
  
  const pocPrice = minPrice + (pocIndex * bucketSize) + (bucketSize / 2);
  
  // Calculate Value Area (70% of volume)
  const totalVol = volumeProfile.reduce((a, b) => a + b, 0);
  const valueAreaVol = totalVol * 0.70;
  
  let currentVol = volumeProfile[pocIndex];
  let upIdx = pocIndex;
  let downIdx = pocIndex;
  let vahIndex = pocIndex;
  let valIndex = pocIndex;
  
  while (currentVol < valueAreaVol) {
    const upVol = (upIdx < buckets - 1) ? volumeProfile[upIdx + 1] : 0;
    const downVol = (downIdx > 0) ? volumeProfile[downIdx - 1] : 0;
    
    if (upVol > downVol) {
      upIdx++;
      currentVol += upVol;
      vahIndex = upIdx;
    } else if (downVol > 0) {
      downIdx--;
      currentVol += downVol;
      valIndex = downIdx;
    } else if (upIdx < buckets - 1) { // Force move if stuck
      upIdx++;
      currentVol += volumeProfile[upIdx];
      vahIndex = upIdx;
    } else if (downIdx > 0) {
      downIdx--;
      currentVol += volumeProfile[downIdx];
      valIndex = downIdx;
    } else {
      break;
    }
  }
  
  const vah = minPrice + (vahIndex * bucketSize) + bucketSize;
  const val = minPrice + (valIndex * bucketSize);
  
  return { poc: pocPrice, vah, val, volumeProfile };
}

// Find Support and Resistance levels based on Swing Highs and Lows
export function findSupportResistance(data: Candle[], lookback: number = 20) {
  const levels: { price: number; type: 'SUPPORT' | 'RESISTANCE' }[] = [];
  
  // We need at least lookback * 2 + 1 candles to find a pivot in the middle
  if (data.length < lookback * 2 + 1) return { supports: [], resistances: [] };

  for (let i = lookback; i < data.length - lookback; i++) {
    const current = data[i];
    const leftSide = data.slice(i - lookback, i);
    const rightSide = data.slice(i + 1, i + lookback + 1);

    // Check for Swing High (Resistance)
    const isHigh = leftSide.every(c => c.high <= current.high) && rightSide.every(c => c.high < current.high);
    if (isHigh) {
      levels.push({ price: current.high, type: 'RESISTANCE' });
    }

    // Check for Swing Low (Support)
    const isLow = leftSide.every(c => c.low >= current.low) && rightSide.every(c => c.low > current.low);
    if (isLow) {
      levels.push({ price: current.low, type: 'SUPPORT' });
    }
  }

  // Sort levels
  const supports = levels.filter(l => l.type === 'SUPPORT').map(l => l.price).sort((a, b) => b - a); // Descending (nearest first)
  const resistances = levels.filter(l => l.type === 'RESISTANCE').map(l => l.price).sort((a, b) => a - b); // Ascending (nearest first)

  return { supports, resistances };
}

// Candlestick Patterns
export function isBullishEngulfing(current: Candle, prev: Candle): boolean {
  const prevRed = prev.close < prev.open;
  const currGreen = current.close > current.open;
  
  if (!prevRed || !currGreen) return false;
  
  // Engulfing body: Open <= Prev Close AND Close >= Prev Open
  return current.open <= prev.close && current.close >= prev.open;
}

export function isHammer(candle: Candle): boolean {
  const body = Math.abs(candle.close - candle.open);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const totalRange = candle.high - candle.low;
  
  // Hammer logic: 
  // 1. Lower wick is at least 2x the body
  // 2. Upper wick is small (less than body)
  // 3. Body is in the upper third of the range (optional, but good)
  return lowerWick >= 2 * body && upperWick <= body && body > 0;
}

export function getNearestLevel(price: number, levels: number[], type: 'SUPPORT' | 'RESISTANCE'): number | null {
  if (type === 'SUPPORT') {
    // Find first level below price
    return levels.find(l => l < price) || null;
  } else {
    // Find first level above price
    return levels.find(l => l > price) || null;
  }
}
