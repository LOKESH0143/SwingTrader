import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance from 'yahoo-finance2';
import { getCachedCandles, saveCandles, getLastCandleDate } from './src/lib/db';
import { NIFTY_500_SYMBOLS } from './src/lib/nifty500';
import { ShoonyaService } from './src/lib/shoonya';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';

const JOURNAL_FILE = './data/journal.json';
const SCORES_FILE = './data/scores.json';
const SHOONYA_CONFIG_FILE = './data/shoonya_config.json';
const PROXY_URL = 'https://script.google.com/macros/s/AKfycbwd7cYYjtOdp2Fu_esn3hmd-QKmulh_8H0i9R9KiKNjc4e8pHEVPxgW4tstxDiAdHk_/exec';

// Initialize Yahoo Finance instance with custom config
// This mimics a real browser to bypass bot detection
const yf = new (yahooFinance as any)({
  httpOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  }
});

let shoonya: ShoonyaService | null = null;

// Load Shoonya Config
async function loadShoonya() {
  try {
    const data = await fs.readFile(SHOONYA_CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    if (config.userId && config.apiKey) {
      shoonya = new ShoonyaService(config);
      console.log('✅ Shoonya Service Initialized');
    }
  } catch (e) {
    console.log('ℹ️ Shoonya config not found. Using Yahoo fallback.');
  }
}
loadShoonya();

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

  // --- SHOONYA CONFIG API ---
  app.post("/api/shoonya/config", async (req, res) => {
    try {
      const config = req.body;
      await fs.writeFile(SHOONYA_CONFIG_FILE, JSON.stringify(config, null, 2));
      shoonya = new ShoonyaService(config);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save Shoonya config" });
    }
  });

  app.get("/api/shoonya/config", async (req, res) => {
    try {
      const data = await fs.readFile(SHOONYA_CONFIG_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (e) {
      res.json({});
    }
  });

  app.get("/api/shoonya/test", async (req, res) => {
    try {
      if (!shoonya) {
        return res.json({ success: false, error: "Shoonya not configured" });
      }
      await shoonya.login();
      res.json({ success: true, token: (shoonya as any).token });
    } catch (e: any) {
      res.json({ success: false, error: e.message });
    }
  });

  // --- CACHE MANAGEMENT ---
  app.post("/api/cache/clear", (req, res) => {
    try {
      // Delete all rows from candles table
      const dbPath = path.resolve('data/market_data.db');
      const db = new Database(dbPath);
      db.exec('DELETE FROM candles');
      console.log('[Cache] Cleared all data.');
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Cache] Clear failed:', e);
      res.status(500).json({ error: e.message });
    }
  });
  // ------------------------
  // ---------------------------

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

        // If data is less than 4 hours old (or it's the weekend), use cache
        if (diffHours < 4) {
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

      // 2. Fetch from Source (Shoonya or Yahoo)
      console.log(`[Fetch] Fetching ${symbol} from ${fetchStartDate.toISOString().split('T')[0]}...`);
      
      const endDate = new Date();
      let result: any[] = [];
      let usedSource = 'Cache';
      let lastError = '';
      
      try {
        if (shoonya) {
          // --- SHOONYA FETCH ---
          console.log(`[Shoonya] Fetching ${symbol}...`);
          usedSource = 'Shoonya (Finvasia)';
          const daysToFetch = Math.ceil((endDate.getTime() - fetchStartDate.getTime()) / (1000 * 60 * 60 * 24));
          const shoonyaData = await shoonya.getHistory(symbol, daysToFetch);
          
          if (shoonyaData.length > 0) {
            result = shoonyaData;
          } else {
             console.warn(`[Shoonya] Empty result for ${symbol}, falling back to Yahoo.`);
             lastError = "Shoonya returned empty array";
             throw new Error("Shoonya returned empty");
          }
        } else {
           lastError = "Shoonya not configured";
           throw new Error("Shoonya not configured");
        }
      } catch (shoonyaError: any) {
        // --- YAHOO / PROXY FALLBACK ---
        if (shoonya) {
            console.log(`[Fallback] Switching to Yahoo/Proxy for ${symbol}...`);
            lastError = `Shoonya Error: ${shoonyaError.message}`;
        }
        usedSource = 'Google Proxy (Yahoo)';
        
        try {
          // USE GOOGLE PROXY
          console.log(`[Proxy] Fetching ${symbol} via Google Script...`);
          const proxyRes = await fetch(`${PROXY_URL}?symbol=${symbol}&range=${range}&interval=${interval}`, {
             redirect: 'follow'
          });
          
          if (!proxyRes.ok) {
             throw new Error(`Proxy HTTP Error: ${proxyRes.status}`);
          }
          
          const proxyData = await proxyRes.json();
          
          // Parse Yahoo Chart Response
          if (proxyData.chart && proxyData.chart.result && proxyData.chart.result[0]) {
             const quote = proxyData.chart.result[0];
             const timestamps = quote.timestamp || [];
             const quoteData = quote.indicators.quote[0];
             
             result = timestamps.map((t: number, i: number) => ({
                date: new Date(t * 1000).toISOString().split('T')[0],
                open: quoteData.open[i],
                high: quoteData.high[i],
                low: quoteData.low[i],
                close: quoteData.close[i],
                volume: quoteData.volume[i] || 0
             })).filter((c: any) => c.open !== null && c.close !== null); // Filter nulls
             
             if (result.length === 0) throw new Error("Proxy returned empty data");
             
          } else {
             throw new Error("Invalid Proxy Response Format");
          }

        } catch (proxyError: any) {
           console.warn(`[Proxy] Fetch failed: ${proxyError.message}`);
           lastError = `Proxy Error: ${proxyError.message} (Prev: ${lastError})`;
        }
      }
      
      if (result.length === 0) {
         // FINAL FALLBACK: If fetch fails but we have cache, RETURN CACHE
         if (cachedData && cachedData.length > 0) {
            console.log(`[Fallback] Returning stale cache for ${symbol}`);
            res.json(cachedData);
            return;
         }
         
         // If diagnostics, return specific error
         if (range === '6m' && symbol === 'RELIANCE.NS') {
             res.status(500).json({ 
                 error: "No data returned", 
                 details: `Shoonya: ${shoonya ? 'Active' : 'Inactive'} | Last Error: ${lastError}` 
             });
             return;
         }
         
         throw new Error("No data returned from any source");
      }

      // Map to our Candle format (Shoonya already mapped, Yahoo needs mapping if using raw)
      // But wait, ShoonyaService.getHistory returns Candle[], Yahoo returns raw.
      // We need to normalize.
      
      let newCandles: any[] = [];
      
      if (result[0].date && typeof result[0].open === 'number') {
          // Already Candle format (Shoonya or pre-mapped Yahoo)
          // Wait, Yahoo code above maps it.
          // Let's fix the Yahoo block to return Candle[] directly or raw.
          // Actually, let's just ensure result is Candle[]
          
          // If it came from Yahoo raw (historicalResult), it needs mapping.
          if (!result[0].hasOwnProperty('open')) { 
             // It's raw Yahoo
             newCandles = result.map((quote: any) => ({
                date: new Date(quote.date).toISOString().split('T')[0],
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume || 0
              }));
          } else {
             // It's already mapped (Shoonya or Yahoo chart map)
             // Ensure date format is YYYY-MM-DD
             newCandles = result.map((c: any) => ({
                 ...c,
                 date: new Date(c.date).toISOString().split('T')[0]
             }));
          }
      }

      // 3. Save to Cache
      if (newCandles.length > 0) {
        saveCandles(symbol, newCandles);
        console.log(`[Cache] Saved ${newCandles.length} new candles for ${symbol}`);
      }
      
      // Return combined data
      const finalData = getCachedCandles(symbol, 365) || newCandles;
      
      // If this is a diagnostics check, include metadata
      if (range === '6m' && symbol === 'RELIANCE.NS') {
         res.json({
           source: usedSource,
           data: finalData
         });
         return;
      }
      
      res.json(finalData);

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
