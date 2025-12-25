import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, LineChart, Settings, ListTodo, History, BrainCircuit, Book, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <LineChart className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">SwingTrade</h1>
          </div>
          <p className="text-xs text-slate-400 mt-2 ml-1">Architect Edition</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/" icon={<ListTodo />} label="Requirements" />
          <NavItem to="/dashboard" icon={<LayoutDashboard />} label="Dashboard" />
          <NavItem to="/strategies" icon={<BrainCircuit />} label="Strategies" />
          <NavItem to="/backtest" icon={<History />} label="Backtest" />
          <NavItem to="/tournament" icon={<Trophy />} label="Tournament" />
          <NavItem to="/settings" icon={<Settings />} label="Settings" />
          <NavItem to="/about" icon={<Book />} label="Documentation" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">
              US
            </div>
            <div>
              <p className="text-sm font-medium">User</p>
              <p className="text-xs text-slate-400">Pro Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
          isActive
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        )
      }
    >
      {React.cloneElement(icon as React.ReactElement, {
        className: "w-5 h-5 transition-colors"
      })}
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}
