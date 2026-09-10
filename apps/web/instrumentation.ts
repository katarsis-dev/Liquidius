/**
 * Next.js official hook — dijalankan sekali saat server boot (Node runtime only).
 * Load `.env` root (2 level di atas apps/web) + apps/web/.env kalau ada.
 *
 * Kita parse manual (bukan dotenv) supaya webpack Next.js gak coba bundle
 * dotenv untuk Edge runtime dan gagal resolve 'path'/'fs'.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { readFileSync, existsSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const loadEnvFile = (path: string, override = false): void => {
    if (!existsSync(path)) return;
    const content = readFileSync(path, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // Buang quote di kanan-kiri kalau ada
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (override || process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  };

  // Load root .env dulu, lalu apps/web/.env kalau ada (override root).
  loadEnvFile(resolve(process.cwd(), '../../.env'), false);
  loadEnvFile(resolve(process.cwd(), '.env'), true);

  const { startPipeline } = await import('./lib/pipeline');
  startPipeline();
}
