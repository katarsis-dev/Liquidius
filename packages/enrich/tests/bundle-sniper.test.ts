import { describe, it, expect } from 'vitest';
import { computeBundleSniper } from '../src/market/bundle-sniper.js';

describe('computeBundleSniper', () => {
  it('marks buys in first N slots as snipers', () => {
    const r = computeBundleSniper(
      [
        { wallet: 'a', slot: 100 },
        { wallet: 'b', slot: 101 },
        { wallet: 'c', slot: 105 },
        { wallet: 'd', slot: 200 },
      ],
      100,
      4,
      { sniperSlotWindow: 3 },
    );
    // slot ≤ 103 → snipers
    expect(r.sniperPct).toBeCloseTo(2 / 4);
  });

  it('detects same-funding cluster in bundle', () => {
    const r = computeBundleSniper(
      [
        { wallet: 'a', slot: 100, funder: 'F1' },
        { wallet: 'b', slot: 100, funder: 'F1' },
        { wallet: 'c', slot: 100, funder: 'F1' },
        { wallet: 'd', slot: 200 },
      ],
      100,
      4,
      { bundleSameSlotMin: 3 },
    );
    expect(r.sameFunding).toBe(true);
    expect(r.clusterCount).toBe(3);
  });
});
