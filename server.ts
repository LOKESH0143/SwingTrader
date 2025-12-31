import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance from 'yahoo-finance2';
import { getCachedCandles, saveCandles, getLastCandleDate } from './src/lib/db';
import { NIFTY_500_SYMBOLS } from './src/lib/nifty500';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

const JOURNAL_FILE = './data/journal.json';
const SCORES_FILE = './data/scores.json';

// Initialize Yahoo Finance instance with custom config
// This mimics a real browser to bypass bot detection
const yf = new (yahooFinance as any)({
  httpOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }
});

// --- SERVER-SIDE RATE LIMITER ---
class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;
  private concurrency = 1; 
  private delay = 500; // Reduced to 500ms for better UX while maintaining safety

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, retries = 3, backoff = 5000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries > 0 && (error.message?.includes('Too Many Requests') || error.message?.includes('429'))) {
        console.log(`[Rate Limit] Hit 429. Waiting ${backoff}ms before retry... (${retries} left)`);
        await new Promise(r => setTimeout(r, backoff));
        return this.executeWithRetry(fn, retries - 1, backoff * 2); // Exponential backoff
      }
      throw error;
    }
  }

  private async process() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) return;

    this.activeCount++;
    const task = this.queue.shift();
    
    if (task) {
      try {
        await task();
      } finally {
        setTimeout(() => {
          this.activeCount--;
          this.process();
        }, this.delay);
      }
    }
  }
}

