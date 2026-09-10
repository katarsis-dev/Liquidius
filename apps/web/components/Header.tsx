'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Activity, Pause, Play, Radio, Settings, Users, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isMuted, setMuted, primeAudio, playAlertSound } from '@/lib/notifSound';

interface Props {
  connected: boolean;
  paused: boolean;
  onTogglePause: () => void;
  totalAlerts: number;
}

export function Header({ connected, paused, onTogglePause, totalAlerts }: Props) {
  const [muted, setMutedState] = useState(true); // default true sampai hydration
  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  const handleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    primeAudio(); // unlock AudioContext di user gesture
    if (!next) {
      // Preview 1x saat unmute biar user tau volumenya
      playAlertSound('MEDIUM');
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-purple-500 grid place-items-center shadow-glow">
            <Activity className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Liquidius</div>
            <div className="text-[10px] text-text-faint uppercase tracking-widest">
              Solana Screener
            </div>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <StatusPill connected={connected} />
          <span className="hidden sm:inline text-xs text-text-muted tabular">
            {totalAlerts} alerts
          </span>
          <button
            onClick={handleMute}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors',
              muted
                ? 'bg-white/[0.03] text-text-muted ring-white/10 hover:bg-white/[0.06]'
                : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/15',
            )}
            aria-label={muted ? 'Enable sound notifications' : 'Mute sound notifications'}
            title={muted ? 'Sound off — click to test & enable' : 'Sound on'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{muted ? 'Sound off' : 'Sound on'}</span>
          </button>

          <button
            onClick={onTogglePause}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors',
              paused
                ? 'bg-orange-500/10 text-orange-300 ring-orange-500/30 hover:bg-orange-500/15'
                : 'bg-white/[0.03] text-text-muted ring-white/10 hover:bg-white/[0.06]',
            )}
            aria-label={paused ? 'Resume stream' : 'Pause stream'}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{paused ? 'Resume' : 'Pause'}</span>
          </button>

          <NavLink href="/watchlist" Icon={Users} label="Watchlist" />
          <NavLink href="/settings" Icon={Settings} label="Settings" />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-text-muted ring-1 ring-white/10 transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1',
        connected
          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
          : 'bg-red-500/10 text-red-300 ring-red-500/30',
      )}
    >
      <Radio className={cn('h-3 w-3', connected && 'animate-pulse')} />
      {connected ? 'Live' : 'Disconnected'}
    </span>
  );
}
