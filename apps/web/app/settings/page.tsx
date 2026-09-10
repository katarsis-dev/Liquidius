import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadYaml(name: string): string {
  try {
    const p = resolve(process.cwd(), '..', '..', 'config', 'modes', `${name}.yaml`);
    return readFileSync(p, 'utf8');
  } catch {
    return '(gagal load)';
  }
}

export default function SettingsPage() {
  const files = [
    { name: 'degen', label: 'DEGEN', color: 'text-orange-300' },
    { name: 'medium', label: 'MEDIUM', color: 'text-yellow-300' },
    { name: 'safe', label: 'SAFE', color: 'text-emerald-300' },
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold mb-1">Filter Modes</h1>
      <p className="text-sm text-text-muted mb-6">
        Threshold per-mode di-load dari{' '}
        <code className="text-xs font-mono text-text">config/modes/*.yaml</code>. Edit file
        langsung — screener akan hot-reload otomatis.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {files.map((f) => (
          <div key={f.name} className="rounded-xl border border-border bg-bg-card p-4">
            <h2 className={`font-semibold mb-3 ${f.color}`}>{f.label}</h2>
            <pre className="text-[11px] leading-relaxed font-mono text-text-muted whitespace-pre-wrap max-h-[600px] overflow-auto">
              {loadYaml(f.name)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
