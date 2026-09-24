// MetaTrader 5 symbol catalog — mapped to TradingView data feeds
// (github.com/Mathieu2301/TradingView-API as data provider)

export type SymbolGroup = 'Forex' | 'Metals' | 'Crypto' | 'Indices' | 'Energies';

export interface SymbolInfo {
  /** MT5-style symbol name shown in Market Watch */
  name: string;
  /** TradingView full symbol id used as the data feed */
  tv: string;
  description: string;
  group: SymbolGroup;
  /** decimal digits used for price display */
  digits: number;
  /** contract size per 1.0 lot */
  contractSize: number;
  /** profit currency of the symbol (MT5 "profit currency") */
  profitCurrency: 'USD' | 'QUOTE' | 'BASE';
  /** typical starting price used by the offline simulator */
  basePrice: number;
  /** daily volatility fraction for the simulator */
  vol: number;
  /** typical bid/ask spread in price units */
  spread: number;
  /** default visible in Market Watch on first load */
  visible: boolean;
}

export const SYMBOLS: SymbolInfo[] = [
  // ---- Forex majors ----
  { name: 'EURUSD', tv: 'OANDA:EURUSD', description: 'Euro vs US Dollar', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'USD', basePrice: 1.1364, vol: 0.0045, spread: 0.00012, visible: true },
  { name: 'GBPUSD', tv: 'OANDA:GBPUSD', description: 'Great Britain Pound vs US Dollar', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'USD', basePrice: 1.3412, vol: 0.0050, spread: 0.00016, visible: true },
  { name: 'USDJPY', tv: 'OANDA:USDJPY', description: 'US Dollar vs Japanese Yen', group: 'Forex', digits: 3, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 146.82, vol: 0.0050, spread: 0.014, visible: true },
  { name: 'USDCHF', tv: 'OANDA:USDCHF', description: 'US Dollar vs Swiss Franc', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 0.7965, vol: 0.0045, spread: 0.00016, visible: true },
  { name: 'AUDUSD', tv: 'OANDA:AUDUSD', description: 'Australian Dollar vs US Dollar', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'USD', basePrice: 0.6610, vol: 0.0055, spread: 0.00018, visible: true },
  { name: 'USDCAD', tv: 'OANDA:USDCAD', description: 'US Dollar vs Canadian Dollar', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 1.3718, vol: 0.0042, spread: 0.0002, visible: true },
  { name: 'NZDUSD', tv: 'OANDA:NZDUSD', description: 'New Zealand Dollar vs US Dollar', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'USD', basePrice: 0.5880, vol: 0.0060, spread: 0.00025, visible: true },
  // ---- Crosses ----
  { name: 'EURJPY', tv: 'OANDA:EURJPY', description: 'Euro vs Japanese Yen', group: 'Forex', digits: 3, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 166.80, vol: 0.0055, spread: 0.018, visible: true },
  { name: 'GBPJPY', tv: 'OANDA:GBPJPY', description: 'Great Britain Pound vs Japanese Yen', group: 'Forex', digits: 3, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 196.95, vol: 0.0065, spread: 0.03, visible: true },
  { name: 'EURGBP', tv: 'OANDA:EURGBP', description: 'Euro vs Great Britain Pound', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 0.8471, vol: 0.0035, spread: 0.00016, visible: false },
  { name: 'AUDJPY', tv: 'OANDA:AUDJPY', description: 'Australian Dollar vs Japanese Yen', group: 'Forex', digits: 3, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 97.08, vol: 0.0065, spread: 0.025, visible: false },
  { name: 'EURCHF', tv: 'OANDA:EURCHF', description: 'Euro vs Swiss Franc', group: 'Forex', digits: 5, contractSize: 100000, profitCurrency: 'QUOTE', basePrice: 0.9051, vol: 0.0030, spread: 0.00018, visible: false },
  // ---- Metals ----
  { name: 'XAUUSD', tv: 'OANDA:XAUUSD', description: 'Gold vs US Dollar', group: 'Metals', digits: 2, contractSize: 100, profitCurrency: 'USD', basePrice: 3868.40, vol: 0.0090, spread: 0.3, visible: true },
  { name: 'XAGUSD', tv: 'OANDA:XAGUSD', description: 'Silver vs US Dollar', group: 'Metals', digits: 3, contractSize: 5000, profitCurrency: 'USD', basePrice: 46.850, vol: 0.0120, spread: 0.025, visible: true },
  // ---- Crypto ----
  { name: 'BTCUSD', tv: 'BINANCE:BTCUSDT', description: 'Bitcoin vs US Dollar', group: 'Crypto', digits: 2, contractSize: 1, profitCurrency: 'USD', basePrice: 113500.00, vol: 0.0250, spread: 8.0, visible: true },
  { name: 'ETHUSD', tv: 'BINANCE:ETHUSDT', description: 'Ethereum vs US Dollar', group: 'Crypto', digits: 2, contractSize: 1, profitCurrency: 'USD', basePrice: 4120.00, vol: 0.0300, spread: 0.8, visible: true },
  // ---- Indices ----
  { name: 'US30', tv: 'OANDA:US30USD', description: 'Dow Jones Industrial Average', group: 'Indices', digits: 2, contractSize: 1, profitCurrency: 'USD', basePrice: 46850.0, vol: 0.0070, spread: 2.5, visible: true },
  { name: 'NAS100', tv: 'OANDA:NAS100USD', description: 'US Tech 100 Index', group: 'Indices', digits: 2, contractSize: 1, profitCurrency: 'USD', basePrice: 24780.0, vol: 0.0090, spread: 1.5, visible: true },
  { name: 'GER40', tv: 'XETR:DAX', description: 'DAX Index', group: 'Indices', digits: 2, contractSize: 1, profitCurrency: 'USD', basePrice: 24310.0, vol: 0.0080, spread: 1.8, visible: false },
  { name: 'UK100', tv: 'LSE:UKX', description: 'FTSE 100 Index', group: 'Indices', digits: 2, contractSize: 1, profitCurrency: 'USD', basePrice: 9320.0, vol: 0.0060, spread: 1.5, visible: false },
  // ---- Energies ----
  { name: 'XTIUSD', tv: 'TVC:USOIL', description: 'Crude Oil WTI', group: 'Energies', digits: 3, contractSize: 1000, profitCurrency: 'USD', basePrice: 64.850, vol: 0.0160, spread: 0.04, visible: true },
  { name: 'XBRUSD', tv: 'TVC:UKOIL', description: 'Crude Oil Brent', group: 'Energies', digits: 3, contractSize: 1000, profitCurrency: 'USD', basePrice: 68.620, vol: 0.0150, spread: 0.04, visible: false },
];

