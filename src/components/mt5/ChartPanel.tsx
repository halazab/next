'use client';

// Chart panel — mounts the MT5 canvas engine, feeds it TradingView candles
// and live ticks, and renders the MT5 header line, tabs and context menu.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/stores/app';
import { useQuotes } from '@/stores/quotes';
import { useTrading } from '@/stores/trading';
import { getSymbol, tfByLabel } from '@/lib/symbols';
import { fmtPrice } from '@/lib/format';
import type { Candle } from '@/lib/tv/candles';
import { ChartEngine, type EngineIndicator, type EngineTradeLine } from './chart/engine';
import { SCHEMES } from '@/stores/app';
import { IconCross } from './icons';

export function ChartPanel({ countdown = false }: { countdown?: boolean }) {
  const app = useApp();
  const quotes = useQuotes();
  const trading = useTrading();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const dragRef = useRef<{ dragging: boolean }>({ dragging: false });

  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<Candle | null>(null);
  const [source, setSource] = useState<'tradingview' | 'simulated' | null>(null);
  const [ocVol, setOcVol] = useState(0.1);

  const symbol = app.activeSymbol;
  const tf = app.timeframe;
  const info = getSymbol(symbol);
  const tfInfo = tfByLabel(tf);
  const quote = quotes.quotes[symbol];

  // ---- create engine once --------------------------------------------------
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new ChartEngine(canvasRef.current, SCHEMES[app.scheme]);
    engineRef.current = engine;
    engine.onHover = (c) => setHover(c ? { ...c } : null);

    const ro = new ResizeObserver(() => {
      if (wrapRef.current) {
        engine.resize(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
      }
    });
    if (wrapRef.current) {
      ro.observe(wrapRef.current);
      engine.resize(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
    }
    return () => ro.disconnect();
  }, []);

  // ---- sync engine config ---------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.scheme = SCHEMES[app.scheme];
    engine.chartType = app.chartType;
    engine.showGrid = app.grid;
    engine.showSeparators = app.separators;
    engine.tfSeconds = tfInfo.seconds;
    engine.digits = info.digits;
    engine.indicators = app.indicators as EngineIndicator[];
    engine.invalidate();
  }, [app.scheme, app.chartType, app.grid, app.separators, app.indicators, tfInfo.seconds, info.digits]);

  // ---- fetch candle history ---------------------------------------------------
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/candles?symbol=${symbol}&tf=${tf}&count=700`);
      if (!res.ok) throw new Error('bad response');
      const data = (await res.json()) as { candles: Candle[]; source: 'tradingview' | 'simulated' };
      const engine = engineRef.current;
      if (engine && data.candles.length > 0) {
        engine.setData(data.candles);
        setSource(data.source);
        if (quote) engine.setQuote(quote.bid, quote.ask);
      }
    } catch {
      trading.log(`failed to load history for ${symbol},${tf}`, 'error');
    } finally {
      setLoading(false);
    }
    }, [symbol, tf]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  // ---- live ticks -------------------------------------------------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !quote) return;
    engine.setQuote(quote.bid, quote.ask);
  }, [quote?.bid]);

  // ---- trade levels (entries, S/L, T/P, pendings) for the active symbol ------
  const syncLines = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const lines: EngineTradeLine[] = [];
    for (const p of trading.positions) {
      if (p.symbol !== symbol) continue;
      lines.push({
        id: `entry-${p.ticket}`, kind: 'entry', tag: `${p.type} ${p.volume.toFixed(2)}`,
        price: p.openPrice, color: p.type === 'buy' ? '#3391ff' : '#eb4d5c', draggable: false,
      });
      if (p.sl > 0) {
        lines.push({ id: `sl-${p.ticket}`, kind: 'sl', tag: 'S/L', price: p.sl, color: '#ef5350', draggable: true });
      }
      if (p.tp > 0) {
        lines.push({ id: `tp-${p.ticket}`, kind: 'tp', tag: 'T/P', price: p.tp, color: '#26a69a', draggable: true });
      }
    }
    for (const o of trading.pendings) {
      if (o.symbol !== symbol) continue;
      lines.push({
        id: `ord-${o.ticket}`, kind: 'order', tag: `${o.type} ${o.volume.toFixed(2)}`,
        price: o.price, color: o.type.startsWith('buy') ? '#00c853' : '#ff5252', draggable: true,
      });
      if (o.sl > 0) {
        lines.push({ id: `slp-${o.ticket}`, kind: 'sl', tag: 'S/L', price: o.sl, color: '#ef5350', draggable: true });
      }
      if (o.tp > 0) {
        lines.push({ id: `tpp-${o.ticket}`, kind: 'tp', tag: 'T/P', price: o.tp, color: '#26a69a', draggable: true });
      }
    }
    engine.tradeLines = lines;
    engine.invalidate();
  }, [trading.positions, trading.pendings, symbol]);

  useEffect(() => {
    syncLines();
  }, [syncLines]);

  // ---- drag-release: commit the new price of a trade line ---------------------
  const handleLineRelease = useCallback(
    (id: string, price: number) => {
      const liveQuotes = useQuotes.getState().quotes;
      const q = liveQuotes[symbol];
      const digits = info.digits;
      const reject = (msg: string) => trading.log(msg, 'error');

      if (id.startsWith('sl-') || id.startsWith('tp-')) {
        const pos = useTrading.getState().positions.find((p) => p.ticket === parseInt(id.slice(3), 10));
        if (!pos) return;
        if (id.startsWith('sl-')) {
          const ok = pos.type === 'buy' ? q && price < q.bid : q !== undefined && price > q.ask;
          if (!ok) {
            reject(`invalid S/L ${fmtPrice(price, digits)} for #${pos.ticket} — must be ${pos.type === 'buy' ? 'below Bid' : 'above Ask'}`);
          } else {
            trading.modifyPosition(pos.ticket, price, pos.tp);
          }
        } else {
          const ok = pos.type === 'buy' ? q && price > q.ask : q !== undefined && price < q.bid;
          if (!ok) {
            reject(`invalid T/P ${fmtPrice(price, digits)} for #${pos.ticket} — must be ${pos.type === 'buy' ? 'above Ask' : 'below Bid'}`);
          } else {
            trading.modifyPosition(pos.ticket, pos.sl, price);
          }
        }
      } else if (id.startsWith('slp-') || id.startsWith('tpp-')) {
        const order = useTrading.getState().pendings.find((o) => o.ticket === parseInt(id.slice(4), 10));
        if (!order) return;
        if (id.startsWith('slp-')) {
          const ok = order.type.startsWith('buy') ? price < order.price : price > order.price;
          if (!ok) reject(`invalid S/L ${fmtPrice(price, digits)} for order #${order.ticket}`);
          else trading.modifyPending(order.ticket, { sl: price });
        } else {
          const ok = order.type.startsWith('buy') ? price > order.price : price < order.price;
          if (!ok) reject(`invalid T/P ${fmtPrice(price, digits)} for order #${order.ticket}`);
          else trading.modifyPending(order.ticket, { tp: price });
        }
      } else if (id.startsWith('ord-')) {
        const order = useTrading.getState().pendings.find((o) => o.ticket === parseInt(id.slice(4), 10));
        if (!order) return;
        let ok = true;
        if (q) {
          if (order.type === 'buy limit') ok = price < q.ask;
          else if (order.type === 'buy stop') ok = price > q.ask;
          else if (order.type === 'sell limit') ok = price > q.bid;
          else if (order.type === 'sell stop') ok = price < q.bid;
        }
        if (!ok) reject(`invalid ${order.type} price ${fmtPrice(price, digits)} for order #${order.ticket}`);
        else trading.modifyPending(order.ticket, { price });
      }
      // re-sync from the store — reverts the visual if the release was rejected
      syncLines();
    },
    [symbol, info.digits, trading, syncLines],
  );

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.onLineRelease = handleLineRelease;
  }, [handleLineRelease]);

  // ---- candle countdown timer (MT5 mobile price-scale tag) -------------------
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setCountdown(countdown);
    // stop the engine's 1s repaint timer when unmounting / toggling off
    return () => engine.setCountdown(false);
  }, [countdown]);

  // ---- one-click trading ------------------------------------------------------
  const oneClickTrade = (type: 'buy' | 'sell') => {
    if (!quote) return;
    const price = type === 'buy' ? quote.ask : quote.bid;
    const ticket = trading.openPosition({ symbol, type, volume: ocVol, openPrice: price, sl: 0, tp: 0 });
    trading.log(`one-click #${ticket}: ${type} ${ocVol.toFixed(2)} ${symbol} at ${fmtPrice(price, info.digits)}`);
  };

  // ---- zoom via toolbar / menu events -------------------------------------------
  useEffect(() => {
    const onZoom = (e: Event) => {
      const dir = (e as CustomEvent).detail as 1 | -1;
      const engine = engineRef.current;
      if (!engine) return;
      engine.onWheel(dir === 1 ? -100 : 100);
    };
    window.addEventListener('mt5-zoom', onZoom);
    return () => window.removeEventListener('mt5-zoom', onZoom);
  }, []);

  // ---- mouse events ----------------------------------------------------------------
  const toLocal = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const { x, y } = toLocal(e);
    dragRef.current.dragging = true;
    engineRef.current?.onMouseDown(x, y);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = toLocal(e);
    engineRef.current?.onMouseMove(x, y, dragRef.current.dragging);
  };

  const onMouseUp = () => {
    dragRef.current.dragging = false;
    engineRef.current?.onMouseUp();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    engineRef.current?.onWheel(e.deltaY);
  };

  // ---- touch events (mobile) — 1 finger pans, 2 fingers pinch-zoom --------
  const touchRef = useRef<{ pinch: boolean; dist: number }>({ pinch: false, dist: 0 });

  const touchPos = (t: React.Touch) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const { x, y } = touchPos(e.touches[0]);
      touchRef.current = { pinch: false, dist: 0 };
      dragRef.current.dragging = true;
      engineRef.current?.onMouseDown(x, y);
      engineRef.current?.onMouseMove(x, y, true);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { pinch: true, dist: Math.hypot(dx, dy) };
      dragRef.current.dragging = false;
      // cancels an in-progress line drag without committing
      engineRef.current?.onMouseLeave();
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // canvas has touch-action:none, so the browser never hijacks the gesture
    if (e.touches.length === 1 && !touchRef.current.pinch) {
      const { x, y } = touchPos(e.touches[0]);
      engineRef.current?.onMouseMove(x, y, true);
    } else if (e.touches.length === 2 && touchRef.current.pinch) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = touchRef.current.dist - dist; // fingers apart → zoom in
      if (Math.abs(delta) >= 2) {
        engineRef.current?.onWheel(delta * 1.2);
        touchRef.current.dist = dist;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      dragRef.current.dragging = false;
      touchRef.current.pinch = false;
      engineRef.current?.onMouseUp();
      engineRef.current?.onMouseLeave();
    } else if (e.touches.length === 1) {
      // pinch ended — restart a fresh pan anchor from the remaining finger
      touchRef.current.pinch = false;
      const { x, y } = touchPos(e.touches[0]);
      dragRef.current.dragging = true;
      engineRef.current?.onMouseDown(x, y);
      engineRef.current?.onMouseMove(x, y, true);
    }
  };

  // ---- context menu -----------------------------------------------------------------
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    app.openContextMenu(e.clientX, e.clientY, [
      { label: 'New Order', shortcut: 'F9', onClick: () => app.openDialog('newOrder') },
      { separator: true, label: '' },
      { label: 'Indicators List', onClick: () => app.openDialog('indicatorList') },
      { label: 'Add Indicator...', onClick: () => app.openDialog('indicators') },
      { separator: true, label: '' },
      { label: 'Grid', checked: app.grid, onClick: () => app.toggleGrid() },
      { label: 'Period Separators', checked: app.separators, onClick: () => app.toggleSeparators() },
      { separator: true, label: '' },
      { label: 'Auto Scroll', checked: app.autoScroll, onClick: () => engineRef.current?.scrollToEnd() },
      { label: 'Scroll to End', onClick: () => engineRef.current?.scrollToEnd() },
      { separator: true, label: '' },
      { label: 'Properties...', onClick: () => app.openDialog('properties') },
    ]);
  };

  // ---- header OHLC -----------------------------------------------------------------
  const shown = hover ?? null;
  const lastCandle = engineRef.current?.candles[engineRef.current.candles.length - 1];
  const header = shown ?? lastCandle ?? null;
  const headerUp = header ? header.close >= header.open : true;

  const mqlLabel = `${symbol},${tf}`;

  return (
    <div className="chart-panel">
      <div className="mt-panel-title">
        <span>{mqlLabel}</span>
        <span className="mt-panel-title-icons">
          {source && (
            <span className={`chart-feed ${source === 'tradingview' ? 'chart-feed-tv' : 'chart-feed-sim'}`}>
              {source === 'tradingview' ? 'TradingView' : 'Simulated'}
            </span>
          )}
        </span>
      </div>

      <div className="chart-body" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="chart-canvas"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            dragRef.current.dragging = false;
            engineRef.current?.onMouseLeave();
          }}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onContextMenu={onContextMenu}
        />

        <div className="chart-header" style={{ color: SCHEMES[app.scheme].axisText }}>
          <div className="chart-header-sym">{mqlLabel}</div>
          {header && (
            <div className="chart-header-ohlc">
              <span className="ch-k">O</span>
              <span className="ch-v">{fmtPrice(header.open, info.digits)}</span>
              <span className="ch-k">H</span>
              <span className="ch-v">{fmtPrice(header.high, info.digits)}</span>
              <span className="ch-k">L</span>
              <span className="ch-v">{fmtPrice(header.low, info.digits)}</span>
              <span className="ch-k">C</span>
              <span className={`ch-v ${headerUp ? 'mw-up' : 'mw-down'}`}>{fmtPrice(header.close, info.digits)}</span>
            </div>
          )}
          {app.indicators.length > 0 && (
            <div className="chart-header-ind">
              {app.indicators.map((ind) => (
                <span key={ind.id} style={{ color: ind.color }}>
                  {ind.label}({ind.method.toUpperCase()},{ind.period})
                </span>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="chart-loading">
            <span>Loading {symbol} {tf} history…</span>
          </div>
        )}

        {app.oneClick && quote && (
          <div className="oc-panel">
            <button className="oc-btn oc-sell" onClick={() => oneClickTrade('sell')}>
              <span className="oc-k">sell</span>
              <span className="oc-p">{fmtPrice(quote.bid, info.digits)}</span>
            </button>
            <div className="oc-vol">
              <button onClick={() => setOcVol((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}>−</button>
              <span>{ocVol.toFixed(2)}</span>
              <button onClick={() => setOcVol((v) => Math.min(100, +(v + 0.01).toFixed(2)))}>+</button>
            </div>
            <button className="oc-btn oc-buy" onClick={() => oneClickTrade('buy')}>
              <span className="oc-k">buy</span>
              <span className="oc-p">{fmtPrice(quote.ask, info.digits)}</span>
            </button>
            <button className="oc-close" title="Disable One Click Trading" onClick={() => app.toggleOneClick()}>
              <IconCross size={9} />
            </button>
          </div>
        )}
      </div>

      <div className="chart-tabs">
        <span className="chart-tab chart-tab-active">
          <span className="chart-tab-label">{mqlLabel}</span>
          <span className="chart-tab-close">
            <IconCross size={8} />
          </span>
        </span>
        <span className="chart-tab-spacer" />
        <span className="chart-tab-quote">
          {quote && (
            <>
              <span className={quote.dir >= 0 ? 'mw-up' : 'mw-down'}>{fmtPrice(quote.bid, info.digits)}</span>
              <span className="chart-tab-sep">/</span>
              <span className={quote.dir >= 0 ? 'mw-up' : 'mw-down'}>{fmtPrice(quote.ask, info.digits)}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
