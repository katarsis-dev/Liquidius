import { describe, it, expect } from 'vitest';
import { detectTriggers } from '../src/trigger-detector.js';
import type { PairSnapshot } from '@liquidius/core';

const baseSnap = (partial: Partial<PairSnapshot> = {}): PairSnapshot => ({
  mint: 'm',
  pool: 'p',
  launchSource: 'pump',
  creator: 'c',
  createdAt: Date.now(),
  pairAgeSec: 60,
  safety: {},
  migration: { isMigrated: false, bondingProgressPct: 0.5 },
  wallets: {
    first20Buyers: [],
    trackedSmartWalletsIn: 0,
    trackedSniperWalletsIn: 0,
    trackedCallerWalletsIn: 0,
    clusterWalletCount: 0,
    sameFundingSource: false,
  },
  signals: {},
  ...partial,
});

describe('detectTriggers', () => {
  it('emits new_pair_detected when no prev snapshot', () => {
    const triggers = detectTriggers(undefined, baseSnap());
    expect(triggers).toContain('new_pair_detected');
  });

  it('emits bonding_almost_done when crossing threshold', () => {
    const prev = baseSnap({ migration: { isMigrated: false, bondingProgressPct: 0.6 } });
    const next = baseSnap({ migration: { isMigrated: false, bondingProgressPct: 0.85 } });
    const t = detectTriggers(prev, next);
    expect(t).toContain('bonding_almost_done');
  });

  it('emits just_migrated on migration transition', () => {
    const prev = baseSnap({ migration: { isMigrated: false } });
    const next = baseSnap({ migration: { isMigrated: true } });
    expect(detectTriggers(prev, next)).toContain('just_migrated');
  });

  it('emits smart_wallet_buy when tracked smart count increases', () => {
    const prev = baseSnap();
    const next = baseSnap({
      wallets: { ...baseSnap().wallets, trackedSmartWalletsIn: 1 },
    });
    expect(detectTriggers(prev, next)).toContain('smart_wallet_buy');
  });
});
