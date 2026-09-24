'use client';

// MobileApp — responsive shell for phones (< 768px), modelled on the native
// MetaTrader 5 mobile app: top bar with account actions, full-screen
// Quotes / Charts / Trade / History screens and a bottom tab bar.
// The desktop terminal layout (MT5App) is completely untouched.

import { useMemo, useState } from 'react';
import { useApp } from '@/stores/app';
import { useQuotes } from '@/stores/quotes';
import { useTrading } from '@/stores/trading';
import { SYMBOLS, getSymbol, TIMEFRAMES } from '@/lib/symbols';
import { fmtMoney, fmtPrice, fmtVolume, fmtDateTime } from '@/lib/format';
import { positionProfit, positionMargin } from '@/lib/calc';
import {
  IconBars, IconCandles, IconLine, IconIndicators,
} from './icons';
import { GlobalContextMenu } from './ContextMenu';
import { Dialogs } from './dialogs/Dialogs';
import { ChartPanel } from './ChartPanel';

type MTab = 'quotes' | 'chart' | 'trade' | 'history';

// ---------------------------------------------------------------- tab icons

function IconTabQuotes({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3391ff' : '#8a8a8a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 20V6M4.8 9.2 8 6l3.2 3.2" />
      <path d="M16 4v14M12.8 14.8 16 18l3.2-3.2" />
    </svg>
  );
}

function IconTabChart({ active }: { active: boolean }) {
  const c = active ? '#3391ff' : '#8a8a8a';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <rect x="5" y="9" width="4" height="7" />
      <line x1="7" y1="4" x2="7" y2="20" />
      <rect x="14" y="6" width="4" height="8" />
      <line x1="16" y1="2" x2="16" y2="18" />
    </svg>
  );
}

function IconTabTrade({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3391ff' : '#8a8a8a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5" />
      <path d="M20 16H7M10.5 12.5 7 16l3.5 3.5" />
    </svg>
  );
}

function IconTabHistory({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3391ff' : '#8a8a8a'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 1.9" />
    </svg>
  );
}

// ---------------------------------------------------------------- helpers

function useAccountSummary() {
  const quotes = useQuotes((s) => s.quotes);
  const trading = useTrading();
  const profit = trading.positions.reduce((acc, p) => acc + positionProfit(p, quotes), 0);
  const margin = trading.positions.reduce((acc, p) => acc + positionMargin(p, quotes), 0);
  const equity = trading.balance + profit;
  const free = equity - margin;
  const level = margin > 0 ? (equity / margin) * 100 : 0;
  return { balance: trading.balance, equity, margin, free, level, profit };
}

// ---------------------------------------------------------------- shell

