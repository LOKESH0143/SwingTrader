import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Requirements } from './pages/Requirements';
import { Dashboard } from './pages/Dashboard';
import { Strategies } from './pages/Strategies';
import { Backtest } from './pages/Backtest';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { Tournament } from './pages/Tournament';

import { StrategyBuilder } from './pages/StrategyBuilder';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Requirements />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="strategies" element={<Strategies />} />
        <Route path="builder" element={<StrategyBuilder />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="tournament" element={<Tournament />} />
        <Route path="settings" element={<Settings />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}
