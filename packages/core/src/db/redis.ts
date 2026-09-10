import Redis from 'ioredis';
import { loadEnv } from '../config/env.js';

let client: Redis | null = null;
let sub: Redis | null = null;

/** Redis client tunggal (lazy). */
export function redis(): Redis {
  if (!client) {
    const env = loadEnv();
    client = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });
  }
  return client;
}

/** Redis subscriber terpisah (pub/sub perlu koneksi khusus). */
export function redisSub(): Redis {
  if (!sub) {
    const env = loadEnv();
    sub = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });
  }
  return sub;
}

export const CHANNELS = {
  alerts: (mode: string) => `alerts:${mode}`,
  alertsAll: 'alerts:*',
} as const;

export const KEYS = {
  metricsWindow: (pair: string, minute: number) => `metrics:${pair}:${minute}`,
  dedupe: (mint: string, mode: string) => `dedupe:${mint}:${mode}`,
  pairSnapshot: (mint: string) => `snapshot:${mint}`,
} as const;
