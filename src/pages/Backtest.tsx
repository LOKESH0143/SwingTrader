import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { PREBUILT_STRATEGIES, loadCustomStrategies } from '../lib/strategies';
import { NIFTY_500_SYMBOLS } from '../lib/nifty500';
import { fetchHistory } from '../services/api';
import { runBacktest } from '../lib/backtest';
import { Strategy } from '../lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Backtest() {
  const [searchParams] = useSearchParams();
  const allStrategies = [...PREBUILT_STRATEGIES, ...loadCustomStrategies().filter(c => !PREBUILT_STRATEGIES.some(p => p.id === c.id))];
  const urlStrategy = searchParams.get('strategy');
  const initialStrategyId = urlStrategy && allStrategies.some(s => s.id === urlStrategy) ? urlStrategy : allStrategies[0]?.id;

  const [selectedStrategyId, setSelectedStrategyId] = useState(initialStrategyId || PREBUILT_STRATEGIES[0].id);
  const [selectedSymbol, setSelectedSymbol] = useState(NIFTY_500_SYMBOLS[0]);
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | '2y' | '5y'>('2y');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlStrategy && allStrategies.some(s => s.id === urlStrategy)) {
      setSelectedStrategyId(urlStrategy);
    }
  }, [urlStrategy]);

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // 1. Fetch Data
      const data = await fetchHistory(selectedSymbol, timeRange);
      
      // 2. Get Strategy
      const strategy = allStrategies.find(s => s.id === selectedStrategyId);
      if (!strategy) throw new Error("Strategy not found");

      // 3. Run Backtest
      const backtestResult = runBacktest(strategy, data);
      setResult(backtestResult);
      
    } catch (err: any) {
      setError(err.message || "Failed to run backtest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[98%] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Backtest Engine</h1>
        <p className="text-slate-600 mt-2">Test your strategies against historical Nifty 500 data.</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Strategy</label>
            <select 
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {allStrategies.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Symbol (Nifty 500)</label>
            <select 
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {NIFTY_500_SYMBOLS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Time Range</label>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="2y">2 Years</option>
              <option value="5y">5 Years</option>
            </select>
          </div>

          <button 
            onClick={handleRunBacktest}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Run Simulation
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-3 mb-8">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard 
              label="Net Profit" 
              value={`₹${result.metrics.netProfit.toFixed(2)}`} 
              trend={result.metrics.netProfit > 0 ? 'up' : 'down'} 
            />
            <MetricCard 
              label="Win Rate" 
              value={`${result.metrics.winRate.toFixed(1)}%`} 
              subtext={`${result.metrics.totalTrades} Trades`}
            />
            <MetricCard 
              label="Profit Factor" 
              value={result.metrics.profitFactor.toFixed(2)} 
            />
             <MetricCard 
              label="Max Drawdown" 
              value={`${result.metrics.maxDrawdown.toFixed(1)}%`} 
              trend="down"
            />
          </div>

          {/* Trade List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-200 bg-slate-50">
               <h3 className="font-semibold text-slate-800">Trade Log</h3>
             </div>
             <div className="max-h-96 overflow-y-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                   <tr>
                     <th className="px-6 py-3">Entry Date</th>
                     <th className="px-6 py-3">Type</th>
                     <th className="px-6 py-3">Entry Price</th>
                     <th className="px-6 py-3">Target</th>
                     <th className="px-6 py-3">Stop Loss</th>
                     <th className="px-6 py-3">Exit Price</th>
                     <th className="px-6 py-3">PnL</th>
                     <th className="px-6 py-3">Reason</th>
                   </tr>
                 </thead>
                 <tbody>
                   {result.trades.map((trade: any, i: number) => (
                     <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                       <td className="px-6 py-3 font-mono">{new Date(trade.entryDate).toLocaleDateString()}</td>
                       <td className="px-6 py-3">
                         <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">LONG</span>
                       </td>
                       <td className="px-6 py-3">₹{trade.entryPrice.toFixed(2)}</td>
                       <td className="px-6 py-3 text-slate-600">₹{trade.target?.toFixed(2)}</td>
                       <td className="px-6 py-3 text-slate-600">₹{trade.stopLoss?.toFixed(2)}</td>
                       <td className="px-6 py-3">₹{trade.exitPrice?.toFixed(2)}</td>
                       <td className={`px-6 py-3 font-medium ${trade.pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                         {trade.pnl > 0 ? '+' : ''}₹{trade.pnl.toFixed(2)} ({trade.pnlPercent.toFixed(2)}%)
                       </td>
                       <td className="px-6 py-3 text-slate-500">{trade.reason}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, subtext, trend }: { label: string, value: string, subtext?: string, trend?: 'up' | 'down' }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="flex items-end justify-between mt-2">
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        {trend && (
          <div className={`flex items-center ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          </div>
        )}
      </div>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}
