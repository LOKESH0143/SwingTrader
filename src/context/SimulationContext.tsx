import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { PortfolioState, PortfolioSettings, runPortfolioSimulation } from '../lib/portfolioBacktest';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { STOCK_UNIVERSES, StockUniverse } from '../lib/stockUniverses';
import { fetchHistory } from '../services/api';
import { getStrategyScores } from '../lib/scores';

interface SimulationContextType {
  running: boolean;
  progress: number;
  results: PortfolioState | null;
  settings: PortfolioSettings;
  updateSettings: (newSettings: Partial<PortfolioSettings>) => void;
  runSimulation: () => Promise<void>;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<PortfolioState | null>(null);
  
  const [settings, setSettings] = useState<PortfolioSettings>({
    initialCapital: 50000,
    riskPerTrade: 2,
    minRiskReward: 2,
    maxStopLossPercent: 5,
    maxOpenTrades: 5,
    minConsensusScore: 40,
    useProbabilisticExecution: false,
    allowFractionalShares: false,
    useTrailingStop: true,
    useMarketRegimeFilter: true,
    useDynamicRisk: true,
    maxHoldDays: 90,
    selectedStrategies: PREBUILT_STRATEGIES.map(s => s.id),
    universe: 'NIFTY_100', // Removed explicit cast to StockUniverse to fix type error if PortfolioSettings has universe as string
    startDate: '',
    endDate: '',
    dataPeriod: '1y',
  });

  // Use a ref to track if we should abort (optional, but good for cleanup)
  const abortRef = useRef(false);

  const updateSettings = useCallback((newSettings: Partial<PortfolioSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const runSimulation = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    setResults(null);
    abortRef.current = false;

    try {
      // Use a local variable for universe to ensure we capture current state
      // But we can use settings.universe directly as it's in closure, 
      // however, if settings update during run, it might be weird. 
      // Let's snapshot settings.
      const currentSettings = { ...settings };
      const symbols = STOCK_UNIVERSES[currentSettings.universe as StockUniverse].symbols;
      const allData: Record<string, any> = {};
      const scores = await getStrategyScores();

      // Fetch Nifty 50 for Market Regime Filter
      let marketData: any[] = [];
      if (currentSettings.useMarketRegimeFilter) {
        marketData = await fetchHistory('^NSEI', '5y');
      }

      // 1. Fetch Data
      for (let i = 0; i < symbols.length; i++) {
        if (abortRef.current) break;
        
        const symbol = symbols[i];
        
        // SMART FETCH LOGIC
        let fetchPeriod: '1y' | '2y' | '5y' = '5y';
        if (currentSettings.startDate || currentSettings.endDate) {
           fetchPeriod = '5y';
        } else {
           if (currentSettings.dataPeriod === '1y') fetchPeriod = '2y';
           else if (currentSettings.dataPeriod === '2y') fetchPeriod = '5y';
           else fetchPeriod = '5y';
        }

        const data = await fetchHistory(symbol, fetchPeriod);
        if (data && data.length > 0) {
          allData[symbol] = data;
        }
        setProgress(Math.round(((i + 1) / symbols.length) * 100));
      }

      if (!abortRef.current) {
        // 2. Run Engine
        // We use setTimeout to allow UI to render 100% progress before freezing for calculation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const simResult = runPortfolioSimulation(
          PREBUILT_STRATEGIES,
          allData,
          currentSettings,
          scores,
          marketData
        );
        setResults(simResult);
      }
    } catch (e) {
      console.error("Simulation failed", e);
    } finally {
      setRunning(false);
    }
  }, [settings, running]);

  return (
    <SimulationContext.Provider value={{ running, progress, results, settings, updateSettings, runSimulation }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
