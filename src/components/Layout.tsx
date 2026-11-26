import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Radar,
  CandlestickChart,
  Settings,
  History,
  BrainCircuit,
  Book,
  Trophy,
  Sparkles,
  BookOpen,
  BarChart3,
  Wifi,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Terminal,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ConnectionStatus } from './ConnectionStatus';
import { useTheme } from '../context/ThemeContext';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Market Scanner', subtitle: 'Live NSE universe setup scan' },
  '/journal': { title: 'Trade Journal', subtitle: 'Execution log & PnL tracking' },
  '/tournament': { title: 'Strategy Tournament', subtitle: 'Multi-strategy NSE leaderboard' },
  '/backtest': { title: 'Single Backtest', subtitle: 'Interactive candlestick trade replay' },
  '/simulator': { title: 'Portfolio Simulator', subtitle: 'Shared-capital risk & regime engine' },
  '/strategies': { title: 'Strategy Editor', subtitle: 'Inspect & customize JS strategy logic' },
  '/builder': { title: 'AI Architect', subtitle: 'Generate strategies from plain English' },
  '/connection': { title: 'Data Diagnostics', subtitle: 'Verify broker & market feed latency' },
  '/settings': { title: 'Settings', subtitle: 'Broker credentials & local cache' },
  '/about': { title: 'Documentation', subtitle: 'Architecture & strategy guide' },
};

const NAV_GROUPS = [
  {
    label: 'Trading Desk',
    items: [
      { to: '/dashboard', icon: Radar, label: 'Scanner' },
      { to: '/journal', icon: BookOpen, label: 'Journal' },
    ],
  },
  {
    label: 'Research Lab',
    items: [
      { to: '/tournament', icon: Trophy, label: 'Tournament' },
      { to: '/backtest', icon: History, label: 'Backtest' },
      { to: '/simulator', icon: BarChart3, label: 'Portfolio Sim' },
      { to: '/strategies', icon: BrainCircuit, label: 'Strategies' },
      { to: '/builder', icon: Sparkles, label: 'AI Architect' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/connection', icon: Wifi, label: 'Diagnostics' },
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/about', icon: Book, label: 'Docs' },
    ],
  },
];

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || {
    title: 'SwingTrade Architect',
    subtitle: 'NSE Quant Workspace',
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r transition-all duration-200 shrink-0',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'h-14 flex items-center border-b px-3.5',
            collapsed ? 'justify-center' : 'justify-between'
          )}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <CandlestickChart className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-bold tracking-tight truncate">
                  SwingTrade
                </div>
                <div
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Architect • NSE
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              className="p-1.5 rounded-md transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div
                  className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'text-white'
                            : 'hover:opacity-90'
                        )
                      }
                      style={({ isActive }) =>
                        isActive
                          ? {
                              backgroundColor: 'var(--accent)',
                              color: '#ffffff',
                            }
                          : {
                              color: 'var(--text-secondary)',
                            }
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Status */}
        <div
          className="p-3 border-t space-y-2.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {!collapsed ? (
            <>
              <ConnectionStatus />
              <div
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-mono"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-muted)',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  LOCAL BYOK
                </span>
                <span className="text-emerald-500 font-semibold">v2.0</span>
              </div>
            </>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
              }}
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Utility Header */}
        <header
          className="h-14 border-b px-6 flex items-center justify-between shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-semibold tracking-tight truncate">
              {pageInfo.title}
            </h2>
            <span
              className="hidden sm:inline text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              / {pageInfo.subtitle}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                NSE
              </span>
              <span>•</span>
              <span>EOD Swing</span>
            </div>

            <ConnectionStatus compact />

            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="terminal-main flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
