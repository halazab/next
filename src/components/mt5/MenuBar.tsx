'use client';

// MT5 menu bar — File / View / Insert / Charts / Tools / Window / Help
// with the exact same item structure as MetaTrader 5.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/stores/app';
import { useTrading } from '@/stores/trading';
import { SYMBOLS, TIMEFRAMES } from '@/lib/symbols';
import { useQuotes } from '@/stores/quotes';

interface MenuDef {
  label: string;
  items: MenuItem[];
}

interface MenuItem {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  sub?: MenuItem[];
  action?: () => void;
}

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const app = useApp();
  const trading = useTrading();
  const addSymbol = useQuotes((s) => s.addSymbol);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        {
          label: 'New Chart',
          sub: SYMBOLS.map((s) => ({
            label: s.name,
            action: () => {
              app.setSymbol(s.name);
              addSymbol(s.name);
              trading.log(`chart ${s.name},${app.timeframe} opened`);
            },
          })),
        },
        { label: 'Open Deleted Chart', disabled: true },
        { separator: true },
        { label: 'Login to Trade Account', disabled: true },
        { label: 'Open an Account', disabled: true },
        { separator: true },
        {
          label: 'New Order',
          shortcut: 'F9',
          action: () => app.openDialog('newOrder'),
        },
        { separator: true },
        {
          label: 'Exit',
          action: () => trading.log('terminal exit requested (ignored in browser build)'),
        },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Languages', disabled: true },
        { separator: true },
        {
          label: 'Market Watch',
          shortcut: 'Ctrl+M',
          checked: app.showMarketWatch,
          action: () => app.toggleMarketWatch(),
        },
        {
          label: 'Navigator',
          shortcut: 'Ctrl+N',
          checked: app.showNavigator,
          action: () => app.toggleNavigator(),
        },
        {
          label: 'Toolbox',
          shortcut: 'Ctrl+T',
          checked: app.showToolbox,
          action: () => app.toggleToolbox(),
        },
        { separator: true },
        {
          label: 'Grid',
          shortcut: 'Ctrl+G',
          checked: app.grid,
          action: () => app.toggleGrid(),
        },
        {
          label: 'Period Separators',
          checked: app.separators,
          action: () => app.toggleSeparators(),
        },
        { separator: true },
        { label: 'Zoom In', action: () => app.zoomStep(1) },
        { label: 'Zoom Out', action: () => app.zoomStep(-1) },
        { separator: true },
        { label: 'Symbols', action: () => app.openDialog('symbols') },
      ],
    },
    {
      label: 'Insert',
      items: [
        {
          label: 'Indicators',
          sub: [
            {
              label: 'Trend',
              sub: [
                {
                  label: 'Moving Average',
                  action: () => app.openDialog('indicators'),
                },
                {
                  label: 'Bollinger Bands',
                  action: () => trading.log("study 'Bollinger Bands' is not available in this demo build"),
                },
                {
                  label: 'Envelopes',
                  action: () => trading.log("study 'Envelopes' is not available in this demo build"),
                },
              ],
            },
            {
              label: 'Oscillators',
              sub: [
                {
                  label: 'MACD',
                  action: () => trading.log("study 'MACD' is not available in this demo build"),
                },
                {
                  label: 'RSI',
                  action: () => trading.log("study 'Relative Strength Index' is not available in this demo build"),
                },
                {
                  label: 'Stochastic',
                  action: () => trading.log("study 'Stochastic Oscillator' is not available in this demo build"),
                },
              ],
            },
          ],
        },
        {
          label: 'Objects',
          sub: [
            { label: 'Trendline', disabled: true },
            { label: 'Horizontal Line', disabled: true },
            { label: 'Rectangle', disabled: true },
            { label: 'Text', disabled: true },
          ],
        },
      ],
    },
    {
      label: 'Charts',
      items: [
        {
          label: 'Bar Chart',
          checked: app.chartType === 'bars',
          action: () => app.setChartType('bars'),
        },
        {
          label: 'Candlestick',
          checked: app.chartType === 'candles',
          action: () => app.setChartType('candles'),
        },
        {
          label: 'Line Chart',
          checked: app.chartType === 'line',
          action: () => app.setChartType('line'),
        },
        { separator: true },
        {
          label: 'Timeframes',
          sub: TIMEFRAMES.map((tf) => ({
            label: tf.label,
            checked: app.timeframe === tf.label,
            action: () => app.setTimeframe(tf.label),
          })),
        },
        { separator: true },
        { label: 'Indicator List', action: () => app.openDialog('indicatorList') },
        { separator: true },
        { label: 'Properties...', action: () => app.openDialog('properties') },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'History Center', disabled: true },
        { label: 'Global Options', disabled: true },
        { separator: true },
        { label: 'MetaQuotes Language Editor', disabled: true },
      ],
    },
    {
      label: 'Window',
      items: [
        { label: 'New Window', disabled: true },
        { label: 'New Arrangement', disabled: true },
        { separator: true },
        { label: 'Tile Vertically', disabled: true },
        { label: 'Tile Horizontally', disabled: true },
        { separator: true },
        { label: `${app.activeSymbol},${app.timeframe}`, checked: true },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', disabled: true },
        { separator: true },
        { label: 'About MetaTrader 5...', action: () => app.openDialog('about') },
      ],
    },
  ];

  return (
    <div ref={barRef} className="mt-menubar" onContextMenu={(e) => e.preventDefault()}>
      {menus.map((m) => (
        <div
          key={m.label}
          className={`mt-menu-top ${openMenu === m.label ? 'mt-menu-top-open' : ''}`}
          onMouseDown={(e) => {
            e.stopPropagation();
            setOpenMenu(openMenu === m.label ? null : m.label);
          }}
          onMouseEnter={() => {
            if (openMenu !== null) setOpenMenu(m.label);
          }}
        >
          {m.label}
          {openMenu === m.label && (
            <div className="mt-menu mt-dropdown">
              {m.items.map((item, i) => {
                if (item.separator) return <div key={i} className="mt-menu-sep" />;
                const hasSub = !!item.sub;
                return (
                  <div
                    key={i}
                    className={`mt-menu-item ${item.disabled ? 'mt-menu-disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.disabled || hasSub) return;
                      item.action?.();
                      setOpenMenu(null);
                    }}
                  >
                    {item.checked && <span className="mt-menu-check">✓</span>}
                    {!item.checked && <span className="mt-menu-check" />}
                    <span className="mt-menu-label">{item.label}</span>
                    {item.shortcut && <span className="mt-menu-shortcut">{item.shortcut}</span>}
                    {hasSub && <span className="mt-menu-arrow">▸</span>}
                    {hasSub && (
                      <div className="mt-menu-sub">
                        <div className="mt-menu-list" style={{ minWidth: 190 }}>
                          {item.sub!.map((sub, j) => {
                            if (sub.separator) return <div key={j} className="mt-menu-sep" />;
                            const hasSub2 = !!sub.sub;
                            return (
                              <div
                                key={j}
                                className={`mt-menu-item ${sub.disabled ? 'mt-menu-disabled' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sub.disabled || hasSub2) return;
                                  sub.action?.();
                                  setOpenMenu(null);
                                }}
                              >
                                {sub.checked && <span className="mt-menu-check">✓</span>}
                                {!sub.checked && <span className="mt-menu-check" />}
                                <span className="mt-menu-label">{sub.label}</span>
                                {hasSub2 && <span className="mt-menu-arrow">▸</span>}
                                {hasSub2 && (
                                  <div className="mt-menu-sub mt-menu-sub-nested">
                                    <div className="mt-menu-list" style={{ minWidth: 210 }}>
                                      {sub.sub!.map((s3, k) => (
                                        <div
                                          key={k}
                                          className={`mt-menu-item ${s3.disabled ? 'mt-menu-disabled' : ''}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (s3.disabled) return;
                                            s3.action?.();
                                            setOpenMenu(null);
                                          }}
                                        >
                                          {s3.checked && <span className="mt-menu-check">✓</span>}
                                          {!s3.checked && <span className="mt-menu-check" />}
                                          <span className="mt-menu-label">{s3.label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="mt-menubar-right">
        <span className="mt-menubar-badge">Demo</span>
        <span className="mt-menubar-account">#{trading.account}</span>
      </div>
    </div>
  );
}
