import React, { useState } from 'react';
import { Play, Code2, Save, Plus } from 'lucide-react';
import { PREBUILT_STRATEGIES } from '../lib/strategies';
import { Strategy } from '../lib/types';
import { cn } from '../lib/utils';

export function Strategies() {
  const [strategies, setStrategies] = useState<Strategy[]>(PREBUILT_STRATEGIES);
  const [selectedId, setSelectedId] = useState<string>(PREBUILT_STRATEGIES[0].id);

  const selectedStrategy = strategies.find(s => s.id === selectedId);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Strategy List Sidebar */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">My Strategies</h2>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {strategies.map(strategy => (
            <button
              key={strategy.id}
              onClick={() => setSelectedId(strategy.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                selectedId === strategy.id
                  ? "border-indigo-500 bg-indigo-50 shadow-sm"
                  : "border-transparent hover:bg-slate-50 hover:border-slate-200"
              )}
            >
              <div className="font-medium text-slate-900">{strategy.name}</div>
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{strategy.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {selectedStrategy ? (
          <>
            <div className="p-6 border-b border-slate-200 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{selectedStrategy.name}</h1>
                  <p className="text-slate-600 mt-1">{selectedStrategy.description}</p>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors">
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                    <Play className="w-4 h-4" />
                    Run Backtest
                  </button>
                </div>
              </div>
              
              {/* Parameters */}
              <div className="mt-6 flex gap-4">
                {Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-semibold">{key}</span>
                    <div className="font-mono text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-slate-900 p-6 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-2 text-slate-400 mb-4 text-sm">
                  <Code2 className="w-4 h-4" />
                  <span>Strategy Logic (JavaScript)</span>
                </div>
                <textarea
                  value={selectedStrategy.code}
                  readOnly
                  className="w-full h-[500px] bg-slate-950 text-slate-300 font-mono text-sm p-6 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Select a strategy to view details
          </div>
        )}
      </div>
    </div>
  );
}
