import React, { useState } from 'react';
import { Sparkles, Code, Play, Save, Loader2, CheckCircle } from 'lucide-react';
import { generateStrategyFromPrompt } from '../services/strategyGenerator';
import { Strategy } from '../lib/types';
import { saveCustomStrategy } from '../lib/strategies';
import { useNavigate } from 'react-router-dom';

export function StrategyBuilder() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState<Strategy | null>(null);
  const [saved, setSaved] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setGenerating(true);
    setGeneratedStrategy(null);
    setSaved(false);

    try {
      const strategy = await generateStrategyFromPrompt(prompt);
      setGeneratedStrategy(strategy);
    } catch (error) {
      console.error(error);
      alert("Failed to generate strategy. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (generatedStrategy) {
      saveCustomStrategy(generatedStrategy);
      setSaved(true);
      setTimeout(() => {
        navigate('/tournament');
      }, 1500);
    }
  };

  return (
    <div className="p-6 max-w-[98%] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-600" />
          AI Strategy Architect
        </h1>
        <p className="text-slate-600 mt-2 text-lg">
          Describe your trading idea in plain English, and I'll write the code for you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Describe your strategy
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Buy when RSI crosses above 30 and price is above the 200 SMA. Sell when RSI goes above 70."
              className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-slate-900 placeholder-slate-400"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Architecting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Strategy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
            <h3 className="font-semibold text-indigo-900 mb-2">Pro Tips:</h3>
            <ul className="space-y-2 text-sm text-indigo-800 list-disc list-inside">
              <li>Mention specific indicators (RSI, MACD, Bollinger Bands).</li>
              <li>Define your entry AND exit conditions.</li>
              <li>Specify risk management (e.g., "Use a 2% stop loss").</li>
              <li>Ask for filters (e.g., "Only trade if volume is high").</li>
            </ul>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-6">
          {generatedStrategy ? (
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-800 flex flex-col h-full max-h-[600px]">
              <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-white">{generatedStrategy.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{generatedStrategy.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saved}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      saved 
                        ? "bg-green-500/20 text-green-400" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}
                  >
                    {saved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save & Use
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                <pre className="text-blue-300">
                  <code>{generatedStrategy.code}</code>
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
              <Code className="w-12 h-12 mb-4 opacity-50" />
              <p>Generated code will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
