import React, { useState } from 'react';
import { CheckCircle2, Circle, MessageSquare, ArrowRight, ShieldAlert, Target, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface Requirement {
  id: string;
  category: 'Core' | 'Strategy' | 'Data' | 'Risk';
  title: string;
  description: string;
  status: 'proposed' | 'accepted' | 'discussion';
  notes?: string;
}

const INITIAL_REQUIREMENTS: Requirement[] = [
  {
    id: '1',
    category: 'Core',
    title: 'Strategy Management (Code-Based)',
    description: 'Define strategies using JavaScript/TypeScript snippets for maximum flexibility.',
    status: 'accepted',
    notes: 'Selected Option B. Will include pre-built famous strategies.'
  },
  {
    id: '2',
    category: 'Core',
    title: 'Signal Generation',
    description: 'System must output Entry Point, Target (Take Profit), and Stop Loss for each signal.',
    status: 'accepted',
  },
  {
    id: '3',
    category: 'Core',
    title: 'Strategy Attribution',
    description: 'Identify exactly which strategy generated a specific buy/sell signal.',
    status: 'accepted',
  },
  {
    id: '4',
    category: 'Strategy',
    title: 'Backtesting Engine',
    description: 'Run strategies against historical data to calculate win rate, drawdown, and ROI.',
    status: 'accepted',
    notes: 'Focus on Daily/4H timeframe for Swing Trading.'
  },
  {
    id: '5',
    category: 'Data',
    title: 'Market Data Feed (Nifty 500)',
    description: 'Ingest data for Indian Markets (NSE). Preferred source: Yahoo Finance (Free).',
    status: 'accepted',
    notes: 'Symbols will use .NS suffix (e.g., RELIANCE.NS).'
  },
  {
    id: '6',
    category: 'Risk',
    title: 'Position Sizing',
    description: 'Calculate recommended position size based on account risk % and stop loss distance.',
    status: 'proposed',
  }
];

export function Requirements() {
  const [requirements, setRequirements] = useState(INITIAL_REQUIREMENTS);

  const toggleStatus = (id: string) => {
    setRequirements(prev => prev.map(req => {
      if (req.id !== id) return req;
      const nextStatus = req.status === 'proposed' ? 'accepted' : req.status === 'accepted' ? 'discussion' : 'proposed';
      return { ...req, status: nextStatus };
    }));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">System Requirements & Capabilities</h1>
        <p className="text-slate-600 text-lg">
          Let's define the scope of the SwingTrade Architect. Review and adjust the capabilities below.
        </p>
      </div>

      <div className="grid gap-6">
        {requirements.map((req) => (
          <div 
            key={req.id} 
            className={cn(
              "bg-white rounded-xl p-6 border shadow-sm transition-all hover:shadow-md",
              req.status === 'accepted' ? "border-green-200 bg-green-50/30" : 
              req.status === 'discussion' ? "border-amber-200 bg-amber-50/30" : "border-slate-200"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className={cn(
                  "mt-1 p-2 rounded-lg",
                  req.category === 'Core' ? "bg-blue-100 text-blue-600" :
                  req.category === 'Strategy' ? "bg-purple-100 text-purple-600" :
                  req.category === 'Data' ? "bg-emerald-100 text-emerald-600" :
                  "bg-rose-100 text-rose-600"
                )}>
                  {req.category === 'Core' && <Zap className="w-5 h-5" />}
                  {req.category === 'Strategy' && <Target className="w-5 h-5" />}
                  {req.category === 'Data' && <DatabaseIcon className="w-5 h-5" />}
                  {req.category === 'Risk' && <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{req.title}</h3>
                  <p className="text-slate-600 mt-1">{req.description}</p>
                  {req.notes && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-100 w-fit">
                      <MessageSquare className="w-4 h-4" />
                      {req.notes}
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => toggleStatus(req.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  req.status === 'accepted' ? "bg-green-100 text-green-700 hover:bg-green-200" :
                  req.status === 'discussion' ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                  "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {req.status === 'accepted' ? <CheckCircle2 className="w-4 h-4" /> : 
                 req.status === 'discussion' ? <MessageSquare className="w-4 h-4" /> : 
                 <Circle className="w-4 h-4" />}
                <span className="capitalize">{req.status}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-indigo-900">Ready to proceed?</h3>
          <p className="text-indigo-700">Once we align on these requirements, we can start building the strategy engine.</p>
        </div>
        <button className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2">
          Start Building <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}