export function MobileApp() {
  const app = useApp();
  const quotes = useQuotes();
  const [tab, setTab] = useState<MTab>('quotes');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetSymbol, setSheetSymbol] = useState<string | null>(null);
  const [detailsSymbol, setDetailsSymbol] = useState<string | null>(null);

  const q = quotes.quotes[app.activeSymbol];
  const info = getSymbol(app.activeSymbol);

  return (
    <div className="mb-shell" onContextMenu={(e) => e.preventDefault()}>
      {/* ---- top bar ---- */}
      <div className="mb-header">
        <button className="mb-hbtn" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6.5" x2="20" y2="6.5" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17.5" x2="20" y2="17.5" />
          </svg>
        </button>

        <div className="mb-header-info" onClick={() => setTab('quotes')}>
          <div className="mb-header-sym">
            {app.activeSymbol}
            <span className={`mb-dot ${quotes.status.connected ? 'mb-dot-green' : 'mb-dot-orange'}`} />
          </div>
          <div className={`mb-header-price ${q && q.dir < 0 ? 'mw-down' : 'mw-up'}`}>
            {q ? fmtPrice(q.bid, info.digits) : '—'}
            {q && <span className="mb-header-chp">{q.chp >= 0 ? '+' : ''}{q.chp.toFixed(2)}%</span>}
          </div>
        </div>

        <button className="mb-hbtn mb-hbtn-plus" aria-label="New Order" onClick={() => app.openDialog('newOrder')}>
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {menuOpen && (
          <>
            <div className="mb-menu-overlay" onClick={() => setMenuOpen(false)} />
            <div className="mt-menu-list mb-menu">
              <div className="mt-menu-item" onClick={() => { setMenuOpen(false); app.openDialog('newOrder'); }}>
                <span className="mt-menu-check" />
                <span className="mt-menu-label">New Order</span>
                <span className="mt-menu-shortcut">F9</span>
              </div>
              <div className="mt-menu-item" onClick={() => { setMenuOpen(false); app.openDialog('symbols'); }}>
                <span className="mt-menu-check" />
                <span className="mt-menu-label">Symbols...</span>
              </div>
              <div className="mt-menu-sep" />
              <div className="mt-menu-item" onClick={() => { setMenuOpen(false); app.openDialog('about'); }}>
                <span className="mt-menu-check" />
                <span className="mt-menu-label">About</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- screen body ---- */}
      <div className="mb-body">
        {tab === 'quotes' && (
          <QuotesScreen
            onOpenSheet={setSheetSymbol}
            onOpenDetails={(s) => setDetailsSymbol(s)}
          />
        )}

        {tab === 'chart' && (
          <>
            <div className="mb-chips-row">
              <div className="mb-chips">
                {TIMEFRAMES.map((tf) => (
                  <span
                    key={tf.label}
                    className={`mb-chip ${app.timeframe === tf.label ? 'mb-chip-active' : ''}`}
                    onClick={() => app.setTimeframe(tf.label)}
                  >
                    {tf.label}
                  </span>
                ))}
              </div>
              <span className="mb-chips-sep" />
              <span
                className={`mb-chip mb-chip-icon ${app.chartType === 'bars' ? 'mb-chip-active' : ''}`}
                onClick={() => app.setChartType('bars')}
              >
                <IconBars size={15} />
              </span>
              <span
                className={`mb-chip mb-chip-icon ${app.chartType === 'candles' ? 'mb-chip-active' : ''}`}
                onClick={() => app.setChartType('candles')}
              >
                <IconCandles size={15} />
              </span>
              <span
                className={`mb-chip mb-chip-icon ${app.chartType === 'line' ? 'mb-chip-active' : ''}`}
                onClick={() => app.setChartType('line')}
              >
                <IconLine size={15} />
              </span>
              <span className="mb-chip mb-chip-icon" onClick={() => app.openDialog('indicators')}>
                <IconIndicators size={15} />
              </span>
            </div>
            <div className="mb-chart-holder">
              <ChartPanel />
            </div>
            <button className="mb-fab" aria-label="New Order" onClick={() => app.openDialog('newOrder')}>＋</button>
          </>
        )}

        {tab === 'trade' && <TradeScreen />}
        {tab === 'history' && <HistoryScreen />}

        {detailsSymbol && (
          <DetailsScreen symbol={detailsSymbol} onBack={() => setDetailsSymbol(null)} />
        )}
      </div>

      {/* ---- bottom tab bar ---- */}
      <div className="mb-tabbar">
        <button className={`mb-tab ${tab === 'quotes' ? 'mb-tab-active' : ''}`} onClick={() => setTab('quotes')}>
          <IconTabQuotes active={tab === 'quotes'} />
          <span className="mb-tab-label">Quotes</span>
        </button>
        <button className={`mb-tab ${tab === 'chart' ? 'mb-tab-active' : ''}`} onClick={() => setTab('chart')}>
          <IconTabChart active={tab === 'chart'} />
          <span className="mb-tab-label">Charts</span>
        </button>
        <button className={`mb-tab ${tab === 'trade' ? 'mb-tab-active' : ''}`} onClick={() => setTab('trade')}>
          <IconTabTrade active={tab === 'trade'} />
          <span className="mb-tab-label">Trade</span>
        </button>
        <button className={`mb-tab ${tab === 'history' ? 'mb-tab-active' : ''}`} onClick={() => setTab('history')}>
          <IconTabHistory active={tab === 'history'} />
          <span className="mb-tab-label">History</span>
        </button>
      </div>

      {/* ---- symbol action sheet ---- */}
      {sheetSymbol && (
        <QuoteSheet
          symbol={sheetSymbol}
          onClose={() => setSheetSymbol(null)}
          onChart={() => { app.setSymbol(sheetSymbol); setTab('chart'); setSheetSymbol(null); }}
          onDetails={() => { setDetailsSymbol(sheetSymbol); setSheetSymbol(null); }}
          onTraded={() => setTab('trade')}
        />
      )}

      <GlobalContextMenu />
      <Dialogs />
    </div>
  );
}

