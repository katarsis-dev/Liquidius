import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Liquidius — Solana Token Screener',
  description:
    'Realtime alert screener untuk pair baru Solana (pump.fun & Raydium/PumpSwap) — 3 mode filter + tombol Buy on GMGN.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}
