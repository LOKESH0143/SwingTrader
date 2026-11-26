import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<'connected' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('Standby');

  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setStatus(customEvent.detail.status);
      setMessage(customEvent.detail.message);
    };

    window.addEventListener('api-status-change', handleStatusChange);
    return () => window.removeEventListener('api-status-change', handleStatusChange);
  }, []);

  const dotColor =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'error'
      ? 'bg-red-500'
      : 'bg-slate-400';

  const statusText =
    status === 'connected'
      ? 'Feed Online'
      : status === 'error'
      ? 'Feed Error'
      : 'Feed Idle';

  if (compact) {
    return (
      <div
        title={`${statusText}: ${message}`}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <span className={cn('w-2 h-2 rounded-full', dotColor)} />
        <span className="hidden sm:inline">{statusText}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
    >
      <div className="relative flex items-center justify-center">
        {status === 'connected' && <Wifi size={14} className="text-emerald-500" />}
        {status === 'error' && <WifiOff size={14} className="text-red-500" />}
        {status === 'idle' && <Activity size={14} className="text-slate-400" />}
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full',
            dotColor
          )}
        />
      </div>

      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {statusText}
        </span>
        <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
          {status === 'connected' ? 'NSE Data Ready' : message}
        </span>
      </div>
    </div>
  );
}
