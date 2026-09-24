// Trade-server sync API — the client pushes its account state here on
// every change and with a 3s heartbeat; the server executor
// (lib/server/executor.ts) takes over pending-order / S/L / T/P /
// trailing execution when the platform (browser) goes away.
//
//   GET  → current server-side trading state (for adoption on load)
//   POST → ingest a client state snapshot (409 = client stale, adopt first)

import { NextRequest } from 'next/server';
import { getExecutor, type IngestPayload } from '@/lib/server/executor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const ex = getExecutor();
  await ex.ensureLoaded();
  return Response.json(
    { state: ex.getState() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const ex = getExecutor();
  const body = (await req.json().catch(() => null)) as IngestPayload | null;
  const result = await ex.ingest(body ?? {});
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
