import React, { useState, useEffect } from 'react';
import { BarChart, Play, Loader2, Settings, BrainCircuit, ChevronDown, TrendingUp, AlertCircle, History, Wallet, Calendar } from 'lucide-react';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { cn } from '../lib/utils';
import { STOCK_UNIVERSES, StockUniverse } from '../lib/stockUniverses';
import { PortfolioState } from '../lib/portfolioBacktest';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

import { useSimulation } from '../context/SimulationContext';
import { calculateArchitectScoreV3 } from '../lib/analysis';

export function PortfolioSimulator() {
  const { running, progress, results, settings, updateSettings, runSimulation } = useSimulation();

  const handleStrategyToggle = (id: string) => {
    const selected = settings.selectedStrategies;
    if (selected.includes(id)) {
      updateSettings({ selectedStrategies: selected.filter(sId => sId !== id) });
    } else {
      updateSettings({ selectedStrategies: [...selected, id] });
    }
  };

  const selectTopRated = async () => {
    const { getStrategyScores } = await import('../lib/scores');
    const scores = await getStrategyScores();
    
    const rated = PREBUILT_STRATEGIES.map(s => {
      const scoreData = scores[s.id];
      const score = calculateArchitectScoreV3(scoreData);
      return { ...s, score };
    });

    // Sort by score descending
    const sorted = rated.sort((a, b) => b.score - a.score);

    const selectedIds: string[] = [];
    const selectedCategories = new Set<string>();

    // Phase 1: Pick the best from each category
    for (const s of sorted) {
      if (selectedIds.length >= 5) break;
      if (s.category && !selectedCategories.has(s.category)) {
        selectedIds.push(s.id);
        selectedCategories.add(s.category);
      }
    }

    // Phase 2: Fill remaining slots with next best (if any)
    for (const s of sorted) {
      if (selectedIds.length >= 5) break;
      if (!selectedIds.includes(s.id)) {
        selectedIds.push(s.id);
      }
    }

    updateSettings({ selectedStrategies: selectedIds });
  };

  return (
    <div className="p-6 max-w-[98%] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart className="w-8 h-8 text-indigo-600" />
            Portfolio Simulator
          </h1>
          <p className="text-slate-600 mt-1">Simulate real-world portfolio performance with shared capital and risk rules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* --- SETTINGS & STRATEGIES --- */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-indigo-500" />
              Simulation Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Capital</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">₹</span>
                  <input 
                    type="number"
                    value={settings.initialCapital}
                    onChange={e => updateSettings({ initialCapital: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 pl-7 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Risk per Trade</label>
                 <div className="relative">
                  <input 
                    type="number"
                    value={settings.riskPerTrade}
                    onChange={e => updateSettings({ riskPerTrade: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 pr-8 border border-slate-300 rounded-lg"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400">%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Risk:Reward</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.1"
                      value={settings.minRiskReward}
                      onChange={e => updateSettings({ minRiskReward: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 pr-8 border border-slate-300 rounded-lg"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400">R</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Stop Loss</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.5"
                      value={settings.maxStopLossPercent}
                      onChange={e => updateSettings({ maxStopLossPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 pr-8 border border-slate-300 rounded-lg"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400">%</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Open Trades</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={settings.maxOpenTrades}
                    onChange={e => updateSettings({ maxOpenTrades: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">Crucial: Prevents portfolio-wide "cluster risk" during market crashes.</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">Max Hold Days</label>
                  <button 
                    onClick={() => updateSettings({ maxHoldDays: settings.maxHoldDays > 0 ? 0 : 30 })}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded transition-colors",
                      settings.maxHoldDays > 0 
                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {settings.maxHoldDays > 0 ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="number"
                    min="0"
                    disabled={settings.maxHoldDays === 0}
                    value={settings.maxHoldDays === 0 ? '' : settings.maxHoldDays}
                    onChange={e => updateSettings({ maxHoldDays: parseInt(e.target.value) || 0 })}
                    className={cn(
                      "w-full p-2 pr-12 border rounded-lg transition-opacity",
                      settings.maxHoldDays === 0 ? "border-slate-200 bg-slate-50 opacity-50" : "border-slate-300"
                    )}
                    placeholder="Enter days..."
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs">DAYS</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">Force exit if trade is profitable after N days.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Consensus Score</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={settings.minConsensusScore}
                    onChange={e => updateSettings({ minConsensusScore: parseInt(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 italic">Requires multiple strategies to agree before taking a trade (0-100).</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Trailing Stop Loss</label>
                  <p className="text-[10px] text-slate-500 italic">Locks in profits by moving SL up.</p>
                </div>
                <button
                  onClick={() => updateSettings({ useTrailingStop: !settings.useTrailingStop })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.useTrailingStop ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.useTrailingStop ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Market Regime Filter</label>
                  <p className="text-[10px] text-slate-500 italic">Stay in cash if Nifty 50 &lt; SMA 200.</p>
                </div>
                <button
                  onClick={() => updateSettings({ useMarketRegimeFilter: !settings.useMarketRegimeFilter })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.useMarketRegimeFilter ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.useMarketRegimeFilter ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Dynamic Risk Scaling</label>
                  <p className="text-[10px] text-slate-500 italic">Bet more on high-conviction signals.</p>
                </div>
                <button
                  onClick={() => updateSettings({ useDynamicRisk: !settings.useDynamicRisk })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.useDynamicRisk ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.useDynamicRisk ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Probabilistic Execution</label>
                  <p className="text-[10px] text-slate-500 italic">Uses Score as % chance to enter trade.</p>
                </div>
                <button
                  onClick={() => updateSettings({ useProbabilisticExecution: !settings.useProbabilisticExecution })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.useProbabilisticExecution ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.useProbabilisticExecution ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Allow Fractional Shares</label>
                  <p className="text-[10px] text-slate-500 italic">Research Mode: Ignores capital bottlenecks.</p>
                </div>
                <button
                  onClick={() => updateSettings({ allowFractionalShares: !settings.allowFractionalShares })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    settings.allowFractionalShares ? "bg-indigo-600" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.allowFractionalShares ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stock Universe</label>
                <div className="relative">
                  <select
                    value={settings.universe}
                    onChange={(e) => updateSettings({ universe: e.target.value as StockUniverse })}
                    className="w-full appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-3 pr-10 rounded-lg font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(STOCK_UNIVERSES).map(([key, value]) => (
                      <option key={key} value={key}>{value.name} ({value.symbols.length})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar size={14} /> Start
                  </label>
                  <input 
                    type="date"
                    value={settings.startDate}
                    onChange={e => updateSettings({ startDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar size={14} /> End
                  </label>
                  <input 
                    type="date"
                    value={settings.endDate}
                    onChange={e => updateSettings({ endDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Period (if no dates)</label>
                <div className="relative">
                  <select
                    value={settings.dataPeriod}
                    onChange={(e) => updateSettings({ dataPeriod: e.target.value as any })}
                    className="w-full appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-3 pr-10 rounded-lg font-medium hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1y">Last 1 Year</option>
                    <option value="2y">Last 2 Years</option>
                    <option value="5y">Last 5 Years</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-5 h-5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-500" />
                Select Strategies
              </h2>
              <button 
                onClick={selectTopRated}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
              >
                Select Top 5 Rated
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {PREBUILT_STRATEGIES.map(strategy => (
                <label key={strategy.id} className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.selectedStrategies.includes(strategy.id)}
                    onChange={() => handleStrategyToggle(strategy.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-800">{strategy.name}</span>
                </label>
              ))}
            </div>
          </div>

           <button
            onClick={runSimulation}
            disabled={running}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all",
              running 
                ? "bg-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
            )}
          >
            {running ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Simulating...</>
            ) : (
              <><Play className="w-5 h-5" /> Run Simulation</>
            )}
          </button>
        </div>

        {/* --- RESULTS --- */}
        <div className="lg:col-span-2 space-y-8">
          {!results && !running && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 h-full flex items-center justify-center">
              <div className="text-center py-24">
                <h3 className="text-xl font-bold text-slate-800">Ready to Simulate</h3>
                <p className="text-slate-500 mt-2">Configure your settings and run the simulation to see the portfolio's performance.</p>
              </div>
            </div>
          )}

          {running && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 h-full flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-800">Fetching Market Data...</h3>
              <p className="text-slate-500 mt-2">Processing {STOCK_UNIVERSES[settings.universe].symbols.length} symbols</p>
              <div className="w-64 bg-slate-100 h-2 rounded-full mt-6 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs font-bold text-indigo-600 mt-2">{progress}%</span>
            </div>
          )}

          {results && (
            <>
              {/* Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard 
                  label="Final Equity" 
                  value={`₹${results.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  subValue={`${((results.equity - settings.initialCapital) / settings.initialCapital * 100).toFixed(1)}% Return`}
                  icon={<Wallet className="w-5 h-5 text-emerald-500" />}
                />
                <MetricCard 
                  label="Total Trades" 
                  value={results.tradeHistory.length}
                  subValue={`${results.openTrades.length} Currently Open`}
                  icon={<History className="w-5 h-5 text-indigo-500" />}
                />
                <MetricCard 
                  label="Win Rate" 
                  value={`${(results.tradeHistory.filter(t => (t.pnl || 0) > 0).length / (results.tradeHistory.length || 1) * 100).toFixed(1)}%`}
                  subValue={`${(results as any).profitFactor.toFixed(2)} Profit Factor`}
                  icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
                />
                <MetricCard 
                  label="Max Drawdown" 
                  value={`${(results as any).maxDrawdown.toFixed(1)}%`}
                  subValue="Peak to Trough"
                  icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                />
              </div>

              {/* Equity Curve Chart */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Equity Curve</h3>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={results.equityCurve}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(label) => new Date(label).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        domain={['auto', 'auto']}
                        tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`}
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Equity']}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="equity" 
                        stroke="#4f46e5" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorEquity)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trade History Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-slate-800">Portfolio Trade Log</h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {results.tradeHistory.length} Total Trades
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      const headers = ['Symbol', 'Strategy', 'Consensus Score', 'Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'PnL %', 'Reason'];
                      const rows = [...results.tradeHistory]
                        .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
                        .map(t => [
                          t.symbol,
                          t.strategyName,
                          Math.round(t.consensusScore),
                          t.entryDate,
                          t.exitDate || '-',
                          t.entryPrice.toFixed(2),
                          t.exitPrice?.toFixed(2) || '-',
                          t.pnlPercent?.toFixed(2) || '0',
                          t.reason
                        ]);
                      
                      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement("a");
                      const url = URL.createObjectURL(blob);
                      link.setAttribute("href", url);
                      link.setAttribute("download", `portfolio_trades_${new Date().toISOString().split('T')[0]}.csv`);
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3">Symbol</th>
                        <th className="px-6 py-3">Strategy</th>
                        <th className="px-6 py-3 text-center">Score</th>
                        <th className="px-6 py-3">Entry Date</th>
                        <th className="px-6 py-3">Exit Date</th>
                        <th className="px-6 py-3 text-right">PnL %</th>
                        <th className="px-6 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...results.tradeHistory]
                        .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
                        .map((trade, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{trade.symbol}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{trade.strategyName}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold",
                              trade.consensusScore >= 70 ? "bg-emerald-100 text-emerald-700" :
                              trade.consensusScore >= 50 ? "bg-blue-100 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {Math.round(trade.consensusScore)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{new Date(trade.entryDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{trade.exitDate ? new Date(trade.exitDate).toLocaleDateString() : '-'}</td>
                          <td className={cn(
                            "px-6 py-4 text-right font-mono font-bold",
                            (trade.pnlPercent || 0) > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {(trade.pnlPercent || 0) > 0 ? '+' : ''}{trade.pnlPercent?.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 italic">{trade.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subValue, icon }: { label: string; value: string | number; subValue: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{subValue}</div>
    </div>
  );
}
