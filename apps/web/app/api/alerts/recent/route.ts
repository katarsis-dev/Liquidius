import { NextResponse, type NextRequest } from 'next/server';
import { getRedis } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/alerts/recent?mode=MEDIUM&limit=100 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get('mode') ?? 'MEDIUM').toUpperCase();
  const limit = Math.min(500, Number(searchParams.get('limit') ?? '100'));
  if (!['DEGEN', 'MEDIUM', 'SAFE'].includes(mode)) {
    return NextResponse.json({ error: 'invalid mode' }, { status: 400 });
  }
  const raws = await getRedis().lrange(`recent:${mode}`, 0, limit - 1);
  const items = raws.map((r) => {
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  }).filter(Boolean);
  return NextResponse.json({ items });
}
