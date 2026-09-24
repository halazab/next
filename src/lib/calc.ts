// Trading math: position profit, margin and currency conversion helpers.
// Mirrors MT5 conventions for forex/CFD contracts.

import { getSymbol } from '@/lib/symbols';
import type { Position } from '@/stores/trading';

/** price of 1 unit of a currency in USD, derived from the live quotes */
export function baseToUsd(base: string, quotes: Record<string, { bid: number; ask: number }>): number {
  if (base === 'USD') return 1;
  if (base === 'XAU') return quotes.XAUUSD?.bid ?? 3868;
  if (base === 'XAG') return quotes.XAGUSD?.bid ?? 46.85;
  if (base === 'BTC') return quotes.BTCUSD?.bid ?? 113500;
  if (base === 'ETH') return quotes.ETHUSD?.bid ?? 4120;
  const direct = quotes[`${base}USD`];
  if (direct) return direct.bid;
  const inverse = quotes[`USD${base}`];
  if (inverse) return 1 / inverse.bid;
  return 1;
}

export interface QuoteLike {
  bid: number;
  ask: number;
}

/** floating profit in account currency (USD) for a position */
export function positionProfit(
  pos: Position,
  quotes: Record<string, QuoteLike>,
): number {
  const info = getSymbol(pos.symbol);
  const q = quotes[pos.symbol];
  if (!q) return 0;
  const dir = pos.type === 'buy' ? 1 : -1;
  // MT5 marks a position to market using the closing-side price:
  // buy closes by Bid, sell closes by Ask
  const closePrice = pos.type === 'buy' ? q.bid : q.ask;
  const diff = (closePrice - pos.openPrice) * dir;

  let profitInQuote = diff * info.contractSize * pos.volume;
  if (info.profitCurrency === 'QUOTE') {
    const quoteCcy = pos.symbol.slice(3, 6);
    profitInQuote *= baseToUsd(quoteCcy, quotes);
  }
  // 'USD' symbols are already quoted in USD
  return profitInQuote;
}

/** margin required by a position, in USD (leverage 1:100) */
export function positionMargin(
  pos: Position,
  quotes: Record<string, QuoteLike>,
): number {
  const info = getSymbol(pos.symbol);
  const q = quotes[pos.symbol];
  const refPrice = q ? (pos.type === 'buy' ? q.ask : q.bid) : pos.openPrice;
  const base = pos.symbol.slice(0, 3);

  // notional value of the position expressed in USD
  let notionalUsd: number;
  if (base === 'USD') {
    // USD-base pairs (USDJPY, USDCHF…): notional is fixed contract value
    notionalUsd = info.contractSize * pos.volume;
  } else if (info.profitCurrency === 'USD') {
    // base unit is directly priced in USD (EURUSD, XAUUSD, BTCUSD, indices)
    notionalUsd = info.contractSize * pos.volume * refPrice;
  } else {
    // crosses (EURJPY…): convert base-currency notional to USD
    notionalUsd = info.contractSize * pos.volume * baseToUsd(base, quotes);
  }
  return notionalUsd / 100; // leverage 1:100
}
