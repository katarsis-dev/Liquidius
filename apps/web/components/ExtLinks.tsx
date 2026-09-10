'use client';

import type { AlertPayload } from '@/lib/sse';

const items: Array<{ key: keyof AlertPayload['links']; label: string }> = [
  { key: 'solscan', label: 'Solscan' },
  { key: 'dexscreener', label: 'Dexscreener' },
  { key: 'birdeye', label: 'Birdeye' },
];

export function ExtLinks({ links }: { links: AlertPayload['links'] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
      {items.map((it) => (
        <a
          key={it.key}
          href={links[it.key]}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text underline underline-offset-2 decoration-transparent hover:decoration-text-muted transition-colors"
        >
          {it.label}
        </a>
      ))}
    </div>
  );
}
