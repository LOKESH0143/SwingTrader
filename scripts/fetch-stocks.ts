import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

// --- CONFIGURATION ---
const HISTORY_YEARS = 5;
const REFRESH_DAYS = 7;
const RATE_LIMIT_DELAY_MS = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const DATA_DIR = path.resolve('data');
const SYMBOLS_FILE = path.resolve('symbols.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load Symbols
const symbols: string[] = JSON.parse(fs.readFileSync(SYMBOLS_FILE, 'utf-8'));

// Types
interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getStartDate = (yearsAgo: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d;
};

// --- CORE LOGIC ---

async function fetchWithRetry(symbol: string, start: Date, end: Date, retries = MAX_RETRIES): Promise<any[]> {
  try {
    // Yahoo Finance expects dates, not strings for historical
    const result = await yahooFinance.historical(symbol, {
      period1: start,
      period2: end,
      interval: '1d'
    });
    return result;
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`⚠️ Error fetching ${symbol}. Retrying in ${RETRY_DELAY_MS}ms... (${retries} left)`);
      await delay(RETRY_DELAY_MS);
      return fetchWithRetry(symbol, start, end, retries - 1);
    }
    console.error(`❌ Failed to fetch ${symbol}:`, error.message);
    return [];
  }
}

async function processStock(symbol: string) {
  const filePath = path.join(DATA_DIR, `${symbol}.json`);
  let existingData: Candle[] = [];

  // 1. Load Existing Data
  if (fs.existsSync(filePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.warn(`⚠️ Corrupt JSON for ${symbol}, starting fresh.`);
    }
  }

  // 2. Determine Cutoff Date (Today - 7 Days)
  const today = new Date();
  const refreshCutoff = new Date();
  refreshCutoff.setDate(today.getDate() - REFRESH_DAYS);
  const refreshCutoffStr = formatDate(refreshCutoff);

  // Keep data strictly BEFORE the cutoff
  let keptData = existingData.filter(c => c.date < refreshCutoffStr);

  // 3. Identify Gaps
  const targetStartDate = getStartDate(HISTORY_YEARS);
  let newHistory: Candle[] = [];
  let newRecent: Candle[] = [];

  // Gap A: History (If existing data starts too late or is empty)
  let historyFetchStart = targetStartDate;
  let historyFetchEnd: Date | null = null;

  if (keptData.length > 0) {
    const firstKeptDate = new Date(keptData[0].date);
    if (firstKeptDate > targetStartDate) {
      // We need to backfill from targetStart -> firstKeptDate
      historyFetchEnd = firstKeptDate;
    }
  } else {
    // No data kept, fetch everything from targetStart -> refreshCutoff
    historyFetchEnd = refreshCutoff;
  }

  if (historyFetchEnd) {
    console.log(`⏳ [${symbol}] Backfilling history: ${formatDate(historyFetchStart)} -> ${formatDate(historyFetchEnd)}`);
    const rawHistory = await fetchWithRetry(symbol, historyFetchStart, historyFetchEnd);
    newHistory = mapToCandles(rawHistory);
  }

  // Gap B: Recent (From cutoff -> Today)
  console.log(`⏳ [${symbol}] Refreshing recent: ${refreshCutoffStr} -> ${formatDate(today)}`);
  const rawRecent = await fetchWithRetry(symbol, refreshCutoff, today);
  newRecent = mapToCandles(rawRecent);

  // 5. Merge
  const combined = [...newHistory, ...keptData, ...newRecent];

  // 6. Deduplicate & Sort
  const uniqueMap = new Map<string, Candle>();
  combined.forEach(c => uniqueMap.set(c.date, c));
  const sortedData = Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 7. Save
  if (sortedData.length > 0) {
    fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2));
    console.log(`✅ [${symbol}] Saved ${sortedData.length} records.`);
    return true;
  } else {
    console.warn(`⚠️ [${symbol}] No data to save.`);
    return false;
  }
}

function mapToCandles(raw: any[]): Candle[] {
  return raw.map(q => ({
    date: formatDate(new Date(q.date)),
    open: q.open,
    high: q.high,
    low: q.low,
    close: q.close,
    volume: q.volume
  })).filter(c => c.open !== null && c.close !== null); // Filter invalid candles
}

// --- MAIN LOOP ---
async function main() {
  console.log(`🚀 Starting Stock Data Fetcher for ${symbols.length} symbols...`);
  const summary: Record<string, string> = {};

  for (const symbol of symbols) {
    const success = await processStock(symbol);
    summary[symbol] = success ? 'Success' : 'Failed';
    await delay(RATE_LIMIT_DELAY_MS); // Rate Limit
  }

  // Save Summary
  fs.writeFileSync(path.join(DATA_DIR, '_summary.json'), JSON.stringify(summary, null, 2));
  console.log("🎉 All Done!");
}

main().catch(console.error);
