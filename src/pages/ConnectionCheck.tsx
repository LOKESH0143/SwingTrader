import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchHistory } from '../services/api';

export function ConnectionCheck() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [latency, setLatency] = useState<number | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  const runCheck = async () => {
    setStatus('checking');
    setLatency(null);
    setDetails(null);
    
    const start = performance.now();
    try {
      // Fetch just 5 days of data for a highly liquid stock (Reliance)
      // We use '1y' range but the server cache logic might return it instantly if cached.
      const data = await fetchHistory('RELIANCE.NS', '6m', true, true);
      
      const end = performance.now();
      setLatency(Math.round(end - start));

      // Handle metadata response
      let candles = data;
      let source = 'Unknown';
      if (!Array.isArray(data) && (data as any).data) {
        candles = (data as any).data;
        source = (data as any).source;
      }

      if (candles && candles.length > 0) {
        setStatus('success');
        setDetails(`Source: ${source} | Fetched ${candles.length} candles. Last: ${candles[candles.length-1].date}`);
      } else {
        setStatus('error');
        setDetails('API returned empty data array.');
      }
    } catch (e: any) {
      const end = performance.now();
      setLatency(Math.round(end - start));
      setStatus('error');
      
      // Try to parse detailed error from response if available
      // The fetchHistory function throws an error, but we need to see if we can extract details
      // Actually, fetchHistory in api.ts catches the error and returns [] or throws.
      // We need to update api.ts to throw the actual error object with details.
      
      setDetails(e.message || 'Unknown network error');
    }
  };

  return (
    <div className="p-6 max-w-[98%] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Connection Diagnostics</h1>
        <p className="text-slate-600 mt-2">Test your connectivity to the Yahoo Finance API via the backend server.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              status === 'idle' ? "bg-slate-100 text-slate-500" :
              status === 'checking' ? "bg-blue-100 text-blue-600" :
              status === 'success' ? "bg-emerald-100 text-emerald-600" :
              "bg-red-100 text-red-600"
            )}>
              {status === 'idle' && <Wifi size={24} />}
              {status === 'checking' && <RefreshCw size={24} className="animate-spin" />}
              {status === 'success' && <CheckCircle2 size={24} />}
              {status === 'error' && <XCircle size={24} />}
            </div>
            <div>
              <h3 className="font-semibold text-lg">API Health Check</h3>
              <p className="text-sm text-slate-500">Target: RELIANCE.NS (NSE)</p>
            </div>
          </div>
          
          <button
            onClick={runCheck}
            disabled={status === 'checking'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {status === 'checking' ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Run Test
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock size={18} />
              <span className="font-medium">Latency</span>
            </div>
            <span className={cn(
              "font-mono font-bold",
              !latency ? "text-slate-400" :
              latency < 1000 ? "text-emerald-600" :
              latency < 3000 ? "text-amber-600" : "text-red-600"
            )}>
              {latency ? `${latency}ms` : '---'}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 min-h-[100px]">
             <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Diagnostic Log</h4>
             {details ? (
               <p className={cn(
                 "text-sm font-mono",
                 status === 'error' ? "text-red-600" : "text-slate-700"
               )}>
                 {status === 'success' ? '✓ ' : status === 'error' ? '✗ ' : ''}
                 {details}
               </p>
             ) : (
               <p className="text-sm text-slate-400 italic">Run a test to see details...</p>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
