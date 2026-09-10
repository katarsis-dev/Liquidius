import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface WatchlistFile {
  label: 'smart' | 'sniper' | 'caller';
  note?: string;
  wallets: { address: string; alias?: string; source?: string }[];
}

function loadFile(name: string): WatchlistFile | null {
  try {
    const p = resolve(process.cwd(), '..', '..', 'config', 'watchlists', `${name}.json`);
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export default function WatchlistPage() {
  const files = ['smart', 'sniper', 'caller']
    .map((n) => loadFile(n))
    .filter((x): x is WatchlistFile => x !== null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold mb-1">Wallet Watchlist</h1>
      <p className="text-sm text-text-muted mb-6">
        Kelompok wallet yang di-track (smart/sniper/caller). File JSON hot-reload; edit di{' '}
        <code className="font-mono text-xs text-text">config/watchlists/*.json</code>.
      </p>

      <div className="grid gap-4">
        {files.map((f) => (
          <div key={f.label} className="rounded-xl border border-border bg-bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-semibold capitalize">{f.label}</h2>
              <span className="text-xs text-text-faint">{f.wallets.length} wallets</span>
            </div>
            {f.note && <div className="text-xs text-text-muted mb-3">{f.note}</div>}
            {f.wallets.length === 0 ? (
              <div className="text-sm text-text-faint">
                (kosong — tambah address di file JSON untuk mulai tracking)
              </div>
            ) : (
              <ul className="text-sm font-mono divide-y divide-border/50">
                {f.wallets.map((w) => (
                  <li key={w.address} className="py-1.5 flex items-center gap-3">
                    <span className="text-text">{w.address}</span>
                    {w.alias && <span className="text-text-muted">— {w.alias}</span>}
                    {w.source && (
                      <span className="text-[10px] text-text-faint ml-auto">{w.source}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
