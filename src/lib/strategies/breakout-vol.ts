import { Strategy } from '../types';

export const breakoutVol: Strategy = {
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
  };