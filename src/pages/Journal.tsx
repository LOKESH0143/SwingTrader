import React, { useState, useEffect } from 'react';
import { journalService } from '../services/journal';
import { JournalTrade } from '../lib/types';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Clock, Save, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function Journal() {
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTrade, setEditingTrade] = useState<JournalTrade | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      const data = await journalService.getTrades();
      setTrades(data);
    } catch (e) {
      console.error("Failed to load trades", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingTrade) return;

    try {
      if (isNew) {
        await journalService.addTrade(editingTrade);
      } else {
        await journalService.updateTrade(editingTrade);
      }
      setEditingTrade(null);
      loadTrades();
    } catch (e) {
      alert("Failed to save trade");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this trade?")) {
      // Optimistic update: Remove from UI immediately
      const previousTrades = [...trades];
      setTrades(trades.filter(t => t.id !== id));

      try {
        await journalService.deleteTrade(id);
        // Success - no need to reload, state is already correct
        // But we can reload in background just to be safe
        loadTrades(); 
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete trade. Please check console for details.");
        // Revert UI on failure
        setTrades(previousTrades);
      }
    }
  };

  const startNewTrade = () => {
    setEditingTrade({
      id: '',
      symbol: '',
      strategyName: 'Manual',
      entryDate: new Date().toISOString().split('T')[0],
      entryPrice: 0,
      stopLoss: 0,
      target: 0,
      status: 'OPEN',
      direction: 'LONG',
      quantity: 1
    });
    setIsNew(true);
  };

  const calculatePnL = (trade: JournalTrade) => {
    if (trade.status === 'CLOSED' && trade.exitPrice && trade.entryPrice) {
      const diff = trade.exitPrice - trade.entryPrice;
      const pnl = trade.direction === 'LONG' ? diff : -diff;
      return (pnl / trade.entryPrice) * 100;
    }
    return null;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trade Journal</h1>
          <p className="text-slate-600 mt-1">Track and manage your active positions.</p>
        </div>
        <div className="flex gap-3">
          {trades.length > 0 && (
            <button 
              onClick={async () => {
                if (confirm("WARNING: This will delete ALL trades from your journal. This cannot be undone.")) {
                  await journalService.clearAll();
                  loadTrades();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}
          <button 
            onClick={startNewTrade}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Trade
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium uppercase">Open Trades</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {trades.filter(t => t.status === 'OPEN').length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium uppercase">Win Rate</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {(() => {
              const closed = trades.filter(t => t.status === 'CLOSED');
              if (closed.length === 0) return '0%';
              const wins = closed.filter(t => calculatePnL(t)! > 0).length;
              return `${((wins / closed.length) * 100).toFixed(1)}%`;
            })()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium uppercase">Avg Return</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {(() => {
              const closed = trades.filter(t => t.status === 'CLOSED');
              if (closed.length === 0) return '0%';
              const totalPnL = closed.reduce((acc, t) => acc + (calculatePnL(t) || 0), 0);
              const avg = totalPnL / closed.length;
              return (avg > 0 ? '+' : '') + avg.toFixed(2) + '%';
            })()}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-medium uppercase">Total Trades</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{trades.length}</div>
        </div>
      </div>

      {/* Trade List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">Status</th>
              <th className="p-4">Symbol</th>
              <th className="p-4">Entry Date</th>
              <th className="p-4 text-right">Entry Price</th>
              <th className="p-4 text-right">Target / Stop</th>
              <th className="p-4 text-right">Exit Price</th>
              <th className="p-4 text-right">PnL %</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trades.map((trade) => {
              const pnl = calculatePnL(trade);
              return (
                <tr key={trade.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit",
                      trade.status === 'OPEN' ? "bg-blue-100 text-blue-700" :
                      trade.status === 'CLOSED' ? "bg-slate-100 text-slate-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {trade.status === 'OPEN' && <Clock className="w-3 h-3" />}
                      {trade.status === 'CLOSED' && (pnl && pnl > 0 ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />)}
                      {trade.status}
                    </span>
                  </td>
                  <td className="p-4 font-medium">
                    <div>{trade.symbol}</div>
                    <div className="text-xs text-slate-500">{trade.strategyName}</div>
                  </td>
                  <td className="p-4 text-slate-600">{trade.entryDate}</td>
                  <td className="p-4 text-right font-mono">{trade.entryPrice.toFixed(2)}</td>
                  <td className="p-4 text-right font-mono text-xs">
                    <div className="text-green-600">T: {trade.target.toFixed(2)}</div>
                    <div className="text-red-600">S: {trade.stopLoss.toFixed(2)}</div>
                  </td>
                  <td className="p-4 text-right font-mono">
                    {trade.exitPrice ? trade.exitPrice.toFixed(2) : '-'}
                  </td>
                  <td className={cn("p-4 text-right font-bold font-mono", pnl && pnl > 0 ? "text-green-600" : pnl && pnl < 0 ? "text-red-600" : "text-slate-400")}>
                    {pnl ? (pnl > 0 ? '+' : '') + pnl.toFixed(2) + '%' : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditingTrade(trade); setIsNew(false); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(trade.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {trades.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-500">
                  No trades recorded yet. Start by adding one or scanning the dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {isNew ? 'New Trade' : 'Edit Trade'}
              </h3>
              <button onClick={() => setEditingTrade(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Symbol</label>
                  <input 
                    type="text" 
                    value={editingTrade.symbol}
                    onChange={e => setEditingTrade({...editingTrade, symbol: e.target.value.toUpperCase()})}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select 
                    value={editingTrade.status}
                    onChange={e => setEditingTrade({...editingTrade, status: e.target.value as any})}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Entry Date</label>
                  <input 
                    type="date" 
                    value={editingTrade.entryDate}
                    onChange={e => setEditingTrade({...editingTrade, entryDate: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Strategy</label>
                  <input 
                    type="text" 
                    value={editingTrade.strategyName}
                    onChange={e => setEditingTrade({...editingTrade, strategyName: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Entry Price</label>
                  <input 
                    type="number" 
                    value={editingTrade.entryPrice}
                    onChange={e => setEditingTrade({...editingTrade, entryPrice: parseFloat(e.target.value)})}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stop Loss</label>
                  <input 
                    type="number" 
                    value={editingTrade.stopLoss}
                    onChange={e => setEditingTrade({...editingTrade, stopLoss: parseFloat(e.target.value)})}
                    className="w-full p-2 border border-slate-300 rounded-lg text-red-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
                  <input 
                    type="number" 
                    value={editingTrade.target}
                    onChange={e => setEditingTrade({...editingTrade, target: parseFloat(e.target.value)})}
                    className="w-full p-2 border border-slate-300 rounded-lg text-green-600"
                  />
                </div>
              </div>

              {editingTrade.status === 'CLOSED' && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Exit Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Exit Date</label>
                      <input 
                        type="date" 
                        value={editingTrade.exitDate || ''}
                        onChange={e => setEditingTrade({...editingTrade, exitDate: e.target.value})}
                        className="w-full p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Exit Price</label>
                      <input 
                        type="number" 
                        value={editingTrade.exitPrice || ''}
                        onChange={e => setEditingTrade({...editingTrade, exitPrice: parseFloat(e.target.value)})}
                        className="w-full p-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea 
                  value={editingTrade.notes || ''}
                  onChange={e => setEditingTrade({...editingTrade, notes: e.target.value})}
                  className="w-full p-2 border border-slate-300 rounded-lg h-24"
                  placeholder="Why did you take this trade?"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setEditingTrade(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
