'use client';

// Application state: active chart, color schemes (MT5 presets), panels,
// dialogs, indicators and the global context menu.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChartType = 'bars' | 'candles' | 'line';
export type SchemeKey = 'green' | 'white' | 'black' | 'broker';

export interface ChartScheme {
  key: SchemeKey;
  title: string;
  bg: string;
  grid: string;
  axisText: string;
  barUp: string;
  barDown: string;
  /** bullish candle border colour */
  bullBorder: string;
  /** bullish candle body fill (MT5 default = background, i.e. hollow) */
  bullFill: string;
  bearBody: string;
  line: string;
  bidLine: string;
  crosshair: string;
  separator: string;
}

/** MT5 built-in color presets, replicated exactly */
export const SCHEMES: Record<SchemeKey, ChartScheme> = {
  green: {
    key: 'green',
    title: 'Green on Black',
    bg: '#000000',
    grid: '#323C32',
    axisText: '#C8C8C8',
    barUp: '#00FF00',
    barDown: '#00FF00',
    bullBorder: '#00FF00',
    bullFill: '#000000',
    bearBody: '#00FF00',
    line: '#00FF00',
    bidLine: '#FF0000',
    crosshair: '#808080',
    separator: '#416B4A',
  },
  white: {
    key: 'white',
    title: 'Black on White',
    bg: '#FFFFFF',
    grid: '#C8C8C8',
    axisText: '#000000',
    barUp: '#000000',
    barDown: '#000000',
    bullBorder: '#000000',
    bullFill: '#FFFFFF',
    bearBody: '#000000',
    line: '#000000',
    bidLine: '#FF0000',
    crosshair: '#808080',
    separator: '#808080',
  },
  black: {
    key: 'black',
    title: 'Black on Black',
    bg: '#000000',
    grid: '#323232',
    axisText: '#C8C8C8',
    barUp: '#FFFFFF',
    barDown: '#FFFFFF',
    bullBorder: '#FFFFFF',
    bullFill: '#000000',
    bearBody: '#FFFFFF',
    line: '#FFFFFF',
    bidLine: '#FF0000',
    crosshair: '#808080',
    separator: '#323232',
  },
  broker: {
    key: 'broker',
    title: 'Dark Broker (custom)',
    bg: '#0E1210',
    grid: '#243129',
    axisText: '#B2B5BE',
    barUp: '#26A69A',
    barDown: '#EF5350',
    bullBorder: '#26A69A',
    bullFill: '#26A69A',
    bearBody: '#EF5350',
    line: '#2962FF',
    bidLine: '#EB4D5C',
    crosshair: '#758696',
    separator: '#36474A',
  },
};

export interface ChartIndicator {
  id: string;
  type: 'ma';
  label: string;
  period: number;
  method: 'sma' | 'ema';
  color: string;
}

export interface MenuItemDef {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  submenu?: MenuItemDef[];
  onClick?: () => void;
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  items: MenuItemDef[];
}

type DialogKind =
  | 'newOrder'
  | 'properties'
  | 'indicators'
  | 'indicatorList'
  | 'symbols'
  | 'about'
  | 'modifySltp'
  | null;

interface AppState {
  activeSymbol: string;
  timeframe: string;
  chartType: ChartType;
  scheme: SchemeKey;
  grid: boolean;
  separators: boolean;
  autoScroll: boolean;
  indicators: ChartIndicator[];

  showMarketWatch: boolean;
  showNavigator: boolean;
  showToolbox: boolean;
  mwWidth: number;
  /** fraction of the left column given to Market Watch */
  mwSplit: number;
  toolboxHeight: number;
  mobilePanel: 'chart' | 'watch' | 'toolbox';
  mwTab: 'symbols' | 'ticks' | 'details' | 'trade';
  /** MT5 one-click trading overlay on the chart */
  oneClick: boolean;

  dialog: DialogKind;
  dialogPayload: string | null;
  contextMenu: ContextMenuState;

