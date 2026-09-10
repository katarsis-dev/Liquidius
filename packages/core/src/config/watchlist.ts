import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const WalletEntrySchema = z.object({
  address: z.string().min(32).max(48),
  alias: z.string().optional(),
  source: z.string().optional(),
  addedAt: z.string().optional(),
});

const WatchlistFileSchema = z.object({
  label: z.enum(['smart', 'sniper', 'caller']),
  note: z.string().optional(),
  wallets: z.array(WalletEntrySchema),
});

export type WalletEntry = z.infer<typeof WalletEntrySchema>;
export type WatchlistFile = z.infer<typeof WatchlistFileSchema>;

export function loadWatchlist(file: string): WatchlistFile {
  const full = resolve(process.cwd(), file);
  const raw = JSON.parse(readFileSync(full, 'utf8'));
  return WatchlistFileSchema.parse(raw);
}

export function loadAllWatchlists(dir = 'config/watchlists'): Record<
  'smart' | 'sniper' | 'caller',
  Set<string>
> {
  const smart = loadWatchlist(`${dir}/smart.json`);
  const sniper = loadWatchlist(`${dir}/sniper.json`);
  const caller = loadWatchlist(`${dir}/caller.json`);
  return {
    smart: new Set(smart.wallets.map((w) => w.address)),
    sniper: new Set(sniper.wallets.map((w) => w.address)),
    caller: new Set(caller.wallets.map((w) => w.address)),
  };
}
