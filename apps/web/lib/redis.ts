import Redis from 'ioredis';

let client: Redis | null = null;
let sub: Redis | null = null;

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export function getRedis(): Redis {
  if (!client) client = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return client;
}

export function getRedisSub(): Redis {
  if (!sub) sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return sub;
}
