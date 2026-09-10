import { Connection, PublicKey } from '@solana/web3.js';

/**
 * P3: Same-funding-source cluster detection.
 * Untuk daftar wallet (biasanya first-20 buyers), fetch signature terakhir dan
 * cari transfer SOL awalnya (funder). Wallet dengan funder sama masuk cluster.
 *
 * NOTE: implementasi minimal — grouping oleh alamat funder terakhir yang
 * mengirim SOL ke wallet tersebut. Tidak melakukan multi-hop graph traversal.
 */
export async function detectFundingClusters(
  conn: Connection,
  wallets: string[],
  opts: { fetchSigs?: number } = {},
): Promise<{ clusters: Map<string, string[]>; largestClusterSize: number }> {
  const fetchSigs = opts.fetchSigs ?? 5;
  const clusters = new Map<string, string[]>();

  for (const w of wallets) {
    try {
      const pk = new PublicKey(w);
      const sigs = await conn.getSignaturesForAddress(pk, { limit: fetchSigs });
      const oldest = sigs[sigs.length - 1];
      if (!oldest) continue;
      const tx = await conn.getParsedTransaction(oldest.signature, {
        maxSupportedTransactionVersion: 0,
      });
      const firstFunder = extractFirstFunder(tx, w);
      if (!firstFunder) continue;
      const arr = clusters.get(firstFunder) ?? [];
      arr.push(w);
      clusters.set(firstFunder, arr);
    } catch {
      /* ignore per-wallet failures */
    }
  }

  let largest = 0;
  for (const [, v] of clusters) largest = Math.max(largest, v.length);
  return { clusters, largestClusterSize: largest };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFirstFunder(tx: any, receiver: string): string | undefined {
  const ixs = tx?.transaction?.message?.instructions ?? [];
  for (const ix of ixs) {
    if (ix?.program === 'system' && ix?.parsed?.type === 'transfer') {
      if (ix.parsed.info?.destination === receiver) return ix.parsed.info.source;
    }
  }
  return undefined;
}
