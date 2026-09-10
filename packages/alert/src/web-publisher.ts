import { redis, CHANNELS, logger, type AlertPayload } from '@liquidius/core';

/**
 * Publish alert ke Redis pub/sub — dikonsumsi oleh Next.js `/api/alerts/stream`
 * (SSE). Channel: `alerts:{mode}`. Payload adalah JSON stringified AlertPayload.
 * Juga simpan LTRIM ring buffer 500 recent per mode utk `/api/alerts/recent`.
 */
export async function publishWebAlert(payload: AlertPayload): Promise<void> {
  try {
    const r = redis();
    const json = JSON.stringify(payload);
    await Promise.all([
      r.publish(CHANNELS.alerts(payload.mode), json),
      r.lpush(`recent:${payload.mode}`, json),
      r.ltrim(`recent:${payload.mode}`, 0, 499),
    ]);
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[web-publisher] failed');
  }
}
