import React, { useState } from 'react';
import { Radar, Target, ArrowUpRight, ArrowDownRight, Zap, Search, AlertTriangle } from 'lucide-react';
import { NIFTY_500_SYMBOLS } from '../lib/nifty500';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { fetchHistory } from '../services/api';
import { evaluateStrategy } from '../lib/scanner';
import { Signal } from '../lib/types';
import { cn } from '../lib/utils';

export function Dashboard() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scannedCount, setScannedCount] = useState(0);

  const runScan = async () => {
    setScanning(true);
    setSignals([]);
    setProgress(0);
    setScannedCount(0);

    const total = NIFTY_500_SYMBOLS.length;
    const newSignals: Signal[] = [];

    // Process in chunks to avoid UI freeze and rate limits
    const chunkSize = 5;
    for (let i = 0; i < total; i += chunkSize) {
      const chunk = NIFTY_500_SYMBOLS.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (symbol) => {
        try {
          // Fetch last 300 days (enough for 200 SMA)
          const data = await fetchHistory(symbol, '1y'); // Using 1y to be safe
          
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Market Dashboard</h1>
          <p className="text-slate-600 mt-2">Real-time scanner and active signal monitoring.</p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white shadow-lg transition-all",
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
              Scan Market
            </>
          )}
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Symbols Scanned</p>
              <h3 className="text-2xl font-bold text-slate-900">{scannedCount} / {NIFTY_500_SYMBOLS.length}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Active Signals</p>
              <h3 className="text-2xl font-bold text-slate-900">{signals.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Top Strategy</p>
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
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No signals found</h3>
          <p className="text-slate-500 mt-1">Run a scan to find trading opportunities.</p>
        </div>
      )}
    </div>
  );
}

const SignalCard: React.FC<{ signal: Signal }> = ({ signal }) => {
  const risk = signal.price - signal.stopLoss;
  const reward = signal.target - signal.price;
  const rrRatio = reward / risk;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900">{signal.symbol}</h3>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">
              {signal.type}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{signal.strategyName}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">₹{signal.price.toFixed(2)}</div>
          <div className="text-xs text-slate-400">{new Date(signal.date).toLocaleDateString()}</div>
        </div>
      </div>
      
      <div className="p-5 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Stop Loss</p>
          <div className="flex items-center gap-1 text-red-600 font-medium">
            <ArrowDownRight className="w-4 h-4" />
            ₹{signal.stopLoss.toFixed(2)}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Target</p>
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <ArrowUpRight className="w-4 h-4" />
            ₹{signal.target.toFixed(2)}
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">R:R Ratio</p>
          <div className="font-medium text-slate-700">
            1:{rrRatio.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-sm text-slate-600 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        {signal.reason}
      </div>
    </div>
  );
};

function getTopStrategy(signals: Signal[]) {
  const counts: Record<string, number> = {};
  signals.forEach(s => counts[s.strategyName] = (counts[s.strategyName] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
