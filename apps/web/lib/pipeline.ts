/**
 * Dual-source polling & event pipeline.
 * Berjalan di Next.js Node runtime (dipicu instrumentation.ts).
 *
 * Sumber:
 *   A. Dexscreener API polling (30s) — /token-boosts/{latest,top},
 *      /token-profiles/latest, /latest/dex/search?q=SOL → chip: dexscreener
 *   B. Helius WS pump.fun program logs → chip: pumpfun
 *
 * Semua ke-merge di in-memory candidate registry (dedupe by mint).
 * Publish ke bus + optional Telegram push.
 */

import type { AlertPayload, AlertSource } from './sse';
import {
  getLatestBoosts,
  getTopBoosts,
  getLatestProfiles,
  searchPairs,
  getPairsByToken,
  type DsPair,
} from './dexscreener';
import { publishAlert } from './bus';
import {
  startHeliusListener,
  heliusEvents,
  canCallHeliusRpc,
  markHeliusRpcCall,
  type PumpFunCreateEvent,
} from './helius';

const POLL_INTERVAL_MS = 45_000; // 45s — hemat rate limit setelah nambah endpoint
const CANDIDATE_PER_TICK = 30;
const RECENT_ALERT_TTL_MS = 30 * 60_000;
const PUMPFUN_ENRICH_RETRY_MS = 30_000;
const PUMPFUN_ENRICH_MAX_MS = 30 * 60_000;

interface ModeThreshold {
  name: 'DEGEN' | 'MEDIUM' | 'SAFE';
  ageMin: number;
  ageMax: number;
  mcMin: number;
  mcMax: number;
  lpMin: number;
  lpMax: number;
  vol5mMin: number;
  buyers5mMin: number;
  bsRatioMin: number;
}

const MODES: ModeThreshold[] = [
  {
    name: 'DEGEN',
    ageMin: 30,
    ageMax: 720,
    mcMin: 3000,
    mcMax: 25000,
    lpMin: 2500,
    lpMax: 15000,
    vol5mMin: 2000,
    buyers5mMin: 12,
    bsRatioMin: 1.2,
  },
  {
    name: 'MEDIUM',
    ageMin: 60,
    ageMax: 1200,
    mcMin: 6000,
    mcMax: 35000,
    lpMin: 5000,
    lpMax: 25000,
    vol5mMin: 5000,
    buyers5mMin: 25,
    bsRatioMin: 1.4,
  },
  {
    name: 'SAFE',
    ageMin: 180,
    ageMax: 1800,
    mcMin: 10000,
    mcMax: 40000,
    lpMin: 8000,
    lpMax: 40000,
    vol5mMin: 10000,
    buyers5mMin: 40,
    bsRatioMin: 1.5,
  },
];

const recentAlerts = new Map<string, number>();

function shouldSend(mint: string, mode: string): boolean {
  const key = `${mint}:${mode}`;
  const last = recentAlerts.get(key);
  if (last && Date.now() - last < RECENT_ALERT_TTL_MS) return false;
  recentAlerts.set(key, Date.now());
  return true;
}