const yahooLimiter = new RequestQueue();
// --------------------------------

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Middleware to parse JSON
  app.use(express.json());

  // Ensure data directory exists
  try {
    await fs.mkdir('./data', { recursive: true });
  } catch (e) {}

  // Request Logging Middleware
  app.use((req, res, next) => {
    if (!req.url.includes('/api/history')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- JOURNAL API ---
  app.get("/api/journal", async (req, res) => {
    try {
      const data = await fs.readFile(JOURNAL_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (e) {
      res.json([]);
    }
  });

  app.post("/api/journal", async (req, res) => {
    try {
      const newTrade = req.body;
      let trades = [];
      try {
        const data = await fs.readFile(JOURNAL_FILE, 'utf-8');
        trades = JSON.parse(data);
      } catch (e) {}
      
      trades.push(newTrade);
      await fs.writeFile(JOURNAL_FILE, JSON.stringify(trades, null, 2));
      res.json({ success: true, trade: newTrade });
    } catch (e) {
      res.status(500).json({ error: "Failed to save trade" });
    }
  });

  app.put("/api/journal/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedTrade = req.body;
      let trades = [];
      try {
        const data = await fs.readFile(JOURNAL_FILE, 'utf-8');
        trades = JSON.parse(data);
      } catch (e) {}

      const index = trades.findIndex((t: any) => String(t.id) === String(id));
      if (index !== -1) {
        trades[index] = { ...trades[index], ...updatedTrade };
        await fs.writeFile(JOURNAL_FILE, JSON.stringify(trades, null, 2));
        res.json({ success: true, trade: trades[index] });
      } else {
        res.status(404).json({ error: "Trade not found" });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to update trade" });
    }
  });

  app.delete("/api/journal/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let trades = [];
      try {
        const data = await fs.readFile(JOURNAL_FILE, 'utf-8');
        trades = JSON.parse(data);
      } catch (e) {}

      const filtered = trades.filter((t: any) => String(t.id).trim() !== String(id).trim());
      await fs.writeFile(JOURNAL_FILE, JSON.stringify(filtered, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete trade" });
    }
  });

  app.post("/api/journal/delete", async (req, res) => {
    try {
      const { id } = req.body;
      let trades = [];
      try {
        const data = await fs.readFile(JOURNAL_FILE, 'utf-8');
        trades = JSON.parse(data);
      } catch (e) {}

      const filtered = trades.filter((t: any) => String(t.id).trim() !== String(id).trim());
      await fs.writeFile(JOURNAL_FILE, JSON.stringify(filtered, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete trade" });
    }
  });

  app.post("/api/journal/clear", async (req, res) => {
    try {
      await fs.writeFile(JOURNAL_FILE, JSON.stringify([], null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to clear journal" });
    }
  });

  // --- STRATEGY SCORES API ---
  const SCORES_FILE = './data/scores.json';

  app.get("/api/scores", async (req, res) => {
    try {
      const data = await fs.readFile(SCORES_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (e) {
      res.json({});
    }
  });

  app.post("/api/scores", async (req, res) => {
    try {
      const newScores = req.body; // Expecting Record<string, StrategyScore>
      await fs.writeFile(SCORES_FILE, JSON.stringify(newScores, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save scores" });
    }
  });
  // -------------------

  app.get("/api/history/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { interval = '1d', range = '1y', force = 'false' } = req.query;
    const isForce = force === 'true';

    try {
      // 1. Check Cache
      const cachedData = getCachedCandles(symbol, 365);
      const lastDateStr = getLastCandleDate(symbol);
      
      let shouldFetch = true;
      let fetchStartDate = new Date();
      
      if (!isForce && cachedData && cachedData.length > 0 && lastDateStr) {
        const lastDate = new Date(lastDateStr);
        const now = new Date();
        const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

        // If data is less than 48 hours old (or it's the weekend), use cache
        if (diffHours < 48) {
          console.log(`[Cache] Hit for ${symbol} (Fresh enough)`);
          
          // Filter for requested range
          let requiredStart = new Date();
          if (range === '5y') requiredStart.setFullYear(requiredStart.getFullYear() - 5);
          else if (range === '2y') requiredStart.setFullYear(requiredStart.getFullYear() - 2);
          else if (range === '1y') requiredStart.setFullYear(requiredStart.getFullYear() - 1);
          else requiredStart.setMonth(requiredStart.getMonth() - 6);
          
          const filtered = cachedData.filter(c => new Date(c.date).getTime() >= requiredStart.getTime());
          res.json(filtered);
          return;
        }
        
        // If we have data but it's old, only fetch the missing part
        console.log(`[Cache] Stale for ${symbol}. Last: ${lastDateStr}. Fetching update...`);
        fetchStartDate = new Date(lastDate);
        fetchStartDate.setDate(fetchStartDate.getDate() + 1); // Start from next day
      } else {
        // No cache, fetch full range
        if (range === '5y') fetchStartDate.setFullYear(fetchStartDate.getFullYear() - 5);
        else if (range === '2y') fetchStartDate.setFullYear(fetchStartDate.getFullYear() - 2);
        else if (range === '1y') fetchStartDate.setFullYear(fetchStartDate.getFullYear() - 1);
        else fetchStartDate.setMonth(fetchStartDate.getMonth() - 6);
      }

      // 2. Fetch from Yahoo (Incremental or Full)
      console.log(`[Yahoo] Fetching ${symbol} from ${fetchStartDate.toISOString().split('T')[0]}...`);
      
      const endDate = new Date();
      let result: any[] = [];
      
      try {
        // WRAPPED IN LIMITER
        // Switch to historical as primary for better reliability
        console.log(`[Yahoo] Requesting historical data for ${symbol}...`);
        const historicalResult = await yahooLimiter.add(() => yf.historical(symbol, {
          period1: fetchStartDate,
          period2: endDate,
          interval: interval as any
        })) as Array<any>;

        if (historicalResult && historicalResult.length > 0) {
          result = historicalResult;
        } else {
           // Fallback to chart if historical fails
           console.log(`[Yahoo] Historical empty, trying chart for ${symbol}...`);
           const chartResult = await yahooLimiter.add(() => yf.chart(symbol, {
             period1: fetchStartDate,
             period2: endDate,
             interval: interval as any
           })) as any;
           
           if (chartResult && chartResult.quotes && chartResult.quotes.length > 0) {
             result = chartResult.quotes
               .filter((q: any) => q.date && q.open !== null && q.high !== null && q.low !== null && q.close !== null)
               .map((q: any) => ({
                 date: q.date,
                 open: q.open,
                 high: q.high,
                 low: q.low,
                 close: q.close,
                 volume: q.volume || 0
               }));
           }
        }
        
        if (result.length === 0) {
           throw new Error("No data returned from both historical and chart endpoints");
        }

      } catch (error: any) {
        console.warn(`[Yahoo] Fetch failed for ${symbol}: ${error.message}`);
        
        // FALLBACK: If fetch fails but we have cache, RETURN CACHE
        if (cachedData && cachedData.length > 0) {
           console.log(`[Fallback] Returning stale cache for ${symbol}`);
           res.json(cachedData);
           return;
        }
        
        throw error;
      }

      // Map to our Candle format
      const newCandles = result.map(quote => ({
        date: new Date(quote.date).toISOString().split('T')[0],
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume || 0
      }));

      // 3. Save to Cache
      if (newCandles.length > 0) {
        saveCandles(symbol, newCandles);
        console.log(`[Cache] Saved ${newCandles.length} new candles for ${symbol}`);
      }
      
      // Return combined data (Old Cache + New Data)
      const finalData = getCachedCandles(symbol, 365); // Re-read from DB to get sorted, unique list
      res.json(finalData || newCandles);

    } catch (error: any) {
      console.error(`[Yahoo] Error details for ${symbol}:`, error.message || error);
      res.status(500).json({ error: "Failed to fetch data", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: server
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
