'use client';

// Market Watch — MT5-identical panel: Symbols / Ticks / Details / Trade tabs,
// live tick flashes, symbol context menu and symbol management.

import { useMemo } from 'react';
import { useApp } from '@/stores/app';
import { useQuotes } from '@/stores/quotes';
import { useTrading } from '@/stores/trading';
import { SYMBOLS, getSymbol } from '@/lib/symbols';
import { fmtPrice, fmtTime } from '@/lib/format';
import { IconPin, IconCross } from './icons';

type MwTab = 'symbols' | 'ticks' | 'details' | 'trade';

function PriceCell({ value, dir, digits }: { value: number; dir: 1 | -1 | 0; digits: number }) {
  // flash animation restarts on every new price (key), fades out via CSS
  return (
    <td
      key={value}
      className={`mw-cell mw-price ${dir === 1 ? 'mw-flash-up' : dir === -1 ? 'mw-flash-down' : ''}`}
    >
      {fmtPrice(value, digits)}
    </td>
  );
}

function ArrowCell({ dir }: { dir: 1 | -1 | 0 }) {
  return (
    <td className={`mw-cell mw-arrow ${dir === 1 ? 'mw-up' : dir === -1 ? 'mw-down' : ''}`}>
      {dir === 1 ? '▲' : dir === -1 ? '▼' : '•'}
    </td>
  );
}