// ── Filter — auto-skip + anti-rug/wash heuristics ────────────────────────────
function autoSkip(p: DsPair): string[] {
  const reasons: string[] = [];

  const lp = p.liquidity?.usd ?? 0;
  const vol5 = p.volume?.m5 ?? 0;
  const vol1h = p.volume?.h1 ?? 0;
  const buys5 = p.txns?.m5?.buys ?? 0;
  const sells5 = p.txns?.m5?.sells ?? 0;
  const buys1h = p.txns?.h1?.buys ?? 0;
  const sells1h = p.txns?.h1?.sells ?? 0;
  const ageSec = p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 1000) : 0;

  // ─ Klasik (PRD §7) ─
  if (lp < 2000) reasons.push('lp<2000');
  if (buys5 < 5) reasons.push('buyers_5m<5');
  if (vol5 > 0 && buys5 === 0 && sells5 > 0) reasons.push('volume_up_holders_down');

  // ─ Anti wash-trade / bot ─
  // Buys tinggi tapi NOL sells → dev beli sendiri (wash), bukan real interest
  if (buys1h > 20 && sells1h === 0) reasons.push('no_sells_wash_suspect');
  // Rasio buy/sell ekstrim → wash trade
  if (buys1h > 30 && sells1h > 0 && buys1h / sells1h > 20) {
    reasons.push('extreme_buy_pressure');
  }
  // Volume tinggi tapi count txn rendah → wash trade (order gede sedikit)
  if (vol1h > 20_000 && buys1h + sells1h < 15) {
    reasons.push('unique_makers_too_low');
  }

  // ─ Anti pump-and-dump / bot bait ─
  const pumpM5 = p.priceChange?.m5 ?? 0;
  const pumpH1 = p.priceChange?.h1 ?? 0;
  if (pumpM5 > 500) reasons.push('pump_5m>500%');
  if (pumpH1 > 1000) reasons.push('pump_1h>1000%');
  // Fresh + hot → biasanya bot pumping sebelum rug
  if (ageSec > 0 && ageSec < 120 && vol5 > 50_000) reasons.push('too_fresh_too_hot');

  // ─ Anti instant-rug bait ─
  // LP tipis tapi volume ada → LP bakal cepat drain (rug trigger)
  if (lp < 1000 && vol5 > 5_000) reasons.push('low_lp_vs_vol');

  return reasons;
}

// Set of creator wallets flagged as serial-launcher (populate async via Helius RPC).
const serialLaunchers = new Set<string>();
export function markSerialLauncher(wallet: string): void {
  serialLaunchers.add(wallet);
}
export function isSerialLauncher(wallet: string): boolean {
  return serialLaunchers.has(wallet);
}

function matchMode(p: DsPair, m: ModeThreshold): boolean {
  const ageSec = p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 1000) : 0;
  if (ageSec < m.ageMin || ageSec > m.ageMax) return false;
  const mc = p.marketCap ?? p.fdv ?? 0;
  if (mc < m.mcMin || mc > m.mcMax) return false;
  const lp = p.liquidity?.usd ?? 0;
  if (lp < m.lpMin || lp > m.lpMax) return false;
  const vol5 = p.volume?.m5 ?? 0;
  if (vol5 < m.vol5mMin) return false;
  const buys5 = p.txns?.m5?.buys ?? 0;
  const sells5 = p.txns?.m5?.sells ?? 0;
  if (buys5 < m.buyers5mMin) return false;
  const ratio = sells5 > 0 ? buys5 / sells5 : buys5 > 0 ? Infinity : 0;
  if (ratio < m.bsRatioMin) return false;
  return true;
}

// ── Payload builder ──────────────────────────────────────────────────────────
function pairToPayload(
  p: DsPair,
  mode: ModeThreshold['name'],
  source: AlertSource,
  sourceDetail?: string,
): AlertPayload {
  const ageSec = p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 1000) : 0;
  const mint = p.baseToken.address;
  const buys5 = p.txns?.m5?.buys ?? 0;
  const sells5 = p.txns?.m5?.sells ?? 0;
  const ratio = sells5 > 0 ? buys5 / sells5 : buys5 > 0 ? Infinity : 0;

  // Derive source lebih spesifik dari dexId kalau sumber dexscreener
  let finalSource: AlertSource = source;
  if (source === 'dexscreener') {
    if (p.dexId === 'raydium') finalSource = 'raydium';
    else if (p.dexId === 'pumpswap') finalSource = 'pumpswap';
  }

  return {
    id: `${mint}:${mode}:${Date.now()}`,
    mode,
    trigger: 'new_pair_detected',
    source: finalSource,
    sourceDetail,
    mint,
    pool: p.pairAddress,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    logoUri: p.info?.imageUrl,
    age_sec: ageSec,
    mc_usd: p.marketCap ?? p.fdv,
    liq_usd: p.liquidity?.usd,
    vol_1m_usd: p.volume?.m5 ? p.volume.m5 / 5 : undefined,
    vol_5m_usd: p.volume?.m5,
    unique_buyers_5m: buys5,
    buy_sell_ratio_5m: ratio,
    safety: {},
    trackedWallets: { smart: 0, sniper: 0, caller: 0 },
    isMigrated: p.dexId === 'raydium' || p.dexId === 'pumpswap',
    links: {
      gmgn: `https://gmgn.ai/sol/token/${mint}`,
      solscan: `https://solscan.io/token/${mint}`,
      dexscreener: p.url || `https://dexscreener.com/solana/${p.pairAddress}`,
      birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
    },
    createdAt: Date.now(),
  };
}

