import React, { useState, useEffect } from 'react';
import { Trophy, Play, Loader2, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Filter, Calendar, X } from 'lucide-react';
import { NIFTY_500_SYMBOLS } from '../lib/nifty500';
import { STOCK_UNIVERSES, StockUniverse } from '../lib/stockUniverses';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { fetchHistory } from '../services/api';
import { runBacktest, TradeFilters } from '../lib/backtest';
import { cn } from '../lib/utils';
import { TradeChart } from '../components/TradeChart';
import { Candle, StrategyScore } from '../lib/types';
import { updateStrategyScore, getStrategyScores } from '../lib/scores';

interface TradeDetails {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  stopLoss: number;
  target: number;
  type: 'LONG' | 'SHORT';
  pnlPercent: number;
  mfe?: number;
  mae?: number;
}

interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  wins: number;
  totalPnL: number; // Sum of PnL %
  bestSymbol: string;
  bestSymbolPnL: number;
  allTrades: TradeDetails[];
}


import { analyzeTournamentResults, StrategyAnalysisInput } from '../services/ai';
import { Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function Tournament() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<StrategyPerformance[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedUniverse, setSelectedUniverse] = useState<StockUniverse>('NIFTY_50');
  
  // Trade Inspector State
  const [selectedTrade, setSelectedTrade] = useState<TradeDetails | null>(null);
  const [tradeData, setTradeData] = useState<Candle[]>([]);
  const [loadingTrade, setLoadingTrade] = useState(false);

  // AI Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, StrategyScore>>({});
  const [showSymbolList, setShowSymbolList] = useState(false);

  useEffect(() => {
    loadScores();
  }, []);

  const loadScores = async () => {
    const data = await getStrategyScores();
    setScores(data);
  };

  const handleAIAnalysis = async () => {
    if (results.length === 0) return;
    
    setAnalyzing(true);
    setAnalysis(null);

    // Prepare data for AI
    const aiInput: StrategyAnalysisInput[] = results.map(r => {
      const closedTrades = r.allTrades.filter(t => t.exitDate); // Only closed trades have MFE/MAE usually
      const avgMfe = closedTrades.reduce((sum, t) => sum + (t.mfe || 0), 0) / (closedTrades.length || 1);
      const avgMae = closedTrades.reduce((sum, t) => sum + (t.mae || 0), 0) / (closedTrades.length || 1);
      
      return {
        strategyName: r.strategyName,
        winRate: (r.wins / (r.totalTrades || 1)) * 100,
        netProfit: r.totalPnL,
        totalTrades: r.totalTrades,
        avgMfe,
        avgMae,
        bestSymbol: r.bestSymbol
      };
    });

    const report = await analyzeTournamentResults(aiInput);
    setAnalysis(report);
    setAnalyzing(false);
  };

  // Filters
  const [filters, setFilters] = useState<TradeFilters>({
    minRiskReward: 2,
    maxStopLossPercent: 5,
    minTargetPercent: 0,
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch data for selected trade
  useEffect(() => {
    if (selectedTrade) {
      setLoadingTrade(true);
      // Fetch 5y to ensure we have enough context
      fetchHistory(selectedTrade.symbol, '5y')
        .then(data => {
          setTradeData(data);
          setLoadingTrade(false);
        })
        .catch(err => {
          console.error("Failed to fetch trade data", err);
          setLoadingTrade(false);
        });
    }
  }, [selectedTrade]);

  // Execution Details State
  const [executionDetails, setExecutionDetails] = useState<{
    universeName: string;
    symbolCount: number;
    startDate: string;
    endDate: string;
    period: string;
  } | null>(null);

  const runTournament = async (overrideRange?: '5y' | '6m') => {
    setRunning(true);
    setResults([]);
    setProgress(0);
    setExecutionDetails(null);

    const universeName = STOCK_UNIVERSES[selectedUniverse].name;
    const universeSymbols = STOCK_UNIVERSES[selectedUniverse].symbols;
    const totalSymbols = universeSymbols.length;
    
    // Determine effective date range
    let period: '6m' | '1y' | '2y' | '5y' = '1y';
    if (overrideRange) {
      period = overrideRange;
    } else if (filters.startDate || filters.endDate) {
      period = '5y';
    }
    
    const effectiveStartDate = filters.startDate || `(Default: Last ${period})`;
    const effectiveEndDate = filters.endDate || '(Default: Today)';

    setExecutionDetails({
      universeName,
      symbolCount: totalSymbols,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      period
    });

    const stats: Record<string, StrategyPerformance> = {};
    
    // Initialize stats
    PREBUILT_STRATEGIES.forEach(s => {
      stats[s.id] = {
        strategyId: s.id,
        strategyName: s.name,
        totalTrades: 0,
        wins: 0,
        totalPnL: 0,
        bestSymbol: '-',
        bestSymbolPnL: -Infinity,
        allTrades: []
      };
    });

    // Process in chunks
    const chunkSize = 5;
    for (let i = 0; i < totalSymbols; i += chunkSize) {
      const chunk = universeSymbols.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (symbol) => {
        try {
          const data = await fetchHistory(symbol, period);
          
          PREBUILT_STRATEGIES.forEach(strategy => {
            const activeFilters: TradeFilters = { ...filters };
            if (!activeFilters.minRiskReward) delete activeFilters.minRiskReward;
            if (!activeFilters.maxStopLossPercent) delete activeFilters.maxStopLossPercent;
            if (!activeFilters.minTargetPercent) delete activeFilters.minTargetPercent;
            if (!activeFilters.startDate) delete activeFilters.startDate;
            if (!activeFilters.endDate) delete activeFilters.endDate;

            const result = runBacktest(strategy, data, activeFilters);
            const sStats = stats[strategy.id];
            
            sStats.totalTrades += result.metrics.totalTrades;
            sStats.wins += result.trades.filter(t => t.pnl > 0).length;
            
            const symbolPnL = result.trades.reduce((acc, t) => acc + t.pnlPercent, 0);
            sStats.totalPnL += symbolPnL;

            if (symbolPnL > sStats.bestSymbolPnL) {
              sStats.bestSymbol = symbol;
              sStats.bestSymbolPnL = symbolPnL;
            }

            result.trades.forEach(t => {
              sStats.allTrades.push({
                symbol,
                entryDate: t.entryDate,
                entryPrice: t.entryPrice,
                exitDate: t.exitDate,
                exitPrice: t.exitPrice,
                stopLoss: t.stopLoss,
                target: t.target,
                type: t.type,
                pnlPercent: t.pnlPercent,
                mfe: t.mfe,
                mae: t.mae
              });
            });
          });
        } catch (e) {
          console.error(`Failed to process ${symbol}`, e);
        }
      }));

      setProgress(((i + chunkSize) / totalSymbols) * 100);
      setResults(Object.values(stats).sort((a, b) => b.totalPnL - a.totalPnL));
    }

    // Save scores if in override mode
    if (overrideRange) {
      const mode = overrideRange === '5y' ? 'avg' : 'recent';
      for (const res of Object.values(stats)) {
        const winRate = res.totalTrades > 0 ? (res.wins / res.totalTrades) * 100 : 0;
        await updateStrategyScore(res.strategyId, res.totalPnL, winRate, mode);
      }
      await loadScores();
    }

    setRunning(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      {/* Trade Inspector Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedTrade.symbol} Trade Analysis</h3>
                <p className={cn("text-sm font-medium", selectedTrade.pnlPercent > 0 ? "text-green-600" : "text-red-600")}>
                  {selectedTrade.pnlPercent > 0 ? '+' : ''}{selectedTrade.pnlPercent.toFixed(2)}% Return
                </p>
              </div>
              <button onClick={() => setSelectedTrade(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {loadingTrade ? (
                <div className="h-[400px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : (
                <TradeChart data={tradeData} trade={selectedTrade} />
              )}
              
              <div className="mt-6 grid grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block mb-1">Entry Date</span>
                  <span className="font-medium">{new Date(selectedTrade.entryDate).toLocaleDateString()}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block mb-1">Entry Price</span>
                  <span className="font-medium">{selectedTrade.entryPrice.toFixed(2)}</span>
                </div>
                 <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block mb-1">Exit Date</span>
                  <span className="font-medium">{selectedTrade.exitDate ? new Date(selectedTrade.exitDate).toLocaleDateString() : '-'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block mb-1">Exit Price</span>
                  <span className="font-medium">{selectedTrade.exitPrice?.toFixed(2) || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Strategy Tournament v2.1</h1>
          <p className="text-slate-600 mt-2">
            Battle of the bots! Run all strategies against <span className="font-semibold text-indigo-600">{STOCK_UNIVERSES[selectedUniverse].name}</span> to find the champion.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value as StockUniverse)}
              className="appearance-none bg-white border border-slate-300 text-slate-700 py-3 pl-4 pr-10 rounded-lg font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(STOCK_UNIVERSES).map(([key, value]) => (
                <option key={key} value={key}>{value.name} ({value.symbols.length})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg font-medium border transition-all",
              showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
          <button
            onClick={() => runTournament()}
            disabled={running}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all",
              running 
                ? "bg-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
            )}
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Backtest
              </>
            )}
          </button>

          <div className="h-10 w-px bg-slate-200 mx-1"></div>

          <button
            onClick={() => runTournament('5y')}
            disabled={running}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg font-medium border transition-all",
              running ? "opacity-50 cursor-not-allowed" : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
            )}
            title="Run tournament on 5 years of data to update average scores"
          >
            <Trophy className="w-5 h-5" />
            Update Avg (5Y)
          </button>

          <button
            onClick={() => runTournament('6m')}
            disabled={running}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-lg font-medium border transition-all",
              running ? "opacity-50 cursor-not-allowed" : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            )}
            title="Run tournament on last 6 months of data to update recent scores"
          >
            <TrendingUp className="w-5 h-5" />
            Update Recent (6M)
          </button>
        </div>
      </div>

      {/* Execution Details Panel */}
      {executionDetails && (
        <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-wrap gap-6 text-sm text-indigo-900 items-center">
          <div>
            <span className="font-semibold text-indigo-700 block text-xs uppercase tracking-wider">Universe</span>
            <span className="font-medium">{executionDetails.universeName} ({executionDetails.symbolCount} Symbols)</span>
          </div>
          <div>
            <span className="font-semibold text-indigo-700 block text-xs uppercase tracking-wider">Date Range</span>
            <span className="font-medium">{executionDetails.startDate} — {executionDetails.endDate}</span>
          </div>
          <div>
            <span className="font-semibold text-indigo-700 block text-xs uppercase tracking-wider">Data Period</span>
            <span className="font-medium">{executionDetails.period}</span>
          </div>
          <div>
            <span className="font-semibold text-indigo-700 block text-xs uppercase tracking-wider">Total Trades</span>
            <span className="font-medium">
              {results.reduce((acc, r) => acc + r.totalTrades, 0)}
            </span>
          </div>
          <div className="ml-auto">
             <button 
               onClick={() => setShowSymbolList(true)}
               className="text-indigo-600 hover:text-indigo-800 underline text-xs font-medium"
             >
               View Symbol List
             </button>
          </div>
        </div>
      )}

      {/* Symbol List Modal */}
      {showSymbolList && executionDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                Symbols in {executionDetails.universeName}
              </h3>
              <button 
                onClick={() => setShowSymbolList(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {STOCK_UNIVERSES[selectedUniverse].symbols.map(symbol => (
                  <div key={symbol} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-mono text-slate-700">
                    {symbol}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowSymbolList(false)}
                className="px-6 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Section */}
      {results.length > 0 && (
        <div className="mb-8">
          <button
            onClick={handleAIAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-70"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Market Data...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Ask AI Analyst
              </>
            )}
          </button>



          {analysis && (
            <div className="mt-6 p-6 bg-white rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                AI Strategy Report
              </h3>
              <div className="prose prose-indigo max-w-none text-slate-700">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 animate-in slide-in-from-top-2">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-500" />
            Trade Filtering Rules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Min Risk:Reward Ratio
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  value={filters.minRiskReward || ''}
                  onChange={(e) => setFilters({...filters, minRiskReward: parseFloat(e.target.value) || 0})}
                  placeholder="e.g. 2.0"
                  className="w-full p-2.5 pl-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">R</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Only take trades with potential &gt; {filters.minRiskReward || 0}x risk.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Max Stop Loss %
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.5"
                  min="0"
                  value={filters.maxStopLossPercent || ''}
                  onChange={(e) => setFilters({...filters, maxStopLossPercent: parseFloat(e.target.value) || 0})}
                  placeholder="e.g. 5"
                  className="w-full p-2.5 pl-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Skip trades where SL is deeper than {filters.maxStopLossPercent || 0}%.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Min Target %
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="1"
                  min="0"
                  value={filters.minTargetPercent || ''}
                  onChange={(e) => setFilters({...filters, minTargetPercent: parseFloat(e.target.value) || 0})}
                  placeholder="e.g. 10"
                  className="w-full p-2.5 pl-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Only take trades aiming for &gt; {filters.minTargetPercent || 0}% profit.</p>
            </div>

            {/* Date Range Filters */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Calendar size={16} /> Start Date
              </label>
              <input 
                type="date" 
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Calendar size={16} /> End Date
              </label>
              <input 
                type="date" 
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-6">Rank</th>
                <th className="p-6">Strategy</th>
                <th className="p-6 text-right">Total Return (Sum %)</th>
                <th className="p-6 text-right" title="Score from 5-year data">Avg Score (5Y)</th>
                <th className="p-6 text-right" title="Score from 6-month data">Recent Score (6M)</th>
                <th className="p-6 text-right">Win Rate</th>
                <th className="p-6 text-right">Total Trades</th>
                <th className="p-6 text-right">Avg Trades/Week</th>
                <th className="p-6 text-right">Avg Hold</th>
                <th className="p-6">Best Stock</th>
                <th className="p-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((res, index) => {
                const winRate = res.totalTrades > 0 ? (res.wins / res.totalTrades) * 100 : 0;
                const isExpanded = expandedId === res.strategyId;
                
                // Calculate Avg Trades Per Week
                let weeks = 52; // Default 1 year
                if (executionDetails?.period === '5y') weeks = 52 * 5;
                else if (executionDetails?.period === '6m') weeks = 26;
                else if (executionDetails?.period === '2y') weeks = 52 * 2;
                // If specific dates were used, we could be more precise, but this is a good approximation
                // based on the "Data Period" filter.
                
                const avgTradesPerWeek = res.totalTrades / weeks;
                
                // Calculate Avg Hold Days
                let totalHoldDays = 0;
                let closedTradesCount = 0;
                
                res.allTrades.forEach(t => {
                  if (t.exitDate) {
                    const entry = new Date(t.entryDate).getTime();
                    const exit = new Date(t.exitDate).getTime();
                    const days = (exit - entry) / (1000 * 60 * 60 * 24);
                    totalHoldDays += days;
                    closedTradesCount++;
                  }
                });
                
                const avgHoldDays = closedTradesCount > 0 ? totalHoldDays / closedTradesCount : 0;
                
                return (
                  <React.Fragment key={res.strategyId}>
                    <tr 
                      className={cn(
                        "hover:bg-slate-50 transition-colors cursor-pointer",
                        index === 0 ? "bg-amber-50/50" : ""
                      )}
                      onClick={() => setExpandedId(isExpanded ? null : res.strategyId)}
                    >
                      <td className="p-6">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                          index === 0 ? "bg-amber-100 text-amber-700" : 
                          index === 1 ? "bg-slate-200 text-slate-700" :
                          index === 2 ? "bg-orange-100 text-orange-800" : "text-slate-400"
                        )}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="p-6 font-medium text-slate-900">
                        {res.strategyName}
                        {index === 0 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Champion</span>}
                      </td>
                      <td className={cn(
                        "p-6 text-right font-bold font-mono",
                        res.totalPnL > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {res.totalPnL > 0 ? '+' : ''}{res.totalPnL.toFixed(2)}%
                      </td>
                      <td className="p-6 text-right text-slate-500 font-mono text-xs">
                        {(() => {
                          const s = scores[res.strategyId];
                          if (!s || !s.lastUpdatedAvg) return '-';
                          return (
                            <div className="flex flex-col">
                              <span className={cn(s.avgPnL > 0 ? "text-green-600" : "text-red-600")}>
                                {s.avgPnL > 0 ? '+' : ''}{s.avgPnL.toFixed(1)}%
                              </span>
                              <span className="text-[10px] opacity-50">{s.avgWinRate.toFixed(0)}% WR</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-6 text-right text-slate-500 font-mono text-xs">
                        {(() => {
                          const s = scores[res.strategyId];
                          if (!s || !s.lastUpdatedRecent) return '-';
                          return (
                            <div className="flex flex-col">
                              <span className={cn(s.recentPnL > 0 ? "text-green-600" : "text-red-600")}>
                                {s.recentPnL > 0 ? '+' : ''}{s.recentPnL.toFixed(1)}%
                              </span>
                              <span className="text-[10px] opacity-50">{s.recentWinRate.toFixed(0)}% WR</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-6 text-right text-slate-700">
                        {winRate.toFixed(1)}%
                      </td>
                      <td className="p-6 text-right text-slate-600">
                        {res.totalTrades}
                      </td>
                      <td className="p-6 text-right text-slate-600">
                        {avgTradesPerWeek.toFixed(1)}
                      </td>
                      <td className="p-6 text-right text-slate-600">
                        {avgHoldDays.toFixed(1)}d
                      </td>
                      <td className="p-6 text-sm">
                        <span className="font-medium text-slate-900">{res.bestSymbol}</span>
                        <span className="ml-2 text-green-600">+{res.bestSymbolPnL.toFixed(1)}%</span>
                      </td>
                      <td className="p-6 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={11} className="p-6">
                          <div className="grid grid-cols-2 gap-8">
                            <div>
                              <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Top 10 Winners
                              </h4>
                              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                      <th className="px-4 py-2 text-left">Symbol</th>
                                      <th className="px-4 py-2 text-left">Date</th>
                                      <th className="px-4 py-2 text-right">Return</th>
                                      <th className="px-4 py-2 text-right" title="Max Favorable Excursion (Max Profit Reached)">MFE</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {res.allTrades
                                      .filter(t => t.pnlPercent > 0)
                                      .sort((a, b) => b.pnlPercent - a.pnlPercent)
                                      .slice(0, 10)
                                      .map((t, i) => (
                                        <tr 
                                          key={i} 
                                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                                          onClick={() => setSelectedTrade(t)}
                                        >
                                          <td className="px-4 py-2 font-medium">{t.symbol}</td>
                                          <td className="px-4 py-2 text-slate-500">{new Date(t.entryDate).toLocaleDateString()}</td>
                                          <td className="px-4 py-2 text-right text-green-600 font-bold">+{t.pnlPercent.toFixed(2)}%</td>
                                          <td className="px-4 py-2 text-right text-slate-500">{t.mfe?.toFixed(1)}%</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Top 10 Losers
                              </h4>
                              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                      <th className="px-4 py-2 text-left">Symbol</th>
                                      <th className="px-4 py-2 text-left">Date</th>
                                      <th className="px-4 py-2 text-right">Return</th>
                                      <th className="px-4 py-2 text-right" title="Max Adverse Excursion (Max Drawdown Reached)">MAE</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {res.allTrades
                                      .filter(t => t.pnlPercent <= 0)
                                      .sort((a, b) => a.pnlPercent - b.pnlPercent)
                                      .slice(0, 10)
                                      .map((t, i) => (
                                        <tr 
                                          key={i} 
                                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors"
                                          onClick={() => setSelectedTrade(t)}
                                        >
                                          <td className="px-4 py-2 font-medium">{t.symbol}</td>
                                          <td className="px-4 py-2 text-slate-500">{new Date(t.entryDate).toLocaleDateString()}</td>
                                          <td className="px-4 py-2 text-right text-red-600 font-bold">{t.pnlPercent.toFixed(2)}%</td>
                                          <td className="px-4 py-2 text-right text-slate-500">{t.mae?.toFixed(1)}%</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!running && results.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Ready to compete?</h3>
          <p className="text-slate-500 mt-1">Click the button above to benchmark all strategies.</p>
        </div>
      )}
    </div>
  );
}
