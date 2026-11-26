import React, { useState } from 'react';
import { Radar, Target, ArrowUpRight, ArrowDownRight, Zap, Search, AlertTriangle, BookOpen, Check, Filter, RefreshCw } from 'lucide-react';
import { NIFTY_500_SYMBOLS } from '../lib/nifty500';
import { STOCK_UNIVERSES, StockUniverse } from '../lib/stockUniverses';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { fetchHistory } from '../services/api';
import { evaluateStrategy } from '../lib/scanner';
import { Signal } from '../lib/types';
import { cn } from '../lib/utils';
import { journalService } from '../services/journal';

export function Dashboard() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [selectedUniverse, setSelectedUniverse] = useState<StockUniverse | 'NIFTY_500'>('NIFTY_50');
  const [forceRefresh, setForceRefresh] = useState(false);

  const getSymbols = () => {
    if (selectedUniverse === 'NIFTY_500') return NIFTY_500_SYMBOLS;
    return STOCK_UNIVERSES[selectedUniverse]?.symbols || NIFTY_500_SYMBOLS.slice(0, 50);
  };

  const universeSymbols = getSymbols();

  const runScan = async () => {
    setScanning(true);
    setSignals([]);
    setProgress(0);
    setScannedCount(0);

    const symbolsToScan = getSymbols();
    const total = symbolsToScan.length;
    const newSignals: Signal[] = [];

    // Process in chunks to avoid UI freeze and rate limits
    const chunkSize = 5;
    for (let i = 0; i < total; i += chunkSize) {
      const chunk = symbolsToScan.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (symbol) => {
        try {
          // Fetch last 300 days (enough for 200 SMA)
          const data = await fetchHistory(symbol, '1y', forceRefresh); 
          
          // Check ALL strategies
          for (const strategy of PREBUILT_STRATEGIES) {
            const signal = evaluateStrategy(strategy, data);
            if (signal) {
              newSignals.push({ ...signal, symbol });
            }
          }
        } catch (e) {
          console.error(`Failed to scan ${symbol}`, e);
        }
      }));

      setScannedCount(prev => Math.min(prev + chunkSize, total));
      setProgress(((i + chunkSize) / total) * 100);
      setSignals([...newSignals]); // Update UI incrementally
    }

    setScanning(false);
  };

  return (
    <div className="p-6 max-w-[98%] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Market Dashboard</h1>
          <p className="text-slate-600 mt-2">Real-time scanner and active signal monitoring.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedUniverse}
              onChange={(e) => setSelectedUniverse(e.target.value as any)}
              disabled={scanning}
              className="text-sm font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="NIFTY_50">Nifty 50 (50 stocks)</option>
              <option value="NIFTY_100">Nifty 100 (100 stocks)</option>
              <option value="BANKING">Banking & Finance (19 stocks)</option>
              <option value="IT">IT Sector (8 stocks)</option>
              <option value="AUTO">Auto Sector (8 stocks)</option>
              <option value="PHARMA">Pharma (7 stocks)</option>
              <option value="FMCG">FMCG (11 stocks)</option>
              <option value="ENERGY">Energy (10 stocks)</option>
              <option value="METAL">Metals (5 stocks)</option>
              <option value="INFRA">Infra (15 stocks)</option>
              <option value="NIFTY_500">Nifty 500 (Full 500)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-2.5 rounded-lg border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              disabled={scanning}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Force Live Fetch</span>
          </label>

          <button
            onClick={runScan}
            disabled={scanning}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white shadow-lg transition-all",
              scanning 
                ? "bg-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
            )}
          >
            {scanning ? (
              <>
                <Search className="w-5 h-5 animate-spin" />
                Scanning ({Math.round(progress)}%)...
              </>
            ) : (
              <>
                <Radar className="w-5 h-5" />
                Scan Universe
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-sky-500 rounded-lg">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Symbols Scanned</p>
              <h3 className="text-2xl font-bold font-mono text-slate-900">{scannedCount} / {universeSymbols.length}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 text-emerald-500 rounded-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Active Signals</p>
              <h3 className="text-2xl font-bold font-mono text-slate-900">{signals.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-lg">
              <Target className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Top Strategy</p>
              <h3 className="text-lg font-bold text-slate-900 truncate">
                {signals.length > 0 
                  ? getTopStrategy(signals)
                  : "—"}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Signals Grid */}
      {signals.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {signals.map((signal, idx) => (
            <SignalCard key={`${signal.symbol}-${idx}`} signal={signal} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <div className="mx-auto w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No active setups scanned yet</h3>
          <p className="text-sm text-slate-500 mt-1">Select an NSE universe above and click Scan Universe.</p>
        </div>
      )}
    </div>
  );
}

const SignalCard: React.FC<{ signal: Signal }> = ({ signal }) => {
  const [added, setAdded] = useState(false);
  const risk = signal.price - signal.stopLoss;
  const reward = signal.target - signal.price;
  const rrRatio = risk > 0 ? reward / risk : 0;

  const handleAddToJournal = async () => {
    try {
      await journalService.addTrade({
        symbol: signal.symbol,
        strategyName: signal.strategyName,
        entryDate: new Date().toISOString().split('T')[0],
        entryPrice: signal.price,
        stopLoss: signal.stopLoss,
        target: signal.target,
        status: 'OPEN',
        direction: 'LONG',
        notes: `Signal from ${signal.strategyName}. Reason: ${signal.reason}`
      });
      setAdded(true);
    } catch (e) {
      alert("Failed to add to journal");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold font-mono text-slate-900">{signal.symbol}</h3>
            <span className="px-2 py-0.5 bg-green-100 text-emerald-500 text-xs font-mono font-bold rounded uppercase">
              {signal.type}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{signal.strategyName}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold font-mono text-slate-900">₹{signal.price.toFixed(2)}</div>
          <div className="text-xs font-mono text-slate-400">{new Date(signal.date).toLocaleDateString()}</div>
        </div>
      </div>
      
      <div className="p-5 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Stop Loss</p>
          <div className="flex items-center gap-1 text-red-500 font-mono font-semibold">
            <ArrowDownRight className="w-4 h-4" />
            ₹{signal.stopLoss.toFixed(2)}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Target</p>
          <div className="flex items-center gap-1 text-emerald-500 font-mono font-semibold">
            <ArrowUpRight className="w-4 h-4" />
            ₹{signal.target.toFixed(2)}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">R:R Ratio</p>
          <div className="font-mono font-semibold text-slate-700">
            1:{rrRatio.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-sm text-slate-600 flex items-start gap-2 flex-1">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        {signal.reason}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <button
          onClick={handleAddToJournal}
          disabled={added}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
            added 
              ? "bg-green-100 text-green-700 cursor-default"
              : "bg-white border border-slate-300 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
          )}
        >
          {added ? (
            <>
              <Check className="w-4 h-4" /> Added to Journal
            </>
          ) : (
            <>
              <BookOpen className="w-4 h-4" /> Add to Journal
            </>
          )}
        </button>
      </div>
    </div>
  );
};

function getTopStrategy(signals: Signal[]) {
  const counts: Record<string, number> = {};
  signals.forEach(s => counts[s.strategyName] = (counts[s.strategyName] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
