// Shared trade-server decision rules — the single source of truth for
// pending-order activation, S/L & T/P execution and trailing-stop
// maintenance. Used by BOTH the client store (instant execution while
// the terminal is open) and the server executor (execution while the
// platform is closed), so behaviour is identical in both places.

import { getSymbol } from '@/lib/symbols';
import type { Position, PendingOrder, ActivationQuote } from '@/stores/trading';

export interface TradeDecisions {
  /** positions to close at a fixed price (S/L or T/P hit) */
  closes: { ticket: number; closePrice: number; reason: 'sl' | 'tp' }[];
  /** trailing-stop S/L updates */
  trail: { ticket: number; sl: number }[];
  /** pending orders whose activation condition is met (fill at order price) */
  activations: { ticket: number }[];
}

export function decideTrades(
  positions: Position[],
  pendings: PendingOrder[],
  quotes: Record<string, ActivationQuote>,
): TradeDecisions {
  const closes: TradeDecisions['closes'] = [];
  const trail: TradeDecisions['trail'] = [];
  const activations: TradeDecisions['activations'] = [];

  // ---- 1) S/L & T/P execution — close at the stop price (MT5 server) ----
  for (const p of positions) {
    const q = quotes[p.symbol];
    if (!q) continue;
    if (p.type === 'buy') {
      if (p.sl > 0 && q.bid <= p.sl) {
        closes.push({ ticket: p.ticket, closePrice: p.sl, reason: 'sl' });
        continue;
      }
      if (p.tp > 0 && q.bid >= p.tp) {
        closes.push({ ticket: p.ticket, closePrice: p.tp, reason: 'tp' });
        continue;
      }
    } else {
      if (p.sl > 0 && q.ask >= p.sl) {
        closes.push({ ticket: p.ticket, closePrice: p.sl, reason: 'sl' });
        continue;
      }
      if (p.tp > 0 && q.ask <= p.tp) {
        closes.push({ ticket: p.ticket, closePrice: p.tp, reason: 'tp' });
        continue;
      }
    }

    // ---- 2) trailing-stop maintenance (only for positions still open) ----
    // S/L follows the price by `ts` points once the position is in profit
    // by that distance; it never moves against the position
    if (!p.ts || p.ts <= 0) continue;
    const info = getSymbol(p.symbol);
    const point = 10 ** -info.digits;
    const dist = p.ts * point;
    if (p.type === 'buy') {
      if (q.bid - p.openPrice >= dist) {
        const newSl = Number((q.bid - dist).toFixed(info.digits));
        if (p.sl === 0 || newSl > p.sl + point / 2) trail.push({ ticket: p.ticket, sl: newSl });
      }
    } else {
      if (p.openPrice - q.ask >= dist) {
        const newSl = Number((q.ask + dist).toFixed(info.digits));
        if (p.sl === 0 || newSl < p.sl - point / 2) trail.push({ ticket: p.ticket, sl: newSl });
      }
    }
  }

  // ---- 3) pending-order activation (fills at the order price) ----
  for (const o of pendings) {
    const q = quotes[o.symbol];
    if (!q) continue;
    if (o.type === 'buy limit' && q.ask <= o.price) activations.push({ ticket: o.ticket });
    else if (o.type === 'buy stop' && q.ask >= o.price) activations.push({ ticket: o.ticket });
    else if (o.type === 'sell limit' && q.bid >= o.price) activations.push({ ticket: o.ticket });
    else if (o.type === 'sell stop' && q.bid <= o.price) activations.push({ ticket: o.ticket });
  }

  return { closes, trail, activations };
}
