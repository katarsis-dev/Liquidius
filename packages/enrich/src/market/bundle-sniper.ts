/**
 * Deteksi bundle/sniper — heuristik sesuai PRD §13 open question.
 *
 *  - SNIPER: wallet yang buy di N slot pertama sejak pool created.
 *  - BUNDLE: kelompok wallet dgn signer/funding sama yang buy di block yang sama.
 *
 * Implementasi minimal: dihitung dari array `earlyBuys` (mint, wallet, slot).
 * Fungsi pure — mudah di-unit-test.
 */

export interface EarlyBuy {
  wallet: string;
  slot: number;
  funder?: string; // dari getSignaturesForAddress si wallet
}

export function computeBundleSniper(
  earlyBuys: EarlyBuy[],
  poolCreatedSlot: number,
  totalSupplyBuys: number,
  opts: { sniperSlotWindow?: number; bundleSameSlotMin?: number } = {},
): { sniperPct: number; bundlePct: number; clusterCount: number; sameFunding: boolean } {
  const sniperWindow = opts.sniperSlotWindow ?? 3;
  const bundleMin = opts.bundleSameSlotMin ?? 3;

  const snipers = earlyBuys.filter((b) => b.slot - poolCreatedSlot <= sniperWindow);
  const sniperPct = totalSupplyBuys > 0 ? snipers.length / totalSupplyBuys : 0;

  // Bundle: cluster wallet berbagi funder pada slot yang sama.
  const bySlot = new Map<number, EarlyBuy[]>();
  for (const b of earlyBuys) {
    const arr = bySlot.get(b.slot) ?? [];
    arr.push(b);
    bySlot.set(b.slot, arr);
  }
  const funders = new Map<string, number>();
  for (const [, group] of bySlot) {
    if (group.length < bundleMin) continue;
    for (const g of group) {
      if (!g.funder) continue;
      funders.set(g.funder, (funders.get(g.funder) ?? 0) + 1);
    }
  }
  let clusterCount = 0;
  let sameFunding = false;
  for (const [, count] of funders) {
    if (count >= bundleMin) {
      clusterCount = Math.max(clusterCount, count);
      sameFunding = true;
    }
  }
  const bundlePct = totalSupplyBuys > 0 ? clusterCount / totalSupplyBuys : 0;

  return { sniperPct, bundlePct, clusterCount, sameFunding };
}