/** Publish satu pair (dari sumber apapun) via 3 mode evaluator. */
function publishFromPair(p: DsPair, source: AlertSource, sourceDetail?: string): number {
  if (autoSkip(p).length > 0) return 0;
  let published = 0;
  for (const mode of MODES) {
    if (!matchMode(p, mode)) continue;
    if (!shouldSend(p.baseToken.address, mode.name)) continue;
    const payload = pairToPayload(p, mode.name, source, sourceDetail);
    publishAlert(payload);
    void sendTelegram(payload);
    published++;
  }
  return published;
}

// ── Dexscreener producer ─────────────────────────────────────────────────────
async function dexscreenerTick(): Promise<void> {
  const [latest, top, profiles, searchSol] = await Promise.all([
    getLatestBoosts(),
    getTopBoosts(),
    getLatestProfiles(),
    searchPairs('SOL'),
  ]);

  const mintSet = new Set<string>();
  for (const b of latest ?? []) if (b.chainId === 'solana') mintSet.add(b.tokenAddress);
  for (const b of top ?? []) if (b.chainId === 'solana') mintSet.add(b.tokenAddress);
  for (const p of profiles ?? []) if (p.chainId === 'solana') mintSet.add(p.tokenAddress);

  // Pair dari search sudah punya data lengkap → publish langsung.
  const pairsFromSearch = (searchSol?.pairs ?? []).filter((p) => p.chainId === 'solana');

  const mints = Array.from(mintSet).slice(0, CANDIDATE_PER_TICK);
  let candidates = 0;
  let published = 0;

  // Publish langsung dari search hits
  for (const p of pairsFromSearch) {
    candidates++;
    published += publishFromPair(p, 'dexscreener', 'DS search q=SOL');
  }

  // Enrich boost/profile candidates → pair data
  for (const mint of mints) {
    const res = await getPairsByToken(mint);
    const pair = res?.pairs?.find((p) => p.chainId === 'solana');
    if (!pair) continue;
    candidates++;
    published += publishFromPair(pair, 'dexscreener', 'DS boost/profile');
    await sleep(150);
  }

  // eslint-disable-next-line no-console
  console.log(`[pipeline] dexscreener tick: ${candidates} candidates, ${published} published`);
}

// ── Helius producer (pump.fun) ───────────────────────────────────────────────
interface PendingPumpFun {
  ev: PumpFunCreateEvent;
  attempts: number;
  firstTry: number;
}
const pumpfunPending = new Map<string, PendingPumpFun>();

