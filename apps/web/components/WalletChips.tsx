'use client';

import { Brain, Target, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tracked: { smart: number; sniper: number; caller: number };
}

export function WalletChips({ tracked }: Props) {
  const items = [
    { key: 'smart', label: 'smart', count: tracked.smart, Icon: Brain, tone: 'text-emerald-400' },
    { key: 'sniper', label: 'sniper', count: tracked.sniper, Icon: Target, tone: 'text-orange-400' },
    { key: 'caller', label: 'caller', count: tracked.caller, Icon: Megaphone, tone: 'text-sky-400' },
  ] as const;
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {items.map((it) => (
        <span
          key={it.key}
          className={cn(
            'inline-flex items-center gap-1 rounded-md bg-white/[0.03] ring-1 ring-white/10 px-1.5 py-0.5 tabular',
            it.count > 0 ? it.tone : 'text-text-faint',
          )}
        >
          <it.Icon className="h-3 w-3" aria-hidden />
          <span>{it.count}</span>
          <span className="text-text-faint">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
