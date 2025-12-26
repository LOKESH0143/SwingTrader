import { GoogleGenAI } from "@google/genai";
import { Strategy } from "../lib/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `
You are an expert TypeScript Trading Strategy Developer. Your goal is to convert a natural language description of a trading strategy into executable TypeScript code that fits a specific backtesting engine.

**Context:**
- The code runs inside a \`new Function('data', 'params', 'indicators', code)\`.
- \`data\` is an array of \`Candle\` objects: \`{ date: string, open: number, high: number, low: number, close: number, volume: number }\`.
- \`params\` is an object containing user-defined parameters (e.g., \`params.period\`).
- \`indicators\` is a library of helper functions.

**Available Indicators (indicators.*):**
- \`sma(data, period)\`: Returns number[]
- \`ema(data, period)\`: Returns number[]
- \`rsi(data, period)\`: Returns number[]
- \`macd(data, fast, slow, signal)\`: Returns { macdLine, signalLine, histogram }
- \`bollingerBands(data, period, multiplier)\`: Returns { upper, middle, lower }
- \`adx(data, period)\`: Returns number[]
- \`atr(data, period)\`: Returns number[]
- \`stochastic(data, kPeriod, 3, dPeriod)\`: Returns { k, d }
- \`supertrend(data, period, multiplier)\`: Returns { trend, direction } (Not implemented yet, use ATR/SMA manually if needed)
- \`findSupportResistance(data, lookback)\`: Returns { supports: number[], resistances: number[] }
- \`getNearestLevel(price, levels, type)\`: Returns number | null
- \`isBullishEngulfing(current, prev)\`: Returns boolean
- \`isHammer(candle)\`: Returns boolean

**Output Requirements:**
You must return a JSON object with the following structure:
{
  "name": "Short descriptive name",
  "description": "One sentence description",
  "parameters": { "param1": defaultValue, "param2": defaultValue },
  "code": "The actual strategy logic code string"
}

**Code Logic Rules:**
1.  **Return Type:** The code MUST return an object \`{ signal: 'BUY', stopLoss: number, target: number, reason: string }\` if a trade is found, or \`null\` if no trade.
2.  **Accessing Data:** Use \`data[data.length - 1]\` for the current candle.
3.  **Indicators:** Calculate indicators at the top. Access their last value using \`[arr.length - 1]\`.
4.  **Safety:** Handle cases where indicators might be NaN (e.g., beginning of data).
5.  **Stop Loss & Target:** You MUST calculate a specific numeric Stop Loss and Target price.

**Example Code Snippet:**
\`\`\`typescript
const sma20 = indicators.sma(data, params.period);
const currentClose = data[data.length - 1].close;
const currentSma = sma20[sma20.length - 1];

if (currentClose > currentSma) {
  return {
    signal: 'BUY',
    stopLoss: currentClose * 0.95,
    target: currentClose * 1.10,
    reason: 'Price crossed above SMA'
  };
}
return null;
\`\`\`
`;

export async function generateStrategyFromPrompt(userPrompt: string): Promise<Strategy> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a trading strategy based on this description: "${userPrompt}"`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text);
    
    return {
      id: `custom-${Date.now()}`,
      name: result.name,
      description: result.description,
      parameters: result.parameters,
      code: result.code
    };
  } catch (error) {
    console.error("Strategy Generation Error:", error);
    throw new Error("Failed to generate strategy. Please try again.");
  }
}