  // actions
  setSymbol: (s: string) => void;
  setTimeframe: (tf: string) => void;
  setChartType: (t: ChartType) => void;
  setScheme: (s: SchemeKey) => void;
  toggleGrid: () => void;
  toggleSeparators: () => void;
  setAutoScroll: (v: boolean) => void;
  addIndicator: (ind: ChartIndicator) => void;
  removeIndicator: (id: string) => void;
  toggleMarketWatch: () => void;
  toggleNavigator: () => void;
  toggleToolbox: () => void;
  setMwWidth: (w: number) => void;
  setMwSplit: (v: number) => void;
  setToolboxHeight: (h: number) => void;
  setMobilePanel: (p: 'chart' | 'watch' | 'toolbox') => void;
  setMwTab: (t: 'symbols' | 'ticks' | 'details' | 'trade') => void;
  toggleOneClick: () => void;
  openDialog: (d: DialogKind, payload?: string) => void;
  closeDialog: () => void;
  openContextMenu: (x: number, y: number, items: MenuItemDef[]) => void;
  closeContextMenu: () => void;
  zoomStep: (dir: 1 | -1) => void;
}

interface PersistedApp {
  activeSymbol: string;
  timeframe: string;
  chartType: ChartType;
  scheme: SchemeKey;
  grid: boolean;
  separators: boolean;
  indicators: ChartIndicator[];
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      activeSymbol: 'EURUSD',
      timeframe: 'M15',
      chartType: 'candles',
      scheme: 'green',
      grid: true,
      separators: true,
      autoScroll: true,
      indicators: [],

      showMarketWatch: true,
      showNavigator: true,
      showToolbox: true,
      mwWidth: 252,
      mwSplit: 0.55,
      toolboxHeight: 236,
      mobilePanel: 'chart',
      mwTab: 'symbols',
      oneClick: false,

      dialog: null,
      dialogPayload: null,
      contextMenu: { open: false, x: 0, y: 0, items: [] },

      setSymbol: (s) => set({ activeSymbol: s }),
      setTimeframe: (tf) => set({ timeframe: tf }),
      setChartType: (t) => set({ chartType: t }),
      setScheme: (s) => set({ scheme: s }),
      toggleGrid: () => set((st) => ({ grid: !st.grid })),
      toggleSeparators: () => set((st) => ({ separators: !st.separators })),
      setAutoScroll: (v) => set({ autoScroll: v }),
      addIndicator: (ind) => set((st) => ({ indicators: [...st.indicators, ind] })),
      removeIndicator: (id) => set((st) => ({ indicators: st.indicators.filter((i) => i.id !== id) })),
      toggleMarketWatch: () => set((st) => ({ showMarketWatch: !st.showMarketWatch })),
      toggleNavigator: () => set((st) => ({ showNavigator: !st.showNavigator })),
      toggleToolbox: () => set((st) => ({ showToolbox: !st.showToolbox })),
      setMwWidth: (w) => set({ mwWidth: Math.min(Math.max(w, 180), 460) }),
      setMwSplit: (v) => set({ mwSplit: Math.min(Math.max(v, 0.15), 0.85) }),
      setToolboxHeight: (h) => set({ toolboxHeight: Math.min(Math.max(h, 100), window.innerHeight - 300) }),
      setMobilePanel: (p) => set({ mobilePanel: p }),
      setMwTab: (t) => set({ mwTab: t }),
      toggleOneClick: () => set((st) => ({ oneClick: !st.oneClick })),
      openDialog: (d, payload) => set({ dialog: d, dialogPayload: payload ?? null }),
      closeDialog: () => set({ dialog: null, dialogPayload: null }),
      openContextMenu: (x, y, items) => set({ contextMenu: { open: true, x, y, items } }),
      closeContextMenu: () => set((st) => ({ contextMenu: { ...st.contextMenu, open: false } })),
      zoomStep: (dir) => {
        // delegates to chart engine via custom event — keeps store serialisable
        window.dispatchEvent(new CustomEvent('mt5-zoom', { detail: dir }));
      },
    }),
    {
      name: 'mt5-clone-app',
      partialize: (st): PersistedApp => ({
        activeSymbol: st.activeSymbol,
        timeframe: st.timeframe,
        chartType: st.chartType,
        scheme: st.scheme,
        grid: st.grid,
        separators: st.separators,
        indicators: st.indicators,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedApp>;
        return { ...current, ...p };
      },
    },
  ),
);

export function useScheme(): ChartScheme {
  return SCHEMES[useApp((s) => s.scheme)] ?? SCHEMES.green;
}
