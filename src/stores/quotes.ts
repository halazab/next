'use client';

// Live quote store — consumes the server SSE stream fed by the
// TradingView-API hub (github.com/Mathieu2301/TradingView-API).

import { create } from 'zustand';
import { SYMBOLS } from '@/lib/symbols';
import { useTrading } from '@/stores/trading';

export interface TickRecord {
  t: number;
  b: number;
  a: number;
}

export interface LiveQuote {
  bid: number;
  ask: number;
  dir: 1 | -1 | 0;
  ch: number;
  chp: number;
  high: number;
  low: number;
  open: number;
  time: number;
  /** previous bid — used for tick-flash colouring */
  prevBid: number;
  source: 'tradingview' | 'simulated';
}

interface HubStatus {
  connected: boolean;
  source: 'tradingview' | 'simulated';
  tvSymbols: number;
}

interface QuotesState {
  quotes: Record<string, LiveQuote>;
  /** last N ticks per symbol (drives the Market Watch "Ticks" tab) */
  tickBuffers: Record<string, TickRecord[]>;
  status: HubStatus;
  /** ms timestamp of last received message */
  lastTickAt: number;
  visibleSymbols: string[];
  selectedSymbol: string;
  setSelected: (s: string) => void;
  setVisible: (names: string[]) => void;
  hideSymbol: (name: string) => void;
  addSymbol: (name: string) => void;
  showAll: () => void;
  hideAll: () => void;
  connect: () => void;
}

function seedQuotes(): Record<string, LiveQuote> {
  const out: Record<string, LiveQuote> = {};
  for (const s of SYMBOLS) {
    out[s.name] = {
      bid: s.basePrice,
      ask: s.basePrice + s.spread,
      dir: 0,
      ch: 0,
      chp: 0,
      high: s.basePrice,
      low: s.basePrice,
      open: s.basePrice,
      time: Date.now(),
      prevBid: s.basePrice,
      source: 'simulated',
    };
  }
  return out;
}

let started = false;

const emptyBuffers = () => Object.fromEntries(SYMBOLS.map((s) => [s.name, []]));

export const useQuotes = create<QuotesState>((set, get) => ({
  quotes: seedQuotes(),
  tickBuffers: emptyBuffers(),
  status: { connected: false, source: 'simulated', tvSymbols: 0 },
  lastTickAt: 0,
  visibleSymbols: SYMBOLS.filter((s) => s.visible).map((s) => s.name),
  selectedSymbol: 'EURUSD',
  setSelected: (s) => set({ selectedSymbol: s }),
  setVisible: (names) => set({ visibleSymbols: names }),
  hideSymbol: (name) => set({ visibleSymbols: get().visibleSymbols.filter((n) => n !== name) }),
  addSymbol: (name) => set((st) => ({
    visibleSymbols: st.visibleSymbols.includes(name) ? st.visibleSymbols : [...st.visibleSymbols, name],
  })),
  showAll: () => set({ visibleSymbols: SYMBOLS.map((s) => s.name) }),
  hideAll: () => set({ visibleSymbols: [] }),

  connect: () => {
    if (started || typeof window === 'undefined') return;
    started = true;

    const es = new EventSource('/api/quotes');
    (window as unknown as { __mt5ES?: EventSource }).__mt5ES = es;

    es.addEventListener('snapshot', (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data) as {
        quotes: Record<string, Record<string, number | string>>;
        status: HubStatus;
      };
      const quotes = { ...get().quotes };
      const buffers = { ...get().tickBuffers };
      for (const k of Object.keys(buffers)) if (!buffers[k]) buffers[k] = [];
      for (const [name, q] of Object.entries(msg.quotes)) {
        const prev = quotes[name];
        const bid = Number(q.b);
        quotes[name] = {
          bid,
          ask: Number(q.a),
          dir: q.d as 1 | -1 | 0,
          ch: Number(q.c),
          chp: Number(q.cp),
          high: Number(q.h),
          low: Number(q.l),
          open: Number(q.o),
          time: Number(q.t),
          prevBid: prev ? prev.bid : bid,
          source: q.s as 'tradingview' | 'simulated',
        };
        const buf = buffers[name];
        if (!buf.length || buf[buf.length - 1].b !== bid) {
          buf.push({ t: Number(q.t), b: bid, a: Number(q.a) });
          if (buf.length > 40) buf.shift();
        }
      }
      set({ quotes, tickBuffers: { ...buffers }, status: msg.status, lastTickAt: Date.now() });
      // SL/TP execution + trailing-stop maintenance + pending-order
      // activation run on every snapshot (MT5 trade-server behaviour)
      const tradingApi = useTrading.getState();
      tradingApi.checkStops(quotes);
      tradingApi.checkPendings(quotes);
    });

    es.addEventListener('quotes', (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data) as Record<string, Record<string, number | string>>;
      set((st) => {
        const quotes = { ...st.quotes };
        const buffers = { ...st.tickBuffers };
        for (const [name, q] of Object.entries(msg)) {
          const prev = quotes[name];
          if (!prev) continue;
          const bid = Number(q.b);
          quotes[name] = {
            ...prev,
            bid,
            ask: Number(q.a),
            dir: q.d as 1 | -1 | 0,
            ch: Number(q.c),
            chp: Number(q.cp),
            high: Number(q.h),
            low: Number(q.l),
            open: Number(q.o),
            time: Number(q.t),
            prevBid: prev.bid,
            source: q.s as 'tradingview' | 'simulated',
          };
          if (!buffers[name]) buffers[name] = [];
          const buf = buffers[name];
          if (!buf.length || buf[buf.length - 1].b !== bid) {
            buf.push({ t: Number(q.t), b: bid, a: Number(q.a) });
            if (buf.length > 40) buf.shift();
          }
        }
        return { quotes, tickBuffers: buffers, lastTickAt: Date.now() };
      });
      useTrading.getState().checkStops(get().quotes);
      useTrading.getState().checkPendings(get().quotes);
    });

    es.addEventListener('status', (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data) as HubStatus;
      set({ status: msg });
    });

    es.onerror = () => {
      set((st) => ({ status: { ...st.status, connected: false } }));
      // EventSource auto-reconnects
    };
  },
}));
