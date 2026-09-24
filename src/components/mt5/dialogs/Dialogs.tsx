'use client';

// MT5 dialogs — New Order, Chart Properties (authentic MT5 color presets),
// Moving Average, Indicator List, Symbols manager, Modify SL/TP, About.

import { useEffect, useState } from 'react';
import { useApp, SCHEMES, type SchemeKey } from '@/stores/app';
import { useQuotes } from '@/stores/quotes';
import { useTrading } from '@/stores/trading';
import { SYMBOLS, getSymbol } from '@/lib/symbols';
import { fmtPrice } from '@/lib/format';
import { IconMT5, IconCross } from '../icons';

function DialogShell({
  title,
  children,
  onClose,
  width = 420,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="mt-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mt-dialog" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mt-dialog-title">
          <span>{title}</span>
          <span className="mt-title-icon" onClick={onClose}>
            <IconCross size={10} />
          </span>
        </div>
        <div className="mt-dialog-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- New Order
export function NewOrderDialog({ preselect }: { preselect: string | null }) {
  const app = useApp();
  const quotes = useQuotes((s) => s.quotes);
  const trading = useTrading();
  const [symbol, setSymbol] = useState(preselect ?? app.activeSymbol);
  const info = getSymbol(symbol);
  const q = quotes[symbol];

  const [volume, setVolume] = useState('0.10');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const vol = Math.max(0.01, Math.min(100, parseFloat(volume) || 0.01));

  const submit = (type: 'buy' | 'sell') => {
    setError('');
    if (!q) return;
    const price = type === 'buy' ? q.ask : q.bid;
    const slV = parseFloat(sl);
    const tpV = parseFloat(tp);

    if (sl) {
      if (type === 'buy' && slV >= q.bid) return setError('For BUY orders S/L must be below Bid');
      if (type === 'sell' && slV <= q.ask) return setError('For SELL orders S/L must be above Ask');
    }
    if (tp) {
      if (type === 'buy' && tpV <= q.ask) return setError('For BUY orders T/P must be above Ask');
      if (type === 'sell' && tpV >= q.bid) return setError('For SELL orders T/P must be below Bid');
    }

    const ticket = trading.openPosition({
      symbol,
      type,
      volume: vol,
      openPrice: price,
      sl: slV || 0,
      tp: tpV || 0,
    });
    trading.log(`order #${ticket} opened: ${type} ${vol.toFixed(2)} ${symbol} at ${fmtPrice(price, info.digits)}`);
    app.closeDialog();
  };

  return (
    <DialogShell title={`Order — ${symbol}`} onClose={() => app.closeDialog()} width={470}>
      <div className="no-grid">
        <label>Symbol</label>
        <select className="mt-input" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {SYMBOLS.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>

        <label>Volume</label>
        <div className="no-stepper">
          <button onClick={() => setVolume((v) => (Math.max(0.01, (parseFloat(v) || 0.1) - 0.01)).toFixed(2))}>−</button>
          <input className="mt-input" value={volume} onChange={(e) => setVolume(e.target.value)} />
          <button onClick={() => setVolume((v) => (Math.min(100, (parseFloat(v) || 0.1) + 0.01)).toFixed(2))}>+</button>
        </div>

        <label>Stop Loss</label>
        <input className="mt-input" placeholder={q ? fmtPrice(q.bid - 50 * (info.spread || info.basePrice * 0.0001), info.digits) : ''} value={sl} onChange={(e) => setSl(e.target.value)} />
        <label>Take Profit</label>
        <input className="mt-input" placeholder="" value={tp} onChange={(e) => setTp(e.target.value)} />

        <label>Comment</label>
        <input className="mt-input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={27} />

        <label>Type</label>
        <div className="mt-input mt-input-static">Instant Execution</div>
      </div>

      {error && <div className="no-error">{error}</div>}

      <div className="no-buttons">
        <button className="mt-btn mt-btn-sell" onClick={() => submit('sell')} disabled={!q}>
          <span>Sell</span>
          <span className="no-price">{q ? fmtPrice(q.bid, info.digits) : '—'}</span>
        </button>
        <button className="mt-btn mt-btn-buy" onClick={() => submit('buy')} disabled={!q}>
          <span>Buy</span>
          <span className="no-price">{q ? fmtPrice(q.ask, info.digits) : '—'}</span>
        </button>
      </div>
      <div className="no-footnote">
        Market order · leverage 1:100 · demo account — profit currency {info.profitCurrency === 'USD' ? 'USD' : symbol.slice(3, 6)}
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- Properties
export function PropertiesDialog() {
  const app = useApp();
  const [local, setLocal] = useState<SchemeKey>(app.scheme);
  const [localGrid, setLocalGrid] = useState(app.grid);
  const [localSep, setLocalSep] = useState(app.separators);

  const apply = () => {
    app.setScheme(local);
    if (localGrid !== app.grid) app.toggleGrid();
    if (localSep !== app.separators) app.toggleSeparators();
    app.closeDialog();
  };

  return (
    <DialogShell title="Chart Properties — Colors" onClose={() => app.closeDialog()} width={430}>
      <div className="prop-grid">
        <div className="prop-scheme-list">
          {Object.values(SCHEMES).map((s) => (
            <button
              key={s.key}
              className={`prop-scheme ${local === s.key ? 'prop-scheme-active' : ''}`}
              onClick={() => setLocal(s.key)}
            >
              <span
                className="prop-preview"
                style={{ background: s.bg }}
              >
                <span style={{ background: s.bearBody, border: `1px solid ${s.bullBorder}` }} />
                <span style={{ background: s.bg, border: `1px solid ${s.bullBorder}` }} />
                <span style={{ background: s.bearBody, border: `1px solid ${s.bearBody}` }} />
              </span>
              {s.title}
            </button>
          ))}
        </div>
        <div className="prop-checks">
          <label>
            <input type="checkbox" checked={localGrid} onChange={(e) => setLocalGrid(e.target.checked)} /> Show grid
          </label>
          <label>
            <input type="checkbox" checked={localSep} onChange={(e) => setLocalSep(e.target.checked)} /> Period separators
          </label>
        </div>
      </div>
      <div className="mt-dialog-buttons">
        <button className="mt-btn" onClick={apply}>OK</button>
        <button className="mt-btn" onClick={() => app.closeDialog()}>Cancel</button>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- Moving Average
export function IndicatorsDialog() {
  const app = useApp();
  const trading = useTrading();
  const [period, setPeriod] = useState(14);
  const [method, setMethod] = useState<'sma' | 'ema'>('sma');
  const [color, setColor] = useState('#FF9800');

  const add = () => {
    const ind = {
      id: `ma-${Date.now()}`,
      type: 'ma' as const,
      label: `MA(${period})`,
      period,
      method,
      color,
    };
    app.addIndicator(ind);
    trading.log(`indicator ${ind.label} (${method.toUpperCase()}) added to ${app.activeSymbol}`);
    app.closeDialog();
  };

  return (
    <DialogShell title="Moving Average" onClose={() => app.closeDialog()} width={380}>
      <div className="no-grid">
        <label>Period</label>
        <input className="mt-input" type="number" min={2} max={500} value={period} onChange={(e) => setPeriod(Math.max(2, Math.min(500, parseInt(e.target.value) || 14)))} />
        <label>Method</label>
        <select className="mt-input" value={method} onChange={(e) => setMethod(e.target.value as 'sma' | 'ema')}>
          <option value="sma">Simple</option>
          <option value="ema">Exponential</option>
        </select>
        <label>Color</label>
        <input className="mt-input mt-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <label>Apply to</label>
        <div className="mt-input mt-input-static">Close</div>
      </div>
      <div className="mt-dialog-buttons">
        <button className="mt-btn" onClick={add}>Add</button>
        <button className="mt-btn" onClick={() => app.closeDialog()}>Cancel</button>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- Indicator List
export function IndicatorListDialog() {
  const app = useApp();
  const trading = useTrading();
  return (
    <DialogShell title="Indicators on chart" onClose={() => app.closeDialog()} width={380}>
      <div className="ind-list">
        {app.indicators.length === 0 && <div className="tb-empty">No indicators on the current chart</div>}
        {app.indicators.map((ind) => (
          <div key={ind.id} className="ind-row">
            <span className="ind-dot" style={{ background: ind.color }} />
            <span>{ind.label} · {ind.method.toUpperCase()}</span>
            <button
              className="mt-btn mt-btn-sm"
              onClick={() => {
                app.removeIndicator(ind.id);
                trading.log(`indicator ${ind.label} removed`);
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <div className="mt-dialog-buttons">
        <button className="mt-btn" onClick={() => { app.closeDialog(); app.openDialog('indicators'); }}>Add…</button>
        <button className="mt-btn" onClick={() => app.closeDialog()}>Close</button>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- Symbols manager
export function SymbolsDialog() {
  const app = useApp();
  const quotes = useQuotes();
  const visible = new Set(quotes.visibleSymbols);
  return (
    <DialogShell title="Symbols — Show / Hide" onClose={() => app.closeDialog()} width={420}>
      <div className="sym-list">
        {SYMBOLS.map((s) => (
          <label key={s.name} className="sym-row">
            <input
              type="checkbox"
              checked={visible.has(s.name)}
              onChange={(e) => (e.target.checked ? quotes.addSymbol(s.name) : quotes.hideSymbol(s.name))}
            />
            <span className="sym-name">{s.name}</span>
            <span className="sym-desc">{s.description}</span>
          </label>
        ))}
      </div>
      <div className="mt-dialog-buttons">
        <button className="mt-btn" onClick={() => quotes.showAll()}>Show All</button>
        <button className="mt-btn" onClick={() => quotes.hideAll()}>Hide All</button>
        <button className="mt-btn" onClick={() => app.closeDialog()}>Close</button>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- Modify SL/TP
export function ModifySltpDialog({ ticket }: { ticket: number }) {
  const app = useApp();
  const quotes = useQuotes((s) => s.quotes);
  const trading = useTrading();
  const pos = trading.positions.find((p) => p.ticket === ticket);
  const [sl, setSl] = useState(pos?.sl ? String(pos.sl) : '');
  const [tp, setTp] = useState(pos?.tp ? String(pos.tp) : '');

  if (!pos) return null;
  const info = getSymbol(pos.symbol);
  const q = quotes[pos.symbol];

  const save = () => {
    trading.modifyPosition(pos.ticket, parseFloat(sl) || 0, parseFloat(tp) || 0);
    app.closeDialog();
  };

  return (
    <DialogShell title={`Modify #${ticket} — ${pos.symbol}`} onClose={() => app.closeDialog()} width={380}>
      <div className="no-grid">
        <label>Type</label>
        <div className={`mt-input mt-input-static ${pos.type === 'buy' ? 'mw-up' : 'mw-down'}`}>
          {pos.type} {pos.volume.toFixed(2)} @ {fmtPrice(pos.openPrice, info.digits)}
        </div>
        <label>Stop Loss</label>
        <input className="mt-input" value={sl} placeholder={q ? fmtPrice(pos.type === 'buy' ? q.bid * 0.995 : q.bid * 1.005, info.digits) : ''} onChange={(e) => setSl(e.target.value)} />
        <label>Take Profit</label>
        <input className="mt-input" value={tp} placeholder={q ? fmtPrice(pos.type === 'buy' ? q.bid * 1.005 : q.bid * 0.995, info.digits) : ''} onChange={(e) => setTp(e.target.value)} />
      </div>
      <div className="mt-dialog-buttons">
        <button className="mt-btn" onClick={save}>Modify</button>
        <button className="mt-btn" onClick={() => { trading.modifyPosition(pos.ticket, 0, 0); app.closeDialog(); }}>Remove S/L & T/P</button>
        <button className="mt-btn" onClick={() => app.closeDialog()}>Cancel</button>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- About
export function AboutDialog() {
  const app = useApp();
  return (
    <DialogShell title="About MetaTrader 5" onClose={() => app.closeDialog()} width={400}>
      <div className="about-box">
        <div className="about-logo">
          <IconMT5 size={44} />
          <div>
            <div className="about-name">MetaTrader 5</div>
            <div className="about-build">version 5.00 · build 4980 (web clone)</div>
          </div>
        </div>
        <div className="about-sep" />
        <div className="about-text">
          Pixel-faithful replica of the MetaTrader 5 terminal, rebuilt for the
          browser with live market data from the{' '}
          <b>TradingView-API</b> open-source library
          (github.com/Mathieu2301/TradingView-API).
        </div>
        <div className="about-text about-dim">
          © 2026 MetaTrader Web Clone — for demo purposes only. Not affiliated
          with MetaQuotes Software Corp. Market data © TradingView.
        </div>
        <div className="mt-dialog-buttons">
          <button className="mt-btn" onClick={() => app.closeDialog()}>OK</button>
        </div>
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------- Root switch
export function Dialogs() {
  const dialog = useApp((s) => s.dialog);
  const payload = useApp((s) => s.dialogPayload);

  if (!dialog) return null;
  switch (dialog) {
    case 'newOrder':
      return <NewOrderDialog preselect={payload} />;
    case 'properties':
      return <PropertiesDialog />;
    case 'indicators':
      return <IndicatorsDialog />;
    case 'indicatorList':
      return <IndicatorListDialog />;
    case 'symbols':
      return <SymbolsDialog />;
    case 'modifySltp':
      return <ModifySltpDialog ticket={parseInt(payload ?? '0', 10)} />;
    case 'about':
      return <AboutDialog />;
    default:
      return null;
  }
}
