import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, Loader2, TrendingUp, TrendingDown, AlertCircle, CandlestickChart, RotateCcw } from 'lucide-react';
import { PREBUILT_STRATEGIES, loadCustomStrategies } from '../lib/strategies';
import { NIFTY_500_SYMBOLS } from '../lib/nifty500';
import { fetchHistory } from '../services/api';
import { runBacktest } from '../lib/backtest';
import { Candle } from '../lib/types';
import { TradeChart, ChartTrade } from '../components/TradeChart';

export function Backtest() {
  const [searchParams] = useSearchParams();
  const allStrategies = [
    ...PREBUILT_STRATEGIES,
    ...loadCustomStrategies().filter((c) => !PREBUILT_STRATEGIES.some((p) => p.id === c.id)),
  ];
  const urlStrategy = searchParams.get('strategy');
  const initialStrategyId =
    urlStrategy && allStrategies.some((s) => s.id === urlStrategy)
      ? urlStrategy
      : allStrategies[0]?.id;

  const [selectedStrategyId, setSelectedStrategyId] = useState(
    initialStrategyId || PREBUILT_STRATEGIES[0].id
  );
  const [selectedSymbol, setSelectedSymbol] = useState(NIFTY_500_SYMBOLS[0]);
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | '2y' | '5y'>('2y');
  const [loading, setLoading] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [result, setResult] = useState<any>(null);
  const [focusedTrade, setFocusedTrade] = useState<ChartTrade | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlStrategy && allStrategies.some((s) => s.id === urlStrategy)) {
      setSelectedStrategyId(urlStrategy);
    }
  }, [urlStrategy]);

  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFocusedTrade(null);

    try {
      const data = await fetchHistory(selectedSymbol, timeRange);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`No historical candle data returned for ${selectedSymbol}`);
      }
      setCandles(data);

      const strategy = allStrategies.find((s) => s.id === selectedStrategyId);
      if (!strategy) throw new Error('Strategy not found');

      const backtestResult = runBacktest(strategy, data);
      setResult(backtestResult);
    } catch (err: any) {
      setError(err.message || 'Failed to run backtest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Controls Bar */}
      <div className="terminal-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Strategy
            </label>
            <select
              id="backtest-strategy-select"
              value={selectedStrategyId}
              onChange={(e) => setSelectedStrategyId(e.target.value)}
              className="terminal-input w-full px-3 py-2 text-sm"
            >
              {allStrategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Symbol (NSE)
            </label>
            <select
              id="backtest-symbol-select"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="terminal-input w-full px-3 py-2 text-sm font-mono"
            >
              {NIFTY_500_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Lookback Range
            </label>
            <select
              id="backtest-range-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="terminal-input w-full px-3 py-2 text-sm"
            >
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="2y">2 Years</option>
              <option value="5y">5 Years</option>
            </select>
          </div>

          <button
            id="run-backtest-btn"
            onClick={handleRunBacktest}
            disabled={loading}
            className="terminal-btn-primary flex items-center justify-center gap-2 px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-[38px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Backtest
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="p-4 rounded-lg border flex items-center gap-3 text-sm"
          style={{
            backgroundColor: 'var(--bear-soft)',
            borderColor: 'rgba(239, 68, 68, 0.35)',
            color: 'var(--bear)',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Net Profit"
              value={`${result.metrics.netProfit >= 0 ? '+' : ''}₹${result.metrics.netProfit.toFixed(2)}`}
              trend={result.metrics.netProfit >= 0 ? 'up' : 'down'}
            />
            <MetricCard
              label="Win Rate"
              value={`${result.metrics.winRate.toFixed(1)}%`}
              subtext={`${result.metrics.totalTrades} closed trades`}
            />
            <MetricCard
              label="Profit Factor"
              value={result.metrics.profitFactor.toFixed(2)}
              subtext={result.metrics.profitFactor >= 1.5 ? 'Strong edge' : 'Needs tuning'}
            />
            <MetricCard
              label="Max Drawdown"
              value={`${result.metrics.maxDrawdown.toFixed(2)}%`}
              trend="down"
            />
          </div>

          {/* Interactive TradingView Candlestick Chart */}
          {candles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CandlestickChart className="w-4 h-4 text-sky-500" />
                  <span>
                    {focusedTrade
                      ? `Trade Replay: ${selectedSymbol} (${focusedTrade.entryDate.split('T')[0]})`
                      : `Price Action & Trade Signals — ${selectedSymbol}`}
                  </span>
                </div>
                {focusedTrade && (
                  <button
                    onClick={() => setFocusedTrade(null)}
                    className="terminal-btn-secondary flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Show Full History
                  </button>
                )}
              </div>
              <TradeChart
                data={candles}
                symbol={selectedSymbol}
                trade={focusedTrade || undefined}
                trades={focusedTrade ? undefined : result.trades}
                height={430}
              />
            </div>
          )}

          {/* Trade Log Table */}
          <div className="terminal-card overflow-hidden">
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <h3 className="text-sm font-semibold">Trade Log</h3>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Click any trade row to inspect levels on chart
              </span>
            </div>

            {result.trades.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No trades triggered for {selectedSymbol} in the selected lookback window.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead
                    className="uppercase tracking-wider sticky top-0 border-b"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <tr>
                      <th className="px-4 py-3">Entry Date</th>
                      <th className="px-4 py-3">Exit Date</th>
                      <th className="px-4 py-3">Side</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">Target</th>
                      <th className="px-4 py-3 text-right">Stop</th>
                      <th className="px-4 py-3 text-right">Exit</th>
                      <th className="px-4 py-3 text-right">PnL</th>
                      <th className="px-4 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade: any, i: number) => {
                      const isSelected = focusedTrade === trade;
                      const isWin = trade.pnl >= 0;
                      return (
                        <tr
                          key={i}
                          onClick={() => setFocusedTrade(trade)}
                          className="border-b transition-colors cursor-pointer"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            backgroundColor: isSelected ? 'var(--accent-soft)' : undefined,
                          }}
                        >
                          <td className="px-4 py-2.5 font-mono">{trade.entryDate.split('T')[0]}</td>
                          <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                            {trade.exitDate ? trade.exitDate.split('T')[0] : 'OPEN'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                              style={{
                                backgroundColor: 'var(--accent-soft)',
                                color: 'var(--accent)',
                              }}
                            >
                              {trade.type || 'LONG'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right">₹{trade.entryPrice.toFixed(2)}</td>
                          <td className="px-4 py-2.5 font-mono text-right text-emerald-500">
                            ₹{trade.target?.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right text-red-500">
                            ₹{trade.stopLoss?.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-right">
                            ₹{trade.exitPrice?.toFixed(2)}
                          </td>
                          <td
                            className={`px-4 py-2.5 font-mono font-semibold text-right ${
                              isWin ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {isWin ? '+' : ''}₹{trade.pnl.toFixed(2)} ({isWin ? '+' : ''}
                            {trade.pnlPercent.toFixed(2)}%)
                          </td>
                          <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                            {trade.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  trend,
}: {
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="terminal-card p-4">
      <p
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <div className="flex items-end justify-between mt-2">
        <h3
          className={`text-2xl font-bold font-mono tracking-tight ${
            trend === 'up'
              ? 'text-emerald-500'
              : trend === 'down'
              ? 'text-red-500'
              : ''
          }`}
        >
          {value}
        </h3>
        {trend && (
          <div className={trend === 'up' ? 'text-emerald-500' : 'text-red-500'}>
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
        )}
      </div>
      {subtext && (
        <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
          {subtext}
        </p>
      )}
    </div>
  );
}
