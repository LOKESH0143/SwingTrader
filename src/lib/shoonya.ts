import crypto from 'crypto';

interface ShoonyaConfig {
  userId: string;
  password: string;
  twoFA: string; // TOTP Secret or DOB
  vendorCode: string;
  apiKey: string;
  imei?: string;
}

export class ShoonyaService {
  private baseUrl = 'https://api.shoonya.com/NorenWClientTP';
  private token: string | null = null;
  private config: ShoonyaConfig;

  constructor(config: ShoonyaConfig) {
    this.config = { ...config, imei: config.imei || 'abc1234' };
  }

  private sha256(input: string) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  private async request(endpoint: string, payload: any) {
    const params = new URLSearchParams();
    const jsonPayload = JSON.stringify(payload);
    params.append('jData', jsonPayload);
    
    if (this.token) {
        params.append('jKey', this.token);
    }

    console.log(`[Shoonya] Request: ${endpoint} | Payload: ${jsonPayload}`);

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Shoonya API Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.stat !== 'Ok') {
      throw new Error(`Shoonya Error: ${data.emsg || 'Unknown error'}`);
    }
    return data;
  }

  async login() {
    try {
      // 1. Hash Password
      const pwdHash = this.sha256(this.config.password);
      
      // 2. Generate App Key (UserId + ApiKey)
      const appKeyHash = this.sha256(`${this.config.userId}|${this.config.apiKey}`);

      const payload = {
        apkversion: 'js:1.0.0',
        uid: this.config.userId,
        pwd: pwdHash,
        factor2: this.config.twoFA,
        vc: this.config.vendorCode,
        appkey: appKeyHash,
        imei: this.config.imei,
        source: 'API'
      };

      console.log(`[Shoonya] Login Payload: uid=${payload.uid}, vc=${payload.vc}, source=${payload.source}`);

      const data = await this.request('QuickAuth', payload);
      this.token = data.susertoken;
      console.log('[Shoonya] Login Successful');
      return true;
    } catch (e: any) {
      console.error('[Shoonya] Login Failed:', e.message);
      throw e;
    }
  }

  async searchSymbol(symbol: string, exchange = 'NSE') {
    if (!this.token) await this.login();

    // Clean symbol (remove .NS)
    const cleanSymbol = symbol.replace('.NS', '').replace('.BSE', '');
    
    console.log(`[Shoonya] Searching for symbol: ${cleanSymbol} on ${exchange}`);

    const payload = {
      uid: this.config.userId,
      stext: cleanSymbol,
      exch: exchange
    };

    const data = await this.request('SearchScrip', payload);
    
    if (data.values && data.values.length > 0) {
      // Find exact match for Equity
      // Shoonya symbols are often "RELIANCE-EQ" or just "RELIANCE" depending on the feed
      const match = data.values.find((v: any) => 
        v.tsym === `${cleanSymbol}-EQ` || v.tsym === cleanSymbol
      );
      
      const selected = match || data.values[0];
      console.log(`[Shoonya] Found Token: ${selected.token} (${selected.tsym})`);
      return selected;
    }
    
    console.warn(`[Shoonya] Symbol not found: ${cleanSymbol}`);
    return null;
  }

  async getHistory(symbol: string, days: number) {
    if (!this.token) await this.login();

    // 1. Get Token
    let scrip;
    if (symbol === 'RELIANCE.NS') {
        // Hardcode for diagnostics to rule out search error
        scrip = { token: '2885', exch: 'NSE' };
        console.log('[Shoonya] Using Hardcoded Token for RELIANCE');
    } else {
        scrip = await this.searchSymbol(symbol);
    }

    if (!scrip) {
      throw new Error(`Symbol not found in Shoonya: ${symbol}`);
    }

    // 2. Calculate Time Range
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    // Shoonya TimeSeries format: 'dd-MM-yyyy HH:mm:ss' 
    // Some versions prefer seconds since epoch (string). Let's try that if standard format fails.
    
    const formatDate = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy} 09:15:00`;
    };
    
    const formatDateEnd = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy} 15:30:00`;
    };

    // Documentation says: TPSeries (or TPTimeSeries)
    // st = Start Time (seconds since 1 Jan 1970)
    // et = End Time (seconds since 1 Jan 1970)
    
    const startUnix = Math.floor(start.getTime() / 1000).toString();
    const endUnix = Math.floor(end.getTime() / 1000).toString();

    const payload = {
      uid: this.config.userId,
      exch: scrip.exch,
      token: scrip.token,
      st: startUnix,
      et: endUnix,
      intrv: 'd' // Try sending interval 'd' for daily, though docs didn't list it, it's usually required for candles
    };

    // Try TPTimeSeries first (Standard for History)
    try {
        const data = await this.request('TPTimeSeries', payload);
        if (data.stat === 'Ok' && Array.isArray(data.result)) {
             return this.mapShoonyaData(data.result);
        }
    } catch (e) {
        console.warn(`[Shoonya] TPTimeSeries failed, trying TPSeries...`);
    }

    // Fallback to TPSeries (As per user snippet)
    // Note: TPSeries might not accept 'intrv', let's try without it if needed, or keep it.
    
    const payloadTPSeries = {
      uid: this.config.userId,
      exch: scrip.exch,
      token: scrip.token,
      st: startUnix,
      et: endUnix
    };

    try {
        const data = await this.request('TPSeries', payloadTPSeries);
        if (data.stat === 'Ok' && Array.isArray(data.result)) {
             return this.mapShoonyaData(data.result);
        }
    } catch (e: any) {
         console.warn(`[Shoonya] TPSeries failed:`, e);
         throw new Error(`Shoonya API Error: ${e.message} (Token: ${scrip.token})`);
    }
    
    return [];
  }

  private mapShoonyaData(result: any[]) {
      return result.map((c: any) => {
            // Parse date "10-01-2023 00:00:00" -> ISO "2023-01-10"
            const [d, t] = c.time.split(' ');
            const [day, month, year] = d.split('-');
            const isoDate = `${year}-${month}-${day}`;
            
            return {
                date: isoDate,
                open: parseFloat(c.into),
                high: parseFloat(c.inth),
                low: parseFloat(c.intl),
                close: parseFloat(c.intc),
                volume: parseInt(c.intv || c.v || '0')
            };
        }).reverse();
  }
}
