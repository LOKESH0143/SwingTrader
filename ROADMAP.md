# SwingTrade Architect — Product Roadmap

> **Product Strategy:** One-Time Paid Local / Desktop Trading Terminal (BYOK — Bring Your Own Broker & Gemini Keys) targeting Indian retail NSE swing traders. Zero monthly server bills, full privacy, institutional-grade UI.

---

## Week 1 — Pro Trading Terminal UI/UX Overhaul & TradingView Charts ([#7](https://github.com/LOKESH0143/SwingTrader/issues/7))
*Goal: Replace the generic Google AI Studio template with a sharp, trustworthy fintech terminal UI inspired by TradingView and Zerodha Kite.*

- [x] Update `index.html` branding, metadata, and load `Inter` + `JetBrains Mono` typography
- [x] Build cohesive Dark (default) & Light fintech design system in `src/index.css` with tabular numbers and zero generic purple/indigo clichés
- [x] Redesign `Layout.tsx` with grouped trading-desk navigation, top header bar, and Dark/Light theme toggle
- [x] Replace Recharts line chart in `TradeChart.tsx` with TradingView `lightweight-charts` OHLC Candlesticks, volume histogram, Entry/SL/Target price lines, markers, and live OHLCV crosshair readout
- [x] Upgrade `Backtest.tsx` with interactive TradingView Candlestick chart & trade inspector
- [x] Fix navigation route mismatch (`/strategy-builder` → `/builder`) and restyle core pages

---

## Week 2 — Engine Credibility, Indian Market Costs & Backend Refactor ([#8](https://github.com/LOKESH0143/SwingTrader/issues/8))
*Goal: Make backtest results realistic for serious NSE traders and harden the backend architecture.*

- [ ] Move Gemini AI calls (`analyzeTournamentResults`, `generateStrategyFromPrompt`) to server-side `/api/ai/*` endpoints so `GEMINI_API_KEY` is never exposed in client bundles
- [ ] Split `server.ts` into modular route handlers (`market`, `journal`, `scores`, `tournament`, `shoonya`, `ai`)
- [ ] Migrate local JSON storage (`journal.json`, `scores.json`, `tournament_results.json`) into SQLite tables
- [ ] Add realistic Indian market friction to `backtest.ts` and `portfolioBacktest.ts` (brokerage, STT, exchange fees, slippage)
- [ ] Optimize backtest indicator computation to eliminate $O(N^2)$ history re-slicing

---

## Week 3 — Product Polish, Onboarding Flow & Desktop Packaging ([#9](https://github.com/LOKESH0143/SwingTrader/issues/9))
*Goal: Make installation and daily use effortless for non-technical Indian traders.*

- [ ] First-run Onboarding / Setup Wizard (guided Broker API + Gemini key setup + live diagnostics test)
- [ ] CSV export for Trade Journal, Backtest Trade Log, and Tournament Leaderboard
- [ ] Built-in NSE Position Size & Risk Calculator (Capital, Risk %, Entry, Stop Loss → exact share count)
- [ ] Package as a double-clickable desktop application (Electron) or 1-click local installer for Windows/Mac

---

## Week 4 — Launch Assets, Landing Page & First Paying Customers ([#10](https://github.com/LOKESH0143/SwingTrader/issues/10))
*Goal: Validate real demand and generate first revenue (₹999–₹2,499 one-time lifetime license).*

- [ ] High-converting 1-page Landing Page with live screenshots, feature showcase, and transparent BYOK pricing
- [ ] Record a crisp 60–90 second product demo video
- [ ] Set up Razorpay Payment Page / Gumroad checkout and automated download delivery
- [ ] Refresh `README.md` with visual previews and setup instructions
- [ ] Launch in Indian trading communities (X/Twitter, `r/IndianStreetBets`, Discord/Telegram) and iterate from buyer feedback
