'use client';

// MT5 status bar — connection state, ping, traffic and server clock.

import { useEffect, useState } from 'react';
import { useQuotes } from '@/stores/quotes';
import { IconTerminalGreen } from './icons';

export function StatusBar() {
  const status = useQuotes((s) => s.status);
  const lastTickAt = useQuotes((s) => s.lastTickAt);
  const [bytes, setBytes] = useState(0);
  const [clock, setClock] = useState('');

  useEffect(() => {
    if (lastTickAt > 0) setBytes((b) => b + 96); // approx payload size per tick
  }, [lastTickAt]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);

  const ping = lastTickAt > 0 ? Math.min(999, Math.max(8, Date.now() - lastTickAt)) : 0;
  const tvActive = status.tvSymbols > 0;

  return (
    <div className="mt-statusbar">
      <span className="sb-item">
        <span className={`sb-dot ${tvActive ? 'sb-dot-green' : 'sb-dot-orange'}`} />
        {tvActive ? 'TradingView data feed' : 'Simulated data feed'}
      </span>
      <span className="sb-item">{tvActive ? `${status.tvSymbols} symbols live` : 'fallback mode'}</span>
      <span className="sb-item">{ping} ms</span>
      <span className="sb-spacer" />
      <span className="sb-item">
        <IconTerminalGreen /> {(bytes / 1024).toFixed(1)} kb
      </span>
      <span className="sb-item">1:100</span>
      <span className="sb-item sb-clock">{clock}</span>
    </div>
  );
}
