// Server-side TradingView data hub.
// Uses github.com/Mathieu2301/TradingView-API (@mathieuc/tradingview) as the
// market data provider: one websocket Client, one QuoteSession streaming all
// MT5 symbols, plus a synthetic fallback feed so the terminal never freezes
// (weekend markets / network loss / TradingView throttling).

import { Client } from '@mathieuc/tradingview';
import { SYMBOLS, SYMBOL_MAP, type Quote } from '@/lib/symbols';

export type FeedSource = 'tradingview' | 'simulated';

export interface HubQuote extends Quote {
  source: FeedSource;
  volume: number;
  prev_close: number;
}

type Listener = (snapshot: Record<string, HubQuote>) => void;

function gauss(): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

class QuoteHub {
  client: Client | null = null;
  connected = false;
  connecting = false;

  quotes: Record<string, HubQuote> = {};
  /** symbols that received at least one real TradingView tick */
  private tvSeen = new Set<string>();
  private listeners = new Set<Listener>();
  private started = false;

  private simTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastTvPacket = 0;

  async ensureInit(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // seed every symbol with a static snapshot so the UI has data instantly
    for (const s of SYMBOLS) {
      const bid = s.basePrice;
      this.quotes[s.name] = {
        name: s.name,
        bid,
        ask: bid + s.spread,
        dir: 0,
        ch: 0,
        chp: 0,
        high: bid * 1.0008,
        low: bid * 0.9992,
        open: bid,
        time: Date.now(),
        volume: 0,
        prev_close: bid,
        source: 'simulated',
      };
    }

    this.startSim();
    this.connectTv();
  }

  // ---------------------------------------------------------------- TV feed
  private async connectTv(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const client = new Client({ DEBUG: false });
      this.client = client;

      client.onError((...args: unknown[]) => {
        console.error('[TVHub] client error:', ...args);
      });

      client.onDisconnected(() => {
        console.warn('[TVHub] disconnected from TradingView');
        this.connected = false;
        // attempt a full reconnect after a pause
        setTimeout(() => {
          this.connecting = false;
          this.connectTv();
        }, 10_000);
      });

      client.onConnected(() => {
        console.log('[TVHub] connected to TradingView data feed');
        this.connected = true;
        this.lastTvPacket = Date.now();
        this.subscribeAll(client);
      });

      // safety: if 'connected' never fires, allow retry
      setTimeout(() => {
        if (!this.connected) {
          this.connecting = false;
        }
      }, 15_000);
    } catch (e) {
      console.error('[TVHub] init failed:', e);
      this.connecting = false;
    }
  }

  private subscribeAll(client: Client): void {
    try {
      const qs = new client.Session.Quote({
        fields: [
          'lp', 'bid', 'ask', 'description', 'high_price', 'low_price',
          'open_price', 'prev_close_price', 'ch', 'chp', 'volume',
          'current_session', 'status',
        ],
      });

      for (const s of SYMBOLS) {
        const market = new qs.Market(s.tv);
        market.onData((d: Record<string, unknown>) => {
          this.lastTvPacket = Date.now();
          this.applyTv(s.name, d);
        });
        market.onError((...args: unknown[]) => {
          console.error(`[TVHub] market error ${s.name}:`, ...args);
        });
      }
    } catch (e) {
      console.error('[TVHub] subscribe failed:', e);
    }
  }

  private applyTv(name: string, d: Record<string, unknown>): void {
    const info = SYMBOL_MAP[name];
    if (!info) return;
    const q = this.quotes[name];
    const lp = typeof d.lp === 'number' ? d.lp : undefined;
    const bid = typeof d.bid === 'number' ? d.bid : undefined;
    const ask = typeof d.ask === 'number' ? d.ask : undefined;

    if (lp !== undefined) {
      q.dir = lp > q.bid ? 1 : lp < q.bid ? -1 : q.dir;
      q.bid = lp;
      q.ask = lp + info.spread;
    }
    if (bid !== undefined) q.bid = bid;
    if (ask !== undefined) q.ask = ask;

    if (typeof d.high_price === 'number') q.high = d.high_price;
    if (typeof d.low_price === 'number') q.low = d.low_price;
    if (typeof d.open_price === 'number') q.open = d.open_price;
    if (typeof d.ch === 'number') q.ch = d.ch;
    if (typeof d.chp === 'number') q.chp = d.chp;
    if (typeof d.volume === 'number') q.volume = d.volume;

    q.source = 'tradingview';
    this.tvSeen.add(name);
    q.time = Date.now();
  }

  // -------------------------------------------------------------- sim feed
  private startSim(): void {
    if (this.simTimer) return;

    // Watchdog: any symbol that TradingView has NOT delivered keeps running
    // on the synthetic engine (closed market, throttle etc.).
    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      if (this.connected && now - this.lastTvPacket > 60_000) {
        // websocket silent for 1 min — treat the whole feed as stale
        this.connected = false;
      }
      for (const s of SYMBOLS) {
        const q = this.quotes[s.name];
        if (!this.tvSeen.has(s.name) && q.source === 'simulated') {
          this.simTick(s.name);
        }
      }
    }, 1_500);

    this.simTimer = setInterval(() => {
      for (const s of SYMBOLS) {
        const q = this.quotes[s.name];
        if (q.source === 'simulated') this.simTick(s.name);
      }
    }, 500);
  }

  private simTick(name: string): void {
    const info = SYMBOL_MAP[name];
    if (!info) return;
    const q = this.quotes[name];
    const step = q.bid * info.vol * 0.006 * gauss();
    const newBid = Math.max(q.bid + step, info.basePrice * 0.2);
    q.dir = newBid > q.bid ? 1 : newBid < q.bid ? -1 : q.dir;
    q.bid = newBid;
    q.ask = newBid + info.spread;
    q.high = Math.max(q.high, newBid);
    q.low = Math.min(q.low, newBid);
    q.ch = newBid - q.open;
    q.chp = q.open !== 0 ? (q.ch / q.open) * 100 : 0;
    q.volume += Math.floor(Math.random() * 8);
    q.time = Date.now();
  }

  // ------------------------------------------------------------ subscribers
  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  snapshot(): Record<string, HubQuote> {
    return this.quotes;
  }

  getQuote(name: string): HubQuote | undefined {
    return this.quotes[name];
  }

  status(): { connected: boolean; source: FeedSource; tvSymbols: number } {
    let tvSymbols = 0;
    for (const s of SYMBOLS) if (this.quotes[s.name]?.source === 'tradingview') tvSymbols += 1;
    return {
      connected: this.connected,
      source: tvSymbols > 0 ? 'tradingview' : 'simulated',
      tvSymbols,
    };
  }

  emit(): void {
    const snap = this.quotes;
    this.listeners.forEach((l) => l(snap));
  }
}

declare global {
  var __mt5QuoteHub: QuoteHub | undefined;
}

export function getHub(): QuoteHub {
  if (!globalThis.__mt5QuoteHub) {
    globalThis.__mt5QuoteHub = new QuoteHub();
  }
  return globalThis.__mt5QuoteHub;
}

/** wait until the hub has been initialised (non-blocking call after first await) */
export async function hubReady(): Promise<QuoteHub> {
  const hub = getHub();
  await hub.ensureInit();
  return hub;
}
