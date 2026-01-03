import { Strategy } from '../types';

export const candleHammer: Strategy = {
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
};