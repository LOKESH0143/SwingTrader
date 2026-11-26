import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type Time,
  type SeriesMarker,
} from 'lightweight-charts';
import { Candle } from '../lib/types';
import { useTheme } from '../context/ThemeContext';

export interface ChartTrade {
  entryDate: string;
  entryPrice: number;
  exitDate?: string;
  exitPrice?: number;
  stopLoss: number;
  target: number;
  type: 'LONG' | 'SHORT';
  pnlPercent?: number;
}

interface TradeChartProps {
  data: Candle[];
  symbol?: string;
  trade?: ChartTrade;
  trades?: ChartTrade[];
  height?: number;
}

interface LegendData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toChartTime(dateStr: string): Time {
  // Ensure strict YYYY-MM-DD string for TradingView BusinessDay time
  return dateStr.split('T')[0] as Time;
}

export const TradeChart: React.FC<TradeChartProps> = ({
  data,
  symbol,
  trade,
  trades,
  height = 420,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();
  const [legend, setLegend] = useState<LegendData | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.length === 0) return;

    // Deduplicate and sort candles ascending by date (required by lightweight-charts)
    const uniqueMap = new Map<string, Candle>();
    for (const c of data) {
      if (!c.date || isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close)) continue;
      uniqueMap.set(c.date.split('T')[0], { ...c, date: c.date.split('T')[0] });
    }
    const sortedData = Array.from(uniqueMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    if (sortedData.length === 0) return;

    // Slice focused window when inspecting a single trade (keeps context crisp)
    let displayData = sortedData;
    if (trade) {
      const entryDateKey = trade.entryDate.split('T')[0];
      const exitDateKey = trade.exitDate ? trade.exitDate.split('T')[0] : null;
      const entryIdx = sortedData.findIndex((c) => c.date >= entryDateKey);
      if (entryIdx !== -1) {
        const start = Math.max(0, entryIdx - 40);
        const exitIdx = exitDateKey
          ? sortedData.findIndex((c) => c.date >= exitDateKey)
          : sortedData.length - 1;
        const end = Math.min(
          sortedData.length,
          (exitIdx !== -1 ? exitIdx : sortedData.length - 1) + 20
        );
        displayData = sortedData.slice(start, end);
      }
    }

    const lastCandle = displayData[displayData.length - 1];
    setLegend({
      date: lastCandle.date,
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
      volume: lastCandle.volume || 0,
    });

    const isDark = theme === 'dark';

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#111621' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(148, 163, 184, 0.07)' : 'rgba(15, 23, 42, 0.06)' },
        horzLines: { color: isDark ? 'rgba(148, 163, 184, 0.07)' : 'rgba(15, 23, 42, 0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(15, 23, 42, 0.25)',
          labelBackgroundColor: isDark ? '#1e293b' : '#334155',
        },
        horzLine: {
          color: isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(15, 23, 42, 0.25)',
          labelBackgroundColor: isDark ? '#1e293b' : '#334155',
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e2e8f0',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#e2e8f0',
        timeVisible: false,
        rightOffset: 6,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const candleLookup = new Map<string, Candle>();
    candleSeries.setData(
      displayData.map((c) => {
        candleLookup.set(c.date, c);
        return {
          time: toChartTime(c.date),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        };
      })
    );

    // Volume Histogram Overlay
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeries.setData(
      displayData.map((c) => ({
        time: toChartTime(c.date),
        value: c.volume || 0,
        color:
          c.close >= c.open
            ? isDark
              ? 'rgba(16, 185, 129, 0.28)'
              : 'rgba(16, 185, 129, 0.35)'
            : isDark
            ? 'rgba(239, 68, 68, 0.28)'
            : 'rgba(239, 68, 68, 0.35)',
      }))
    );

    // Entry / Stop Loss / Target Horizontal Price Lines (Single Trade Inspector)
    if (trade) {
      candleSeries.createPriceLine({
        price: trade.entryPrice,
        color: '#0ea5e9',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'ENTRY',
      });

      if (trade.stopLoss > 0) {
        candleSeries.createPriceLine({
          price: trade.stopLoss,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'STOP',
        });
      }

      if (trade.target > 0) {
        candleSeries.createPriceLine({
          price: trade.target,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'TARGET',
        });
      }
    }

    // Trade Entry & Exit Markers (Single or Multi-Trade)
    const activeTrades: ChartTrade[] = trade ? [trade] : trades || [];
    const markers: SeriesMarker<Time>[] = [];
    for (const t of activeTrades) {
      const entryKey = t.entryDate.split('T')[0];
      if (candleLookup.has(entryKey)) {
        markers.push({
          time: toChartTime(entryKey),
          position: 'belowBar',
          color: '#0ea5e9',
          shape: 'arrowUp',
          text: `BUY ₹${t.entryPrice.toFixed(1)}`,
        });
      }
      if (t.exitDate) {
        const exitKey = t.exitDate.split('T')[0];
        if (candleLookup.has(exitKey)) {
          const isWin =
            t.pnlPercent !== undefined
              ? t.pnlPercent >= 0
              : (t.exitPrice || 0) >= t.entryPrice;
          markers.push({
            time: toChartTime(exitKey),
            position: 'aboveBar',
            color: isWin ? '#10b981' : '#ef4444',
            shape: 'arrowDown',
            text: `EXIT${t.exitPrice ? ` ₹${t.exitPrice.toFixed(1)}` : ''}`,
          });
        }
      }
    }

    markers.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    if (markers.length > 0) {
      createSeriesMarkers(candleSeries, markers);
    }

    // Live Crosshair OHLCV Readout
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setLegend({
          date: lastCandle.date,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
          volume: lastCandle.volume || 0,
        });
        return;
      }
      const key = String(param.time);
      const hovered = candleLookup.get(key);
      if (hovered) {
        setLegend({
          date: hovered.date,
          open: hovered.open,
          high: hovered.high,
          low: hovered.low,
          close: hovered.close,
          volume: hovered.volume || 0,
        });
      }
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) {
          chart.applyOptions({ width });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data, trade, trades, theme, height]);

  const isBull = legend ? legend.close >= legend.open : true;

  return (
    <div
      className="w-full rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* TradingView-style OHLCV Legend Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b text-xs font-mono"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          {symbol && (
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              {symbol}
            </span>
          )}
          {legend && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>{legend.date}</span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>O </span>
                <span className={isBull ? 'text-emerald-500' : 'text-red-500'}>
                  {legend.open.toFixed(2)}
                </span>
              </span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>H </span>
                <span className={isBull ? 'text-emerald-500' : 'text-red-500'}>
                  {legend.high.toFixed(2)}
                </span>
              </span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>L </span>
                <span className={isBull ? 'text-emerald-500' : 'text-red-500'}>
                  {legend.low.toFixed(2)}
                </span>
              </span>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>C </span>
                <span className={isBull ? 'text-emerald-500 font-semibold' : 'text-red-500 font-semibold'}>
                  {legend.close.toFixed(2)}
                </span>
              </span>
              <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
                Vol {(legend.volume / 1000).toFixed(1)}K
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" /> Entry
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Target
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Stop
          </span>
        </div>
      </div>

      {/* Lightweight Charts Canvas */}
      <div ref={containerRef} style={{ height: `${height}px` }} className="w-full" />
    </div>
  );
};
