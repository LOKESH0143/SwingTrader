import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Candle } from './types';

const dbPath = path.resolve('data/market_data.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS candles (
    symbol TEXT,
    date TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume REAL,
    PRIMARY KEY (symbol, date)
  );
  CREATE INDEX IF NOT EXISTS idx_symbol_date ON candles(symbol, date);
`);

export function getCachedCandles(symbol: string, days: number): Candle[] | null {
  // Check if we have recent data (e.g., from today/yesterday)
  const lastRow = db.prepare('SELECT date FROM candles WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol) as { date: string } | undefined;
  
  if (!lastRow) return null;

  // If data is older than 24 hours, consider it stale for a "live" scan (simplified logic)
  // For swing trading, we just need to ensure we have up to the last closed market day.
  const lastDate = new Date(lastRow.date);
  const now = new Date();
  const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  
  // If market is open or data is old, we might want to refresh. 
  // For now, let's use a simple cache policy: if we have data < 12 hours old, use it.
  if (diffHours > 24) return null;

  const rows = db.prepare(`
    SELECT date, open, high, low, close, volume 
    FROM candles 
    WHERE symbol = ? 
    ORDER BY date ASC
  `).all(symbol) as Candle[];

  return rows;
}

export function saveCandles(symbol: string, candles: Candle[]) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO candles (symbol, date, open, high, low, close, volume)
    VALUES (@symbol, @date, @open, @high, @low, @close, @volume)
  `);

  const insertMany = db.transaction((data: Candle[]) => {
    for (const candle of data) {
      insert.run({ ...candle, symbol });
    }
  });

  insertMany(candles);
}
