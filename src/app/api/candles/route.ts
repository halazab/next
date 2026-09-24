import { NextRequest, NextResponse } from 'next/server';
import { getCandles } from '@/lib/tv/candles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') ?? 'EURUSD';
  const tf = searchParams.get('tf') ?? 'M15';
  const count = Math.min(Number(searchParams.get('count') ?? 500) || 500, 1500);

  try {
    const result = await getCandles(symbol, tf, count);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api/candles] error:', e);
    return NextResponse.json({ error: 'failed to load candles' }, { status: 500 });
  }
}
