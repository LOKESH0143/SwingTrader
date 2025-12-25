import React, { useState } from 'react';
import { Trophy, Play, Loader2, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { NIFTY_500_SYMBOLS } from '../lib/nifty500';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { fetchHistory } from '../services/api';
import { runBacktest, TradeFilters } from '../lib/backtest';
import { cn } from '../lib/utils';

interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  wins: number;
  totalPnL: number; // Sum of PnL %
  bestSymbol: string;
  bestSymbolPnL: number;
  allTrades: { symbol: string; pnl: number; pnlPercent: number; date: string }[];
}

export function Tournament() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<StrategyPerformance[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<TradeFilters>({
    minRiskReward: 0,
    maxStopLossPercent: 0,
    minTargetPercent: 0
  });
  const [showFilters, setShowFilters] = useState(false);

  const runTournament = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);

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

    const totalSymbols = NIFTY_500_SYMBOLS.length;
    
    // Process in chunks
    const chunkSize = 5;
    for (let i = 0; i < totalSymbols; i += chunkSize) {
      const chunk = NIFTY_500_SYMBOLS.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (symbol) => {
        try {
          const data = await fetchHistory(symbol, '1y'); // 1 Year Tournament
          
          PREBUILT_STRATEGIES.forEach(strategy => {
            // Pass filters to runBacktest
            const activeFilters: TradeFilters = {};
            if (filters.minRiskReward && filters.minRiskReward > 0) activeFilters.minRiskReward = filters.minRiskReward;
            if (filters.maxStopLossPercent && filters.maxStopLossPercent > 0) activeFilters.maxStopLossPercent = filters.maxStopLossPercent;
            if (filters.minTargetPercent && filters.minTargetPercent > 0) activeFilters.minTargetPercent = filters.minTargetPercent;

            const result = runBacktest(strategy, data, activeFilters);
            const sStats = stats[strategy.id];
            
            sStats.totalTrades += result.metrics.totalTrades;
            sStats.wins += result.trades.filter(t => t.pnl > 0).length;
            
            // Summing up PnL percentages to normalize across stock prices
            const symbolPnL = result.trades.reduce((acc, t) => acc + t.pnlPercent, 0);
            sStats.totalPnL += symbolPnL;

            if (symbolPnL > sStats.bestSymbolPnL) {
              sStats.bestSymbol = symbol;
              sStats.bestSymbolPnL = symbolPnL;
            }

            // Collect trades
            result.trades.forEach(t => {
              sStats.allTrades.push({
                symbol,
                pnl: t.pnl,
                pnlPercent: t.pnlPercent,
                date: t.entryDate
              });
            });
          });
        } catch (e) {
          console.error(`Failed to process ${symbol}`, e);
        }
      }));

      setProgress(((i + chunkSize) / totalSymbols) * 100);
      // Force update UI with intermediate results
      setResults(Object.values(stats).sort((a, b) => b.totalPnL - a.totalPnL));
    }

    setRunning(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Strategy Tournament</h1>
          <p className="text-slate-600 mt-2">
            Battle of the bots! Run all strategies against Nifty 100 stocks (1 Year) to find the champion.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
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
            onClick={runTournament}
            disabled={running}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all",
              running 
                ? "bg-slate-400 cursor-not-allowed" 
                : "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
            )}
          >
            {running ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running ({Math.round(progress)}%)...
              </>
            ) : (
              <>
                <Trophy className="w-5 h-5" />
                Start Tournament
              </>
            )}
          </button>
        </div>
      </div>

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
                <th className="p-6 text-right">Win Rate</th>
                <th className="p-6 text-right">Total Trades</th>
                <th className="p-6">Best Stock</th>
                <th className="p-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((res, index) => {
                const winRate = res.totalTrades > 0 ? (res.wins / res.totalTrades) * 100 : 0;
                const isExpanded = expandedId === res.strategyId;
                
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
                      <td className="p-6 text-right text-slate-700">
                        {winRate.toFixed(1)}%
                      </td>
                      <td className="p-6 text-right text-slate-600">
                        {res.totalTrades}
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
                        <td colSpan={7} className="p-6">
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
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {res.allTrades
                                      .sort((a, b) => b.pnlPercent - a.pnlPercent)
                                      .slice(0, 10)
                                      .map((t, i) => (
                                        <tr key={i} className="border-b border-slate-100 last:border-0">
                                          <td className="px-4 py-2 font-medium">{t.symbol}</td>
                                          <td className="px-4 py-2 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                          <td className="px-4 py-2 text-right text-green-600 font-bold">+{t.pnlPercent.toFixed(2)}%</td>
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
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {res.allTrades
                                      .sort((a, b) => a.pnlPercent - b.pnlPercent)
                                      .slice(0, 10)
                                      .map((t, i) => (
                                        <tr key={i} className="border-b border-slate-100 last:border-0">
                                          <td className="px-4 py-2 font-medium">{t.symbol}</td>
                                          <td className="px-4 py-2 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                          <td className="px-4 py-2 text-right text-red-600 font-bold">{t.pnlPercent.toFixed(2)}%</td>
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
