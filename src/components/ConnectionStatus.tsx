import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('Waiting for traffic...');

  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setStatus(customEvent.detail.status);
      setMessage(customEvent.detail.message);
    };

    window.addEventListener('api-status-change', handleStatusChange);
    return () => window.removeEventListener('api-status-change', handleStatusChange);
  }, []);

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
      status === 'connected' ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400" : 
      status === 'error' ? "bg-red-950/30 border-red-500/20 text-red-400" : 
      "bg-slate-800 border-slate-700 text-slate-400"
    )}>
      <div className="relative">
        {status === 'connected' && <Wifi size={14} />}
        {status === 'error' && <WifiOff size={14} />}
        {status === 'idle' && <Activity size={14} />}
        {status === 'connected' && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        )}
      </div>
      
      <div className="flex flex-col leading-none gap-0.5">
        <span className="font-semibold">
          {status === 'connected' ? 'yFinance API' : 
           status === 'error' ? 'Connection Failed' : 'API Idle'}
        </span>
        <span className="text-[10px] opacity-75 truncate max-w-[120px]">
          {status === 'connected' ? 'Operational' : message}
        </span>
      </div>
    </div>
  );
}
