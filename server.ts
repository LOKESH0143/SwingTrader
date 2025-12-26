import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance from 'yahoo-finance2';
import { getCachedCandles, saveCandles } from './src/lib/db';
import http from 'http';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Middleware to parse JSON
  app.use(express.json());

  // Request Logging Middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

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
            res.json(cachedData);
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

      // Handle potential import issues (class vs instance)
      // @ts-ignore
      const yf = typeof yahooFinance === 'function' ? new yahooFinance() : yahooFinance;

      const result = await yf.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: interval as '1d' | '1wk' | '1mo'
      }) as Array<any>;

      // Map to our Candle format
      const candles = result.map(quote => ({
        date: quote.date.toISOString(),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume
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
