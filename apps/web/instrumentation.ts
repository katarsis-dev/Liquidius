/**
 * Next.js official hook — dijalankan sekali saat server boot.
 * Load `.env` dari root repo (2 level di atas apps/web) supaya user
 * cuma perlu 1 file .env di root, bukan duplikat di tiap workspace.
 * Lalu start background pipeline (Dexscreener + Helius WS).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { config } = await import('dotenv');
  const { resolve } = await import('node:path');
  // Load root .env dulu, lalu apps/web/.env (kalau ada, override).
  config({ path: resolve(process.cwd(), '../../.env') });
  config({ path: resolve(process.cwd(), '.env'), override: true });

  const { startPipeline } = await import('./lib/pipeline');
  startPipeline();
}
