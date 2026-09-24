'use client';

// MT5App — the terminal shell: menu, toolbar, dockable panels (Market Watch,
// Navigator), chart, toolbox, status bar. Replicates the MetaTrader 5 layout.

import { useEffect, useRef } from 'react';
import { useApp } from '@/stores/app';
import { useQuotes } from '@/stores/quotes';
import { useTrading, seedJournal } from '@/stores/trading';
import { MenuBar } from './MenuBar';
import { Toolbar } from './Toolbar';
import { MarketWatch } from './MarketWatch';
import { Navigator } from './Navigator';
import { ChartPanel } from './ChartPanel';
import { Toolbox } from './Toolbox';
import { StatusBar } from './StatusBar';
import { GlobalContextMenu } from './ContextMenu';
import { Dialogs } from './dialogs/Dialogs';

export function MT5App() {
  const app = useApp();
  const connect = useQuotes((s) => s.connect);

  // boot: connect SSE + seed journal once (external system sync, no UI state)
  useEffect(() => {
    connect();
    const st = useTrading.getState();
    if (st.journal.length === 0) {
      st.journal.push(...seedJournal());
    }
  }, [connect]);

  // global keyboard shortcuts (MT5-compatible)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'F9') {
        e.preventDefault();
        app.openDialog('newOrder');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        app.toggleGrid();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        app.toggleMarketWatch();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        app.toggleNavigator();
      } else if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        app.toggleToolbox();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  // ---- splitters ------------------------------------------------------------
  const dragState = useRef<{ kind: 'col' | 'toolbox'; startPos: number; startSize: number } | null>(null);

  const beginDrag = (kind: 'col' | 'toolbox') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = {
      kind,
      startPos: kind === 'toolbox' ? e.clientY : e.clientX,
      startSize: kind === 'col' ? app.mwWidth : app.toolboxHeight,
    };
    const onMove = (ev: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      if (st.kind === 'col') app.setMwWidth(st.startSize + (ev.clientX - st.startPos));
      else app.setToolboxHeight(st.startSize - (ev.clientY - st.startPos));
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="mt5-root" onContextMenu={(e) => e.preventDefault()}>
      <MenuBar />
      <Toolbar />

      <div className="mt-main-row">
        {(app.showMarketWatch || app.showNavigator) && (
          <>
            <div className="mt-left-col" style={{ width: app.mwWidth }}>
              {app.showMarketWatch && (
                <div className="mt-left-mw" style={{ flexBasis: `${app.mwSplit * 100}%` }}>
                  <MarketWatch />
                </div>
              )}
              {app.showMarketWatch && app.showNavigator && (
                <div
                  className="mt-splitter-h"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const col = (e.currentTarget as HTMLElement).parentElement;
                    if (!col) return;
                    const total = col.clientHeight;
                    const startY = e.clientY;
                    const start = app.mwSplit;
                    const onMove = (ev: MouseEvent) => {
                      app.setMwSplit(start + (ev.clientY - startY) / total);
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />
              )}
              {app.showNavigator && (
                <div className="mt-left-nav">
                  <Navigator />
                </div>
              )}
            </div>
            <div className="mt-splitter-v" onMouseDown={beginDrag('col')} />
          </>
        )}

        <div className="mt-chart-area">
          <ChartPanel />
        </div>
      </div>

      {app.showToolbox && (
        <>
          <div className="mt-splitter-h mt-splitter-tb" onMouseDown={beginDrag('toolbox')} />
          <div className="mt-toolbox-row" style={{ height: app.toolboxHeight }}>
            <Toolbox />
          </div>
        </>
      )}

      <StatusBar />

      <GlobalContextMenu />
      <Dialogs />
    </div>
  );
}
