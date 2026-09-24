'use client';

// Toolbox — MT5 terminal panel: Trade / Exposure / Account History / News /
// Mailbox / Market / Signals / Journal tabs with live account summary.

import { useState } from 'react';
import { useApp } from '@/stores/app';
import { useQuotes } from '@/stores/quotes';
import { useTrading } from '@/stores/trading';
import { getSymbol } from '@/lib/symbols';
import { fmtMoney, fmtPrice, fmtVolume, fmtDateTime, fmtTime } from '@/lib/format';
import { positionProfit, positionMargin } from '@/lib/calc';
import { IconCross } from './icons';

type TbTab = 'trade' | 'exposure' | 'history' | 'news' | 'mailbox' | 'market' | 'signals' | 'journal';

const TABS: TbTab[] = ['trade', 'exposure', 'history', 'news', 'mailbox', 'market', 'signals', 'journal'];

export function Toolbox() {
  const [tab, setTab] = useState<TbTab>('trade');
  const app = useApp();

  return (
    <div className="mt-panel tb-panel">
      <div className="mt-panel-title">
        <span>Toolbox</span>
      </div>
      <div className="tb-tabs">
        {TABS.map((t) => (
          <span
            key={t}
            className={`tb-tab ${tab === t ? 'tb-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'trade' ? 'Trade' : t === 'history' ? 'Account History' : t[0].toUpperCase() + t.slice(1)}
          </span>
        ))}
        <span className="tb-tabs-spacer" />
        <span className="mt-title-icon" onClick={() => app.toggleToolbox()} title="Close">
          <IconCross size={10} />
        </span>
      </div>

      {tab === 'trade' && <TradeTab />}
      {tab === 'exposure' && <ExposureTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'news' && <NewsTab />}
      {tab === 'mailbox' && <MailboxTab />}
      {tab === 'market' && <EmptyTab text="No products available" />}
      {tab === 'signals' && <EmptyTab text="No signals available" />}
      {tab === 'journal' && <JournalTab />}
    </div>
  );
}

function useAccountSummary() {
  const quotes = useQuotes((s) => s.quotes);
  const trading = useTrading();
  const positions = trading.positions;
  const profit = positions.reduce((acc, p) => acc + positionProfit(p, quotes), 0);
  const margin = positions.reduce((acc, p) => acc + positionMargin(p, quotes), 0);
  const equity = trading.balance + profit;
  const free = equity - margin;
  const level = margin > 0 ? (equity / margin) * 100 : 0;
  return { balance: trading.balance, equity, margin, free, level, profit };
}

function TradeTab() {
  const app = useApp();
  const quotes = useQuotes((s) => s.quotes);
  const trading = useTrading();
  const summary = useAccountSummary();

  const posMenu = (e: React.MouseEvent, ticket: number) => {
    e.preventDefault();
    const pos = trading.positions.find((p) => p.ticket === ticket);
    const ts = pos?.ts ?? 0;
    app.openContextMenu(e.clientX, e.clientY, [
      { label: 'New Order', shortcut: 'F9', onClick: () => app.openDialog('newOrder') },
      { separator: true, label: '' },
      { label: 'Close Position', onClick: () => closePosition(ticket) },
      { label: 'Modify SL / TP', onClick: () => app.openDialog('modifySltp', String(ticket)) },
      {
        label: 'Trailing Stop',
        submenu: [
          { label: 'None', checked: ts === 0, onClick: () => trading.setTrailing(ticket, 0) },
          { label: '50 Points', checked: ts === 50, onClick: () => trading.setTrailing(ticket, 50) },
          { label: '100 Points', checked: ts === 100, onClick: () => trading.setTrailing(ticket, 100) },
          { label: '200 Points', checked: ts === 200, onClick: () => trading.setTrailing(ticket, 200) },
          { label: '400 Points', checked: ts === 400, onClick: () => trading.setTrailing(ticket, 400) },
        ],
      },
      { separator: true, label: '' },
      { label: 'Close All Positions', onClick: () => trading.positions.forEach((p) => closePosition(p.ticket)) },
    ]);
  };

  const pendMenu = (e: React.MouseEvent, ticket: number) => {
    e.preventDefault();
    app.openContextMenu(e.clientX, e.clientY, [
      { label: 'New Order', shortcut: 'F9', onClick: () => app.openDialog('newOrder') },
      { separator: true, label: '' },
      { label: 'Modify Order...', onClick: () => app.openDialog('modifyOrder', String(ticket)) },
      { label: 'Cancel Order', onClick: () => trading.cancelPending(ticket) },
    ]);
  };

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
    <div className="tb-body">
      <div className="tb-table-wrap">
        <table className="tb-table">
          <thead>
            <tr>
              <th className="tb-th">Symbol</th>
              <th className="tb-th">Ticket</th>
              <th className="tb-th">Time</th>
              <th className="tb-th">Type</th>
              <th className="tb-th">Volume</th>
              <th className="tb-th">Price</th>
              <th className="tb-th">S / L</th>
              <th className="tb-th">T / P</th>
              <th className="tb-th">Price</th>
              <th className="tb-th">Swap</th>
              <th className="tb-th">Profit</th>
              <th className="tb-th tb-th-x" />
            </tr>
          </thead>
          <tbody>
            {trading.positions.map((p) => {
              const info = getSymbol(p.symbol);
              const q = quotes[p.symbol];
              const cur = q ? (p.type === 'buy' ? q.bid : q.ask) : p.openPrice;
              const profit = positionProfit(p, quotes);
              return (
                <tr key={p.ticket} className="tb-row" onContextMenu={(e) => posMenu(e, p.ticket)}>
                  <td className="tb-cell">{p.symbol}</td>
                  <td className="tb-cell">{p.ticket}</td>
                  <td className="tb-cell">{fmtDateTime(p.openTime)}</td>
                  <td className={`tb-cell ${p.type === 'buy' ? 'mw-up' : 'mw-down'}`}>
                    {p.type === 'buy' ? 'buy' : 'sell'}
                  </td>
                  <td className="tb-cell">{fmtVolume(p.volume)}</td>
                  <td className="tb-cell">{fmtPrice(p.openPrice, info.digits)}</td>
                  <td className="tb-cell tb-dim">{p.sl ? `${fmtPrice(p.sl, info.digits)}${p.ts ? ' ·TS' : ''}` : ''}</td>
                  <td className="tb-cell tb-dim">{p.tp ? fmtPrice(p.tp, info.digits) : ''}</td>
                  <td className="tb-cell">{fmtPrice(cur, info.digits)}</td>
                  <td className="tb-cell">{p.swap.toFixed(2)}</td>
                  <td className={`tb-cell ${profit >= 0 ? 'mw-up' : 'mw-down'}`}>{fmtMoney(profit)}</td>
                  <td className="tb-cell tb-x">
                    <button className="tb-close-btn" title={`Close #${p.ticket}`} onClick={() => closePosition(p.ticket)}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {trading.pendings.map((o) => {
              const info = getSymbol(o.symbol);
              return (
                <tr
                  key={o.ticket}
                  className="tb-row tb-pending"
                  onContextMenu={(e) => pendMenu(e, o.ticket)}
                  onDoubleClick={() => app.openDialog('modifyOrder', String(o.ticket))}
                  title="Double-click to modify the order"
                >
                  <td className="tb-cell tb-symbol-cell">{o.symbol}</td>
                  <td className="tb-cell">{o.ticket}</td>
                  <td className="tb-cell">{fmtDateTime(o.openTime)}</td>
                  <td className={`tb-cell ${o.type.startsWith('buy') ? 'mw-up' : 'mw-down'}`}>{o.type}</td>
                  <td className="tb-cell">{fmtVolume(o.volume)}</td>
                  <td className="tb-cell">{fmtPrice(o.price, info.digits)}</td>
                  <td className="tb-cell tb-dim">{o.sl ? fmtPrice(o.sl, info.digits) : ''}</td>
                  <td className="tb-cell tb-dim">{o.tp ? fmtPrice(o.tp, info.digits) : ''}</td>
                  <td className="tb-cell tb-dim">—</td>
                  <td className="tb-cell">—</td>
                  <td className="tb-cell tb-dim">—</td>
                  <td className="tb-cell tb-x">
                    <button className="tb-close-btn" title={`Cancel #${o.ticket}`} onClick={() => trading.cancelPending(o.ticket)}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {trading.positions.length === 0 && trading.pendings.length === 0 && (
              <tr>
                <td className="tb-empty" colSpan={12}>
                  No positions — press F9 or use File → New Order to open a trade
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="tb-summary">
        <span>Balance: <b>{fmtMoney(summary.balance)} {trading.currency}</b></span>
        <span>Equity: <b>{fmtMoney(summary.equity)} {trading.currency}</b></span>
        <span>Margin: <b>{fmtMoney(summary.margin)} {trading.currency}</b></span>
        <span>Free margin: <b>{fmtMoney(summary.free)} {trading.currency}</b></span>
        <span>Margin level: <b>{summary.level > 0 ? `${summary.level.toFixed(2)}%` : '—'}</b></span>
        <span className={summary.profit >= 0 ? 'mw-up' : 'mw-down'}>
          Profit: <b>{fmtMoney(summary.profit)} {trading.currency}</b>
        </span>
      </div>
    </div>
  );
}

function ExposureTab() {
  const trading = useTrading();
  const agg: Record<string, number> = {};
  for (const p of trading.positions) {
    const signed = p.type === 'buy' ? p.volume : -p.volume;
    agg[p.symbol] = (agg[p.symbol] ?? 0) + signed;
  }
  const entries = Object.entries(agg);
  return (
    <div className="tb-body">
      <div className="tb-table-wrap">
        <table className="tb-table">
          <thead>
            <tr>
              <th className="tb-th">Symbol</th>
              <th className="tb-th">Net Position</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([sym, vol]) => (
              <tr key={sym} className="tb-row">
                <td className="tb-cell">{sym}</td>
                <td className={`tb-cell ${vol >= 0 ? 'mw-up' : 'mw-down'}`}>{fmtVolume(Math.abs(vol))} {vol >= 0 ? 'buy' : 'sell'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td className="tb-empty" colSpan={2}>No exposure</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTab() {
  const trading = useTrading();
  return (
    <div className="tb-body">
      <div className="tb-table-wrap">
        <table className="tb-table">
          <thead>
            <tr>
              <th className="tb-th">Time</th>
              <th className="tb-th">Deal</th>
              <th className="tb-th">Symbol</th>
              <th className="tb-th">Type</th>
              <th className="tb-th">Volume</th>
              <th className="tb-th">Open Price</th>
              <th className="tb-th">Close Price</th>
              <th className="tb-th">Commission</th>
              <th className="tb-th">Swap</th>
              <th className="tb-th">Profit</th>
              <th className="tb-th">Balance</th>
            </tr>
          </thead>
          <tbody>
            {trading.deals.map((d) => (
              <tr key={`${d.ticket}-${d.closeTime}`} className="tb-row">
                <td className="tb-cell">{fmtDateTime(d.closeTime)}</td>
                <td className="tb-cell">{d.ticket}</td>
                <td className="tb-cell">{d.symbol}</td>
                <td className={`tb-cell ${d.type === 'buy' ? 'mw-up' : 'mw-down'}`}>{d.type}</td>
                <td className="tb-cell">{fmtVolume(d.volume)}</td>
                <td className="tb-cell">{d.openPrice}</td>
                <td className="tb-cell">{d.closePrice}</td>
                <td className="tb-cell tb-dim">{d.commission.toFixed(2)}</td>
                <td className="tb-cell tb-dim">{d.swap.toFixed(2)}</td>
                <td className={`tb-cell ${d.profit >= 0 ? 'mw-up' : 'mw-down'}`}>{fmtMoney(d.profit)}</td>
                <td className="tb-cell">{fmtMoney(d.balanceAfter)}</td>
              </tr>
            ))}
            {trading.deals.length === 0 && (
              <tr><td className="tb-empty" colSpan={11}>No history yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NEWS = [
  { time: '09:14', title: 'Dollar slips as markets weigh Fed pause scenario', src: 'Reuters' },
  { time: '08:47', title: 'Gold holds near record on central bank demand', src: 'Bloomberg' },
  { time: '08:02', title: 'ECB officials signal patience on rate cuts', src: 'Dow Jones' },
  { time: '07:31', title: 'Oil steadies after weekly inventory draw', src: 'Reuters' },
  { time: '06:55', title: 'Nikkei leads Asian equities lower; yen flat', src: 'Nikkei' },
  { time: '06:20', title: 'Bitcoin consolidates above six figures', src: 'CoinDesk' },
];

function NewsTab() {
  return (
    <div className="tb-body">
      <div className="tb-table-wrap">
        <table className="tb-table">
          <thead>
            <tr>
              <th className="tb-th">Time</th>
              <th className="tb-th">Title</th>
              <th className="tb-th">Source</th>
            </tr>
          </thead>
          <tbody>
            {NEWS.map((n) => (
              <tr key={n.time} className="tb-row">
                <td className="tb-cell">{n.time}</td>
                <td className="tb-cell tb-news-title">{n.title}</td>
                <td className="tb-cell tb-dim">{n.src}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MailboxTab() {
  return (
    <div className="tb-body">
      <div className="tb-table-wrap">
        <table className="tb-table">
          <thead>
            <tr>
              <th className="tb-th">Time</th>
              <th className="tb-th">From</th>
              <th className="tb-th">Subject</th>
            </tr>
          </thead>
          <tbody>
            <tr className="tb-row">
              <td className="tb-cell">08:00</td>
              <td className="tb-cell">MetaQuotes Software Corp.</td>
              <td className="tb-cell">Welcome to MetaTrader 5 Demo</td>
            </tr>
            <tr className="tb-row">
              <td className="tb-cell">08:00</td>
              <td className="tb-cell">Terminal</td>
              <td className="tb-cell">Data feed: TradingView-API provider connected</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="tb-body">
      <div className="tb-table-wrap">
        <div className="tb-empty tb-empty-solo">{text}</div>
      </div>
    </div>
  );
}

function JournalTab() {
  const trading = useTrading();
  const entries = [...trading.journal].reverse();
  return (
    <div className="tb-body">
      <div className="tb-table-wrap">
        <table className="tb-table">
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className="tb-row">
                <td className="tb-cell tb-dim tb-nowrap">{fmtTime(e.time)}</td>
                <td className={`tb-cell ${e.level === 'error' ? 'mw-down' : e.level === 'trade' ? 'tb-journal-trade' : ''}`}>{e.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
