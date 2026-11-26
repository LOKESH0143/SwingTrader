import React, { useState, useEffect } from 'react';
import { Play, Code2, Save, Plus, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PREBUILT_STRATEGIES, loadCustomStrategies, saveCustomStrategy } from '../lib/strategies';
import { Strategy } from '../lib/types';
import { cn } from '../lib/utils';

export function Strategies() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const custom = loadCustomStrategies();
    const all = [...PREBUILT_STRATEGIES, ...custom];
    setStrategies(all);
    if (all.length > 0) {
      setSelectedId(all[0].id);
      setCode(all[0].code);
    }
  }, []);

  const handleSelectStrategy = (id: string) => {
    setSelectedId(id);
    const target = strategies.find(s => s.id === id);
    if (target) {
      setCode(target.code);
      setSaveStatus('idle');
      setErrorMessage(null);
    }
  };

  const selectedStrategy = strategies.find(s => s.id === selectedId);

  const handleSave = () => {
    if (!selectedStrategy) return;

    // Validate JavaScript syntax
    try {
      new Function('data', 'params', 'indicators', code);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(`Syntax Error: ${err.message}`);
      return;
    }

    const updatedStrategy: Strategy = {
      ...selectedStrategy,
      id: selectedStrategy.id.startsWith('custom-') ? selectedStrategy.id : `custom-${Date.now()}`,
      name: selectedStrategy.id.startsWith('custom-') ? selectedStrategy.name : `${selectedStrategy.name} (Custom)`,
      code: code
    };

    saveCustomStrategy(updatedStrategy);

    // Refresh list
    const custom = loadCustomStrategies();
    const all = [...PREBUILT_STRATEGIES, ...custom.filter(c => !PREBUILT_STRATEGIES.some(p => p.id === c.id))];
    setStrategies(all);
    setSelectedId(updatedStrategy.id);

    setSaveStatus('saved');
    setErrorMessage(null);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleRunBacktest = () => {
    if (!selectedId) return;
    navigate(`/backtest?strategy=${selectedId}`);
  };

  const handleNewStrategy = () => {
    navigate('/strategy-builder');
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Strategy List Sidebar */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-slate-800">Strategies</h2>
            <p className="text-xs text-slate-500">{strategies.length} strategies available</p>
          </div>
          <button 
            onClick={handleNewStrategy}
            title="Create new strategy with AI"
            className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>New</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {strategies.map(strategy => (
            <button
              key={strategy.id}
              onClick={() => handleSelectStrategy(strategy.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                selectedId === strategy.id
                  ? "border-indigo-500 bg-indigo-50 shadow-sm"
                  : "border-transparent hover:bg-slate-50 hover:border-slate-200"
              )}
            >
              <div className="flex justify-between items-center">
                <div className="font-medium text-slate-900 text-sm">{strategy.name}</div>
                {strategy.id.startsWith('custom-') && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-1.5 py-0.5 rounded">Custom</span>
                )}
              </div>
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
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">{selectedStrategy.name}</h1>
                    {selectedStrategy.category && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                        {selectedStrategy.category}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mt-1">{selectedStrategy.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle className="w-4 h-4" /> Saved!
                    </span>
                  )}
                  {saveStatus === 'error' && errorMessage && (
                    <span className="flex items-center gap-1 text-xs text-rose-600 font-medium max-w-xs truncate" title={errorMessage}>
                      <AlertCircle className="w-4 h-4" /> {errorMessage}
                    </span>
                  )}
                  <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button 
                    onClick={handleRunBacktest}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    <Play className="w-4 h-4" />
                    Run Backtest
                  </button>
                </div>
              </div>
              
              {/* Parameters */}
              <div className="mt-6 flex flex-wrap gap-4">
                {selectedStrategy.parameters && Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                  <div key={key} className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-semibold">{key}</span>
                    <div className="font-mono text-slate-900 text-sm">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-slate-900 p-6 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center text-slate-400 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4" />
                    <span>Strategy Logic (JavaScript)</span>
                  </div>
                  <span className="text-xs text-slate-500">Edit logic and click "Save Changes" to create or update your custom version</span>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-[520px] bg-slate-950 text-slate-200 font-mono text-sm p-6 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none font-medium"
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
