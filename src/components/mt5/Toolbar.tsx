'use client';

// MT5 toolbar strip — standard tools, chart types, timeframes, indicators.

import { useApp } from '@/stores/app';
import { TIMEFRAMES } from '@/lib/symbols';
import {
  IconBars, IconCandles, IconLine, IconZoom, IconIndicators,
  IconGrid, IconSeparator, IconProperties, IconNewOrder,
} from './icons';

function TBtn({
  children,
  title,
  active,
  onClick,
  text,
}: {
  children?: React.ReactNode;
  title: string;
  active?: boolean;
  onClick?: () => void;
  text?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`mt-tbtn ${active ? 'mt-tbtn-active' : ''} ${text ? 'mt-tbtn-text' : ''}`}
    >
      {children ?? text}
    </button>
  );
}

function Sep() {
  return <div className="mt-tsep" />;
}

export function Toolbar() {
  const app = useApp();

  return (
    <div className="mt-toolbars">
      <div className="mt-toolbar">
        <TBtn title="New Order (F9)" onClick={() => app.openDialog('newOrder')}>
          <IconNewOrder />
        </TBtn>
        <Sep />
        <TBtn title="Bars" active={app.chartType === 'bars'} onClick={() => app.setChartType('bars')}>
          <IconBars />
        </TBtn>
        <TBtn title="Candlestick" active={app.chartType === 'candles'} onClick={() => app.setChartType('candles')}>
          <IconCandles />
        </TBtn>
        <TBtn title="Line Chart" active={app.chartType === 'line'} onClick={() => app.setChartType('line')}>
          <IconLine />
        </TBtn>
        <Sep />
        <TBtn title="Zoom In" onClick={() => app.zoomStep(1)}>
          <IconZoom />
        </TBtn>
        <TBtn title="Zoom Out" onClick={() => app.zoomStep(-1)}>
          <IconZoom out />
        </TBtn>
        <Sep />
        {TIMEFRAMES.map((tf) => (
          <TBtn
            key={tf.label}
            title={tf.label}
            text={tf.label}
            active={app.timeframe === tf.label}
            onClick={() => app.setTimeframe(tf.label)}
          />
        ))}
        <Sep />
        <TBtn title="Indicators" onClick={() => app.openDialog('indicators')}>
          <IconIndicators />
        </TBtn>
        <TBtn title="Indicator List" onClick={() => app.openDialog('indicatorList')}>
          <span className="mt-tbtn-fxlist">f(x)·</span>
        </TBtn>
        <Sep />
        <TBtn title="Grid (Ctrl+G)" active={app.grid} onClick={() => app.toggleGrid()}>
          <IconGrid />
        </TBtn>
        <TBtn title="Period Separators" active={app.separators} onClick={() => app.toggleSeparators()}>
          <IconSeparator />
        </TBtn>
        <Sep />
        <TBtn title="One Click Trading" active={app.oneClick} onClick={() => app.toggleOneClick()}>
          <IconOneClick />
        </TBtn>
        <TBtn title="Chart Properties..." onClick={() => app.openDialog('properties')}>
          <IconProperties />
        </TBtn>
      </div>
    </div>
  );
}

function IconOneClick({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M3 2.5l9.5 5-4 1.2 2.3 4-1.8 1-2.3-4-3 2.8z" fill="none" stroke="#d8d8d8" strokeWidth="1" />
      <circle cx="12.5" cy="12.5" r="2.2" fill="#3fa142" />
      <path d="M12.5 11.4v2.2M11.4 12.5h2.2" stroke="#ffffff" strokeWidth="0.9" />
    </svg>
  );
}
