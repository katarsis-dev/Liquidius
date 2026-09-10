import { redis, KEYS } from '@liquidius/core';
import type { AlertPayload } from '@liquidius/core';

/**
 * Dedupe alert dgn Redis SETNX + TTL.
 * Key: dedupe:{mint}:{mode}:{trigger}. Return true bila boleh kirim (first time).
 */
export async function shouldSend(a: AlertPayload, ttlSec = 1800): Promise<boolean> {
  const key = `${KEYS.dedupe(a.mint, a.mode)}:${a.trigger}`;
  const res = await redis().set(key, '1', 'EX', ttlSec, 'NX');
  return res === 'OK';
}
