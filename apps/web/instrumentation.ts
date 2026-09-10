/**
 * Next.js official hook — dijalankan sekali saat server boot.
 * Kita mulai background poller di sini (Node runtime only, bukan Edge).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPipeline } = await import('./lib/pipeline');
    startPipeline();
  }
}
