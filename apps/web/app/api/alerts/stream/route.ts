import type { NextRequest } from 'next/server';
import { getRedisSub } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events endpoint. Client (`useAlertStream`) subscribe di sini
 * dan menerima payload alert realtime via Redis pub/sub channel `alerts:*`.
 */
export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const sub = getRedisSub();
      const encoder = new TextEncoder();

      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      send('ready', JSON.stringify({ ts: Date.now() }));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          /* stream closed */
        }
      }, 15_000);

      const onMessage = (channel: string, message: string) => {
        // channel = alerts:DEGEN|MEDIUM|SAFE
        send('alert', message);
      };

      await sub.psubscribe('alerts:*');
      sub.on('pmessage', (_pattern, channel, message) => onMessage(channel, message));

      const cleanup = () => {
        clearInterval(heartbeat);
        sub.punsubscribe('alerts:*').catch(() => undefined);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // @ts-expect-error abort signal not fully typed in some Next versions
      _req.signal?.addEventListener('abort', cleanup);
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
