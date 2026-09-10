'use client';

import { ExternalLink, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mint: string;
  href?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Primary CTA button — deep-link ke GMGN.
 * Wajib buka tab baru + noopener/noreferrer (payment/trading target).
 */
export function GmgnButton({ mint, href, size = 'md', className }: Props) {
  const url = href ?? `https://gmgn.ai/sol/token/${mint}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Buy ${mint} on GMGN`}
      className={cn(
        'group relative inline-flex items-center justify-center gap-2 rounded-lg',
        'bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold',
        'shadow-glow hover:shadow-[0_0_32px_rgba(34,197,94,0.4)]',
        'ring-1 ring-emerald-400/20 hover:ring-emerald-300/40',
        'transition-all duration-150 active:scale-[0.98]',
        size === 'md' ? 'px-4 py-2.5 text-sm w-full' : 'px-3 py-1.5 text-xs',
        className,
      )}
    >
      <Zap className="h-4 w-4 fill-current" aria-hidden />
      <span>Buy on GMGN</span>
      <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" aria-hidden />
    </a>
  );
}
