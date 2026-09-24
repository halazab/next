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
import { ChartEngine, type EngineIndicator } from './chart/engine';
import { SCHEMES } from '@/stores/app';
import { IconCross } from './icons';

export function ChartPanel() {
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
    const { x } = toLocal(e);
    dragRef.current.dragging = true;
    engineRef.current?.onMouseDown(x);
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
      engineRef.current?.onMouseDown(x);
      engineRef.current?.onMouseMove(x, y, true);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = { pinch: true, dist: Math.hypot(dx, dy) };
      dragRef.current.dragging = false;
      engineRef.current?.onMouseUp();
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
      engineRef.current?.onMouseDown(x);
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
