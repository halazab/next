# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Build a pixel-faithful MetaTrader 5 web terminal clone using github.com/Mathieu2301/TradingView-API as the market data provider (Type 3 web development)

Work Log:
- Loaded fullstack-dev skill, ran init script (Next.js 16 + TS scaffold on port 3000)
- Installed `@mathieuc/tradingview` (the npm package of Mathieu2301/TradingView-API); studied its Client / Session.Quote / Session.Chart APIs from source
- Verified live connectivity in sandbox: OANDA/BINANCE quotes stream, chart periods return {time, open, close, max, min, volume}
- Server layer: src/lib/symbols.ts (22 MT5 symbols mapped to TradingView feeds), src/lib/tv/hub.ts (singleton TV client + one QuoteSession for all symbols + per-symbol synthetic watchdog fallback), src/lib/tv/candles.ts (chart-session OHLCV fetch with 20s cache + random-walk history fallback), /api/quotes SSE route (300ms batched deltas + heartbeat), /api/candles REST route
- Fixed broken @swc/helpers resolution, added serverExternalPackages + devIndicators:false in next.config.ts
- Fixed 2 invalid TradingView symbol mappings (GER40 → XETR:DAX, UK100 → LSE:UKX)
- Client: zustand stores (quotes w/ SSE + tick buffers, trading engine w/ MT5 margin/P&L math + localStorage persistence, app state w/ 4 chart schemes incl. authentic MT5 presets Green-on-Black / Black-on-White / Black-on-Black)
- Components: MenuBar (7 menus fully wired), Toolbar (SVG icon replicas, 9 timeframes), MarketWatch (Symbols/Ticks/Details/Trade tabs, flash animations, context menus), Navigator tree, canvas chart engine (hollow/solid candles, bars, line, grid, period separators, bid line + axis tag, crosshair w/ tags, time/price nice steps, live tick candle building, wheel zoom, drag pan), ChartPanel (TradingView candle fetch, OHLC header, chart tabs, feed badge), Toolbox (Trade/Exposure/Account History/News/Mailbox/Market/Signals/Journal + account summary bar), StatusBar, dialogs (New Order w/ validation, Chart Properties, Moving Average SMA/EMA, Indicator List, Symbols manager, Modify SL/TP, About), global context menu system
- Browser-verified end-to-end: F9 order dialog → buy 0.10 EURUSD → exact MT5 math (margin 113.75, margin level 8790%, live P&L) → close position → deal in Account History (balance 10 001.40); M5/H1 switching; double-click XAUUSD chart switch; MA(14) SMA overlay + crosshair tags; Properties scheme switch (Black on White verified pixel-faithful); Market Watch context menu; mobile 390px layout
- ESLint passes clean after refactors (flash via CSS keyframes + remount, tick buffer moved into store, boot-state removed)

Stage Summary:
- Deliverable: runnable Next.js app on port 3000 — MetaTrader 5 clone, live data from TradingView-API, ~9,300 lines
- Key decisions: custom canvas engine instead of chart libs (pixel fidelity); one shared server QuoteSession for all symbols; synthetic fallback guarantees never-empty UI (status bar + per-symbol feed badges show real source)
- Artifacts: src/lib/{symbols,format,calc}.ts, src/lib/tv/{hub,candles}.ts, src/app/api/{quotes,candles}/, src/stores/{quotes,trading,app}.ts, src/components/mt5/* (14 files), public/mt5-icon.svg
