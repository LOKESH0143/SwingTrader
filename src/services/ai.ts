import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface StrategyAnalysisInput {
  strategyName: string;
  winRate: number;
  netProfit: number;
  totalTrades: number;
  avgMfe: number;
  avgMae: number;
  bestSymbol: string;
}

export async function analyzeTournamentResults(results: StrategyAnalysisInput[]): Promise<string> {
  try {
    const prompt = `
    You are an expert Quantitative Trading Analyst. I have run a backtest tournament of swing trading strategies on the Nifty 100.
    
    Here are the performance results:
    ${JSON.stringify(results, null, 2)}
    
    Please analyze these results and provide a concise report covering:
    1. **The Champion:** Which strategy performed best and why? (Is it high win rate or high risk:reward?)
    2. **The Loser:** Which strategy failed? Diagnose the issue based on MAE (Max Adverse Excursion). 
       - If MAE is very small (e.g., < 1%) but the trade lost, it means the Stop Loss is too tight (stopped out on noise).
       - If MAE is large, the entry timing is bad.
    3. **Optimization Tips:** Suggest 1 specific parameter change for the top 2 strategies to improve them further.
    
    Keep the tone professional, data-driven, and concise. Use bullet points.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Failed to generate analysis.";
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return "Error: Could not generate analysis. Please check your API key or network connection.";
  }
}
