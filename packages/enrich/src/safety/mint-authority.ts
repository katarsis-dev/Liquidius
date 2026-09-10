import { Connection, PublicKey } from '@solana/web3.js';

/**
 * P1: Cek apakah mint & freeze authority disabled (null).
 * Menggunakan `getParsedAccountInfo` — 1 RPC call per pemanggilan.
 */
export async function fetchMintAuthorityFlags(
  conn: Connection,
  mint: string,
): Promise<{ mintAuthorityDisabled: boolean; freezeAuthorityDisabled: boolean } | null> {
  try {
    const info = await conn.getParsedAccountInfo(new PublicKey(mint));
    const data = info.value?.data as { parsed?: { info?: Record<string, unknown> } } | undefined;
    const parsed = data?.parsed?.info;
    if (!parsed) return null;
    return {
      mintAuthorityDisabled: parsed['mintAuthority'] == null,
      freezeAuthorityDisabled: parsed['freezeAuthority'] == null,
    };
  } catch {
    return null;
  }
}
