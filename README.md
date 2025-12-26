# SwingTrade Architect

A professional-grade swing trading backtesting and strategy development platform built with React, TypeScript, and Vite.

## 🚀 Features

### 🏆 Strategy Tournament
- **Battle of the Bots:** Run multiple strategies simultaneously against a basket of stocks.
- **Stock Universes:** Select from Nifty 50, Nifty 100, or specific sectors (Banking, IT, Auto, Pharma, etc.).
- **Walk-Forward Optimization:** Use the Date Range filters to train on historical data (e.g., 2023) and test on out-of-sample data (e.g., 2025).
- **Deep Debugging:** Analyze trade performance with **MFE** (Max Favorable Excursion) and **MAE** (Max Adverse Excursion) to fine-tune stops and targets.

### 📊 Advanced Analytics
- **Win Rate & PnL:** Real-time calculation of strategy performance.
- **Visual Backtest:** See the exact entry and exit points on the chart (coming soon).
- **Trade Filters:** Filter backtests by Risk:Reward ratio, Max Stop Loss %, and Min Target %.

## 🧠 Trading Strategies

The platform includes a suite of optimized swing trading strategies:

1.  **Golden Cross (Optimized):** Classic SMA 50 > SMA 200 crossover with RSI and Volume filters.
2.  **MACD (Standard):** Reliable trend-following using MACD crossover above the Zero Line with ADX confirmation.
3.  **TTM Squeeze (Optimized):** Volatility contraction breakout with Trend (SMA 50) and Volume checks.
4.  **Bollinger Band Squeeze (True Expansion):** Captures explosive moves when Bollinger Bands expand after a squeeze.
5.  **Bollinger Trend Rider:** Simple breakout strategy that rides the Upper Band in a strong uptrend (Above SMA 50).
6.  **Stochastic Dip Buyer:** Mean reversion strategy that buys oversold dips (< 20) ONLY in a long-term uptrend (Above SMA 200).
7.  **Institutional Breakout:** Buys new 50-day highs with strong volume (1.5x avg) and a strong close (top 25% of range).
8.  **Volume Profile Trend:** Buys when price breaks above the Value Area High (VAH) with the Point of Control (POC) as support.
9.  **Gap and Go (Optimized):** Momentum strategy for catching gap-ups > 2% in an uptrend, with tight stops.

## 🛠️ Tech Stack

-   **Frontend:** React 18, Tailwind CSS, Lucide Icons, Recharts
-   **Backend:** Express.js (serving as API and Vite middleware)
-   **Data:** Yahoo Finance API (via `yahoo-finance2`), SQLite (Caching)
-   **Build:** Vite, TypeScript

## 🏃‍♂️ Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start the Development Server:**
    ```bash
    npm run dev
    ```
    The app will run on `http://localhost:3000`.

3.  **Database:**
    The application automatically creates a local SQLite database in `data/market_data.db` to cache stock data and speed up backtests.

## 📝 Recent Updates

-   **Sector Tournaments:** Added ability to run strategies on specific sectors like Banking, IT, and Pharma.
-   **Date Filters:** Fixed logic to allow precise backtesting windows (e.g., Jan 1 - Dec 31).
-   **MFE/MAE:** Added advanced metrics to identify if stops are too tight or targets are too ambitious.
-   **Strategy Optimization:** Refined `Gap and Go` and `MACD` based on performance data.
