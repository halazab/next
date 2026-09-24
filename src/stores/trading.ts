'use client';

// Demo trading account store — MT5-style positions, deals and journal.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Position {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  openTime: number;
  sl: number;
  tp: number;
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

interface TradingState {
  account: number;
  balance: number;
  leverage: number;
  currency: string;
  positions: Position[];
  deals: Deal[];
  journal: JournalEntry[];
  nextTicket: number;
  openPosition: (p: Omit<Position, 'ticket' | 'openTime' | 'commission' | 'swap'>) => number;
  closePosition: (ticket: number, closePrice: number, profit: number) => void;
  modifyPosition: (ticket: number, sl: number, tp: number) => void;
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

      log: (text, level = 'info') => {
        set((st) => ({ journal: [...st.journal, { time: Date.now(), text, level }] }));
      },

      resetAccount: () => {
        set({ balance: 10000, positions: [], deals: [] });
        get().log('account reset to initial state');
      },
    }),
    {
      name: 'mt5-clone-account',
      partialize: (st) => ({
        balance: st.balance,
        positions: st.positions,
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
