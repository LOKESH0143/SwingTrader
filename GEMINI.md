# Gemini Project Context: SwingTrade Architect

## Project Overview

**SwingTrade Architect** is a professional-grade Progressive Web App (PWA) for developing, backtesting, and analyzing swing trading strategies against Indian market data. It allows users to run a "tournament" of multiple pre-built and custom strategies against stock universes (e.g., Nifty 100) to find the best performers.

The application features a detailed results leaderboard, trade inspector, portfolio simulator, and an AI-powered analyst to summarize tournament results.

### Architecture

*   **Frontend:** A modern single-page application built with **React** and **TypeScript**, styled using **Tailwind CSS**. Routing is handled by **React Router**.
*   **Backend:** A **Node.js/Express** server responsible for serving the frontend, providing an API, and managing data.
*   **Build Tool:** **Vite** is used for fast development and building the production-ready frontend. The Express server is integrated as Vite middleware in development mode.
*   **Data Layer:**
    *   **Primary Data Source:** The application fetches market data primarily from the **Shoonya (Finvasia) API**.
    *   **Fallback Source:** It uses a **Google Apps Script proxy** to fetch data from **Yahoo Finance** if the primary source fails.
    *   **Caching:** A **SQLite** database (`data/market_data.db`) is used to cache historical candle data, reducing redundant API calls.
    *   **Persistence:** User-generated data (tournament results, strategy scores, journal entries) is stored in local **JSON files** within the `data/` directory.

### Core Logic

*   **Strategies:** Trading strategies are defined as JavaScript objects in individual files within the `src/lib/strategies/` directory. Each strategy contains metadata and a `code` property with the entry and exit logic, which is dynamically executed by the backtesting engine.
*   **Backtesting Engine:** The `runBacktest` function in `src/lib/backtest.ts` is the core engine. It iterates through historical data, executes the strategy code for each candle, and simulates trades based on the generated signals (BUY, stopLoss, target).
*   **Strategy Evaluation Details:**
    *   **Average Metrics (`avgPnL`, `avgWinRate`, etc.):** Calculated over a 5-year historical period.
    *   **Recent Metrics (`recentPnL`, `recentWinRate`, etc.):** Calculated over a 6-month historical period.
    *   **Default Stock Universe:** Nifty 100.
    *   **Default Risk Parameters:** Maximum Stop Loss (SL) of 5% and a minimum Risk-Reward (RR) ratio of 1:2.
*   **Tournament:** The `Tournament.tsx` page orchestrates the process of running all `PREBUILT_STRATEGIES` against a selected stock universe, collecting performance metrics, and persisting the results.

## Building and Running

The project is managed with `npm`. Key commands are defined in `package.json`:

*   **Install Dependencies:**
    ```bash
    npm install
    ```

*   **Run Development Server:**
    *   Starts the Express backend and the Vite development server with HMR. The app will be available at `http://localhost:3000`.
    ```bash
    npm run dev
    ```

*   **Build for Production:**
    *   Transpiles TypeScript and bundles the frontend for production.
    ```bash
    npm run build
    ```

*   **Linting:**
    *   Checks the project for TypeScript errors.
    ```bash
    npm run lint
    ```

## Development Conventions

*   **Structure:** The `src` directory is well-organized into `pages`, `components`, `lib` (core logic), `context`, and `services`. The recent refactoring has further organized strategies into a dedicated `src/lib/strategies` folder.
*   **Styling:** The project uses **Tailwind CSS** with `clsx` and `tailwind-merge` for utility-first styling and managing conditional classes.
*   **State Management:** Primarily uses React hooks (`useState`, `useEffect`). A `SimulationProvider` context is used for the Portfolio Simulator.
*   **API Calls:** Frontend API calls are centralized in `src/services/api.ts`.
*   **Code:** The backend and core logic are written in TypeScript. The frontend uses TypeScript with JSX (`.tsx`). The strategy logic itself is written as a string of JavaScript code to be dynamically executed by `new Function(...)` in the backtester.
*   **Environment Variables:** The `GEMINI_API_KEY` for the AI Analyst feature is managed via a `.env` file and exposed to the frontend through the `vite.config.ts` file.
