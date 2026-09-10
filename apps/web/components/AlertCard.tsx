'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertPayload } from '@/lib/sse';
import { fmtUsd, fmtPct, fmtRatio, fmtAge, shortAddr } from '@/lib/format';
import { GmgnButton } from './GmgnButton';
import { SafetyBadges } from './SafetyBadges';
import { WalletChips } from './WalletChips';
import { ExtLinks } from './ExtLinks';

interface Props {
  alert: AlertPayload;
  isNew?: boolean;
}

const modeStyle: Record<AlertPayload['mode'], { ring: string; badge: string; text: string }> = {
  DEGEN: {
    ring: 'ring-orange-500/30',
    badge: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
    text: 'text-orange-300',
  },
  MEDIUM: {
    ring: 'ring-yellow-500/30',
    badge: 'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30',
    text: 'text-yellow-300',
  },
  SAFE: {
    ring: 'ring-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    text: 'text-emerald-300',
  },
};

const sourceStyle: Record<
  AlertPayload['source'],
  { badge: string; label: string; icon: string }
> = {
  pumpfun: {
    badge: 'bg-purple-500/15 text-purple-300 ring-purple-500/30',
    label: 'pump.fun',
    icon: '🚀',
  },
  dexscreener: {
    badge: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
    label: 'Dexscreener',
    icon: '📊',
  },
  raydium: {
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30',
    label: 'Raydium',
    icon: '🌊',
  },
  pumpswap: {
    badge: 'bg-teal-500/15 text-teal-300 ring-teal-500/30',
    label: 'PumpSwap',
    icon: '🔄',
  },
  fixture: {
    badge: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    label: 'Fixture',
    icon: '🧪',
  },
};

export function AlertCard({ alert: a, isNew }: Props) {
  const style = modeStyle[a.mode];
  const src = sourceStyle[a.source] ?? sourceStyle.dexscreener;
  const title = a.symbol || a.name || shortAddr(a.mint);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'rounded-xl border border-border bg-bg-card shadow-card',
        'ring-1 ring-inset',
        style.ring,
        'p-3 sm:p-4 flex flex-col gap-3',
        isNew && 'animate-pulse-glow',
      )}
    >
      {/* Row 1: identity */}
      <div className="flex items-start gap-3">
        {a.logoUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.logoUri}
            alt=""
            className="h-9 w-9 rounded-full ring-1 ring-white/10 object-cover shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 ring-1 ring-white/10 shrink-0 grid place-items-center">
            <Sparkles className="h-4 w-4 text-white/80" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/token/${a.mint}`}
              className="font-semibold text-text hover:underline underline-offset-2 truncate"
              title={a.name ?? title}
            >
              {title}
            </Link>
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider rounded-md px-1.5 py-0.5 ring-1',
                style.badge,
              )}
            >
              {a.mode}
            </span>
            <span
              title={a.sourceDetail ?? src.label}
              className={cn(
                'text-[10px] tracking-wider rounded-md px-1.5 py-0.5 ring-1 inline-flex items-center gap-1',
                src.badge,
              )}
            >
              <span aria-hidden>{src.icon}</span>
              {src.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-white/5 text-text-muted ring-1 ring-white/10">
              {a.trigger.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-[11px] text-text-faint tabular truncate mt-0.5">
            {shortAddr(a.mint)} · {fmtAge(a.age_sec)}
          </div>
        </div>
      </div>

      {/* Row 2: primary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular">
        <Metric label="MC" value={fmtUsd(a.mc_usd)} accent="text-text" />
        <Metric label="LP" value={fmtUsd(a.liq_usd)} accent="text-text" />
        <Metric label="Vol 5m" value={fmtUsd(a.vol_5m_usd)} accent={style.text} />
        <Metric label="Buyers 5m" value={String(a.unique_buyers_5m ?? '—')} accent={style.text} />
      </div>

      {/* Row 3: safety */}
      <SafetyBadges safety={a.safety} />

      {/* Row 4: numeric safety + wallets */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted tabular">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span>
            Top10 <span className="text-text">{fmtPct(a.safety.topPct)}</span>
          </span>
          <span>
            Creator <span className="text-text">{fmtPct(a.safety.creatorPct)}</span>
          </span>
          <span>
            Bundle <span className="text-text">{fmtPct(a.safety.bundlePct)}</span>
          </span>
          <span>
            Sniper <span className="text-text">{fmtPct(a.safety.sniperPct)}</span>
          </span>
          <span>
            B/S <span className="text-text">{fmtRatio(a.buy_sell_ratio_5m)}</span>
          </span>
        </div>
        <WalletChips tracked={a.trackedWallets} />
      </div>

      {/* Row 5: primary CTA + secondary links */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
        <GmgnButton mint={a.mint} href={a.links.gmgn} className="sm:flex-1" />
        <ExtLinks links={a.links} />
      </div>

      {/* Migration indicator */}
      {!a.isMigrated && a.bondingProgressPct !== undefined && (
        <div className="pt-1">
          <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
            <span>Bonding progress</span>
            <span className="tabular">{(a.bondingProgressPct * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-emerald-500"
              style={{ width: `${Math.min(100, a.bondingProgressPct * 100)}%` }}
            />
          </div>
        </div>
      )}

      {a.isMigrated && (
        <span className="text-[10px] inline-flex items-center gap-1 text-emerald-400 self-start">
          <ArrowUpRight className="h-3 w-3" aria-hidden /> migrated
        </span>
      )}
    </motion.article>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-text-faint">{label}</div>
      <div className={cn('text-sm font-semibold', accent ?? 'text-text')}>{value}</div>
    </div>
  );
}
