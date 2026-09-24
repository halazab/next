'use client';

// Demo trading account store — MT5-style positions, deals and journal.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSymbol } from '@/lib/symbols';
import { profitAt } from '@/lib/calc';

export interface Position {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  openTime: number;
  sl: number;
  tp: number;
  /** trailing-stop distance in points (0/undefined = disabled) */
  ts?: number;
  commission: number;
  swap: number;
}

export interface Deal {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: number;
  closeTime: number;
  profit: number;
  commission: number;
  swap: number;
  balanceAfter: number;
}

export interface JournalEntry {
  time: number;
  text: string;
  level: 'info' | 'trade' | 'error';
}

export type PendingType = 'buy limit' | 'sell limit' | 'buy stop' | 'sell stop';

export interface PendingOrder {
  ticket: number;
  symbol: string;
  type: PendingType;
  volume: number;
  price: number;
  sl: number;
  tp: number;
  openTime: number;
}

/** minimal quote snapshot needed for pending-order activation */
export interface ActivationQuote {
  bid: number;
  ask: number;
}

interface TradingState {
  account: number;
  balance: number;
  leverage: number;
  currency: string;
  positions: Position[];
  pendings: PendingOrder[];
  deals: Deal[];
  journal: JournalEntry[];
  nextTicket: number;
  openPosition: (p: Omit<Position, 'ticket' | 'openTime' | 'commission' | 'swap'>) => number;
  closePosition: (ticket: number, closePrice: number, profit: number) => void;
  modifyPosition: (ticket: number, sl: number, tp: number) => void;
  placePending: (p: Omit<PendingOrder, 'ticket' | 'openTime'>) => number;
  cancelPending: (ticket: number) => void;
  /** modify an existing pending order (price / S/L / T/P) */
  modifyPending: (ticket: number, patch: { price?: number; sl?: number; tp?: number }) => void;
  /** enable / disable a trailing stop on a position (distance in points) */
  setTrailing: (ticket: number, points: number) => void;
  /** called on every quote batch — fills pending orders whose
   *  activation condition is met, at the order price (MT5 behaviour) */
  checkPendings: (quotes: Record<string, ActivationQuote>) => void;
  /** called on every quote batch — executes S/L & T/P levels and
   *  maintains trailing stops, exactly like the MT5 trade server */
  checkStops: (quotes: Record<string, ActivationQuote>) => void;
  log: (text: string, level?: JournalEntry['level']) => void;
  resetAccount: () => void;
}

let ticketSeq = 51_000_001;

