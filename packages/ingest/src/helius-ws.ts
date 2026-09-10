import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { loadEnv, logger } from '@liquidius/core';
import { PROGRAM_IDS } from './program-ids.js';
import type { IngestEvent } from './events.js';
import { parsePumpFunLogs } from './pumpfun-parser.js';
import { parseRaydiumLogs } from './raydium-parser.js';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

interface LogsNotification {
  jsonrpc: '2.0';
  method: 'logsNotification';
  params: {
    result: {
      context: { slot: number };
      value: { signature: string; err: unknown; logs: string[] };
    };
    subscription: number;
  };
}

/**
 * Subscribe ke `logsSubscribe` untuk 2–3 program (pump.fun, Raydium AMM v4, PumpSwap).
 * Emit event `event` bertipe IngestEvent ke listener.
 */
export class HeliusLogsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private stopped = false;
  private subs = new Map<number, string>();

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    const env = loadEnv();
    logger.info('[helius-ws] connecting');
    this.ws = new WebSocket(env.HELIUS_WSS_URL);

    this.ws.on('open', () => {
      logger.info('[helius-ws] connected');
      this.reconnectAttempt = 0;
      this.subscribeAll();
    });

    this.ws.on('message', (raw) => {
      this.handleMessage(raw.toString());
    });

    this.ws.on('close', (code) => {
      logger.warn({ code }, '[helius-ws] closed');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error({ err: err.message }, '[helius-ws] error');
    });
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    this.reconnectAttempt++;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_MIN_MS * Math.pow(2, this.reconnectAttempt - 1),
    );
    logger.info({ delayMs: delay }, '[helius-ws] reconnecting');
    setTimeout(() => this.connect(), delay);
  }

  private subscribeAll() {
    const targets = [
      { name: 'PUMP_FUN', id: PROGRAM_IDS.PUMP_FUN },
      { name: 'RAYDIUM_AMM_V4', id: PROGRAM_IDS.RAYDIUM_AMM_V4 },
      { name: 'PUMP_SWAP', id: PROGRAM_IDS.PUMP_SWAP },
    ];
    for (const [i, t] of targets.entries()) {
      const req = {
        jsonrpc: '2.0',
        id: i + 1,
        method: 'logsSubscribe',
        params: [{ mentions: [t.id] }, { commitment: 'processed' }],
      };
      this.ws?.send(JSON.stringify(req));
      this.subs.set(i + 1, t.name);
    }
  }

  private handleMessage(data: string) {
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    const m = msg as Partial<LogsNotification> & { id?: number; result?: number };

    // subscription confirmation
    if (typeof m.id === 'number' && typeof m.result === 'number') {
      logger.debug({ sub: m.result, source: this.subs.get(m.id) }, '[helius-ws] sub ack');
      return;
    }

    if (m.method !== 'logsNotification' || !m.params) return;

    const { logs, signature, err } = m.params.result.value;
    const slot = m.params.result.context.slot;
    if (err) return;

    // Route by log content. Cheap prefix match untuk hindari alloc heavy.
    const events: IngestEvent[] = [];
    if (logs.some((l) => l.includes(PROGRAM_IDS.PUMP_FUN))) {
      events.push(...parsePumpFunLogs(logs, { signature, slot, ts: Date.now() }));
    }
    if (
      logs.some(
        (l) =>
          l.includes(PROGRAM_IDS.RAYDIUM_AMM_V4) || l.includes(PROGRAM_IDS.PUMP_SWAP),
      )
    ) {
      events.push(...parseRaydiumLogs(logs, { signature, slot, ts: Date.now() }));
    }
    for (const ev of events) this.emit('event', ev);
  }
}
