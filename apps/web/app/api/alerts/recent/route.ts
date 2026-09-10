import { NextResponse, type NextRequest } from 'next/server';
import { getRecent } from '@/lib/bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/alerts/recent?mode=MEDIUM&limit=100 — baca ring buffer in-memory. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') ?? 'MEDIUM').toUpperCase();
  const limit = Math.min(500, Number(searchParams.get('limit') ?? '100'));
  if (!['DEGEN', 'MEDIUM', 'SAFE'].includes(mode)) {
    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
  }
  return NextResponse.json({
    items: getRecent(mode as 'DEGEN' | 'MEDIUM' | 'SAFE', limit),
  });
}