export const SYMBOL_MAP: Record<string, SymbolInfo> = Object.fromEntries(
  SYMBOLS.map((s) => [s.name, s]),
);

export function getSymbol(name: string): SymbolInfo {
  const s = SYMBOL_MAP[name];
  if (!s) throw new Error(`Unknown symbol ${name}`);
  return s;
}

/** MT5 timeframe list (display name -> seconds + TradingView timeframe string) */
export const TIMEFRAMES = [
  { label: 'M1', seconds: 60, tv: '1' },
  { label: 'M5', seconds: 300, tv: '5' },
  { label: 'M15', seconds: 900, tv: '15' },
  { label: 'M30', seconds: 1800, tv: '30' },
  { label: 'H1', seconds: 3600, tv: '60' },
  { label: 'H4', seconds: 14400, tv: '240' },
  { label: 'D1', seconds: 86400, tv: 'D' },
  { label: 'W1', seconds: 604800, tv: 'W' },
  { label: 'MN', seconds: 2592000, tv: 'M' },
] as const;

export type TimeframeLabel = (typeof TIMEFRAMES)[number]['label'];

export function tfByLabel(label: string) {
  return TIMEFRAMES.find((t) => t.label === label) ?? TIMEFRAMES[2];
}

/** Quote snapshot for one symbol coming from the data hub */
export interface Quote {
  name: string;
  bid: number;
  ask: number;
  /** last tick direction: 1 up, -1 down, 0 flat */
  dir: 1 | -1 | 0;
  /** change vs daily open, absolute + percent */
  ch: number;
  chp: number;
  high: number;
  low: number;
  open: number;
  /** last update epoch ms */
  time: number;
}
