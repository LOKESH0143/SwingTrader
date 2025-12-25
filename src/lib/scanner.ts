import { Strategy, Candle, Signal } from './types';
import * as indicators from './indicators';

export function evaluateStrategy(strategy: Strategy, data: Candle[]): Signal | null {
  // We need enough data
  if (data.length < 200) return null;

  const executeStrategy = new Function(
    'data', 
    'params', 
    'indicators', 
    strategy.code
  );

  try {
    // Run strategy on the full dataset to ensure indicators are calculated correctly
    // The strategy code is expected to look at the *end* of the array for the signal
    const result = executeStrategy(data, strategy.parameters, indicators);
    
    if (result && result.signal === 'BUY') {
      return {
        symbol: '', // To be filled by caller
        strategyId: strategy.id,
        strategyName: strategy.name,
        type: 'BUY',
        price: data[data.length - 1].close,
        stopLoss: result.stopLoss,
        target: result.target,
        date: data[data.length - 1].date,
        reason: result.reason
      };
    }
  } catch (e) {
    console.error(`Error evaluating strategy ${strategy.name}:`, e);
  }

  return null;
}
