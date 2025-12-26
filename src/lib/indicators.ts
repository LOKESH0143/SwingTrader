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

// ADX (Average Directional Index)
export function adx(data: Candle[], period: number = 14): number[] {
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  
  // Calculate TR, +DM, -DM
  for (let i = 1; i < data.length; i++) {
    const curr = data[i];
    const prev = data[i-1];
    
    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;
    
    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }
    
    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
    
    tr.push(trueRange(curr, prev));
  }
  
  // Smooth TR, +DM, -DM (Wilder's Smoothing)
  const smoothTR = wilderSmooth(tr, period);
  const smoothPlusDM = wilderSmooth(plusDM, period);
  const smoothMinusDM = wilderSmooth(minusDM, period);
  
  const adxLine: number[] = [];
  const dxLine: number[] = [];
  
  // Calculate DX and ADX
  // We need 'period' amount of smoothed data to start
  // The smoothing function returns array of same length as input, with initial NaNs
  
  let prevADX = 0;
  let firstADXCalculated = false;

  for (let i = 0; i < smoothTR.length; i++) {
    if (isNaN(smoothTR[i]) || smoothTR[i] === 0) {
      adxLine.push(NaN);
      continue;
    }
    
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    
    const sumDI = plusDI + minusDI;
    const dx = sumDI === 0 ? 0 : (Math.abs(plusDI - minusDI) / sumDI) * 100;
    dxLine.push(dx);
    
    // ADX is smoothed DX
    if (!firstADXCalculated) {
      // Need 'period' values of DX to calculate first ADX
      if (dxLine.filter(v => !isNaN(v)).length >= period) {
         // Simple average for first ADX
         const validDX = dxLine.slice(i - period + 1, i + 1);
         prevADX = validDX.reduce((a,b) => a+b, 0) / period;
         adxLine.push(prevADX);
         firstADXCalculated = true;
      } else {
        adxLine.push(NaN);
      }
    } else {
      const currentADX = ((prevADX * (period - 1)) + dx) / period;
      adxLine.push(currentADX);
      prevADX = currentADX;
    }
  }
  
  // Pad the beginning to match data length (we skipped index 0 loop)
  return [NaN, ...adxLine];
}

// Helper: Wilder's Smoothing
function wilderSmooth(data: number[], period: number): number[] {
  const smoothed: number[] = [];
  let sum = 0;
  
  // First value is SMA
  for (let i = 0; i < period; i++) {
    if (i < data.length) sum += data[i];
  }
  const firstVal = sum / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smoothed.push(NaN);
    } else if (i === period - 1) {
      smoothed.push(firstVal);
    } else {
      const prev = smoothed[i-1];
      const curr = (prev * (period - 1) + data[i]) / period;
      smoothed.push(curr);
    }
  }
  return smoothed;
}

// Advanced Support and Resistance with Clustering and Strength
export function findSupportResistance(data: Candle[], lookback: number = 20) {
  const rawLevels: { price: number; type: 'SUPPORT' | 'RESISTANCE'; strength: number; dateIndex: number }[] = [];
  
  // 1. Identify Pivot Points (Fractals)
  for (let i = lookback; i < data.length - lookback; i++) {
    const current = data[i];
    const leftSide = data.slice(i - lookback, i);
    const rightSide = data.slice(i + 1, i + lookback + 1);

    // Swing High
    const isHigh = leftSide.every(c => c.high <= current.high) && rightSide.every(c => c.high < current.high);
    if (isHigh) {
      rawLevels.push({ price: current.high, type: 'RESISTANCE', strength: 1, dateIndex: i });
    }

    // Swing Low
    const isLow = leftSide.every(c => c.low >= current.low) && rightSide.every(c => c.low > current.low);
    if (isLow) {
      rawLevels.push({ price: current.low, type: 'SUPPORT', strength: 1, dateIndex: i });
    }
  }

  // 2. Cluster Levels (Merge nearby levels)
  // If levels are within 1% of each other, merge them and increase strength
  const threshold = 0.01; // 1%
  const clusters: { price: number; type: 'SUPPORT' | 'RESISTANCE'; strength: number }[] = [];

  // Sort by price to make clustering easier
  rawLevels.sort((a, b) => a.price - b.price);

  for (const level of rawLevels) {
    let merged = false;
    for (const cluster of clusters) {
      // Check if close enough and same type
      if (Math.abs(cluster.price - level.price) / cluster.price <= threshold && cluster.type === level.type) {
        // Weighted average for new price
        cluster.price = (cluster.price * cluster.strength + level.price) / (cluster.strength + 1);
        cluster.strength += 1;
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({ price: level.price, type: level.type, strength: 1 });
    }
  }

  // 3. Filter Weak Levels
  // Only keep levels that have been tested at least twice (strength >= 2)
  // Or very recent significant pivots (last 50 candles) even if strength is 1
  const currentIdx = data.length - 1;
  const significantLevels = clusters.filter(l => l.strength >= 2);

  // Add recent significant pivots that might not have been clustered yet
  const recentPivots = rawLevels
    .filter(l => (currentIdx - l.dateIndex) < 50 && !significantLevels.some(sl => Math.abs(sl.price - l.price) / sl.price < threshold))
    .map(l => ({ price: l.price, type: l.type, strength: 1 }));

  const finalLevels = [...significantLevels, ...recentPivots];

  const supports = finalLevels.filter(l => l.type === 'SUPPORT').map(l => l.price).sort((a, b) => b - a);
  const resistances = finalLevels.filter(l => l.type === 'RESISTANCE').map(l => l.price).sort((a, b) => a - b);

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
