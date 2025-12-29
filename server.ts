import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance from 'yahoo-finance2';
import { getCachedCandles, saveCandles } from './src/lib/db';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';

const JOURNAL_FILE = './data/journal.json';

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
    const { interval = '1d', range = '1y' } = req.query;
    try {
      // 1. Try Cache First (Only for daily data)
      if (interval === '1d') {
        const cachedData = getCachedCandles(symbol, 365);
        if (cachedData && cachedData.length > 0) {
          // Check if cached data covers the requested range
          const cachedStart = new Date(cachedData[0].date).getTime();
          let requiredStart = new Date();
          
          if (range === '5y') requiredStart.setFullYear(requiredStart.getFullYear() - 5);
          else if (range === '2y') requiredStart.setFullYear(requiredStart.getFullYear() - 2);
          else if (range === '1y') requiredStart.setFullYear(requiredStart.getFullYear() - 1);
          else requiredStart.setMonth(requiredStart.getMonth() - 6);

          // Allow a small buffer (e.g., 10 days) for holidays/weekends
          // If cached data starts BEFORE or roughly AT the required start date, it's good.
          if (cachedStart <= requiredStart.getTime() + (10 * 24 * 60 * 60 * 1000)) {
            console.log(`[Cache] Hit for ${symbol} (Range: ${range})`);
            
            // Filter cached data to match the requested range
            const filteredData = cachedData.filter((c: any) => new Date(c.date).getTime() >= requiredStart.getTime());
            res.json(filteredData);
            return;
          } else {
            console.log(`[Cache] Miss for ${symbol}: Insufficient history. Have ${cachedData[0].date}, Need ${requiredStart.toISOString().split('T')[0]}`);
          }
        }
      }

      // 2. Fetch from Yahoo if Cache Miss
      console.log(`[Yahoo] Fetching ${symbol}...`);
      
      const endDate = new Date();
      let startDate = new Date();
      
      if (range === '1y') startDate.setFullYear(endDate.getFullYear() - 1);
      else if (range === '2y') startDate.setFullYear(endDate.getFullYear() - 2);
      else if (range === '5y') startDate.setFullYear(endDate.getFullYear() - 5);
      else startDate.setMonth(endDate.getMonth() - 6); 

      let result: any[] = [];
      try {
        // Use yf.chart as it is more robust for NSE/BSE symbols
        const chartResult = await yahooFinance.chart(symbol, {
          period1: startDate,
          period2: endDate,
          interval: interval as any
        }) as any;

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
        } else {
          throw new Error("No data in chart response");
        }
      } catch (chartError: any) {
        console.warn(`[Yahoo] Chart fetch failed for ${symbol}, trying historical fallback...`, chartError.message);
        // Fallback to historical
        const historicalResult = await yahooFinance.historical(symbol, {
          period1: startDate,
          period2: endDate,
          interval: interval as any
        }) as Array<any>;
        
        if (historicalResult && historicalResult.length > 0) {
          result = historicalResult;
        } else {
          throw chartError; // Re-throw original error if fallback also fails
        }
      }

      // Map to our Candle format
      const candles = result.map(quote => ({
        date: new Date(quote.date).toISOString().split('T')[0],
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume || 0
      }));

      // 3. Save to Cache (Background)
      if (interval === '1d' && candles.length > 0) {
        saveCandles(symbol, candles);
        console.log(`[Cache] Saved ${candles.length} candles for ${symbol}`);
      }

      res.json(candles);
    } catch (error: any) {
      console.error(`[Yahoo] Error details for ${symbol}:`, error.message || error);
      if (error.errors) {
        console.error(`[Yahoo] Validation errors:`, JSON.stringify(error.errors, null, 2));
      }
      res.status(500).json({ error: "Failed to fetch data from Yahoo Finance", details: error.message });
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
