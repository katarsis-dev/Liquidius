import { Connection, PublicKey } from '@solana/web3.js';

/**
 * P4: Creator dump monitor.
 * Setelah migrate, poll balance creator wallet vs allocation awal; hitung %
 * dijual. `creatorDump = true` bila > threshold.
 */
export class CreatorMonitor {
  private baseline = new Map<string, { creator: string; initialAmt: number }>();

  registerBaseline(mint: string, creator: string, initialAmt: number): void {
    this.baseline.set(mint, { creator, initialAmt });
  }

  async check(
    conn: Connection,
    mint: string,
    threshold = 0.4,
  ): Promise<{ soldPct: number; dumped: boolean } | null> {
    const b = this.baseline.get(mint);
    if (!b || b.initialAmt <= 0) return null;
    try {
      const largest = await conn.getTokenLargestAccounts(new PublicKey(mint));
      const still = largest.value.find((a) => a.address.toBase58() === b.creator);
      const current = still ? Number(still.amount) : 0;
      const soldPct = Math.max(0, (b.initialAmt - current) / b.initialAmt);
      return { soldPct, dumped: soldPct >= threshold };
    } catch {
      return null;
    }
  }
}
