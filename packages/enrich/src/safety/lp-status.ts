import { Connection, PublicKey } from '@solana/web3.js';

const BURN_ADDRESSES = new Set([
  '1nc1nerator11111111111111111111111111111111',
  '11111111111111111111111111111111',
]);

/**
 * P1: Cek LP burn status.
 * - lpBurned = LP mint supply sepenuhnya berada di burn address, atau totalSupply=0
 * - lpLocked = TODO (butuh cek program locker seperti Streamflow, PinkLock).
 */
export async function fetchLpStatus(
  conn: Connection,
  lpMint: string,
): Promise<{ lpBurned: boolean; lpLocked: boolean } | null> {
  try {
    const largest = await conn.getTokenLargestAccounts(new PublicKey(lpMint));
    const total = largest.value.reduce((acc, a) => acc + Number(a.amount), 0);
    if (total === 0) return { lpBurned: true, lpLocked: false };
    const burnSum = largest.value
      .filter((a) => BURN_ADDRESSES.has(a.address.toBase58()))
      .reduce((acc, a) => acc + Number(a.amount), 0);
    const lpBurned = burnSum / total >= 0.99;
    // Locker detection belum diimplementasikan.
    return { lpBurned, lpLocked: false };
  } catch {
    return null;
  }
}
