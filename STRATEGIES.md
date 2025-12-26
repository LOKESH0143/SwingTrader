# Strategy Logic Documentation

This document details the logic and parameters for the strategies available in SwingTrade Architect.

## 1. Golden Cross (Optimized)
*   **Concept:** Trend Following. Captures major trend reversals.
*   **Entry:**
    *   SMA 50 crosses above SMA 200.
    *   **Filter 1:** RSI between 50 and 70 (Momentum is building but not overbought).
    *   **Filter 2:** SMA 200 slope is flat or rising (Avoid downtrends).
    *   **Filter 3:** Volume > 1.1x 20-day Average.
*   **Exit:**
    *   **Stop Loss:** 2 * ATR below entry.
    *   **Target:** 2.5x Risk.

## 2. MACD (Standard)
*   **Concept:** Momentum Trend.
*   **Entry:**
    *   MACD Line crosses above Signal Line.
    *   **Filter 1:** Price > SMA 200 (Long-term Uptrend).
    *   **Filter 2:** ADX > 20 (Trend Strength).
    *   **Filter 3:** RSI < 70 (Not overbought).
*   **Exit:**
    *   **Stop Loss:** Chandelier Exit (3x ATR) or Nearest Support.
    *   **Target:** 3x Risk.

## 3. TTM Squeeze (Optimized)
*   **Concept:** Volatility Breakout.
*   **Entry:**
    *   Bollinger Bands exit Keltner Channels (Squeeze Firing).
    *   **Filter 1:** Price > SMA 50 (Trend Alignment).
    *   **Filter 2:** Momentum > 0 (Histogram positive).
    *   **Filter 3:** Volume > 75% of Avg.
*   **Exit:**
    *   **Stop Loss:** Tighter of Chandelier Exit or Low of Breakout Candle.
    *   **Target:** 2.5x Risk.

## 4. Bollinger Band Squeeze (True Expansion)
*   **Concept:** Volatility Expansion.
*   **Entry:**
    *   Price closes above Upper Bollinger Band.
    *   **Filter 1:** Bandwidth is expanding (Current BW > Prev BW).
    *   **Filter 2:** Strong Close (Close in upper 25% of daily range).
    *   **Filter 3:** Volume > Avg Volume.
*   **Exit:**
    *   **Stop Loss:** Middle Band (SMA 20) or Low of Breakout Candle (if SMA 20 is too far).
    *   **Target:** 2.5x Risk.

## 5. Bollinger Trend Rider
*   **Concept:** Simple Trend Following.
*   **Entry:**
    *   Price closes above Upper Bollinger Band.
    *   **Filter:** Price > SMA 50.
*   **Exit:**
    *   **Stop Loss:** Middle Band (SMA 20).
    *   **Target:** 3x Risk.

## 6. Stochastic Dip Buyer
*   **Concept:** Mean Reversion (Pullback).
*   **Entry:**
    *   Stochastic %K crosses above %D.
    *   **Condition:** Cross happens in Oversold territory (< 20).
    *   **Filter 1:** Price > SMA 200 (Only buy dips in an uptrend).
    *   **Filter 2:** Green Candle (Close > Open).
*   **Exit:**
    *   **Stop Loss:** Recent Low of the dip.
    *   **Target:** 3x Risk.

## 7. Institutional Breakout
*   **Concept:** Price Action / Volume.
*   **Entry:**
    *   Price closes above the 50-Day High.
    *   **Filter 1:** Volume > 1.5x Avg Volume.
    *   **Filter 2:** Strong Close (Upper 25% of range).
    *   **Filter 3:** Price > SMA 200.
*   **Exit:**
    *   **Stop Loss:** Low of the Breakout Candle.
    *   **Target:** 3x Risk.

## 8. Volume Profile Trend
*   **Concept:** Fair Value Breakout.
*   **Entry:**
    *   Price closes above Value Area High (VAH) of the last 50 days.
    *   **Filter:** Price > SMA 50.
*   **Exit:**
    *   **Stop Loss:** Point of Control (POC).
    *   **Target:** 2.5x Risk.

## 9. Gap and Go (Optimized)
*   **Concept:** Momentum Gap.
*   **Entry:**
    *   Gap Up > 2% from previous close.
    *   **Filter 1:** Green Candle (Close > Open).
    *   **Filter 2:** Price > SMA 50 (Uptrend).
    *   **Filter 3:** Gap < 5% (Avoid exhaustion gaps).
*   **Exit:**
    *   **Stop Loss:** Low of the Gap Candle.
    *   **Target:** 2x Risk.
