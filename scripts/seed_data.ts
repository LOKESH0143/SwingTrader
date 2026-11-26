import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'market_data.db');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const SHOONYA_FILE = path.join(DATA_DIR, 'shoonya_config.json');

console.log('🌱 Initializing SwingTrade Architect data...');

// 1. Ensure directory
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('✅ Created data/ directory');
}

// 2. Initialize SQLite DB
try {
  const db = new Database(DB_PATH);
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
  console.log('✅ Initialized SQLite market_data.db schema');
  db.close();
} catch (e: any) {
  console.error('❌ Failed to initialize SQLite database:', e.message);
}

// 3. Ensure shoonya_config.json template exists
if (!fs.existsSync(SHOONYA_FILE)) {
  const template = {
    userId: "",
    password: "",
    twoFA: "",
    vendorCode: "",
    apiKey: "",
    imei: "abc1234"
  };
  fs.writeFileSync(SHOONYA_FILE, JSON.stringify(template, null, 2));
  console.log('✅ Created shoonya_config.json template');
}

// 4. Ensure scores.json exists
if (!fs.existsSync(SCORES_FILE)) {
  fs.writeFileSync(SCORES_FILE, JSON.stringify({}, null, 2));
  console.log('✅ Initialized empty scores.json');
}

console.log('✨ Seed process complete!');
