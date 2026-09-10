import Fastify from 'fastify';
import client from 'prom-client';
import { logger, redis } from '@liquidius/core';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const alertLatency = new client.Histogram({
  name: 'alert_e2e_latency_seconds',
  help: 'End-to-end latency from ingest event to alert dispatch',
  buckets: [0.5, 1, 2, 3, 5, 10, 30],
  registers: [registry],
});
export const skippedTotal = new client.Counter({
  name: 'skipped_total',
  help: 'Tokens skipped by auto-skip gate',
  labelNames: ['reason'],
  registers: [registry],
});

/**
 * HTTP server: /healthz, /metrics, /alerts/recent (untuk Next.js server-side fetch).
 */
export function startHttp(port: number): void {
  const app = Fastify({ logger: false });

  app.get('/healthz', async () => ({ ok: true, uptime: process.uptime() }));

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });

  app.get('/alerts/recent', async (req) => {
    const q = req.query as { mode?: string; limit?: string };
    const mode = (q.mode ?? 'MEDIUM').toUpperCase();
    const limit = Math.min(500, Number(q.limit ?? 100));
    const raws = await redis().lrange(`recent:${mode}`, 0, limit - 1);
    return raws.map((r) => JSON.parse(r));
  });

  app.listen({ port, host: '0.0.0.0' }).then(() => {
    logger.info({ port }, '[http] screener listening');
  });
}
