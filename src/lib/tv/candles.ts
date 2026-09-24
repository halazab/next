// Candle history service — fetches OHLCV from TradingView chart sessions
// (@mathieuc/tradingview) with an in-memory cache, and falls back to a
// synthetic random-walk history seeded from the live quote hub price.

import { getSymbol, tfByLabel } from '@/lib/symbols';
import { hubReady } from './hub';

export interface Candle {
  /** epoch seconds (UTC) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleResult {
  candles: Candle[]; // chronological order (oldest first)
  source: 'tradingview' | 'simulated';
}

interface CacheEntry {
  candles: Candle[];
  source: 'tradingview' | 'simulated';
  fetchedAt: number;
}

const CACHE_TTL_MS = 20_000;
const cache = new Map<string, CacheEntry>();

function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** simulate a plausible OHLCV history that ends at `endPrice` */
function simulateHistory(symbolName: string, tfLabel: string, count: number): Candle[] {
  const info = getSymbol(symbolName);
  const tf = tfByLabel(tfLabel);

  // candles per day per timeframe, used to scale volatility
  const perDay: Record<string, number> = {
    M1: 1440, M5: 288, M15: 96, M30: 48, H1: 24, H4: 6, D1: 1, W1: 0.5, MN: 0.1,
  };
  const candlesPerDay = perDay[tfLabel] ?? 96;
  const barVol = info.vol / Math.sqrt(Math.max(candlesPerDay, 0.05));

  const nowSec = Math.floor(Date.now() / 1000);
  const lastBucket = Math.floor(nowSec / tf.seconds) * tf.seconds;

  // walk backwards from the current price, then reverse
  let price = hubPrice(symbolName);
  const out: Candle[] = [];
  for (let i = 0; i < count; i += 1) {
    const time = lastBucket - (count - 1 - i) * tf.seconds;
    const close = price;
    const open = close * (1 + barVol * gauss() * 0.55);
    const spread = Math.abs(close - open);
    const high = Math.max(open, close) + spread * Math.random() * 0.8 + close * barVol * 0.3 * Math.random();
    const low = Math.min(open, close) - spread * Math.random() * 0.8 - close * barVol * 0.3 * Math.random();
    const volume = Math.floor(
      (500 + Math.random() * 2500) * (candlesPerDay >= 24 ? 1 : candlesPerDay / 24 + 0.2),
    );
    out.push({
      time,
      open: round(open, info.digits),
      high: round(high, info.digits),
      low: round(low, info.digits),
      close: round(close, info.digits),
      volume,
    });
    price = open; // previous close = this open
  }
  out.reverse();
  return out;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function hubPrice(symbolName: string): number {
  // read the freshest hub price synchronously — hub is always seeded
  const g = globalThis as any;
  const hub = g.__mt5QuoteHub;
  const q = hub?.getQuote?.(symbolName);
  return q ? q.bid : getSymbol(symbolName).basePrice;
}

async function fetchTvCandles(
  symbolName: string,
  tfLabel: string,
  count: number,
): Promise<Candle[]> {
  const info = getSymbol(symbolName);
  const tf = tfByLabel(tfLabel);
  const hub = await hubReady();
  if (!hub.connected || !hub.client) throw new Error('tv-not-connected');

  const client = hub.client;
  const chart = new client.Session.Chart();

  const candles = await new Promise<Candle[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('tv-timeout')), 15_000);
    try {
      chart.onUpdate(() => {
        const periods = chart.periods as Array<Record<string, number>>;
        if (!periods || periods.length === 0) return;
        const mapped: Candle[] = periods.map((p) => ({
          time: p.time,
          open: p.open,
          high: p.max,
          low: p.min,
          close: p.close,
          volume: p.volume ?? 0,
        }));
        clearTimeout(timer);
        resolve(mapped);
      });
      chart.setMarket(info.tv, { timeframe: tf.tv, range: count });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });

  chart.delete();
  return candles.sort((a, b) => a.time - b.time);
}

export async function getCandles(
  symbolName: string,
  tfLabel: string,
  count = 500,
): Promise<CandleResult> {
  const key = `${symbolName}|${tfLabel}|${count}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { candles: hit.candles, source: hit.source };
  }

  try {
    const candles = await fetchTvCandles(symbolName, tfLabel, count);
    if (candles.length > 0) {
      cache.set(key, { candles, source: 'tradingview', fetchedAt: Date.now() });
      return { candles, source: 'tradingview' };
    }
    throw new Error('tv-empty');
  } catch {
    const candles = simulateHistory(symbolName, tfLabel, count);
    cache.set(key, { candles, source: 'simulated', fetchedAt: Date.now() });
    return { candles, source: 'simulated' };
  }
}
