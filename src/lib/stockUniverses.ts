import { NIFTY_500_SYMBOLS } from './nifty500';

export type StockUniverse = 'NIFTY_50' | 'NIFTY_100' | 'BANKING' | 'IT' | 'AUTO' | 'PHARMA' | 'FMCG' | 'ENERGY' | 'METAL' | 'INFRA';

export const STOCK_UNIVERSES: Record<StockUniverse, { name: string; symbols: string[] }> = {
  NIFTY_50: {
    name: 'Nifty 50',
    symbols: NIFTY_500_SYMBOLS.slice(0, 50)
  },
  NIFTY_100: {
    name: 'Nifty 100',
    symbols: NIFTY_500_SYMBOLS.slice(0, 100)
  },
  BANKING: {
    name: 'Banking & Finance',
    symbols: [
      "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS", 
      "BAJFINANCE.NS", "BAJAJFINSV.NS", "HDFCLIFE.NS", "SBILIFE.NS", "INDUSINDBK.NS", 
      "BANKBARODA.NS", "SBICARD.NS", "ICICIPRULI.NS", "CHOLAFIN.NS", "ICICIGI.NS", 
      "CANBK.NS", "PNB.NS", "IDBI.NS", "UNIONBANK.NS"
    ]
  },
  IT: {
    name: 'IT Sector',
    symbols: [
      "TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS", 
      "LTIM.NS", "PERSISTENT.NS", "NAUKRI.NS"
    ]
  },
  AUTO: {
    name: 'Auto Sector',
    symbols: [
      "MARUTI.NS", "M&M.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", 
      "BAJAJ-AUTO.NS", "TVSMOTOR.NS", "BOSCHLTD.NS", "MOTHERSON.NS"
    ]
  },
  PHARMA: {
    name: 'Pharma & Healthcare',
    symbols: [
      "SUNPHARMA.NS", "CIPLA.NS", "DRREDDY.NS", "DIVISLAB.NS", "APOLLOHOSP.NS", 
      "TORNTPHARM.NS", "ALKEM.NS"
    ]
  },
  FMCG: {
    name: 'FMCG',
    symbols: [
      "HINDUNILVR.NS", "ITC.NS", "BRITANNIA.NS", "TATACONSUM.NS", "NESTLEIND.NS", 
      "DABUR.NS", "GODREJCP.NS", "VBL.NS", "MARICO.NS", "JUBLFOOD.NS", "UNITDSPR.NS"
    ]
  },
  ENERGY: {
    name: 'Energy & Power',
    symbols: [
      "RELIANCE.NS", "NTPC.NS", "POWERGRID.NS", "ONGC.NS", "COALINDIA.NS", 
      "BPCL.NS", "ADANIGREEN.NS", "IOC.NS", "GAIL.NS", "JSWENERGY.NS"
    ]
  },
  METAL: {
    name: 'Metals',
    symbols: [
      "JSWSTEEL.NS", "TATASTEEL.NS", "HINDALCO.NS", "VEDL.NS", "JINDALSTEL.NS"
    ]
  },
  INFRA: {
    name: 'Infra & Construction',
    symbols: [
      "LT.NS", "ADANIENT.NS", "ADANIPORTS.NS", "ULTRACEMCO.NS", "GRASIM.NS", 
      "AMBUJACEM.NS", "SHREECEM.NS", "ABB.NS", "SIEMENS.NS", "BEL.NS", 
      "HAL.NS", "DLF.NS", "LODHA.NS", "ASTRAL.NS", "POLYCAB.NS"
    ]
  }
};
