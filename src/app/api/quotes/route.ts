import { NextRequest } from 'next/server';
import { hubReady, type FeedSource, type HubQuote } from '@/lib/tv/hub';
import { SYMBOLS } from '@/lib/symbols';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface WireQuote {
  b: number; // bid
  a: number; // ask
  d: number; // dir
  c: number; // change
  cp: number; // change %
  h: number; // high
  l: number; // low
  o: number; // open
  t: number; // time
  s: FeedSource; // per-symbol source
}

function toWire(q: HubQuote): WireQuote {
  return {
    b: q.bid as number,
    a: q.ask as number,
    d: q.dir as number,
    c: Math.round((q.ch as number) * 1e10) / 1e10,
    cp: Math.round((q.chp as number) * 100) / 100,
    h: q.high as number,
    l: q.low as number,
    o: q.open as number,
    t: q.time as number,
    s: q.source as FeedSource,
  };
}

export async function GET(req: NextRequest) {
  const hub = await hubReady();

  const encoder = new TextEncoder();
  let pushTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // initial full snapshot
      const snap = hub.snapshot();
      const full: Record<string, WireQuote> = {};
      for (const s of SYMBOLS) full[s.name] = toWire(snap[s.name]);
      send('snapshot', { quotes: full, status: hub.status() });

      // batched deltas — compare a cheap signature per symbol
      const seen = new Map<string, string>();
      for (const s of SYMBOLS) seen.set(s.name, sig(snap[s.name]));

      pushTimer = setInterval(() => {
        const cur = hub.snapshot();
        const delta: Record<string, WireQuote> = {};
        let changed = false;
        for (const s of SYMBOLS) {
          const k = sig(cur[s.name]);
          if (seen.get(s.name) !== k) {
            seen.set(s.name, k);
            delta[s.name] = toWire(cur[s.name]);
            changed = true;
          }
        }
        if (changed) send('quotes', delta);
      }, 300);

      heartbeat = setInterval(() => {
        send('status', hub.status());
      }, 10_000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        if (pushTimer) clearInterval(pushTimer);
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (pushTimer) clearInterval(pushTimer);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function sig(q: HubQuote): string {
  return `${q.bid}|${q.dir}|${q.time}|${q.high}|${q.low}`;
}