export const useTrading = create<TradingState>()(
  persist(
    (set, get) => ({
      account: 51234567,
      balance: 10000,
      leverage: 100,
      currency: 'USD',
      positions: [],
      pendings: [],
      deals: [],
      journal: [],
      nextTicket: 51_000_001,

      openPosition: (p) => {
        const ticket = ticketSeq++;
        const pos: Position = {
          ...p,
          ticket,
          openTime: Date.now(),
          commission: 0,
          swap: 0,
        };
        set((st) => ({
          positions: [...st.positions, pos],
          journal: [
            ...st.journal,
            {
              time: Date.now(),
              text: `deal #${ticket} ${p.type === 'buy' ? 'buy' : 'sell'} ${p.volume.toFixed(2)} ${p.symbol} at ${p.openPrice} done`,
              level: 'trade' as const,
            },
          ],
        }));
        return ticket;
      },

      closePosition: (ticket, closePrice, profit) => {
        const pos = get().positions.find((p) => p.ticket === ticket);
        if (!pos) return;
        set((st) => ({
          positions: st.positions.filter((p) => p.ticket !== ticket),
          balance: st.balance + profit,
          deals: [
            {
              ticket,
              symbol: pos.symbol,
              type: pos.type,
              volume: pos.volume,
              openPrice: pos.openPrice,
              closePrice,
              openTime: pos.openTime,
              closeTime: Date.now(),
              profit,
              commission: pos.commission,
              swap: pos.swap,
              balanceAfter: st.balance + profit,
            },
            ...st.deals,
          ],
          journal: [
            ...st.journal,
            {
              time: Date.now(),
              text: `deal #${ticket} close ${pos.volume.toFixed(2)} ${pos.symbol} at ${closePrice} profit ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}`,
              level: 'trade' as const,
            },
          ],
        }));
      },

      modifyPosition: (ticket, sl, tp) => {
        set((st) => ({
          positions: st.positions.map((p) => (p.ticket === ticket ? { ...p, sl, tp } : p)),
          journal: [
            ...st.journal,
            {
              time: Date.now(),
              text: `position #${ticket} modified: SL ${sl || '—'} TP ${tp || '—'}`,
              level: 'trade' as const,
            },
          ],
        }));
      },

      placePending: (p) => {
        const ticket = ticketSeq++;
        const order: PendingOrder = { ...p, ticket, openTime: Date.now() };
        set((st) => ({
          pendings: [...st.pendings, order],
          journal: [
            ...st.journal,
            {
              time: Date.now(),
              text: `order #${ticket} placed: ${p.type} ${p.volume.toFixed(2)} ${p.symbol} at ${p.price}`,
              level: 'trade' as const,
            },
          ],
        }));
        return ticket;
      },

      cancelPending: (ticket) => {
        const order = get().pendings.find((o) => o.ticket === ticket);
        if (!order) return;
        set((st) => ({
          pendings: st.pendings.filter((o) => o.ticket !== ticket),
          journal: [
            ...st.journal,
            {
              time: Date.now(),
              text: `order #${ticket} canceled: ${order.type} ${order.volume.toFixed(2)} ${order.symbol}`,
              level: 'trade' as const,
            },
          ],
        }));
      },

      modifyPending: (ticket, patch) => {
        const order = get().pendings.find((o) => o.ticket === ticket);
        if (!order) return;
        const price = patch.price ?? order.price;
        set((st) => ({
          pendings: st.pendings.map((o) => (o.ticket === ticket ? { ...o, ...patch } : o)),
          journal: [
            ...st.journal,
            {
              time: Date.now(),
              text: `order #${ticket} modified: ${order.type} ${order.volume.toFixed(2)} ${order.symbol} at ${price}`,
              level: 'trade' as const,
            },
          ],
        }));
      },

      setTrailing: (ticket, points) => {
        const pos = get().positions.find((p) => p.ticket === ticket);
        if (!pos) return;
        set((st) => ({
          positions: st.positions.map((p) => (p.ticket === ticket ? { ...p, ts: points } : p)),
        }));
        get().log(
          points > 0
            ? `trailing stop ${points} points set on #${ticket} ${pos.symbol}`
            : `trailing stop disabled on #${ticket} ${pos.symbol}`,
        );
      },

      checkStops: (quotes) => {
        const st = get();
        if (st.positions.length === 0) return;

        // 1) S/L & T/P execution — closes at the stop price (MT5 server)
        for (const p of st.positions) {
          const q = quotes[p.symbol];
          if (!q) continue;
          if (p.type === 'buy') {
            if (p.sl > 0 && q.bid <= p.sl) {
              get().closePosition(p.ticket, p.sl, profitAt(p, p.sl, quotes));
              get().log(`stop loss hit #${p.ticket} ${p.symbol} — closed ${p.volume.toFixed(2)} at ${p.sl}`, 'trade');
              continue;
            }
            if (p.tp > 0 && q.bid >= p.tp) {
              get().closePosition(p.ticket, p.tp, profitAt(p, p.tp, quotes));
              get().log(`take profit hit #${p.ticket} ${p.symbol} — closed ${p.volume.toFixed(2)} at ${p.tp}`, 'trade');
              continue;
            }
          } else {
            if (p.sl > 0 && q.ask >= p.sl) {
              get().closePosition(p.ticket, p.sl, profitAt(p, p.sl, quotes));
              get().log(`stop loss hit #${p.ticket} ${p.symbol} — closed ${p.volume.toFixed(2)} at ${p.sl}`, 'trade');
              continue;
            }
            if (p.tp > 0 && q.ask <= p.tp) {
              get().closePosition(p.ticket, p.tp, profitAt(p, p.tp, quotes));
              get().log(`take profit hit #${p.ticket} ${p.symbol} — closed ${p.volume.toFixed(2)} at ${p.tp}`, 'trade');
              continue;
            }
          }
        }

        // 2) trailing-stop maintenance — S/L follows the price by `ts`
        //    points once the position is in profit by that distance;
        //    it never moves against the position
        for (const p of get().positions) {
          if (!p.ts || p.ts <= 0) continue;
          const q = quotes[p.symbol];
          if (!q) continue;
          const info = getSymbol(p.symbol);
          const point = 10 ** -info.digits;
          const dist = p.ts * point;
          if (p.type === 'buy') {
            if (q.bid - p.openPrice >= dist) {
              const newSl = Number((q.bid - dist).toFixed(info.digits));
              if (p.sl === 0 || newSl > p.sl + point / 2) {
                set((cur) => ({
                  positions: cur.positions.map((x) => (x.ticket === p.ticket ? { ...x, sl: newSl } : x)),
                }));
              }
            }
          } else {
            if (p.openPrice - q.ask >= dist) {
              const newSl = Number((q.ask + dist).toFixed(info.digits));
              if (p.sl === 0 || newSl < p.sl - point / 2) {
                set((cur) => ({
                  positions: cur.positions.map((x) => (x.ticket === p.ticket ? { ...x, sl: newSl } : x)),
                }));
              }
            }
          }
        }
      },

      checkPendings: (quotes) => {
        const st = get();
        if (st.pendings.length === 0) return;
        const filled: { order: PendingOrder; type: 'buy' | 'sell' }[] = [];
        for (const o of st.pendings) {
          const q = quotes[o.symbol];
          if (!q) continue;
          if (o.type === 'buy limit' && q.ask <= o.price) filled.push({ order: o, type: 'buy' });
          else if (o.type === 'buy stop' && q.ask >= o.price) filled.push({ order: o, type: 'buy' });
          else if (o.type === 'sell limit' && q.bid >= o.price) filled.push({ order: o, type: 'sell' });
          else if (o.type === 'sell stop' && q.bid <= o.price) filled.push({ order: o, type: 'sell' });
        }
        if (filled.length === 0) return;
        const filledTickets = new Set(filled.map((f) => f.order.ticket));
        set((cur) => ({
          pendings: cur.pendings.filter((o) => !filledTickets.has(o.ticket)),
        }));
        for (const f of filled) {
          get().openPosition({
            symbol: f.order.symbol,
            type: f.type,
            volume: f.order.volume,
            openPrice: f.order.price,
            sl: f.order.sl,
            tp: f.order.tp,
          });
          get().log(
            `order #${f.order.ticket} ${f.order.type} activated — opened #${ticketSeq - 1} ${f.type} ${f.order.volume.toFixed(2)} ${f.order.symbol} at ${f.order.price}`,
          );
        }
      },

      log: (text, level = 'info') => {
        set((st) => ({ journal: [...st.journal, { time: Date.now(), text, level }] }));
      },

      resetAccount: () => {
        set({ balance: 10000, positions: [], pendings: [], deals: [] });
        get().log('account reset to initial state');
      },
    }),
    {
      name: 'mt5-clone-account',
      partialize: (st) => ({
        balance: st.balance,
        positions: st.positions,
        pendings: st.pendings,
        deals: st.deals,
        journal: st.journal.slice(-200),
        account: st.account,
        leverage: st.leverage,
      }),
      onRehydrateStorage: () => (state) => {
        // restore ticket sequence above any persisted ticket
        if (state) {
          const maxUsed = Math.max(
            ...state.positions.map((p) => p.ticket),
            ...state.deals.map((d) => d.ticket),
            ...state.pendings.map((o) => o.ticket),
            51_000_000,
          );
          ticketSeq = Math.max(ticketSeq, maxUsed + 1);
        }
      },
    },
  ),
);

export function seedJournal(): JournalEntry[] {
  const t = Date.now();
  return [
    { time: t, text: 'MetaTrader 5 version 5000.400 build 4980 started', level: 'info' },
    { time: t, text: 'account 51234567 authorized (demo), leverage 1:100', level: 'info' },
    { time: t, text: "Network 'TradingView-API' connected — market data provider ready", level: 'info' },
  ];
}
