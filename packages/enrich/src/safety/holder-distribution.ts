import { Connection, PublicKey } from '@solana/web3.js';

/**
 * P1: Hitung top10 holder % + creator holding %.
 * Gunakan `getTokenLargestAccounts` (SPL native) — cukup untuk top holder set.
 */
export async function fetchHolderDistribution(
  conn: Connection,
  mint: string,
  creator: string,
): Promise<{ top10Pct: number; creatorPct: number } | null> {
  try {
    const [largest, supply] = await Promise.all([
      conn.getTokenLargestAccounts(new PublicKey(mint)),
      conn.getTokenSupply(new PublicKey(mint)),
    ]);
    const total = Number(supply.value.amount);
    if (total <= 0) return null;

    const top10 = largest.value.slice(0, 10);
    const top10Sum = top10.reduce((acc, a) => acc + Number(a.amount), 0);
    const top10Pct = top10Sum / total;

    // Untuk creator kita perlu getTokenAccountsByOwner. Cheap approx: cek apakah
    // salah satu top holder = creator (works kalau creator masih hold banyak).
    const creatorHolding = top10.find((a) => a.address.toBase58() === creator);
    const creatorPct = creatorHolding ? Number(creatorHolding.amount) / total : 0;

    return { top10Pct, creatorPct };
  } catch {
    return null;
  }
}
