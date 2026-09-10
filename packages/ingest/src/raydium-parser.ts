import type { IngestEvent } from './events.js';

interface Ctx {
  signature: string;
  slot: number;
  ts: number;
}

/**
 * Parser log Raydium AMM v4 (dan PumpSwap yang skema log-nya mirip).
 * Heuristic-only, sama seperti pump.fun parser. Field precise di-resolve di
 * enrichment layer via `getTransaction(signature, { maxSupportedTransactionVersion: 0 })`.
 */
export function parseRaydiumLogs(logs: string[], ctx: Ctx): IngestEvent[] {
  const out: IngestEvent[] = [];
  const joined = logs.join('\n');

  if (/Instruction:\s*(Initialize2|InitializePool|CreatePool)/i.test(joined)) {
    out.push({
      kind: 'pair_detected',
      mint: '',
      pool: '',
      creator: '',
      launchSource: joined.includes('PumpSwap') ? 'pumpswap' : 'raydium',
      slot: ctx.slot,
      ts: ctx.ts,
      signature: ctx.signature,
    });
  } else if (/Instruction:\s*Swap/i.test(joined)) {
    out.push({
      kind: 'swap',
      mint: '',
      pool: '',
      side: 'buy',
      wallet: '',
      slot: ctx.slot,
      ts: ctx.ts,
      signature: ctx.signature,
    });
  }

  return out;
}
