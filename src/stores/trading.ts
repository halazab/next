'use client';

// Demo trading account store — MT5-style positions, deals and journal.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { profitAt } from '@/lib/calc';
import { decideTrades } from '@/lib/trade-rules';

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
        // wait for the first server adoption check — avoids executing on
        // a stale copy right after the page loads
        if (!isSyncReady()) return;
        const st = get();
        if (st.positions.length === 0) return;

        const { closes, trail } = decideTrades(st.positions, [], quotes);

        // 1) S/L & T/P execution — closes at the stop price (MT5 server)
        for (const c of closes) {
          const pos = st.positions.find((p) => p.ticket === c.ticket);
          if (!pos) continue;
          get().closePosition(c.ticket, c.closePrice, profitAt(pos, c.closePrice, quotes));
          get().log(
            `${c.reason === 'sl' ? 'stop loss' : 'take profit'} hit #${pos.ticket} ${pos.symbol} — closed ${pos.volume.toFixed(2)} at ${c.closePrice}`,
            'trade',
          );
        }

        // 2) trailing-stop maintenance — S/L follows the price by `ts`
        //    points once the position is in profit by that distance;
        //    it never moves against the position
        if (trail.length > 0) {
          set((cur) => ({
            positions: cur.positions.map((p) => {
              const t = trail.find((x) => x.ticket === p.ticket);
              return t ? { ...p, sl: t.sl } : p;
            }),
          }));
        }
      },

      checkPendings: (quotes) => {
        if (!isSyncReady()) return;
        const st = get();
        if (st.pendings.length === 0) return;
        const { activations } = decideTrades([], st.pendings, quotes);
        if (activations.length === 0) return;
        const actTickets = new Set(activations.map((a) => a.ticket));
        const filled = st.pendings.filter((o) => actTickets.has(o.ticket));
        set((cur) => ({
          pendings: cur.pendings.filter((o) => !actTickets.has(o.ticket)),
        }));
        for (const f of filled) {
          const type: 'buy' | 'sell' = f.type.startsWith('buy') ? 'buy' : 'sell';
          get().openPosition({
            symbol: f.symbol,
            type,
            volume: f.volume,
            openPrice: f.price,
            sl: f.sl,
            tp: f.tp,
          });
          get().log(
            `order #${f.ticket} ${f.type} activated — opened #${ticketSeq - 1} ${type} ${f.volume.toFixed(2)} ${f.symbol} at ${f.price}`,
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

// ---------------------------------------------------------------------------
// Trade-server sync — lets the trade server execute pending orders, S/L,
// T/P and trailing stops while the platform (browser) is CLOSED:
//   • every change + a 3s heartbeat is pushed to /api/trading
//   • when heartbeats stop (platform closed) the server executor takes over
//   • on the next load the client adopts the server state, so deals made
//     while away appear in History / Journal
// ---------------------------------------------------------------------------

interface ServerSyncState {
  balance: number;
  currency: string;
  positions: Position[];
  pendings: PendingOrder[];
  deals: Deal[];
  notes: { id: number; t: number; text: string }[];
  updatedAt: number;
  execSeq: number;
}

let hydrated = false;
let localUpdatedAt = 0;
let seenExecSeq = 0;
let lastNoteId = 0;
let syncReady = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/** true once the first adoption check has completed */
export function isSyncReady(): boolean {
  return syncReady;
}

function syncPayload(): string {
  const st = useTrading.getState();
  return JSON.stringify({
    kind: 'client',
    clientUpdatedAt: localUpdatedAt,
    seenExecSeq,
    lastNoteId,
    state: {
      balance: st.balance,
      currency: st.currency,
      positions: st.positions,
      pendings: st.pendings,
      deals: st.deals,
    },
  });
}

async function pushNow(): Promise<void> {
  if (!syncReady) return;
  try {
    const res = await fetch('/api/trading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: syncPayload(),
      keepalive: true,
    });
    if (res.status === 409) {
      // client is stale (server executed trades while we were away) — adopt
      await adoptFromServer();
      return;
    }
    if (res.ok) {
      const data = (await res.json()) as { execSeq?: number };
      if (typeof data.execSeq === 'number') seenExecSeq = data.execSeq;
    }
  } catch {
    /* offline — the heartbeat retries */
  }
}

function schedulePush(): void {
  if (!syncReady || pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, 250);
}

/** fetch the server state and adopt it when the server is newer */
async function adoptFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/trading', { cache: 'no-store' });
    const data = (await res.json()) as { state: ServerSyncState | null };
    const srv = data.state;
    if (srv) {
      seenExecSeq = srv.execSeq ?? 0;
      if (srv.updatedAt > localUpdatedAt) {
        // restore the ticket sequence above any server-side ticket
        const maxUsed = Math.max(
          ...srv.positions.map((p) => p.ticket),
          ...srv.deals.map((d) => d.ticket),
          ...srv.pendings.map((o) => o.ticket),
          51_000_000,
        );
        ticketSeq = Math.max(ticketSeq, maxUsed + 1);

        const notes = srv.notes ?? [];
        if (notes.length > 0) lastNoteId = Math.max(lastNoteId, ...notes.map((n) => n.id));
        const prevDeals = useTrading.getState().deals.length;
        useTrading.setState((st) => ({
          balance: srv.balance,
          positions: srv.positions,
          pendings: srv.pendings,
          deals: srv.deals,
          journal: [
            ...st.journal,
            ...notes.map((n) => ({ time: n.t, text: n.text, level: 'trade' as const })),
            ...(notes.length > 0
              ? [{
                  time: Date.now(),
                  text: `platform was closed — trade server executed ${notes.length} action(s), ${srv.deals.length - prevDeals} new deal(s)`,
                  level: 'info' as const,
                }]
              : []),
          ],
        }));
        localUpdatedAt = Date.now();
      }
    }
  } catch {
    /* server unreachable — retry via heartbeat */
  } finally {
    if (!syncReady) {
      syncReady = true;
      void pushNow(); // announce ourselves → server executor goes back to sleep
    }
  }
}

if (typeof window !== 'undefined') {
  // localStorage persistence is synchronous — hydration is done by now
  hydrated = true;

  useTrading.subscribe(() => {
    if (!hydrated) return;
    localUpdatedAt = Date.now();
    schedulePush();
  });

  // adoption check on load — brings in anything executed while away
  void adoptFromServer();

  // heartbeat — keeps the server executor idle while the platform is open
  heartbeatTimer = setInterval(() => {
    void pushNow();
  }, 3000);

  // final state push when the page goes away (tab close / navigate)
  window.addEventListener('pagehide', () => {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/trading', new Blob([syncPayload()], { type: 'application/json' }));
    }
  });

  // instant re-sync when the tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pushNow();
  });
}

// keep the heartbeat timer referenced so bundlers never trim it
export function stopTradeHeartbeatForTests(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}
