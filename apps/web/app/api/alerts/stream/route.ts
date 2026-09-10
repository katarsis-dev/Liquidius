import type { NextRequest } from 'next/server';
import { getBus } from '@/lib/bus';
import type { AlertPayload } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events endpoint. Baca dari in-memory bus (no Redis).
 * Client (`useAlertStream`) subscribe di sini dan menerima payload realtime.
 */
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const bus = getBus();

      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      send('ready', JSON.stringify({ ts: Date.now() }));

      const onAlert = (payload: AlertPayload) => {
        send('alert', JSON.stringify(payload));
      };
      bus.emitter.on('alert', onAlert);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          /* ignore */
        }
      }, 15_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        bus.emitter.off('alert', onAlert);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal?.addEventListener('abort', cleanup);
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
