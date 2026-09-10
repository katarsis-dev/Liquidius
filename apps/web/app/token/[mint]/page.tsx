import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GmgnButton } from '@/components/GmgnButton';
import { fmtUsd, fmtPct, fmtRatio, fmtAge, shortAddr } from '@/lib/format';
import { getRedis } from '@/lib/redis';

interface Props {
  params: { mint: string };
}

async function findLatestSnapshot(mint: string) {
  const r = getRedis();
  for (const mode of ['DEGEN', 'MEDIUM', 'SAFE']) {
    const raws = await r.lrange(`recent:${mode}`, 0, 199);
    for (const raw of raws) {
      try {
        const p = JSON.parse(raw);
        if (p.mint === mint) return p;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export default async function TokenDetailPage({ params }: Props) {
  const a = await findLatestSnapshot(params.mint);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {!a ? (
        <div className="rounded-xl border border-border bg-bg-card p-8 text-center text-text-muted">
          Belum ada data untuk mint <span className="font-mono">{shortAddr(params.mint)}</span> di
          cache. Token akan muncul di sini setelah alert pertama masuk.
          <div className="mt-6">
            <GmgnButton mint={params.mint} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-4 mb-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold truncate">{a.name ?? a.symbol ?? params.mint}</h1>
              <div className="text-sm text-text-muted font-mono truncate">{params.mint}</div>
              <div className="text-xs text-text-faint mt-1">
                Age: {fmtAge(a.age_sec)} · Mode {a.mode} · Trigger {a.trigger.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="w-full sm:w-56">
              <GmgnButton mint={params.mint} href={a.links.gmgn} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Market Cap" value={fmtUsd(a.mc_usd)} />
            <Stat label="Liquidity" value={fmtUsd(a.liq_usd)} />
            <Stat label="Volume 1m" value={fmtUsd(a.vol_1m_usd)} />
            <Stat label="Volume 5m" value={fmtUsd(a.vol_5m_usd)} />
            <Stat label="Unique buyers 5m" value={String(a.unique_buyers_5m ?? '—')} />
            <Stat label="Buy/Sell ratio" value={fmtRatio(a.buy_sell_ratio_5m)} />
            <Stat label="Top10 holders" value={fmtPct(a.safety.topPct)} />
            <Stat label="Creator holding" value={fmtPct(a.safety.creatorPct)} />
            <Stat label="Bundle %" value={fmtPct(a.safety.bundlePct)} />
            <Stat label="Sniper %" value={fmtPct(a.safety.sniperPct)} />
            <Stat label="Bonding progress" value={fmtPct(a.bondingProgressPct)} />
            <Stat label="Migrated" value={a.isMigrated ? 'yes' : 'no'} />
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3 text-text-muted uppercase tracking-wider">
              Safety
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <li>Mint authority disabled: {yesNo(a.safety.mintDisabled)}</li>
              <li>Freeze authority disabled: {yesNo(a.safety.freezeDisabled)}</li>
              <li>LP burned: {yesNo(a.safety.lpBurned)}</li>
              <li>LP locked: {yesNo(a.safety.lpLocked)}</li>
              <li>Honeypot flag: {yesNo(a.safety.honeypot)}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3 text-text-muted uppercase tracking-wider">
              Tracked wallets in
            </h2>
            <div className="flex gap-4 text-sm">
              <span>🧠 {a.trackedWallets.smart} smart</span>
              <span>🎯 {a.trackedWallets.sniper} sniper</span>
              <span>📣 {a.trackedWallets.caller} caller</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {(['solscan', 'dexscreener', 'birdeye'] as const).map((k) => (
              <a
                key={k}
                href={a.links[k]}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-white/[0.03] hover:bg-white/[0.06] ring-1 ring-white/10 px-3 py-1.5 text-sm text-text-muted hover:text-text"
              >
                {k}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-card border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-text-faint">{label}</div>
      <div className="text-lg font-semibold tabular">{value}</div>
    </div>
  );
}

function yesNo(v?: boolean) {
  if (v === true) return <span className="text-good">yes</span>;
  if (v === false) return <span className="text-bad">no</span>;
  return <span className="text-text-faint">unknown</span>;
}
