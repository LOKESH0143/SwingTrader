import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Candle } from './types';

const dbPath = path.resolve('data/market_data.db');
const dbDir = path.dirname(dbPath);

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (e) {
  console.error("Failed to create data directory:", e);
}

let db: any;
try {
  db = new Database(dbPath);
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
} catch (e) {
  console.error("Failed to initialize database:", e);
  // Fallback in-memory DB to prevent crash
  db = new Database(':memory:');
}

export function getCachedCandles(symbol: string, days: number): Candle[] | null {
  // Check if we have ANY data
  const lastRow = db.prepare('SELECT date FROM candles WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol) as { date: string } | undefined;
  
  if (!lastRow) return null;

  const rows = db.prepare(`
    SELECT date, open, high, low, close, volume 
    FROM candles 
    WHERE symbol = ? 
    ORDER BY date ASC
  `).all(symbol) as Candle[];

  return rows;
}

export function getLastCandleDate(symbol: string): string | null {
  const row = db.prepare('SELECT date FROM candles WHERE symbol = ? ORDER BY date DESC LIMIT 1').get(symbol) as { date: string } | undefined;
  return row ? row.date : null;
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