// ---------------------------------------------------------------- quotes

function QuotesScreen({
  onOpenSheet,
  onOpenDetails,
}: {
  onOpenSheet: (s: string) => void;
  onOpenDetails: (s: string) => void;
}) {
  const visibleSymbols = useQuotes((s) => s.visibleSymbols);
  const quotesAll = useQuotes((s) => s.quotes);
  const hideSymbol = useQuotes((s) => s.hideSymbol);
  const app = useApp();
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const rows = useMemo(
    () => visibleSymbols.filter((n) => SYMBOLS.some((s) => s.name === n)),
    [visibleSymbols],
  );

  return (
    <div className="mb-scroll">
      {rows.map((name) => {
        const q = quotesAll[name];
        if (!q) return null;
        const inf = getSymbol(name);
        return (
          <div key={name} className="mb-quote-row" onClick={() => onOpenSheet(name)} onDoubleClick={() => onOpenDetails(name)}>
            <div className="mb-quote-left">
              <div className="mb-quote-name">{name}</div>
              <div className={`mb-quote-sub ${(q.ch ?? 0) >= 0 ? 'mw-up' : 'mw-down'}`}>
                {q.chp >= 0 ? '+' : ''}{q.chp.toFixed(2)}%
                <span className="mb-quote-spread">spread {fmtPrice(inf.spread, inf.digits)}</span>
              </div>
            </div>
            <div className={`mb-qchip ${q.dir === 1 ? 'mb-qchip-up' : q.dir === -1 ? 'mb-qchip-down' : ''}`}>
              <span className={`mb-qchip-arrow ${q.dir === 1 ? 'mw-up' : q.dir === -1 ? 'mw-down' : ''}`}>
                {q.dir === 1 ? '▲' : q.dir === -1 ? '▼' : ''}
              </span>
              {fmtPrice(q.bid, inf.digits)}
            </div>
            <div className={`mb-qchip ${q.dir === 1 ? 'mb-qchip-up' : q.dir === -1 ? 'mb-qchip-down' : ''}`}>
              <span className={`mb-qchip-arrow ${q.dir === 1 ? 'mw-up' : q.dir === -1 ? 'mw-down' : ''}`}>
                {q.dir === 1 ? '▲' : q.dir === -1 ? '▼' : ''}
              </span>
              {fmtPrice(q.ask, inf.digits)}
            </div>
            <span
              className="mb-quote-more"
              onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === name ? null : name); }}
            >
              ⋮
            </span>
            {menuFor === name && (
              <>
                <div className="mb-menu-overlay" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                <div className="mt-menu-list mb-row-menu">
                  <div className="mt-menu-item" onClick={() => { setMenuFor(null); app.setSymbol(name); app.openDialog('newOrder', name); }}>
                    <span className="mt-menu-label">New Order</span>
                  </div>
                  <div className="mt-menu-item" onClick={() => { setMenuFor(null); app.setSymbol(name); }}>
                    <span className="mt-menu-label">Open Chart</span>
                  </div>
                  <div className="mt-menu-item" onClick={() => { setMenuFor(null); onOpenDetails(name); }}>
                    <span className="mt-menu-label">Details</span>
                  </div>
                  <div className="mt-menu-sep" />
                  <div className="mt-menu-item" onClick={() => { setMenuFor(null); hideSymbol(name); }}>
                    <span className="mt-menu-label">Hide</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <div className="mw-empty">No symbols — use ⋮ menu or Symbols… to add</div>}
    </div>
  );
}

// ---------------------------------------------------------------- sheet

function QuoteSheet({
  symbol,
  onClose,
  onChart,
  onDetails,
  onTraded,
}: {
  symbol: string;
  onClose: () => void;
  onChart: () => void;
  onDetails: () => void;
  onTraded: () => void;
}) {
  const app = useApp();
  const q = useQuotes((s) => s.quotes[symbol]);
  const hideSymbol = useQuotes((s) => s.hideSymbol);
  const trading = useTrading();
  const info = getSymbol(symbol);

  // one-click execution at the default volume — like the MT5 mobile app.
  // Returns to the Trade tab so the result is immediately visible.
  const instantTrade = (type: 'buy' | 'sell') => {
    if (!q) return;
    const price = type === 'buy' ? q.ask : q.bid;
    const ticket = trading.openPosition({ symbol, type, volume: 0.1, openPrice: price, sl: 0, tp: 0 });
    trading.log(`one-click #${ticket}: ${type} 0.10 ${symbol} at ${fmtPrice(price, info.digits)}`);
    onClose();
    onTraded();
    app.setSymbol(symbol);
  };

  return (
    <div className="mb-sheet-overlay" onClick={onClose}>
      <div className="mb-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mb-sheet-handle" />
        <div className="mb-sheet-head">
          <span className="mb-sheet-sym">{symbol}</span>
          <span className="mb-sheet-desc">{info.description}</span>
        </div>
        <div className="mb-sheet-prices">
          <div className="mb-sheet-price">
            <span className="mb-sheet-price-k">Bid</span>
            <span className="mw-down">{q ? fmtPrice(q.bid, info.digits) : '—'}</span>
          </div>
          <div className="mb-sheet-price">
            <span className="mb-sheet-price-k">Ask</span>
            <span className="mw-up">{q ? fmtPrice(q.ask, info.digits) : '—'}</span>
          </div>
        </div>
        <div className="mb-sheet-btns">
          <button
            className="mt-btn-sell"
            disabled={!q}
            onClick={() => instantTrade('sell')}
          >
            <span>SELL</span>
            <span className="no-price">{q ? fmtPrice(q.bid, info.digits) : '—'}</span>
          </button>
          <button
            className="mt-btn-buy"
            disabled={!q}
            onClick={() => instantTrade('buy')}
          >
            <span>BUY</span>
            <span className="no-price">{q ? fmtPrice(q.ask, info.digits) : '—'}</span>
          </button>
        </div>
        <div className="mb-sheet-hint">One-click · 0.10 lot market order</div>
        <div className="mb-sheet-actions">
          <button onClick={() => { app.openDialog('newOrder', symbol); onClose(); }}>New Order…</button>
          <button onClick={onChart}>Open Chart</button>
          <button onClick={onDetails}>Details</button>
          <button onClick={() => { hideSymbol(symbol); onClose(); }}>Hide</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- details

function DetailsScreen({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  const app = useApp();
  const q = useQuotes((s) => s.quotes[symbol]);
  const info = getSymbol(symbol);

  return (
    <div className="mb-details">
      <div className="mb-details-top">
        <button className="mb-hbtn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 5 7.5 12l7 7" />
          </svg>
        </button>
        <span className="mb-details-title">{symbol}</span>
      </div>
      <div className="mb-scroll">
        <div className="mw-details">
          <div className="mw-details-head">{info.description}</div>
          <div className="mw-details-row"><span>Source</span><span className={q?.source === 'tradingview' ? 'mw-tv' : 'mw-sim'}>{q?.source === 'tradingview' ? 'TradingView feed' : 'Simulated feed'}</span></div>
          <div className="mw-details-row"><span>Digits</span><span>{info.digits}</span></div>
          <div className="mw-details-row"><span>Bid</span><span>{q ? fmtPrice(q.bid, info.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Ask</span><span>{q ? fmtPrice(q.ask, info.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Day High</span><span>{q ? fmtPrice(q.high, info.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Day Low</span><span>{q ? fmtPrice(q.low, info.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Change</span><span className={(q?.ch ?? 0) >= 0 ? 'mw-up' : 'mw-down'}>{q ? `${q.ch >= 0 ? '+' : ''}${fmtPrice(q.ch, info.digits)} (${q.chp.toFixed(2)}%)` : '—'}</span></div>
          <div className="mw-details-row"><span>Contract Size</span><span>{info.contractSize.toLocaleString('en-US')}</span></div>
          <div className="mw-details-row"><span>Spread</span><span>{fmtPrice(info.spread, info.digits)}</span></div>
        </div>
        <div className="mb-details-btns">
          <button className="mt-btn" onClick={() => { app.setSymbol(symbol); onBack(); }}>Open Chart</button>
          <button className="mt-btn" onClick={() => { app.setSymbol(symbol); app.openDialog('newOrder', symbol); onBack(); }}>New Order</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- trade

function TradeScreen() {
  const quotes = useQuotes((s) => s.quotes);
  const trading = useTrading();
  const app = useApp();
  const summary = useAccountSummary();

  const closePosition = (ticket: number) => {
    const pos = trading.positions.find((p) => p.ticket === ticket);
    if (!pos) return;
    const q = quotes[pos.symbol];
    if (!q) return;
    const profit = positionProfit(pos, quotes);
    const closePrice = pos.type === 'buy' ? q.bid : q.ask;
    trading.closePosition(ticket, closePrice, profit);
  };

  return (
    <div className="mb-scroll">
      <div className="mb-acct">
        <div className="mb-acct-item"><span>Balance</span><b>{fmtMoney(summary.balance)} {trading.currency}</b></div>
        <div className="mb-acct-item"><span>Equity</span><b>{fmtMoney(summary.equity)} {trading.currency}</b></div>
        <div className="mb-acct-item"><span>Profit</span><b className={summary.profit >= 0 ? 'mw-up' : 'mw-down'}>{fmtMoney(summary.profit)} {trading.currency}</b></div>
        <div className="mb-acct-item"><span>Margin</span><b>{fmtMoney(summary.margin)} {trading.currency}</b></div>
        <div className="mb-acct-item"><span>Free margin</span><b>{fmtMoney(summary.free)} {trading.currency}</b></div>
        <div className="mb-acct-item"><span>Margin level</span><b>{summary.level > 0 ? `${summary.level.toFixed(2)}%` : '—'}</b></div>
      </div>

      {trading.pendings.length > 0 && (
        <div className="mb-sec-head">Pending Orders ({trading.pendings.length})</div>
      )}
      {trading.pendings.map((o) => {
        const inf = getSymbol(o.symbol);
        return (
          <div key={o.ticket} className="mb-pos mb-pending">
            <div className="mb-pos-row1">
              <span className="mb-pos-sym">{o.symbol}</span>
              <span className="mb-pos-dim">#{o.ticket}</span>
            </div>
            <div className="mb-pos-row2">
              <span className={o.type.startsWith('buy') ? 'mw-up' : 'mw-down'}>{o.type}</span>
              <span className="mb-pos-dim">{fmtVolume(o.volume)} @ {fmtPrice(o.price, inf.digits)}</span>
            </div>
            {(o.sl !== 0 || o.tp !== 0) && (
              <div className="mb-pos-row2">
                <span className="mb-pos-dim">
                  S/L {o.sl ? fmtPrice(o.sl, inf.digits) : '—'} · T/P {o.tp ? fmtPrice(o.tp, inf.digits) : '—'}
                </span>
              </div>
            )}
            <div className="mb-pos-actions">
              <button className="mb-act-btn" onClick={() => app.openDialog('modifyOrder', String(o.ticket))}>
                Modify
              </button>
              <button className="mb-act-btn mb-act-danger" onClick={() => trading.cancelPending(o.ticket)}>
                Cancel
              </button>
            </div>
          </div>
        );
      })}

      {trading.positions.map((p) => {
        const inf = getSymbol(p.symbol);
        const q = quotes[p.symbol];
        const cur = q ? (p.type === 'buy' ? q.bid : q.ask) : p.openPrice;
        const profit = positionProfit(p, quotes);
        return (
          <div key={p.ticket} className="mb-pos">
            <div className="mb-pos-row1">
              <span className="mb-pos-sym">{p.symbol}</span>
              <span className={`mb-pos-profit ${profit >= 0 ? 'mw-up' : 'mw-down'}`}>{fmtMoney(profit)} {trading.currency}</span>
            </div>
            <div className="mb-pos-row2">
              <span className={p.type === 'buy' ? 'mw-up' : 'mw-down'}>{p.type}</span>
              <span className="mb-pos-dim">{fmtVolume(p.volume)} @ {fmtPrice(p.openPrice, inf.digits)}</span>
              <span className="mb-pos-dim">→ {fmtPrice(cur, inf.digits)}</span>
            </div>
            {(p.sl || p.tp) && (
              <div className="mb-pos-row2">
                <span className="mb-pos-dim">
                  S/L {p.sl ? fmtPrice(p.sl, inf.digits) : '—'} · T/P {p.tp ? fmtPrice(p.tp, inf.digits) : '—'}
                </span>
              </div>
            )}
            <div className="mb-pos-actions">
              <button
                className="mb-act-btn"
                onClick={() => app.openDialog('modifySltp', String(p.ticket))}
              >
                S/L · T/P
              </button>
              <button
                className={`mb-act-btn ${p.ts ? 'mb-act-on' : ''}`}
                title="Trailing stop — distance in points"
                onClick={() => {
                  const next = !p.ts ? 50 : p.ts === 50 ? 100 : p.ts === 100 ? 200 : p.ts === 200 ? 400 : 0;
                  trading.setTrailing(p.ticket, next);
                }}
              >
                TS {p.ts || 'Off'}
              </button>
              <span className="mb-act-flex" />
              <button
                className="mb-pos-close"
                title={`Close #${p.ticket}`}
                onClick={() => closePosition(p.ticket)}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      {trading.positions.length === 0 && trading.pendings.length === 0 && (
        <div className="tb-empty tb-empty-solo">No positions — tap ＋ to open a trade</div>
      )}

      <button className="mb-fab" aria-label="New Order" onClick={() => app.openDialog('newOrder')}>＋</button>
    </div>
  );
}

// ---------------------------------------------------------------- history

function HistoryScreen() {
  const trading = useTrading();
  const deals = useMemo(() => [...trading.deals].reverse(), [trading.deals]);

  return (
    <div className="mb-scroll">
      {deals.map((d) => (
        <div key={`${d.ticket}-${d.closeTime}`} className="mb-pos">
          <div className="mb-pos-row1">
            <span className="mb-pos-sym">{d.symbol}</span>
            <span className={`mb-pos-profit ${d.profit >= 0 ? 'mw-up' : 'mw-down'}`}>{fmtMoney(d.profit)} {trading.currency}</span>
          </div>
          <div className="mb-pos-row2">
            <span className={d.type === 'buy' ? 'mw-up' : 'mw-down'}>{d.type}</span>
            <span className="mb-pos-dim">{fmtVolume(d.volume)} · {d.openPrice} → {d.closePrice}</span>
          </div>
          <div className="mb-pos-row2">
            <span className="mb-pos-dim">{fmtDateTime(d.closeTime)}</span>
            <span className="mb-pos-dim">balance {fmtMoney(d.balanceAfter)}</span>
          </div>
        </div>
      ))}
      {deals.length === 0 && (
        <div className="tb-empty tb-empty-solo">No history yet — closed deals appear here</div>
      )}
    </div>
  );
}
