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

// Average True Range (ATR)
export function atr(data: Candle[], period: number = 14): number[] {
  const trValues: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trValues.push(data[i].high - data[i].low);
      continue;
    }
    
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }

  return smaNum(trValues, period);
}

// Helper for number array SMA
function smaNum(data: number[], period: number): number[] {
  const results: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    
    if (i >= period - 1) {
      results.push(sum / period);
    } else {
      results.push(NaN);
    }
  }
  return results;
}

// Keltner Channels
export function keltnerChannels(data: Candle[], period: number = 20, multiplier: number = 1.5) {
  const middle = ema(data, period);
  const atrLine = atr(data, 10); // Standard TTM uses ATR 10 for KC
  
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
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

// Linear Regression (for TTM Histogram)
export function linearRegression(data: number[], length: number): number[] {
  const results: number[] = [];
  
  // X coordinates are fixed: 0, 1, 2, ... length-1
  const xSum = (length * (length - 1)) / 2;
  const xSquaredSum = (length * (length - 1) * (2 * length - 1)) / 6;
  const divisor = length * xSquaredSum - xSum * xSum;

  for (let i = 0; i < data.length; i++) {
    if (i < length - 1) {
      results.push(NaN);
      continue;
    }
    
    const ySlice = data.slice(i - length + 1, i + 1);
    
    let xySum = 0;
    let ySum = 0;
    for (let j = 0; j < length; j++) {
      xySum += j * ySlice[j];
      ySum += ySlice[j];
    }
    
    const slope = (length * xySum - xSum * ySum) / divisor;
    const intercept = (ySum - slope * xSum) / length;
    
    // Predict the value at the end of the line (x = length - 1)
    results.push(slope * (length - 1) + intercept);
  }
  return results;
}
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

export function getNearestLevel(price: number, levels: number[], type: 'SUPPORT' | 'RESISTANCE'): number | null {
  if (type === 'SUPPORT') {
    // Find first level below price
    return levels.find(l => l < price) || null;
  } else {
    // Find first level above price
    return levels.find(l => l > price) || null;
  }
}
