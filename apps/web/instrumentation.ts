/**
 * Next.js official hook — dijalankan sekali saat server boot (Node runtime).
 * Load `.env` root (2 level di atas apps/web) + apps/web/.env kalau ada.
 *
 * WORKAROUND: webpack Next.js static-analyze `import('fs')` walau di dalam
 * guard NEXT_RUNTIME !== 'nodejs'. Kita pakai `eval('require')` untuk hide
 * dari webpack — di runtime tetap CommonJS require yang normal.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
  const nodeRequire = eval('require') as NodeRequire;
  const { readFileSync, existsSync } = nodeRequire('fs') as typeof import('fs');
  const { resolve } = nodeRequire('path') as typeof import('path');

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

  loadEnvFile(resolve(process.cwd(), '../../.env'), false);
  loadEnvFile(resolve(process.cwd(), '.env'), true);

  const { startPipeline } = await import('./lib/pipeline');
  startPipeline();
}
