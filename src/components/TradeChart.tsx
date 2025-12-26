import React from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Bar,
  Cell
} from 'recharts';
import { Candle } from '../lib/types';

interface TradeChartProps {
  data: Candle[];
  trade: {
    entryDate: string;
    entryPrice: number;
    exitDate?: string;
    exitPrice?: number;
    stopLoss: number;
    target: number;
    type: 'LONG' | 'SHORT';
  };
}

const Candlestick = (props: any) => {
  const { x, y, width, height, low, high, open, close } = props;
  const isGreen = close > open;
  const color = isGreen ? '#22c55e' : '#ef4444';
  const ratio = Math.abs(height / (high - low)); // Pixels per unit of price (approx)
  
  // We need the Y-axis scale to render correctly. 
  // Recharts passes `y` as the top of the bar (which is usually `high` or `val`).
  // But for a custom shape, we rely on the `yAxis` scale which isn't easily accessible here.
  // 
  // ALTERNATIVE: Use ErrorBar for High-Low and Bar for Open-Close.
  return <path />;
};

// Simplified approach: Line Chart with Dots for Entry/Exit
// It's robust and clear.
import { LineChart, Line } from 'recharts';

export const TradeChart: React.FC<TradeChartProps> = ({ data, trade }) => {
  const entryTime = new Date(trade.entryDate).getTime();
  const exitTime = trade.exitDate ? new Date(trade.exitDate).getTime() : new Date().getTime();
  
  const entryIndex = data.findIndex(c => new Date(c.date).getTime() === entryTime);
  
  let displayData = data;
  if (entryIndex !== -1) {
    const start = Math.max(0, entryIndex - 30);
    const end = trade.exitDate 
      ? data.findIndex(c => new Date(c.date).getTime() === exitTime) + 10 
      : data.length;
    displayData = data.slice(start, Math.min(data.length, end > 0 ? end : data.length));
  }

  const chartData = displayData.map(c => ({
    ...c,
    dateStr: new Date(c.date).toLocaleDateString(),
  }));

  const minPrice = Math.min(...displayData.map(c => c.low));
  const maxPrice = Math.max(...displayData.map(c => c.high));
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-lg border border-slate-200">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="dateStr" 
            tick={{ fontSize: 12 }} 
            minTickGap={30}
          />
          <YAxis 
            domain={[minPrice - padding, maxPrice + padding]} 
            tick={{ fontSize: 12 }}
            tickFormatter={(val) => val.toFixed(0)}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ fontWeight: 'bold', color: '#64748b' }}
          />
          
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#6366f1" 
            strokeWidth={2} 
            dot={false} 
            activeDot={{ r: 6 }}
          />

          <ReferenceLine y={trade.entryPrice} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'ENTRY', fill: '#22c55e', fontSize: 12, position: 'insideLeft' }} />
          <ReferenceLine y={trade.stopLoss} stroke="#ef4444" label={{ value: 'STOP', fill: '#ef4444', fontSize: 12, position: 'insideLeft' }} />
          <ReferenceLine y={trade.target} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'TARGET', fill: '#3b82f6', fontSize: 12, position: 'insideLeft' }} />
          
          <ReferenceLine x={new Date(trade.entryDate).toLocaleDateString()} stroke="#22c55e" strokeDasharray="3 3" />
          {trade.exitDate && (
            <ReferenceLine x={new Date(trade.exitDate).toLocaleDateString()} stroke="#64748b" strokeDasharray="3 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
