// Server-side trade executor — keeps executing pending orders, S/L,
// T/P and trailing stops on the shared TradingView quote hub even when
// no browser (platform) is connected. The account state is synced from
// the client and persisted to disk, so execution survives page reloads
// and server restarts — mirroring how the real MT5 trade server works:
//
//   • client open   → heartbeats every 3s keep the server executor idle
//                     (the client executes instantly on its own copy)
//   • client closed → after a 5s grace the executor runs on every quote
//                     cycle: activates pendings, hits S/L / T/P, trails
//                     stops, records deals and journals server notes
//   • client back   → adopts the server state (executed deals appear in
//                     History / Journal), then resumes as the executor

import fs from 'node:fs/promises';
import path from 'node:path';
import { hubReady, getHub } from '@/lib/tv/hub';
import { SYMBOLS } from '@/lib/symbols';
import { profitAt } from '@/lib/calc';
import { decideTrades } from '@/lib/trade-rules';
import type { Position, Deal, PendingOrder } from '@/stores/trading';

const STATE_PATH = path.join(process.cwd(), '.mt5-server-state.json');
const GRACE_MS = 5_000; // client heartbeats every 3s — 5s silence = platform closed
const TICK_MS = 600;

export interface ServerNote {
  id: number;
  t: number;
  text: string;
}

export interface ServerState {
  balance: number;
  currency: string;
  positions: Position[];
  pendings: PendingOrder[];
  deals: Deal[];
  notes: ServerNote[];
  noteSeq: number;
  updatedAt: number;
  execSeq: number;
}

export interface IngestPayload {
  clientUpdatedAt?: number;
  seenExecSeq?: number;
  lastNoteId?: number;
  state?: {
    balance?: number;
    currency?: string;
    positions?: Position[];
    pendings?: PendingOrder[];
    deals?: Deal[];
  };
}

export interface IngestResult {
  ok: boolean;
  execSeq: number;
  stale?: boolean;
}

