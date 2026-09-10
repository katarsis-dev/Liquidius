/**
 * Free-tier polling pipeline.
 * Runs inside Next.js Node runtime (dipicu oleh instrumentation.ts).
 *
 * Loop:
 *  1. Tarik latest+top boosts dari Dexscreener → set kandidat Solana.
 *  2. Untuk tiap kandidat, hit /latest/dex/tokens/{mint} → dapat pair terbaik.
 *  3. Transform ke snapshot minimal (P0 fields: mc, lp, vol, buyers ratio).
 *  4. Evaluasi auto-skip gate + 3 mode.
 *  5. Publish alert ke in-memory bus + Telegram (jika token env di-set).
 *
 * TIDAK ada Redis / Postgres / Docker. Data safety on-chain (mint authority,
 * top10 holders, LP burn) tidak ter-enrich di free tier ini — field-nya
 * `undefined`, dan mode config yang require = disabled akan otomatis fail
 * kecuali user menandai token via watchlist.
 *
 * Untuk enrichment on-chain lengkap (P1+): butuh RPC key — lihat NOTES.md.
 */

import type { AlertPayload } from './sse';
import { getLatestBoosts, getTopBoosts, getPairsByToken, type DsPair } from './dexscreener';
import { publishAlert } from './bus';

const POLL_INTERVAL_MS = 30_000; // 30s per iterasi — hemat rate limit
const CANDIDATE_PER_TICK = 20; // maks token yang di-enrich per tick
const RECENT_ALERT_TTL_MS = 30 * 60_000; // dedupe 30 menit

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

// Threshold di-hardcode di sini (versi minimal buat free-tier); YAML config
// tetap ada di config/modes/*.yaml untuk mode WS ke depan.
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

// Global auto-skip (§7 PRD, subset yang bisa kita hitung dari Dexscreener).
function autoSkip(p: DsPair): string[] {
  const reasons: string[] = [];
  const lp = p.liquidity?.usd ?? 0;
  if (lp < 2000) reasons.push('lp<2000');
  const buys5 = p.txns?.m5?.buys ?? 0;
  const sells5 = p.txns?.m5?.sells ?? 0;
  const uniqBuyers = buys5; // approx (Dexscreener tidak expose unique)
  if (uniqBuyers < 5) reasons.push('buyers_5m<5');
  const vol5 = p.volume?.m5 ?? 0;
  const holdersDown = vol5 > 0 && buys5 === 0 && sells5 > 0;
  if (holdersDown) reasons.push('volume_up_holders_down');
  return reasons;
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

function toPayload(p: DsPair, mode: ModeThreshold['name']): AlertPayload {
  const ageSec = p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 1000) : 0;
  const mint = p.baseToken.address;
  const buys5 = p.txns?.m5?.buys ?? 0;
  const sells5 = p.txns?.m5?.sells ?? 0;
  const ratio = sells5 > 0 ? buys5 / sells5 : buys5 > 0 ? Infinity : 0;
  return {
    id: `${mint}:${mode}:${Date.now()}`,
    mode,
    trigger: 'new_pair_detected',
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
    safety: {
      // Field on-chain: undefined di free tier (butuh RPC key).
      mintDisabled: undefined,
      freezeDisabled: undefined,
      lpBurned: undefined,
      lpLocked: undefined,
      topPct: undefined,
      creatorPct: undefined,
      bundlePct: undefined,
      sniperPct: undefined,
      honeypot: undefined,
    },
    trackedWallets: { smart: 0, sniper: 0, caller: 0 },
    isMigrated: p.dexId === 'raydium' || p.dexId === 'pumpswap',
    bondingProgressPct: undefined,
    links: {
      gmgn: `https://gmgn.ai/sol/token/${mint}`,
      solscan: `https://solscan.io/token/${mint}`,
      dexscreener: p.url || `https://dexscreener.com/solana/${p.pairAddress}`,
      birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
    },
    createdAt: Date.now(),
  };
}

const recentAlerts = new Map<string, number>(); // key = mint:mode → ts

function shouldSend(mint: string, mode: string): boolean {
  const key = `${mint}:${mode}`;
  const last = recentAlerts.get(key);
  if (last && Date.now() - last < RECENT_ALERT_TTL_MS) return false;
  recentAlerts.set(key, Date.now());
  return true;
}

async function tick(): Promise<void> {
  const [latest, top] = await Promise.all([getLatestBoosts(), getTopBoosts()]);
  const boosts = [...(latest ?? []), ...(top ?? [])];
  const solMints = Array.from(
    new Set(boosts.filter((b) => b.chainId === 'solana').map((b) => b.tokenAddress)),
  ).slice(0, CANDIDATE_PER_TICK);

  for (const mint of solMints) {
    const res = await getPairsByToken(mint);
    const pair = res?.pairs?.find((p) => p.chainId === 'solana');
    if (!pair) continue;

    if (autoSkip(pair).length > 0) continue;

    for (const mode of MODES) {
      if (!matchMode(pair, mode)) continue;
      if (!shouldSend(mint, mode.name)) continue;
      const payload = toPayload(pair, mode.name);
      publishAlert(payload);
      // Optional Telegram push
      void sendTelegram(payload);
    }
    // Kecil delay biar rate limit aman
    await sleep(150);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Optional Telegram push (kalau env di-set) ────────────────────────────────
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
    `*[${a.mode}] ${a.trigger.replace(/_/g, ' ')}*`,
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

// ── Dev fixture: inject fake alerts ──────────────────────────────────────────
function devFixtureLoop(): void {
  const modes: Array<'DEGEN' | 'MEDIUM' | 'SAFE'> = ['DEGEN', 'MEDIUM', 'SAFE'];
  let i = 0;
  setInterval(() => {
    const mode = modes[i++ % modes.length]!;
    const mint = `Fx${Math.random().toString(36).slice(2, 10)}${'k'.repeat(30)}`.slice(0, 44);
    const payload: AlertPayload = {
      id: `${mint}:${mode}:${Date.now()}`,
      mode,
      trigger: 'new_pair_detected',
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
      isMigrated: mode !== 'DEGEN',
      bondingProgressPct: mode === 'DEGEN' ? 0.7 + Math.random() * 0.25 : undefined,
      links: {
        gmgn: `https://gmgn.ai/sol/token/${mint}`,
        solscan: `https://solscan.io/token/${mint}`,
        dexscreener: `https://dexscreener.com/solana/${mint}`,
        birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
      },
      createdAt: Date.now(),
    };
    publishAlert(payload);
  }, 5000);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
let started = false;
export function startPipeline(): void {
  if (started) return;
  started = true;
  const devFixture = process.env.DEV_FIXTURE_ALERTS === 'true';
  if (devFixture) {
    // eslint-disable-next-line no-console
    console.log('[pipeline] DEV_FIXTURE_ALERTS=true — inject fake alerts tiap 5s');
    devFixtureLoop();
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[pipeline] starting Dexscreener poller (30s interval)');
  // Fire immediately, then interval
  void tick();
  setInterval(() => void tick(), POLL_INTERVAL_MS);
}
