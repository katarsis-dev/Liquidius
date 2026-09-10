'use client';

import { AnimatePresence } from 'framer-motion';
import { AlertCard } from './AlertCard';
import type { AlertPayload } from '@/lib/sse';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface Props {
  mode: 'DEGEN' | 'MEDIUM' | 'SAFE';
  alerts: AlertPayload[];
}

const headerStyle: Record<
  Props['mode'],
  { dot: string; text: string; tag: string }
> = {
  DEGEN: {
    dot: 'bg-orange-500',
    text: 'text-orange-300',
    tag: 'lebih banyak alert, lebih kotor',
  },
  MEDIUM: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-300',
    tag: 'default rekomendasi',
  },
  SAFE: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-300',
    tag: 'sedikit alert, lebih bersih',
  },
};

export function ModeColumn({ mode, alerts }: Props) {
  const s = headerStyle[mode];
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newest = alerts[0]?.id;
    if (!newest) return;
    setFreshIds((prev) => {
      if (prev.has(newest)) return prev;
      const next = new Set(prev);
      next.add(newest);
      return next;
    });
    const t = setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.delete(newest);
        return next;
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [alerts]);

  return (
    <section className="flex flex-col min-h-0 flex-1 bg-bg-soft rounded-xl border border-border">
      <header className="sticky top-0 z-10 backdrop-blur bg-bg-soft/80 border-b border-border rounded-t-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full animate-pulse', s.dot)} />
          <h2 className={cn('font-semibold tracking-wide', s.text)}>{mode}</h2>
          <span className="text-xs text-text-faint hidden sm:inline">{s.tag}</span>
        </div>
        <span className="text-xs text-text-muted tabular">{alerts.length}</span>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center text-text-faint text-sm py-16">
            Belum ada alert. Live stream terhubung — token yang lolos filter akan muncul di sini.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} isNew={freshIds.has(a.id)} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