export function MarketWatch() {
  const app = useApp();
  const visibleSymbols = useQuotes((s) => s.visibleSymbols);
  const selectedSymbol = useQuotes((s) => s.selectedSymbol);
  const setSelected = useQuotes((s) => s.setSelected);
  const addSymbol = useQuotes((s) => s.addSymbol);
  const hideSymbol = useQuotes((s) => s.hideSymbol);
  const showAll = useQuotes((s) => s.showAll);
  const hideAll = useQuotes((s) => s.hideAll);
  const quotesAll = useQuotes((s) => s.quotes);
  const tickBuffers = useQuotes((s) => s.tickBuffers);
  const trading = useTrading();

  const rows = useMemo(
    () => visibleSymbols.filter((n) => SYMBOLS.some((s) => s.name === n)),
    [visibleSymbols],
  );

  const selected = selectedSymbol;
  const selInfo = getSymbol(selected);
  const selQuote = quotesAll[selected];

  const symbolMenu = (e: React.MouseEvent, name: string) => {
    e.preventDefault();
    setSelected(name);
    app.openContextMenu(e.clientX, e.clientY, [
      { label: 'New Order', onClick: () => app.openDialog('newOrder', name) },
      { label: 'Chart Window', onClick: () => app.setSymbol(name) },
      { separator: true, label: '' },
      { label: 'Symbols...', onClick: () => app.openDialog('symbols') },
      { separator: true, label: '' },
      { label: 'Hide', onClick: () => hideSymbol(name) },
      { label: 'Hide All', onClick: () => hideAll() },
      { label: 'Show All', onClick: () => showAll() },
    ]);
  };

  const openChartOrOrder = (name: string, dbl: boolean) => {
    setSelected(name);
    if (dbl) {
      app.setSymbol(name);
      trading.log(`chart ${name},${app.timeframe} opened`);
    }
  };

  return (
    <div className="mt-panel mw-panel">
      <div className="mt-panel-title">
        <span>Market Watch</span>
        <span className="mt-panel-title-icons">
          <span
            className="mt-title-icon mt-title-icon-active"
            title="Pin"
          >
            <IconPin pinned />
          </span>
          <span
            className="mt-title-icon"
            onClick={() => app.toggleMarketWatch()}
            title="Close"
          >
            <IconCross size={10} />
          </span>
        </span>
      </div>

      <div className="mw-tabs">
        {(['symbols', 'ticks', 'details', 'trade'] as MwTab[]).map((t) => (
          <span
            key={t}
            className={`mw-tab ${app.mwTab === t ? 'mw-tab-active' : ''}`}
            onClick={() => app.setMwTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </span>
        ))}
      </div>

      {app.mwTab === 'symbols' && (
        <div className="mw-table-wrap">
          <table className="mw-table">
            <thead>
              <tr>
                <th className="mw-th">Symbol</th>
                <th className="mw-th">Bid</th>
                <th className="mw-th">Ask</th>
                <th className="mw-th mw-arrow-th" />
              </tr>
            </thead>
            <tbody>
              {rows.map((name) => {
                const q = quotesAll[name];
                if (!q) return null;
                const info = getSymbol(name);
                return (
                  <tr
                    key={name}
                    className={`mw-row ${selected === name ? 'mw-row-selected' : ''}`}
                    onMouseDown={() => openChartOrOrder(name, false)}
                    onDoubleClick={() => openChartOrOrder(name, true)}
                    onContextMenu={(e) => symbolMenu(e, name)}
                  >
                    <td className="mw-cell mw-symbol">{name}</td>
                    <PriceCell value={q.bid} dir={q.dir} digits={info.digits} />
                    <PriceCell value={q.ask} dir={q.dir} digits={info.digits} />
                    <ArrowCell dir={q.dir} />
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="mw-empty" colSpan={4}>
                    No symbols — right-click and choose Show All
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {app.mwTab === 'ticks' && <TicksTab symbol={selected} buffer={tickBuffers[selected] ?? []} />}
      {app.mwTab === 'details' && (
        <div className="mw-details">
          <div className="mw-details-head">{selected}</div>
          <div className="mw-details-row"><span>Description</span><span>{selInfo.description}</span></div>
          <div className="mw-details-row"><span>Source</span><span className={selQuote?.source === 'tradingview' ? 'mw-tv' : 'mw-sim'}>{selQuote?.source === 'tradingview' ? 'TradingView feed' : 'Simulated feed'}</span></div>
          <div className="mw-details-row"><span>Digits</span><span>{selInfo.digits}</span></div>
          <div className="mw-details-row"><span>Bid</span><span>{selQuote ? fmtPrice(selQuote.bid, selInfo.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Ask</span><span>{selQuote ? fmtPrice(selQuote.ask, selInfo.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Day High</span><span>{selQuote ? fmtPrice(selQuote.high, selInfo.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Day Low</span><span>{selQuote ? fmtPrice(selQuote.low, selInfo.digits) : '—'}</span></div>
          <div className="mw-details-row"><span>Change</span><span className={(selQuote?.ch ?? 0) >= 0 ? 'mw-up' : 'mw-down'}>{selQuote ? `${selQuote.ch >= 0 ? '+' : ''}${fmtPrice(selQuote.ch, selInfo.digits)} (${selQuote.chp.toFixed(2)}%)` : '—'}</span></div>
          <div className="mw-details-row"><span>Contract Size</span><span>{selInfo.contractSize.toLocaleString('en-US')}</span></div>
          <div className="mw-details-row"><span>Spread</span><span>{fmtPrice(selInfo.spread, selInfo.digits)}</span></div>
        </div>
      )}
      {app.mwTab === 'trade' && (
        <div className="mw-trade-tab">
          {trading.positions.length === 0 && <div className="mw-empty">No positions</div>}
          {trading.positions.map((p) => (
            <div key={p.ticket} className="mw-details-row">
              <span className={p.type === 'buy' ? 'mw-up' : 'mw-down'}>{p.volume.toFixed(2)} {p.symbol}</span>
              <span>@ {p.openPrice}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mw-footer" onContextMenu={(e) => symbolMenu(e, selected)}>
        <span className="mw-footer-count">{rows.length} / {SYMBOLS.length}</span>
        <span className="mw-footer-hint">double-click a symbol to chart</span>
      </div>
    </div>
  );
}

/** Live tick table for the selected symbol (MT5 "Ticks" tab) — pure render */
function TicksTab({ symbol, buffer }: { symbol: string; buffer: { t: number; b: number; a: number }[] }) {
  const info = getSymbol(symbol);
  const ticks = [...buffer].reverse();
  return (
    <div className="mw-table-wrap">
      <table className="mw-table">
        <thead>
          <tr>
            <th className="mw-th">Time</th>
            <th className="mw-th">Bid</th>
            <th className="mw-th">Ask</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((tk, i) => {
            const newer = i > 0 ? ticks[i - 1] : null;
            const up = newer ? tk.b < newer.b : true;
            return (
              <tr key={`${tk.t}-${i}`} className="mw-row">
                <td className="mw-cell">{fmtTime(tk.t)}</td>
                <td className={`mw-cell ${up ? 'mw-up' : 'mw-down'}`}>{fmtPrice(tk.b, info.digits)}</td>
                <td className="mw-cell">{fmtPrice(tk.a, info.digits)}</td>
              </tr>
            );
          })}
          {ticks.length === 0 && (
            <tr><td className="mw-empty" colSpan={3}>Waiting for ticks…</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