function onPumpFunCreate(ev: PumpFunCreateEvent): void {
  // Cek serial launcher SEBELUM queue — kalau dev udah launch >3 token dalam
  // 24 jam, skip semua alert dari dia (patterns rugger).
  if (ev.creator && isSerialLauncher(ev.creator)) {
    // eslint-disable-next-line no-console
    console.log(
      `[pipeline] skip pump.fun mint=${ev.mint.slice(0, 6)}… creator=${ev.creator.slice(0, 6)}… (serial launcher)`,
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[pipeline] pump.fun queued mint=${ev.mint.slice(0, 6)}… sig=${ev.signature.slice(0, 8)}… (waiting for Dex listing)`,
  );
  pumpfunPending.set(ev.mint, { ev, attempts: 0, firstTry: Date.now() });

  // Async cek history creator wallet (rate-limited di helius.ts)
  if (ev.creator) void checkCreatorHistory(ev.creator);

  // TIDAK ada shell alert — tunggu Dexscreener enrichment (retry loop), lalu
  // baru evaluasi dgn filter penuh. Ini menghindari instant-rug + wash bait
  // yg belum sempet ter-detect di menit awal.
}

/**
 * Cek history creator wallet — flag serial launcher (rugger pattern).
 *
 * Rate-limit strategy (biar gak habisin budget Helius):
 *   - Share bucket dgn resolveMintFromSignature (`canCallHeliusRpc`).
 *   - Cache hasil check per wallet — cek ulang cuma tiap 1 jam.
 *   - Kalau bucket habis atau backlog >5, skip (drop check, biar pass —
 *     ada filter Dex heuristics sebagai second-line defense).
 */
const checkedCreators = new Map<string, number>(); // wallet → last check ts
const CREATOR_CHECK_TTL_MS = 60 * 60_000;
let pendingCreatorChecks = 0;

async function checkCreatorHistory(creator: string): Promise<void> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) return;
  if (serialLaunchers.has(creator)) return;
  const last = checkedCreators.get(creator);
  if (last && Date.now() - last < CREATOR_CHECK_TTL_MS) return;
  if (pendingCreatorChecks > 5) return; // backlog terlalu besar
  if (!canCallHeliusRpc()) return; // budget habis, skip

  pendingCreatorChecks++;
  markHeliusRpcCall();
  checkedCreators.set(creator, Date.now());
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [creator, { limit: 25 }],
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const sigs: Array<{ blockTime?: number; err: unknown }> = data?.result ?? [];
    const dayAgo = Math.floor(Date.now() / 1000) - 86400;
    const recentSuccess = sigs.filter((s) => !s.err && (s.blockTime ?? 0) >= dayAgo).length;
    // Kalau limit 25 terhitung penuh dalam 24 jam → wallet sangat aktif = bot suspect
    if (recentSuccess >= 25) {
      markSerialLauncher(creator);
      // eslint-disable-next-line no-console
      console.log(
        `[pipeline] flagged serial launcher ${creator.slice(0, 6)}… (${recentSuccess}+ sigs/24h)`,
      );
    }
  } catch {
    /* ignore */
  } finally {
    pendingCreatorChecks--;
  }
}

async function pumpfunEnrichTick(): Promise<void> {
  for (const [mint, item] of pumpfunPending) {
    if (Date.now() - item.firstTry > PUMPFUN_ENRICH_MAX_MS) {
      pumpfunPending.delete(mint);
      continue;
    }
    // Kalau creator ternyata baru saja ke-flag serial launcher, drop.
    if (item.ev.creator && isSerialLauncher(item.ev.creator)) {
      pumpfunPending.delete(mint);
      continue;
    }
    item.attempts++;
    const res = await getPairsByToken(mint);
    const pair = res?.pairs?.find((p) => p.chainId === 'solana');
    if (!pair) continue;
    // pump.fun → sudah listed, jalankan filter penuh (autoSkip + mode filter)
    publishFromPair(pair, 'pumpfun', 'Helius WS + DS enrichment');
    pumpfunPending.delete(mint);
    await sleep(150);
  }
}

// ── Telegram (opsional) ──────────────────────────────────────────────────────
async function sendTelegram(a: AlertPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    a.mode === 'DEGEN'
      ? process.env.TELEGRAM_CHAT_ID_DEGEN
      : a.mode === 'MEDIUM'
        ? process.env.TELEGRAM_CHAT_ID_MEDIUM
        : process.env.TELEGRAM_CHAT_ID_SAFE;
  if (!token || !chatId) return;
  const text = [
    `*[${a.mode}] ${a.trigger.replace(/_/g, ' ')}* · _${a.source}_`,
    `${a.symbol ?? ''} ${a.name ?? ''}`.trim() || `\`${a.mint}\``,
    ``,
    `MC $${fmt(a.mc_usd)}  ·  LP $${fmt(a.liq_usd)}`,
    `Vol 5m $${fmt(a.vol_5m_usd)}  ·  Buyers ${a.unique_buyers_5m ?? '—'}`,
    ``,
    `[Buy on GMGN](${a.links.gmgn}) · [Dexscreener](${a.links.dexscreener})`,
  ].join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      }),
    });
  } catch {
    /* ignore */
  }
}