class TradeExecutor {
  private state: ServerState | null = null;
  private loaded = false;
  private loading: Promise<void> | null = null;
  private lastClientSyncAt = 0;
  private ticketSeq = 51_000_001;
  private timer: ReturnType<typeof setInterval> | null = null;
  private saving = false;
  private dirty = false;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const raw = await fs.readFile(STATE_PATH, 'utf8');
          this.state = JSON.parse(raw) as ServerState;
        } catch {
          this.state = null; // first run — nothing persisted yet
        }
        if (this.state) this.recalcTicketSeq();
        this.loaded = true;
        void this.startTicker();
      })();
    }
    await this.loading;
  }

  private recalcTicketSeq(): void {
    const s = this.state!;
    const maxUsed = Math.max(
      ...s.positions.map((p) => p.ticket),
      ...s.deals.map((d) => d.ticket),
      ...s.pendings.map((o) => o.ticket),
      51_000_000,
    );
    this.ticketSeq = Math.max(this.ticketSeq, maxUsed + 1);
  }

  /** client pushed its account state (every change + 3s heartbeat) */
  async ingest(payload: IngestPayload): Promise<IngestResult> {
    await this.ensureLoaded();
    this.lastClientSyncAt = Date.now();
    const prev = this.state;
    const execSeq = prev?.execSeq ?? 0;

    if (payload.state && (payload.seenExecSeq ?? 0) >= execSeq) {
      const s = payload.state;
      this.state = {
        balance: typeof s.balance === 'number' ? s.balance : prev?.balance ?? 10000,
        currency: s.currency ?? prev?.currency ?? 'USD',
        positions: Array.isArray(s.positions) ? s.positions : prev?.positions ?? [],
        pendings: Array.isArray(s.pendings) ? s.pendings : prev?.pendings ?? [],
        deals: Array.isArray(s.deals) ? s.deals : prev?.deals ?? [],
        // keep server notes the client has not adopted yet
        notes: (prev?.notes ?? []).filter((n) => n.id > (payload.lastNoteId ?? 0)),
        noteSeq: prev?.noteSeq ?? 0,
        updatedAt: Date.now(),
        execSeq,
      };
      this.recalcTicketSeq();
      void this.save();
      return { ok: true, execSeq };
    }

    // stale client (it missed server-side executions) — must adopt first
    return { ok: false, execSeq, stale: !payload.state };
  }

  getState(): ServerState | null {
    return this.state;
  }

  // ------------------------------------------------------------------ disk
  private async save(): Promise<void> {
    if (this.saving) {
      this.dirty = true;
      return;
    }
    this.saving = true;
    try {
      await fs.writeFile(STATE_PATH, JSON.stringify(this.state), 'utf8');
    } catch {
      /* disk errors are non-fatal — execution continues in memory */
    }
    this.saving = false;
    if (this.dirty) {
      this.dirty = false;
      void this.save();
    }
  }

  // ---------------------------------------------------------------- engine
  private async startTicker(): Promise<void> {
    if (this.timer) return;
    await hubReady(); // keep the quote hub streaming even with zero browsers
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    const st = this.state;
    if (!st) return;
    // platform open → the client executes on its own copy, stay idle
    if (Date.now() - this.lastClientSyncAt < GRACE_MS) return;

    const snap = getHub().snapshot();
    const quotes: Record<string, { bid: number; ask: number }> = {};
    for (const s of SYMBOLS) {
      const q = snap[s.name];
      if (q && q.bid > 0) quotes[s.name] = { bid: q.bid, ask: q.ask };
    }

    const { closes, trail, activations } = decideTrades(st.positions, st.pendings, quotes);
    if (closes.length === 0 && trail.length === 0 && activations.length === 0) return;

    const now = Date.now();
    const closedTickets = new Set(closes.map((c) => c.ticket));
    let balance = st.balance;
    const deals = [...st.deals];
    const notes = [...st.notes];
    let noteSeq = st.noteSeq;
    const note = (text: string) => {
      noteSeq += 1;
      notes.push({ id: noteSeq, t: now, text });
    };

    // 1) S/L & T/P execution — close at the stop price
    let positions = st.positions.filter((p) => !closedTickets.has(p.ticket));
    for (const c of closes) {
      const pos = st.positions.find((p) => p.ticket === c.ticket);
      if (!pos) continue;
      const profit = profitAt(pos, c.closePrice, quotes);
      balance += profit;
      deals.unshift({
        ticket: pos.ticket,
        symbol: pos.symbol,
        type: pos.type,
        volume: pos.volume,
        openPrice: pos.openPrice,
        closePrice: c.closePrice,
        openTime: pos.openTime,
        closeTime: now,
        profit,
        commission: pos.commission,
        swap: pos.swap,
        balanceAfter: balance,
      });
      note(
        `${c.reason === 'sl' ? 'stop loss' : 'take profit'} hit #${pos.ticket} ${pos.symbol} — closed ${pos.volume.toFixed(2)} at ${c.closePrice} (trade server, platform closed)`,
      );
    }

    // 2) trailing-stop maintenance
    positions = positions.map((p) => {
      const t = trail.find((x) => x.ticket === p.ticket);
      return t ? { ...p, sl: t.sl } : p;
    });

    // 3) pending-order activation — new position at the order price
    const actTickets = new Set(activations.map((a) => a.ticket));
    const pendings = st.pendings.filter((o) => !actTickets.has(o.ticket));
    for (const o of st.pendings) {
      if (!actTickets.has(o.ticket)) continue;
      const type = o.type.startsWith('buy') ? 'buy' : 'sell';
      const ticket = this.ticketSeq++;
      positions.push({
        ticket,
        symbol: o.symbol,
        type,
        volume: o.volume,
        openPrice: o.price,
        openTime: now,
        sl: o.sl,
        tp: o.tp,
        commission: 0,
        swap: 0,
      });
      note(
        `order #${o.ticket} ${o.type} activated — opened #${ticket} ${type} ${o.volume.toFixed(2)} ${o.symbol} at ${o.price} (trade server, platform closed)`,
      );
    }

    this.state = {
      ...st,
      balance,
      positions,
      pendings,
      deals,
      notes: notes.slice(-50),
      noteSeq,
      updatedAt: now,
      execSeq: st.execSeq + 1,
    };
    void this.save();
  }
}

declare global {
  var __mt5TradeExecutor: TradeExecutor | undefined;
}

export function getExecutor(): TradeExecutor {
  if (!globalThis.__mt5TradeExecutor) {
    globalThis.__mt5TradeExecutor = new TradeExecutor();
  }
  return globalThis.__mt5TradeExecutor;
}
