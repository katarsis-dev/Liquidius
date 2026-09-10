'use client';

import { Check, X, HelpCircle, Flame, Lock, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertPayload } from '@/lib/sse';

interface Props {
  safety: AlertPayload['safety'];
}

function Badge({
  label,
  status,
  Icon,
}: {
  label: string;
  status: boolean | undefined;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const color =
    status === true
      ? 'text-good bg-emerald-500/10 ring-emerald-500/30'
      : status === false
        ? 'text-bad bg-red-500/10 ring-red-500/30'
        : 'text-text-faint bg-white/5 ring-white/10';
  const Mark = status === true ? Check : status === false ? X : HelpCircle;
  return (
    <span
      title={`${label}: ${status === true ? 'yes' : status === false ? 'no' : 'unknown'}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1',
        color,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
      <Mark className="h-3 w-3" aria-hidden />
    </span>
  );
}

export function SafetyBadges({ safety }: Props) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge label="Mint" status={safety.mintDisabled} Icon={Lock} />
      <Badge label="Freeze" status={safety.freezeDisabled} Icon={Lock} />
      <Badge label="LP🔥" status={safety.lpBurned} Icon={Flame} />
      <Badge label="LP🔒" status={safety.lpLocked} Icon={Lock} />
      <Badge
        label="Honeypot"
        status={safety.honeypot === undefined ? undefined : !safety.honeypot}
        Icon={Skull}
      />
    </div>
  );
}
