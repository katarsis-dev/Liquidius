import { EventEmitter } from 'node:events';
import type { AlertPayload } from './sse';

/**
 * In-memory event bus + ring buffer.
 * Menggantikan Redis pub/sub (opsi Free-tier, no external deps).
 *
 * Sekali proses Next.js hidup, singleton di globalThis tetap ada lintas
 * hot-reload di dev. Restart = state kosong (acceptable untuk single-user free tier).
 */

const RING_LIMIT = 500;

interface Bus {
  emitter: EventEmitter;
  buffers: Record<'DEGEN' | 'MEDIUM' | 'SAFE', AlertPayload[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __liquidiusBus__: Bus | undefined;
}

function makeBus(): Bus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return {
    emitter,
    buffers: { DEGEN: [], MEDIUM: [], SAFE: [] },
  };
}

export function getBus(): Bus {
  if (!globalThis.__liquidiusBus__) {
    globalThis.__liquidiusBus__ = makeBus();
  }
  return globalThis.__liquidiusBus__;
}

export function publishAlert(payload: AlertPayload): void {
  const bus = getBus();
  const buf = bus.buffers[payload.mode];
  buf.unshift(payload);
  if (buf.length > RING_LIMIT) buf.length = RING_LIMIT;
  bus.emitter.emit('alert', payload);
}

export function getRecent(
  mode: 'DEGEN' | 'MEDIUM' | 'SAFE',
  limit = 100,
): AlertPayload[] {
  return getBus().buffers[mode].slice(0, limit);
}

export function findByMint(mint: string): AlertPayload | null {
  const bus = getBus();
  for (const mode of ['DEGEN', 'MEDIUM', 'SAFE'] as const) {
    const found = bus.buffers[mode].find((a) => a.mint === mint);
    if (found) return found;
  }
  return null;
}