function fmt(v?: number): string {
  if (v === undefined) return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Dev fixture ──────────────────────────────────────────────────────────────
function devFixtureLoop(): void {
  const modes: Array<'DEGEN' | 'MEDIUM' | 'SAFE'> = ['DEGEN', 'MEDIUM', 'SAFE'];
  const sources: AlertSource[] = ['pumpfun', 'dexscreener', 'raydium', 'pumpswap'];
  let i = 0;
  setInterval(() => {
    const mode = modes[i % modes.length]!;
    const source = sources[i % sources.length]!;
    i++;
    const mint = `Fx${Math.random().toString(36).slice(2, 10)}${'k'.repeat(30)}`.slice(0, 44);
    publishAlert({
      id: `${mint}:${mode}:${Date.now()}`,
      mode,
      trigger: 'new_pair_detected',
      source,
      sourceDetail: 'Fixture',
      mint,
      pool: mint,
      symbol: 'DEMO',
      name: 'Fixture Token',
      age_sec: 60 + Math.floor(Math.random() * 600),
      mc_usd: 8_000 + Math.random() * 30_000,
      liq_usd: 5_000 + Math.random() * 20_000,
      vol_5m_usd: 3_000 + Math.random() * 25_000,
      vol_1m_usd: 800 + Math.random() * 5_000,
      unique_buyers_5m: 15 + Math.floor(Math.random() * 80),
      buy_sell_ratio_5m: 1.1 + Math.random() * 1.5,
      safety: {
        mintDisabled: true,
        freezeDisabled: true,
        lpBurned: mode !== 'DEGEN',
        lpLocked: false,
        topPct: 0.1 + Math.random() * 0.15,
        creatorPct: Math.random() * 0.05,
        bundlePct: Math.random() * 0.08,
        sniperPct: Math.random() * 0.08,
      },
      trackedWallets: {
        smart: mode === 'SAFE' ? 2 : mode === 'MEDIUM' ? 1 : 0,
        sniper: 0,
        caller: 0,
      },
      isMigrated: source !== 'pumpfun',
      bondingProgressPct: source === 'pumpfun' ? 0.7 + Math.random() * 0.25 : undefined,
      links: {
        gmgn: `https://gmgn.ai/sol/token/${mint}`,
        solscan: `https://solscan.io/token/${mint}`,
        dexscreener: `https://dexscreener.com/solana/${mint}`,
        birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
      },
      createdAt: Date.now(),
    });
  }, 5000);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
let started = false;
export function startPipeline(): void {
  if (started) return;
  started = true;

  if (process.env.DEV_FIXTURE_ALERTS === 'true') {
    // eslint-disable-next-line no-console
    console.log('[pipeline] DEV_FIXTURE_ALERTS=true — inject fake alerts every 5s');
    devFixtureLoop();
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[pipeline] starting dual-source (DS poll ${POLL_INTERVAL_MS / 1000}s + Helius WS)`);

  // Producer A: Dexscreener polling
  void dexscreenerTick();
  setInterval(() => void dexscreenerTick(), POLL_INTERVAL_MS);

  // Producer B: Helius WS (skip kalau env kosong)
  heliusEvents.on('pumpfun_create', onPumpFunCreate);
  startHeliusListener();

  // Pump.fun candidate enrichment retry loop
  setInterval(() => void pumpfunEnrichTick(), PUMPFUN_ENRICH_RETRY_MS);
}
