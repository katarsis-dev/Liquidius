/**
 * Helius WebSocket listener — deteksi pump.fun launches secara realtime.
 *
 * Free-tier notes:
 *   - Batasi 1 WS connection (subscribe pump.fun program aja).
 *   - Batasi RPC `getParsedTransaction` ≤ 30/menit (budget ~33k credits/hari).
 *   - Kalau HELIUS_API_KEY kosong: module ini nggak start apa-apa.
 *
 * Emit event `pumpfun_create` dgn { mint, signature, slot, ts } untuk
 * dikonsumsi pipeline.ts.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const RPC_MAX_PER_MIN = 20; // total budget, di-share antar semua caller (resolveMint + creator check)

export interface PumpFunCreateEvent {
  mint: string;
  signature: string;
  slot: number;
  ts: number;
  creator?: string;
  symbol?: string;
  name?: string;
}

export const heliusEvents = new EventEmitter();

let ws: WebSocket | null = null;
let reconnectAttempt = 0;
let stopped = false;
const rpcTimestamps: number[] = []; // sliding window untuk rate limit (shared)

/** Shared rate limit — dipakai resolveMint + creator history check + siapapun. */
export function canCallHeliusRpc(): boolean {
  const now = Date.now();
  while (rpcTimestamps.length && now - rpcTimestamps[0]! > 60_000) rpcTimestamps.shift();
  return rpcTimestamps.length < RPC_MAX_PER_MIN;
}
export function markHeliusRpcCall(): void {
  rpcTimestamps.push(Date.now());
}
// Alias lama (backward compat internal)
const canCallRpc = canCallHeliusRpc;
const markRpcCall = markHeliusRpcCall;

async function resolveMintFromSignature(signature: string): Promise<{
  mint?: string;
  creator?: string;
} | null> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) return null;
  if (!canCallRpc()) {
    // eslint-disable-next-line no-console
    console.warn('[helius] RPC rate limit hit, skipping signature', signature.slice(0, 8));
    return null;
  }
  markRpcCall();
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
        ],
      }),
    });
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const tx = data?.result;
    if (!tx) return null;
    // pump.fun Create instruction biasanya menaruh mint di account index tertentu.
    // Heuristik: cari account yang jadi tokenBalance baru post-tx dengan supply == 1_000_000_000 * 10^6
    const postBalances = tx?.meta?.postTokenBalances ?? [];
    const preBalances = tx?.meta?.preTokenBalances ?? [];
    const preMints = new Set(preBalances.map((b: { mint: string }) => b.mint));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMint = postBalances.find((b: any) => !preMints.has(b.mint));
    const mint = newMint?.mint as string | undefined;

    const feePayer = tx?.transaction?.message?.accountKeys?.[0];
    const creator =
      typeof feePayer === 'string' ? feePayer : (feePayer?.pubkey as string | undefined);

    return { mint, creator };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[helius] getTransaction failed:', (err as Error).message);
    return null;
  }
}

let dropCounter = 0;

function handleLogs(logs: string[], signature: string, slot: number): void {
  const joined = logs.join('\n');
  // Deteksi Create / InitializeBondingCurve. pump.fun v1 pakai instruksi "Create".
  if (!/Instruction:\s*(Create|InitializeBondingCurve)/i.test(joined)) return;

  // Hemat RPC budget: kalau sudah dekat limit, drop event (sample).
  // pump.fun bisa spawn puluhan token/menit — nggak semua harus di-resolve.
  if (!canCallRpc()) {
    dropCounter++;
    if (dropCounter % 20 === 0) {
      // eslint-disable-next-line no-console
      console.log(`[helius] RPC budget saturated, dropped ${dropCounter} events so far`);
    }
    return;
  }

  // Resolve mint di background — tidak blocking WS handler
  void (async () => {
    const resolved = await resolveMintFromSignature(signature);
    if (!resolved?.mint) return;
    const ev: PumpFunCreateEvent = {
      mint: resolved.mint,
      signature,
      slot,
      ts: Date.now(),
      creator: resolved.creator,
    };
    heliusEvents.emit('pumpfun_create', ev);
  })();
}

function connect(): void {
  const wssUrl = process.env.HELIUS_WSS_URL;
  if (!wssUrl) return;

  // eslint-disable-next-line no-console
  console.log('[helius] connecting…');
  ws = new WebSocket(wssUrl);

  ws.on('open', () => {
    // eslint-disable-next-line no-console
    console.log('[helius] connected — subscribing pump.fun logs');
    reconnectAttempt = 0;
    ws?.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'logsSubscribe',
        params: [{ mentions: [PUMP_FUN_PROGRAM_ID] }, { commitment: 'processed' }],
      }),
    );
  });

  ws.on('message', (raw) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = JSON.parse(raw.toString()) as any;
      if (msg.method !== 'logsNotification') return;
      const val = msg.params?.result?.value;
      const slot = msg.params?.result?.context?.slot ?? 0;
      if (!val || val.err) return;
      handleLogs(val.logs ?? [], val.signature, slot);
    } catch {
      /* malformed */
    }
  });

  ws.on('close', () => {
    // eslint-disable-next-line no-console
    console.warn('[helius] WS closed');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[helius] WS error:', (err as Error).message);
  });
}

function scheduleReconnect(): void {
  if (stopped) return;
  reconnectAttempt++;
  const delay = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_MIN_MS * Math.pow(2, reconnectAttempt - 1),
  );
  // eslint-disable-next-line no-console
  console.log(`[helius] reconnect in ${delay}ms`);
  setTimeout(() => connect(), delay);
}

let started = false;
export function startHeliusListener(): void {
  if (started) return;
  if (process.env.DISABLE_HELIUS === 'true') {
    // eslint-disable-next-line no-console
    console.log('[helius] DISABLE_HELIUS=true — Helius listener OFF (Dexscreener only)');
    return;
  }
  if (!process.env.HELIUS_API_KEY || !process.env.HELIUS_WSS_URL) {
    // eslint-disable-next-line no-console
    console.log(
      '[helius] HELIUS_API_KEY/HELIUS_WSS_URL kosong — skip Helius listener (Dexscreener only)',
    );
    return;
  }
  started = true;
  stopped = false;
  connect();
}

export function stopHeliusListener(): void {
  stopped = true;
  ws?.close();
  ws = null;
  started = false;
}
