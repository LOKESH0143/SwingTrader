import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Strategies } from './pages/Strategies';
import { Backtest } from './pages/Backtest';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { Tournament } from './pages/Tournament';
import { Journal } from './pages/Journal';
import { PortfolioSimulator } from './pages/PortfolioSimulator';
import { ConnectionCheck } from './pages/ConnectionCheck';

import { StrategyBuilder } from './pages/StrategyBuilder';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/tournament" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="journal" element={<Journal />} />
        <Route path="strategies" element={<Strategies />} />
        <Route path="builder" element={<StrategyBuilder />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="tournament" element={<Tournament />} />
        <Route path="simulator" element={<PortfolioSimulator />} />
        <Route path="connection" element={<ConnectionCheck />} />
        <Route path="settings" element={<Settings />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}
