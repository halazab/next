// MT5-style canvas chart engine — replicates MetaTrader 5 chart rendering:
// hollow/solid candles, OHLC bars, grid, period separators, bid line with
// axis tag, crosshair, price/time scales and live tick building.

import type { ChartScheme, ChartType } from '@/stores/app';
import type { Candle } from '@/lib/tv/candles';
import { fmtDayLabel, fmtDayLabelYear, fmtClock } from '@/lib/format';

export interface EngineIndicator {
  id: string;
  type: 'ma';
  label: string;
  period: number;
  method: 'sma' | 'ema';
  color: string;
}

/** horizontal trade level drawn over the plot (MT5 trade lines):
 *  position entries, S/L, T/P and pending-order prices */
export interface EngineTradeLine {
  id: string;
  kind: 'entry' | 'sl' | 'tp' | 'order';
  /** short label rendered in the left tag, e.g. "S/L" or "buy 0.10" */
  tag: string;
  price: number;
  color: string;
  /** draggable lines can be re-priced with pointer/touch */
  draggable: boolean;
}

const PAD_RIGHT = 66; // price axis width
const PAD_BOTTOM = 23; // time axis height
const FONT = '11px Tahoma, "Segoe UI", sans-serif';

function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const frac = raw / base;
  let n: number;
  if (frac <= 1) n = 1;
  else if (frac <= 2) n = 2;
  else if (frac <= 2.5) n = 2.5;
  else if (frac <= 5) n = 5;
  else n = 10;
  return n * base;
}

const TIME_STEPS = [
  60, 120, 180, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 43200,
  86400, 172800, 345600, 604800, 1209600, 2592000, 7776000, 15552000, 31536000,
];

