import { Strategy } from './types';

// Individual strategy imports
import { bbSqueeze } from './strategies/bb-sqeeze';
import { bbTrendRider } from './strategies/bb-trend-rider';
import { breakoutVol } from './strategies/breakout-vol';
import { candleHammer } from './strategies/candle-hammer';
import { gapAndGo } from './strategies/gap-and-go';
import { insideBarNr7_v2 } from './strategies/inside-bar-nr7-v2';
import { institutionalBreakout } from './strategies/institutional-breakout';
import { smcLiquiditySweep } from './strategies/smc-liquidity-sweep';
import { stochDipBuyer_v2 } from './strategies/stoch-dip-buyer-v2';
import { stochOversold } from './strategies/stoch-oversold';
import { ttmSqueeze } from './strategies/ttm-squeeze';
import { vpTrendV3Robust } from './strategies/vp-trend-v3-robust';

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
  // This array is now built from the individual strategy files.
  // Note: This list is based on the files you created. If any strategies are
  // missing from the UI, we may need to add their imports here.
  bbSqueeze,
  bbTrendRider,
  breakoutVol,
  candleHammer,
  gapAndGo,
  insideBarNr7_v2,
  institutionalBreakout,
  smcLiquiditySweep,
  stochDipBuyer_v2,
  stochOversold,
  ttmSqueeze,
  vpTrendV3Robust,
];
