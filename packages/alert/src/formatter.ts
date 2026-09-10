import type { AlertPayload } from '@liquidius/core';
import { buildLinks, type AlertMode, type PairSnapshot, type TriggerKind } from '@liquidius/core';

const MODE_ORDER: AlertMode[] = ['DEGEN', 'MEDIUM', 'SAFE'];

export function toAlertPayload(
  pair: PairSnapshot,
  mode: AlertMode,
  trigger: TriggerKind,
): AlertPayload {
  return {
    id: `${pair.mint}:${mode}:${trigger}:${Date.now()}`,
    mode,
    trigger,
    mint: pair.mint,
    pool: pair.pool,
    symbol: pair.meta?.symbol,
    name: pair.meta?.name,
    logoUri: pair.meta?.logoUri,
    age_sec: pair.pairAgeSec,
    mc_usd: pair.marketCap,
    liq_usd: pair.liquidityUsd,
    vol_1m_usd: pair.volume1mUsd,
    vol_5m_usd: pair.volume5mUsd,
    unique_buyers_5m: pair.uniqueBuyers5m,
    buy_sell_ratio_5m: pair.buySellRatio5m,
    safety: {
      mintDisabled: pair.safety.mintAuthorityDisabled,
      freezeDisabled: pair.safety.freezeAuthorityDisabled,
      lpBurned: pair.safety.lpBurned,
      lpLocked: pair.safety.lpLocked,
      topPct: pair.safety.top10HolderPct,
      creatorPct: pair.safety.creatorHoldingPct,
      bundlePct: pair.safety.bundlePct,
      sniperPct: pair.safety.sniperPct,
      honeypot: pair.safety.honeypotFlag,
    },
    trackedWallets: {
      smart: pair.wallets.trackedSmartWalletsIn,
      sniper: pair.wallets.trackedSniperWalletsIn,
      caller: pair.wallets.trackedCallerWalletsIn,
    },
    isMigrated: pair.migration.isMigrated,
    bondingProgressPct: pair.migration.bondingProgressPct,
    links: buildLinks(pair.mint, pair.pool),
    createdAt: Date.now(),
  };
}

export { MODE_ORDER };

const usd = (v?: number) =>
  v === undefined
    ? '—'
    : v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}M`
      : v >= 1_000
        ? `$${(v / 1_000).toFixed(1)}K`
        : `$${v.toFixed(0)}`;
const pct = (v?: number) => (v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
const bool = (v?: boolean) => (v === true ? '✅' : v === false ? '❌' : '❔');

export function toTelegramMarkdown(a: AlertPayload): string {
  const s = a.safety;
  const w = a.trackedWallets;
  return [
    `*[${a.mode}] ${a.trigger.replace(/_/g, ' ')}*`,
    a.symbol || a.name ? `${a.symbol ?? ''} ${a.name ?? ''}`.trim() : `\`${a.mint}\``,
    ``,
    `MC ${usd(a.mc_usd)}  ·  LP ${usd(a.liq_usd)}`,
    `Vol 5m ${usd(a.vol_5m_usd)}  ·  Buyers ${a.unique_buyers_5m ?? '—'}  ·  B/S ${a.buy_sell_ratio_5m?.toFixed(2) ?? '—'}`,
    ``,
    `Mint ${bool(s.mintDisabled)}  Freeze ${bool(s.freezeDisabled)}  LP🔥 ${bool(s.lpBurned)}  LP🔒 ${bool(s.lpLocked)}`,
    `Top10 ${pct(s.topPct)}  Creator ${pct(s.creatorPct)}  Bundle ${pct(s.bundlePct)}  Sniper ${pct(s.sniperPct)}`,
    ``,
    `🧠 ${w.smart} smart · 🎯 ${w.sniper} sniper · 📣 ${w.caller} caller`,
    ``,
    `[🟢 Buy on GMGN](${a.links.gmgn})`,
    `[Solscan](${a.links.solscan}) · [Dexscreener](${a.links.dexscreener}) · [Birdeye](${a.links.birdeye})`,
  ].join('\n');
}