export class ChartEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  width = 800;
  height = 500;

  candles: Candle[] = [];
  bid = 0;
  ask = 0;

  scheme: ChartScheme;
  chartType: ChartType = 'candles';
  showGrid = true;
  showSeparators = true;
  tfSeconds = 900;
  digits = 5;
  indicators: EngineIndicator[] = [];

  /** px per candle slot (body + gap) */
  barWidth = 9;
  /** bars hidden at the right edge (0 = latest bar visible) */
  rightOffset = 0;
  autoScroll = true;
  /** MT5 candle countdown timer on the price scale (mobile chart) */
  showCountdown = false;
  /** trade levels drawn over the plot (entries, S/L, T/P, pendings) */
  tradeLines: EngineTradeLine[] = [];
  /** called when a draggable line is released at a new price */
  onLineRelease: (id: string, price: number) => void = () => {};

  private crosshair: { x: number; y: number } | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private drag: { startX: number; startOffset: number; startY: number } | null = null;
  /** vertical pan — TV-style: the first vertical drag disengages auto-fit
   *  and freezes the price scale (follows the pointer) until it is reset
   *  via double-click on the price axis or a new symbol/timeframe */
  private vFrozen: { min: number; max: number } | null = null;
  private frozenBase: { min: number; max: number } | null = null;
  /** compression factor applied on top of the frozen (manual) scale */
  private vFrozenK = 1;
  private vAnchorY = 0;
  private vPpp = 0;
  /** TradingView-style vertical compression of the price scale (1 = auto-fit) */
  priceScaleK = 1;
  /** axis currently being dragged to scale the chart ("time" = horizontal
   *  bar-width zoom, "price" = vertical compression) */
  private dragAxis: 'time' | 'price' | null = null;
  private axisStart = 0;
  private axisStartBar = 9;
  private axisStartK = 1;
  /** id of the trade line currently being dragged, if any */
  private dragLineId: string | null = null;
  /** last rendered price scale — used for pointer↔price mapping */
  private scale = { min: 0, max: 1 };
  private dirty = true;
  private rafId: number | null = null;

  onHover: (candle: Candle | null) => void = () => {};
  onEdgeLeft: () => void = () => {};
  onViewChange: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, scheme: ChartScheme) {
    this.canvas = canvas;
    this.scheme = scheme;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  // -------------------------------------------------------------- lifecycle
  resize(w: number, h: number): void {
    this.dpr = window.devicePixelRatio || 1;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.invalidate();
  }

  invalidate(): void {
    this.dirty = true;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.dirty) {
          this.dirty = false;
          this.render();
        }
      });
    }
  }

  /** enable/disable the candle-close countdown; a private 1s interval
   *  repaints the tag with zero React involvement (no re-render, no lag) */
  setCountdown(on: boolean): void {
    if (on === this.showCountdown) return;
    this.showCountdown = on;
    if (on) {
      this.countdownTimer = setInterval(() => {
        // skip repaints while the page is hidden (battery friendly)
        if (typeof document !== 'undefined' && document.hidden) return;
        this.invalidate();
      }, 1000);
      this.invalidate();
    } else if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      this.invalidate();
    }
  }

  setData(candles: Candle[]): void {
    this.candles = candles;
    this.rightOffset = 0;
    this.autoScroll = true;
    this.priceScaleK = 1; // fresh auto-fit for the new symbol / timeframe
    this.vFrozen = null; // re-engage vertical auto-fit
    this.frozenBase = null;
    this.vFrozenK = 1;
    this.invalidate();
  }

  setQuote(bid: number, ask: number): void {
    this.bid = bid;
    this.ask = ask;
    if (this.candles.length > 0) {
      const last = this.candles[this.candles.length - 1];
      const bucket = Math.floor(Date.now() / 1000 / this.tfSeconds) * this.tfSeconds;
      if (bucket > last.time) {
        this.candles.push({ time: bucket, open: bid, high: bid, low: bid, close: bid, volume: 1 });
      } else {
        last.close = bid;
        if (bid > last.high) last.high = bid;
        if (bid < last.low) last.low = bid;
        last.volume += 1;
      }
    }
    this.invalidate();
  }

  // ------------------------------------------------------------- interaction
  onWheel(deltaY: number): void {
    const factor = deltaY > 0 ? 1 / 1.18 : 1.18;
    const next = Math.min(48, Math.max(2.2, this.barWidth * factor));
    this.barWidth = next;
    if (this.autoScroll) this.rightOffset = 0;
    this.invalidate();
    this.onViewChange();
  }

  /** pointer↔price helpers based on the last rendered scale */
  private yFor(price: number): number {
    const { min, max } = this.scale;
    const plotH = this.height - PAD_BOTTOM;
    const f = (price - min) / (max - min || 1);
    // mirrors render yOf — higher prices towards the top
    return Math.round((1 - f) * (plotH - 10) + 5);
  }

  private priceAtY(y: number): number {
    const { min, max } = this.scale;
    const plotH = this.height - PAD_BOTTOM;
    return min + (1 - (y - 5) / (plotH - 10)) * (max - min);
  }

  /** the draggable trade line under the pointer, if any */
  private hitLine(x: number, y: number): EngineTradeLine | null {
    const plotW = this.width - PAD_RIGHT;
    if (x > plotW) return null;
    for (const line of this.tradeLines) {
      if (!line.draggable) continue;
      if (Math.abs(y - this.yFor(line.price)) <= 6) return line;
    }
    return null;
  }

  onMouseDown(x: number, y: number): void {
    const plotW = this.width - PAD_RIGHT;
    const plotH = this.height - PAD_BOTTOM;
    // TradingView-style axis scaling: grabbing an axis scales the chart
    if (x > plotW && y <= plotH) {
      this.dragAxis = 'price';
      this.axisStart = y;
      // manual (frozen) scale → compress/expand it in place
      this.axisStartK = this.vFrozen ? this.vFrozenK : this.priceScaleK;
      if (this.vFrozen) this.frozenBase = { ...this.vFrozen };
      this.canvas.style.cursor = 'ns-resize';
      return;
    }
    if (y > plotH) {
      this.dragAxis = 'time';
      this.axisStart = x;
      this.axisStartBar = this.barWidth;
      this.canvas.style.cursor = 'ew-resize';
      return;
    }
    // grabbing a trade line takes precedence over chart panning
    const hit = this.hitLine(x, y);
    if (hit) {
      this.dragLineId = hit.id;
      return;
    }
    this.drag = { startX: x, startOffset: this.rightOffset, startY: y };
    // already scrolled vertically once → re-anchor the frozen-scale pan
    if (this.vFrozen) {
      this.frozenBase = { ...this.vFrozen };
      this.vAnchorY = y;
      this.vPpp = (this.vFrozen.max - this.vFrozen.min) / (this.height - PAD_BOTTOM - 10);
    }
  }

  onMouseMove(x: number, y: number, dragging: boolean): void {
    // time-axis drag → horizontal zoom (bar width), TV-style exponential
    // feel: drag left spreads candles apart (zoom in), drag right compresses
    // them (zoom out) — anchored at the live edge
    if (dragging && this.dragAxis === 'time') {
      const dx = x - this.axisStart;
      const next = this.axisStartBar * Math.pow(2, -dx / 120); // ~120px = 2x
      this.barWidth = Math.min(48, Math.max(2.2, next));
      if (this.autoScroll) this.rightOffset = 0;
      this.canvas.style.cursor = 'ew-resize';
      this.invalidate();
      this.onViewChange();
      return;
    }
    // price-axis drag → vertical compression: down compresses (zoom out,
    // more range in view), up stretches (zoom in) — around the centre;
    // works in both auto-fit and manual (frozen) scale modes
    if (dragging && this.dragAxis === 'price') {
      const dy = y - this.axisStart;
      const next = Math.min(12, Math.max(0.15, this.axisStartK * Math.pow(2, dy / 120)));
      if (this.vFrozen && this.frozenBase) {
        this.vFrozenK = next;
        const c = (this.frozenBase.min + this.frozenBase.max) / 2;
        const half = ((this.frozenBase.max - this.frozenBase.min) / 2) * next;
        this.vFrozen = { min: c - half, max: c + half };
      } else {
        this.priceScaleK = next;
      }
      this.canvas.style.cursor = 'ns-resize';
      this.invalidate();
      return;
    }
    // live re-pricing of a grabbed trade line
    if (this.dragLineId) {
      const line = this.tradeLines.find((l) => l.id === this.dragLineId);
      if (line) {
        const plotH = this.height - PAD_BOTTOM;
        const yClamped = Math.min(Math.max(y, 5), plotH - 5);
        line.price = Math.max(this.priceAtY(yClamped), 0);
        this.canvas.style.cursor = 'ns-resize';
        this.invalidate();
      }
      return;
    }
    if (dragging && this.drag) {
      const dx = x - this.drag.startX;
      const dy = y - this.drag.startY;
      const slots = dx / this.barWidth;
      const plotW = this.width - PAD_RIGHT;
      const maxOffset = Math.max(0, this.candles.length - Math.floor(plotW / this.barWidth) - 1);
      // TradingView grab behaviour: the chart follows the pointer freely in
      // both directions — right pulls older bars into view, left pushes the
      // newest candle towards the left edge (empty future space appears)
      const minOffset = -Math.max(0, Math.floor((plotW - this.shiftPx() - this.barWidth / 2 - 40) / this.barWidth));
      const next = Math.round(this.drag.startOffset + slots);
      this.rightOffset = Math.min(Math.max(next, minOffset), maxOffset);
      // pinned to the live edge only when the newest candle sits at its
      // default position — scrolled either way resumes/stops it naturally
      this.autoScroll = this.rightOffset === 0;
      // vertical component — the first real vertical movement disengages
      // auto-fit (TV behaviour); afterwards the scale follows the pointer
      if (this.vFrozen === null && Math.abs(dy) > 2) {
        this.vFrozen = { ...this.scale };
        this.frozenBase = { ...this.scale };
        this.vFrozenK = 1; // captured scale already includes priceScaleK
        this.vAnchorY = y;
        this.vPpp = (this.scale.max - this.scale.min) / (this.height - PAD_BOTTOM - 10);
      }
      if (this.vFrozen && this.frozenBase) {
        const d = (y - this.vAnchorY) * this.vPpp;
        this.vFrozen = { min: this.frozenBase.min + d, max: this.frozenBase.max + d };
      }
      this.invalidate();
      this.onViewChange();
      return;
    }
    const plotW = this.width - PAD_RIGHT;
    if (x < plotW && y < this.height - PAD_BOTTOM) {
      this.crosshair = { x, y };
    } else {
      this.crosshair = null;
    }
    // resize cursors over the axes and draggable trade lines (TV affordance)
    const plotH = this.height - PAD_BOTTOM;
    if (x > plotW && y <= plotH) this.canvas.style.cursor = 'ns-resize';
    else if (y > plotH) this.canvas.style.cursor = 'ew-resize';
    else this.canvas.style.cursor = this.hitLine(x, y) ? 'ns-resize' : '';
    // hover callback
    const idx = this.indexAtX(x);
    this.onHover(idx !== null && this.candles[idx] ? this.candles[idx] : null);
    this.invalidate();
  }

  onMouseLeave(): void {
    this.crosshair = null;
    this.drag = null;
    this.dragAxis = null;
    // cancel any line drag without committing (line snaps back on re-sync)
    this.dragLineId = null;
    this.canvas.style.cursor = '';
    this.onHover(null);
    this.invalidate();
  }

  onMouseUp(): void {
    if (this.dragLineId) {
      const line = this.tradeLines.find((l) => l.id === this.dragLineId);
      this.dragLineId = null;
      this.canvas.style.cursor = '';
      if (line) {
        const price = Number(line.price.toFixed(this.digits));
        this.onLineRelease(line.id, price);
      }
      return;
    }
    this.drag = null;
    this.dragAxis = null;
    this.canvas.style.cursor = '';
  }

  /** double-click on an axis resets it — TV/MT5 behaviour:
   *  price axis → re-engage auto-fit, time axis → default zoom + scroll to end */
  onDblClick(x: number, y: number): void {
    const plotW = this.width - PAD_RIGHT;
    const plotH = this.height - PAD_BOTTOM;
    if (x > plotW && y <= plotH) {
      this.priceScaleK = 1;
      this.vFrozen = null; // back to vertical auto-fit
      this.frozenBase = null;
      this.vFrozenK = 1;
    } else if (y > plotH) {
      this.barWidth = 9;
      this.rightOffset = 0;
      this.autoScroll = true;
    }
    this.invalidate();
    this.onViewChange();
  }

  scrollToEnd(): void {
    this.rightOffset = 0;
    this.autoScroll = true;
    this.invalidate();
  }

  indexAtX(x: number): number | null {
    const slot = this.barWidth;
    const plotW = this.width - PAD_RIGHT;
    if (x < 0 || x > plotW) return null;
    const rightIdx = this.candles.length - 1 - this.rightOffset;
    // exact inverse of xOf()
    const idx = Math.round(rightIdx - (plotW - this.shiftPx() - slot / 2 - x) / slot);
    if (idx < 0 || idx >= this.candles.length) return null;
    return idx;
  }

  /** MT5 "chart shift": empty margin at the right edge so the newest
   *  candle (incl. the live bar) renders fully clear of the price axis */
  private shiftPx(): number {
    const plotW = this.width - PAD_RIGHT;
    return Math.round(Math.min(Math.max(plotW * 0.07, 24), 110));
  }

  // ------------------------------------------------------------------ math
  private visibleRange(): { left: number; right: number } {
    const plotW = this.width - PAD_RIGHT;
    const right = this.candles.length - 1 - this.rightOffset;
    const left = right - Math.ceil((plotW - this.shiftPx()) / this.barWidth) - 1;
    return { left, right };
  }

  private indicatorSeries: (number | null)[][] = [];

  private priceRange(left: number, right: number): { min: number; max: number } {
    // vertically scrolled once → the scale stays frozen (manual mode)
    if (this.vFrozen) return this.vFrozen;
    let min = Infinity;
    let max = -Infinity;
    for (let i = Math.max(0, left); i <= Math.min(this.candles.length - 1, right); i += 1) {
      const c = this.candles[i];
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    if (this.bid > 0) {
      min = Math.min(min, this.bid);
      max = Math.max(max, this.bid);
    }
    for (const ind of this.indicatorSeries) {
      for (let i = Math.max(0, left); i <= Math.min(ind.length - 1, right); i += 1) {
        const v = ind[i];
        if (v === null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
    const pad = (max - min) * 0.08 || max * 0.002;
    min -= pad;
    max += pad;
    // TradingView-style price-axis scaling — expand/compress the auto-fit
    // range around its centre (drag the right axis up/down)
    if (this.priceScaleK !== 1) {
      const c = (min + max) / 2;
      const half = ((max - min) / 2) * this.priceScaleK;
      return { min: c - half, max: c + half };
    }
    return { min, max };
  }

  private computeIndicators(): void {
    this.indicatorSeries = this.indicators.map((ind) => {
      const closes = this.candles.map((c) => c.close);
      const out: (number | null)[] = new Array(closes.length).fill(null);
      if (ind.method === 'sma') {
        let sum = 0;
        for (let i = 0; i < closes.length; i += 1) {
          sum += closes[i];
          if (i >= ind.period) sum -= closes[i - ind.period];
          if (i >= ind.period - 1) out[i] = sum / ind.period;
        }
      } else {
        const k = 2 / (ind.period + 1);
        let prev: number | null = null;
        for (let i = 0; i < closes.length; i += 1) {
          prev = prev === null ? closes[i] : closes[i] * k + prev * (1 - k);
          if (i >= ind.period - 1) out[i] = prev;
        }
      }
      return out;
    });
  }

  // --------------------------------------------------------------- drawing
  render(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const plotW = W - PAD_RIGHT;
    const plotH = H - PAD_BOTTOM;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = FONT;
    ctx.imageSmoothingEnabled = false;

    this.computeIndicators();

    // background
    ctx.fillStyle = this.scheme.bg;
    ctx.fillRect(0, 0, W, H);

    if (this.candles.length === 0) return;

    const { left, right } = this.visibleRange();
    const { min, max } = this.priceRange(left, right);
    // remember the scale for pointer↔price mapping (trade line dragging)
    this.scale = { min, max };
    const slot = this.barWidth;
    const bodyW = Math.max(1, Math.floor(slot) - 2);
    const halfBody = Math.floor(bodyW / 2);

    const yOf = (price: number) => {
      const f = (price - min) / (max - min);
      // MT5 orientation: higher prices are drawn towards the top
      return Math.round((1 - f) * (plotH - 10) + 5);
    };
    const xOf = (i: number) => {
      const rightIdx = this.candles.length - 1 - this.rightOffset;
      return Math.round(plotW - this.shiftPx() - (rightIdx - i) * slot - slot / 2);
    };

    // ---- grid ------------------------------------------------------------
    if (this.showGrid) {
      ctx.strokeStyle = this.scheme.grid;
      ctx.lineWidth = 1;

      const step = niceStep((max - min) / Math.max(2, Math.floor(plotH / 55)));
      ctx.beginPath();
      for (let p = Math.ceil(min / step) * step; p <= max; p += step) {
        const y = yOf(p) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(plotW, y);
      }
      ctx.stroke();

      const tStep = this.timeStep();
      const leftT = this.candles[Math.max(0, left)]?.time ?? 0;
      const startT = Math.ceil(leftT / tStep) * tStep;
      ctx.beginPath();
      for (let t = startT; ; t += tStep) {
        let idx = this.candles.findIndex((c) => c.time >= t);
        if (idx < 0 || this.candles[idx].time >= t + tStep) break;
        if (idx < left) idx = left;
        const x = xOf(idx) + 0.5;
        if (x < 0 || x > plotW) continue;
        if (idx > right) break;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotH);
      }
      ctx.stroke();
    }

    // ---- period separators ------------------------------------------------
    if (this.showSeparators) {
      ctx.strokeStyle = this.scheme.separator;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sepUnit = this.tfSeconds >= 86400 ? 'month' : 'day';
      let prevUnit = -1;
      for (let i = Math.max(0, left); i <= Math.min(this.candles.length - 1, right); i += 1) {
        const d = new Date(this.candles[i].time * 1000);
        const unit = sepUnit === 'day' ? d.getUTCDate() : d.getUTCMonth();
        if (prevUnit !== -1 && unit !== prevUnit) {
          const x = xOf(i) + 0.5;
          if (x > 0 && x < plotW) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, plotH);
          }
        }
        prevUnit = unit;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- price series ------------------------------------------------------
    const iStart = Math.max(0, left);
    const iEnd = Math.min(this.candles.length - 1, right);

    if (this.chartType === 'candles') {
      for (let i = iStart; i <= iEnd; i += 1) {
        const c = this.candles[i];
        const x = xOf(i);
        if (x < -slot || x > plotW + slot) continue;
        const bull = c.close >= c.open;
        const yO = yOf(c.open);
        const yC = yOf(c.close);
        const yH = yOf(c.high);
        const yL = yOf(c.low);
        const top = Math.min(yO, yC);
        const h = Math.max(Math.abs(yC - yO), 1);

        ctx.strokeStyle = bull ? this.scheme.bullBorder : this.scheme.bearBody;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yH);
        ctx.lineTo(x + 0.5, yL);
        ctx.stroke();

        if (bull) {
          // hollow bullish candle — MT5 classic look
          ctx.fillStyle = this.scheme.bullFill;
          ctx.fillRect(x - halfBody, top, bodyW, h);
          ctx.strokeStyle = this.scheme.bullBorder;
          ctx.strokeRect(x - halfBody + 0.5, top + 0.5, bodyW - 1, Math.max(h - 1, 1));
        } else {
          ctx.fillStyle = this.scheme.bearBody;
          ctx.fillRect(x - halfBody, top, bodyW, h);
        }
      }
    } else if (this.chartType === 'bars') {
      for (let i = iStart; i <= iEnd; i += 1) {
        const c = this.candles[i];
        const x = xOf(i);
        if (x < -slot || x > plotW + slot) continue;
        const up = c.close >= c.open;
        ctx.strokeStyle = up ? this.scheme.barUp : this.scheme.barDown;
        const yO = yOf(c.open);
        const yC = yOf(c.close);
        const tick = Math.max(3, Math.floor(slot / 2) - 1);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yOf(c.high));
        ctx.lineTo(x + 0.5, yOf(c.low));
        ctx.moveTo(x - tick, yO + 0.5);
        ctx.lineTo(x + 0.5, yO + 0.5);
        ctx.moveTo(x + 0.5, yC + 0.5);
        ctx.lineTo(x + tick, yC + 0.5);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = this.scheme.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let i = iStart; i <= iEnd; i += 1) {
        const x = xOf(i);
        const y = yOf(this.candles[i].close);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // ---- indicators ---------------------------------------------------------
    this.indicatorSeries.forEach((series, si) => {
      const ind = this.indicators[si];
      if (!ind) return;
      ctx.strokeStyle = ind.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (let i = iStart; i <= iEnd; i += 1) {
        const v = series[i];
        if (v === null) {
          started = false;
          continue;
        }
        const x = xOf(i);
        const y = yOf(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    // ---- bid line + tag ------------------------------------------------------
    if (this.bid > 0 && this.bid >= min && this.bid <= max) {
      const y = yOf(this.bid) + 0.5;
      ctx.strokeStyle = this.scheme.bidLine;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = this.scheme.bidLine;
      ctx.fillRect(plotW + 1, y - 9, PAD_RIGHT - 2, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(this.bid.toFixed(this.digits), plotW + PAD_RIGHT / 2, y + 4);
    }

    // ---- trade levels (MT5 style: dashed line + left label tag) -------------
    // position entries, S/L, T/P and pending-order prices; draggable
    // lines show an axis tag while being re-priced
    for (const tl of this.tradeLines) {
      if (tl.price < min || tl.price > max) continue;
      const y = this.yFor(tl.price) + 0.5;
      ctx.strokeStyle = tl.color;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      const text = `${tl.tag} ${tl.price.toFixed(this.digits)}`;
      ctx.fillStyle = tl.color;
      const w = Math.max(58, text.length * 6 + 10);
      ctx.fillRect(2, y - 8, w, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(text, 6, y + 4);

      // dragged line — mirror the live price on the price axis
      if (tl.id === this.dragLineId) {
        ctx.fillStyle = tl.color;
        ctx.fillRect(plotW + 1, y - 9, PAD_RIGHT - 2, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(tl.price.toFixed(this.digits), plotW + PAD_RIGHT / 2, y + 4);
      }
    }

    // ---- price axis ----------------------------------------------------------
    const pStep = niceStep((max - min) / Math.max(2, Math.floor(plotH / 55)));
    for (let p = Math.ceil(min / pStep) * pStep; p <= max; p += pStep) {
      const y = yOf(p);
      ctx.fillStyle = this.scheme.bg;
      ctx.fillRect(plotW + 1, y - 8, PAD_RIGHT - 2, 16);
      ctx.fillStyle = this.scheme.axisText;
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(this.digits), plotW + 6, y + 4);
    }
    ctx.strokeStyle = this.scheme.grid;
    ctx.beginPath();
    ctx.moveTo(plotW + 0.5, 0);
    ctx.lineTo(plotW + 0.5, plotH);
    ctx.moveTo(0, plotH + 0.5);
    ctx.lineTo(plotW, plotH + 0.5);
    ctx.stroke();

    // ---- candle countdown (MT5 price-scale timer) ----------------------------
    // small tag right under the bid tag counting down to the bar close;
    // drawn after the price axis so axis labels never overpaint it
    if (this.showCountdown && this.bid > 0 && this.bid >= min && this.bid <= max) {
      const last = this.candles[this.candles.length - 1];
      const rem = Math.max(0, last.time + this.tfSeconds - Date.now() / 1000);
      const hh = Math.floor(rem / 3600);
      const mm = Math.floor((rem % 3600) / 60);
      const ss = Math.floor(rem % 60);
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const label = hh > 0 ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;

      const by = yOf(this.bid);
      // bid tag spans by-9 .. by+9 → place the countdown directly below,
      // or flip above when it would run off the bottom edge
      let ty = by + 10;
      if (ty + 16 > plotH) ty = by - 26;
      ctx.fillStyle = '#5A5A5A';
      ctx.fillRect(plotW + 1, ty, PAD_RIGHT - 2, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(label, plotW + PAD_RIGHT / 2, ty + 12);
    }

    // ---- time axis ------------------------------------------------------------
    const tStep = this.timeStep();
    const leftT = this.candles[Math.max(0, left)]?.time ?? 0;
    const startT = Math.ceil(leftT / tStep) * tStep;
    ctx.textAlign = 'center';
    const dayBoundary = 86400;
    for (let t = startT; ; t += tStep) {
      const idx = this.candles.findIndex((c) => c.time >= t);
      if (idx < 0) break;
      if (this.candles[idx].time >= t + tStep) break;
      if (idx > iEnd) break;
      const x = xOf(idx);
      if (x > 0 && x < plotW) {
        const isMidnight = this.candles[idx].time % dayBoundary === 0;
        let label: string;
        if (tStep >= 2592000) {
          label = fmtDayLabelYear(this.candles[idx].time);
        } else if (isMidnight) {
          label = fmtDayLabel(this.candles[idx].time);
        } else {
          label = fmtClock(this.candles[idx].time);
        }
        ctx.fillStyle = this.scheme.axisText;
        ctx.fillText(label, x, plotH + 16);
      }
    }

    // ---- crosshair -------------------------------------------------------------
    if (this.crosshair) {
      const { x, y } = this.crosshair;
      if (x < plotW && y < plotH) {
        ctx.strokeStyle = this.scheme.crosshair;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, plotH);
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(plotW, y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        const price = min + (1 - (y - 5) / (plotH - 10)) * (max - min);
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(plotW + 1, y - 9, PAD_RIGHT - 2, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(price.toFixed(this.digits), plotW + PAD_RIGHT / 2, y + 4);

        const idx = this.indexAtX(x);
        if (idx !== null && this.candles[idx]) {
          const d = new Date(this.candles[idx].time * 1000);
          const pad = (n: number) => String(n).padStart(2, '0');
          const label =
            this.tfSeconds >= 86400
              ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
              : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
          ctx.fillStyle = '#5A5A5A';
          const w = Math.max(54, label.length * 7 + 10);
          ctx.fillRect(x - w / 2, plotH + 1, w, PAD_BOTTOM - 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(label, x, plotH + 16);
        }
      }
    }
  }

  private timeStep(): number {
    const targetPx = 80;
    const slots = targetPx / this.barWidth;
    const targetSec = slots * this.tfSeconds;
    for (const s of TIME_STEPS) {
      if (s >= targetSec) return s;
    }
    return 31536000;
  }
}
