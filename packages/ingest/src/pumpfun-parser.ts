import type { IngestEvent } from './events.js';

interface Ctx {
  signature: string;
  slot: number;
  ts: number;
}

/**
 * Parser log pump.fun.
 * NOTE (uncertain): decoding instruction data pump.fun butuh IDL. Implementasi
 * di sini adalah **heuristic parser** berbasis log strings — cukup untuk
 * mendeteksi kejadian (create bonding curve, buy/sell, migrate) dan meng-emit
 * event awal. Untuk field yang butuh account key persis (mint, pool address),
 * kombinasikan dengan `getTransaction(signature)` di enrichment layer.
 *
 * TODO: ganti dengan `@coral-xyz/anchor` decoder + IDL pump.fun bila sudah tersedia.
 */
export function parsePumpFunLogs(logs: string[], ctx: Ctx): IngestEvent[] {
  const out: IngestEvent[] = [];
  const joined = logs.join('\n');

  if (/Instruction:\s*(Create|InitializeBondingCurve)/i.test(joined)) {
    // Placeholder mint/pool/creator — enrichment layer resolve via getTransaction.
    out.push({
      kind: 'pair_detected',
      mint: extractPubkey(joined, /mint[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/) ?? '',
      pool: extractPubkey(joined, /(bondingCurve|pool)[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/, 2) ??
        '',
      creator: extractPubkey(joined, /creator[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/) ?? '',
      launchSource: 'pump',
      slot: ctx.slot,
      ts: ctx.ts,
      signature: ctx.signature,
    });
  } else if (/Instruction:\s*(Buy|Sell)/i.test(joined)) {
    const side = /Instruction:\s*Sell/i.test(joined) ? 'sell' : 'buy';
    out.push({
      kind: 'swap',
      mint: extractPubkey(joined, /mint[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/) ?? '',
      pool: '',
      side,
      wallet: extractPubkey(joined, /user[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/) ?? '',
      slot: ctx.slot,
      ts: ctx.ts,
      signature: ctx.signature,
    });
  } else if (/Instruction:\s*Migrate|Withdraw/i.test(joined)) {
    out.push({
      kind: 'migrate',
      mint: extractPubkey(joined, /mint[:=]\s*([1-9A-HJ-NP-Za-km-z]{32,44})/) ?? '',
      oldPool: '',
      newPool: '',
      newSource: 'raydium',
      slot: ctx.slot,
      ts: ctx.ts,
      signature: ctx.signature,
    });
  }
  return out;
}

function extractPubkey(s: string, re: RegExp, group = 1): string | undefined {
  const m = s.match(re);
  return m?.[group];
}
