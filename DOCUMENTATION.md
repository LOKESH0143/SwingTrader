# Architect Trader v2.1 - Documentation

This document provides a comprehensive overview of the features, technical architecture, and mathematical models implemented in the Architect Trader application.

## 1. Core Features

### 1.1. Strategy Tournament

The Tournament is the core benchmarking tool of the application. It allows users to run all pre-built trading strategies against a selected stock universe over a specified time period.

- **Stock Universes**: Pre-defined lists of stocks (e.g., Nifty 100, Banking Sector) to run the tournament against.
- **Time Periods**: Users can run backtests on custom date ranges or use quick buttons for pre-defined periods:
  - **Update Avg (5Y)**: Runs a 5-year backtest to gather long-term performance data.
  - **Update Recent (6M)**: Runs a 6-month backtest to evaluate recent strategy performance.
- **Leaderboard**: Displays a comprehensive table of results, including Total Return, Win Rate, and the proprietary **Architect Score v2**.
- **Trade Inspector**: Allows users to click on any strategy to view a detailed list of all trades taken during the tournament.

### 1.2. Portfolio Simulator

The Portfolio Simulator stress-tests a portfolio of strategies under real-world conditions.

- **Strategy Selection**: Users can manually select strategies or use the "Select Top Rated" button to automatically pick the best strategies based on the **Architect Score v2**.
- **Risk Management**: Key settings include initial capital, risk per trade, max open trades, and a "Max Hold Days" toggle to prevent trades from being held indefinitely.
- **Chronological Backtesting**: The simulation runs day-by-day, managing a portfolio-level equity curve, cash, and open positions.
- **Performance Metrics**: Outputs detailed portfolio metrics, including Total Return, Max Drawdown, and a historical equity curve chart.

### 1.3. AI Analyst

After a tournament run, users can click "Ask AI Analyst" to receive a high-level summary of the results. The AI provides insights into which strategies performed best and why, based on metrics like win rate, profit, and trade execution quality (MFE/MAE).

## 2. Technical Architecture

- **Frontend**: React (Vite) with TypeScript and Tailwind CSS.
- **Backend**: Node.js with Express, running as a middleware within the Vite development server.
- **Data Storage**: A hybrid approach using:
  - **SQLite**: For caching historical market data (`market_data.db`).
  - **JSON Files**: For persisting user-generated data like tournament results, strategy scores, and journal entries.

### 2.1. Server & Data Flow

1.  The client (React app) makes API requests to the local Express server (e.g., `/api/history/:symbol`).
2.  The server first checks its local SQLite cache for the requested data.
3.  **Cache Miss**: If data is not in the cache or is stale, the server fetches it from an external source (Shoonya API or a Yahoo Finance proxy).
4.  The fetched data is saved to the SQLite cache for future requests.
5.  The server returns the data to the client.

### 2.2. Atomic File Writes

To prevent data corruption when saving large JSON files (like tournament results), the server uses an atomic write process:
1.  Data is first written to a temporary file (e.g., `results.json.tmp`).
2.  If the write is successful, the temporary file is renamed to the final filename (e.g., `results.json`).
This ensures that the application never reads a partially written or corrupted file.

## 3. Data Caching & Persistence

### 3.1. Multi-Layer Caching

The application uses a sophisticated caching strategy to ensure fast performance and minimize external API calls.

- **Layer 1: In-Memory `lastChecked` Map**: A server-side map tracks the timestamp of the last time a symbol's data was fetched. If a request for the same symbol comes within 30 minutes, the server assumes the data is fresh.
- **Layer 2: SQLite Database (`market_data.db`)**: The primary cache for historical candle data. The server checks two conditions for a cache hit:
  1.  **Freshness**: The latest candle in the cache is for the current day, OR the `lastChecked` map indicates a recent fetch.
  2.  **Historical Depth**: The cache contains enough historical data for the requested range (e.g., at least 5 years of data for a '5y' request).

### 3.2. Data Persistence

- **Tournament Results**: Saved in `data/tournament_results.json`.
- **Strategy Scores**: Saved in `data/scores.json`.
- **Trade Journal**: Saved in `data/journal.json`.

To manage payload size, tournament results are **pruned** before saving, keeping all summary statistics but limiting the trade history to the 100 most recent trades per strategy.

## 4. Architect Score v2

The Architect Score v2 is a proprietary, multi-factor model designed to provide a balanced and holistic measure of a strategy's performance. It is normalized to a 0-100 scale for easy comparison.

**Final Score = (Profitability * 40%) + (Consistency * 30%) + (Velocity * 30%)**

### 4.1. Profitability (40% Weight)

- **Measures**: The strategy's ability to generate returns.
- **Logic**: A "Blended Monthly Return" is calculated, giving more weight to recent performance.
  - `Blended Monthly Return = (Recent Monthly Return * 0.7) + (Average Monthly Return * 0.3)`
- **Normalization**: The score is normalized against a reasonable maximum (e.g., 15% monthly return) to get a score out of 10.

### 4.2. Consistency (30% Weight)

- **Measures**: The reliability and stability of the strategy's returns.
- **Logic**: A "Blended Win Rate" is calculated.
  - `Blended Win Rate = (Recent Win Rate * 0.6) + (Average Win Rate * 0.4)`
- **Normalization**: The score is based on a 0-100% scale.

### 4.3. Velocity (30% Weight)

- **Measures**: Capital efficiency—how quickly a strategy generates profit.
- **Logic**: A "Blended Yield per Day" is calculated.
  - `Yield per Day = (Average PnL % per Trade) / (Average Holding Days)`
  - `Blended Velocity = (Recent Velocity * 0.7) + (Average Velocity * 0.3)`
- **Normalization**: The score is normalized against a reasonable maximum (e.g., 1% return per day) to get a score out of 10.

## 5. API Endpoints

- `GET /api/health`: Checks server status.
- `GET /api/history/:symbol`: Fetches historical market data.
- `GET /api/scores`: Retrieves saved strategy scores.
- `POST /api/scores`: Saves strategy scores.
- `GET /api/tournament/results`: Retrieves the latest tournament results.
- `POST /api/tournament/results`: Saves new tournament results.
- `GET, POST, DELETE /api/journal`: Manages trade journal entries.

## 6. Key Libraries

- **React**: Frontend UI library.
- **Vite**: Build tool and development server.
- **Express**: Backend server framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **better-sqlite3**: For high-performance SQLite database access.
- **Recharts**: For rendering charts and graphs.
- **Lucide React**: For icons.
