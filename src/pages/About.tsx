import React from 'react';
import { Book, Server, Code, Database, Activity, Layers, ShieldCheck, Cpu, Terminal, HelpCircle, FileText } from 'lucide-react';

export function About() {
  return (
    <div className="p-6 max-w-[98%] mx-auto pb-20">
      <div className="mb-12 border-b border-slate-200 pb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">SwingTrade Architect Documentation</h1>
        <p className="text-xl text-slate-600 max-w-3xl">
          The definitive technical manual and user guide for the SwingTrade Architect system. 
          Designed for traders who demand transparency, flexibility, and performance.
        </p>
      </div>

      <div className="space-y-16">
        {/* Section 1: System Philosophy */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">1. System Philosophy & Overview</h2>
          </div>
          <div className="prose prose-slate max-w-none text-slate-600">
            <p className="text-lg leading-relaxed">
              SwingTrade Architect is built on the philosophy that <b>transparency &gt; automation</b>. 
              Unlike "black box" trading bots that hide their logic, this system exposes every single decision parameter.
              It is designed specifically for the <b>Indian Stock Market (NSE)</b>, focusing on the Nifty 500 universe, 
              to identify high-probability swing trading setups that typically last from 2 days to 2 weeks.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <PhilosophyCard 
                title="Transparent Logic" 
                desc="Every strategy is defined in plain JavaScript. No hidden parameters or 'AI magic'—just pure, verifiable logic."
              />
              <PhilosophyCard 
                title="Local-First Performance" 
                desc="Market data is cached locally in a high-performance SQLite database, enabling instant scanning of 100+ stocks."
              />
              <PhilosophyCard 
                title="Risk-Centric" 
                desc="Every signal MUST generate a Stop Loss and Target. The system forces you to think about risk before reward."
              />
            </div>
          </div>
        </section>

        {/* Section 2: Technical Architecture */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Server className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">2. Technical Architecture</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-slate-600 mb-4">
                The application follows a <b>Hybrid Full-Stack Architecture</b>. The frontend handles visualization and strategy execution, 
                while the lightweight backend handles data fetching and caching.
              </p>
              <ul className="space-y-3">
                <ArchitectureItem label="Frontend" value="React 18 + Vite + TypeScript" />
                <ArchitectureItem label="Styling" value="Tailwind CSS + Lucide Icons" />
                <ArchitectureItem label="Charting" value="Recharts" />
                <ArchitectureItem label="Backend" value="Node.js + Express" />
                <ArchitectureItem label="Database" value="Better-SQLite3 (Local File)" />
                <ArchitectureItem label="Data Provider" value="Yahoo Finance API (via Proxy)" />
              </ul>
            </div>
            <div className="bg-slate-900 text-slate-300 p-6 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto shadow-inner">
              <pre>{`
[ User Browser ]
       |
       | (HTTP /api/history)
       v
[ Express Server (Port 3000) ]
       |
       +--- 1. Check Cache (SQLite)
       |         |
       |         +-> [ Return Data ] (Fast)
       |
       +--- 2. Cache Miss? -> [ Yahoo Finance API ]
                 |
                 +-> [ Save to SQLite ]
                 +-> [ Return Data ]
            `}</pre>
            </div>
          </div>
        </section>

        {/* Section 3: The Strategy Engine (Developer Guide) */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Code className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">3. Developer Guide: Writing Strategies</h2>
          </div>

          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 mb-6">
              Strategies are written in <b>JavaScript</b> and executed in a sandboxed environment. 
              You have access to three primary objects:
            </p>

            <div className="space-y-6">
              <CodeBlock 
                title="1. Input Data (data)"
                code={`
// Array of Candle objects
data = [
  { 
    date: "2023-01-01", 
    open: 100, 
    high: 105, 
    low: 99, 
    close: 102, 
    volume: 500000 
  },
  ...
]
// Access the latest candle: data[data.length - 1]
                `}
              />

              <CodeBlock 
                title="2. Indicators Library (indicators)"
                code={`
// Available functions:
const sma = indicators.sma(data, 50);   // Simple Moving Average
const ema = indicators.ema(data, 20);   // Exponential Moving Average
const rsi = indicators.rsi(data, 14);   // Relative Strength Index
const macd = indicators.macd(data);     // MACD (12, 26, 9)
                `}
              />

              <CodeBlock 
                title="3. Return Object (Signal)"
                code={`
// Your code MUST return this object if a signal is found:
return {
  signal: 'BUY',
  stopLoss: 95.50,   // Absolute price level
  target: 110.00,    // Absolute price level
  reason: 'RSI Divergence + SMA Crossover'
};

// Return null if no signal
return null;
                `}
              />
            </div>
          </div>
        </section>

        {/* Section 4: Data & Caching */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Database className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">4. Data Layer & Caching</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureBlock 
              title="Yahoo Finance Proxy"
              description="Direct browser calls to Yahoo Finance are blocked by CORS. We use a server-side proxy to fetch data safely."
              details={[
                "Source: Yahoo Finance (Unofficial API)",
                "Reliability: High for daily data",
                "Rate Limits: Handled by client-side chunking (5 requests/batch)"
              ]}
            />
            <FeatureBlock 
              title="SQLite Caching"
              description="To enable instant scanning, we store fetched data locally."
              details={[
                "Location: /data/market_data.db",
                "Schema: Table 'candles' (symbol, date, o, h, l, c, v)",
                "Policy: If data is < 24 hours old, serve from Cache. Otherwise, fetch fresh."
              ]}
            />
          </div>
        </section>

        {/* Section 5: Troubleshooting */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">5. Troubleshooting & FAQ</h2>
          </div>
          
          <div className="space-y-4">
            <FAQItem 
              q="Why do I see 'Failed to fetch data' for some symbols?" 
              a="This usually happens if the symbol name in our list doesn't match Yahoo Finance exactly (e.g., MCDOWELL-N vs UNITDSPR). It can also happen if Yahoo temporarily rate-limits your IP. Wait 5 minutes and try again." 
            />
            <FAQItem 
              q="Why is the scanner slow on the first run?" 
              a="The first time you scan, the system must download 2 years of history for 100 stocks from Yahoo. This takes time. The second time you run it, it will be instant because the data is loaded from the local database." 
            />
            <FAQItem 
              q="Can I trade directly from this app?" 
              a="No. This is an 'Architect' system—it helps you plan and design trades. Execution should be done on your broker's terminal (Zerodha, Upstox, etc.)." 
            />
          </div>
        </section>

        {/* Section 6: Installation & Running */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Terminal className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">6. Installation & Running</h2>
          </div>

          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 mb-6">
              To run this application locally on your machine, follow these steps:
            </p>

            <div className="space-y-6">
              <CodeBlock 
                title="1. Install Dependencies"
                code={`
# Open your terminal in the project folder
npm install
                `}
              />

              <CodeBlock 
                title="2. Start the Development Server"
                code={`
# This starts both the Frontend (Vite) and Backend (Express)
npm run dev
                `}
              />

              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-indigo-800 text-sm">
                <strong>Success!</strong> Once the server starts, open your browser and navigate to:
                <br/>
                <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="underline font-bold mt-1 inline-block">
                  http://localhost:3000
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PhilosophyCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function ArchitectureItem({ label, value }: { label: string, value: string }) {
  return (
    <li className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="text-slate-500 font-mono text-sm">{value}</span>
    </li>
  );
}

function CodeBlock({ title, code }: { title: string, code: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-slate-500" />
        {title}
      </h4>
      <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
        <pre className="text-indigo-300 font-mono text-sm">{code.trim()}</pre>
      </div>
    </div>
  );
}

function FeatureBlock({ title, description, details }: { title: string, description: string, details: string[] }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 mb-4 text-sm">{description}</p>
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
        <ul className="space-y-2">
          {details.map((detail, i) => (
            <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string, a: string }) {
  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200">
      <h4 className="font-bold text-slate-900 mb-2 flex items-start gap-2">
        <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" />
        {q}
      </h4>
      <p className="text-slate-600 text-sm pl-7">{a}</p>
    </div>
  );
}
