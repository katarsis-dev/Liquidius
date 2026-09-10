import { describe, it, expect } from 'vitest';
import type { PairSnapshot, AutoSkipConfig } from '@liquidius/core';
import { evaluateAutoSkip } from '../src/auto-skip.js';

const cfg: AutoSkipConfig = {
  liquidity_usd_min: 2000,
  top10_holder_pct_max: 0.45,
  creator_holding_pct_max: 0.15,
  unique_buyers_5m_min: 10,
  require_mint_authority_disabled: true,
  require_freeze_authority_disabled: true,
  skip_volume_up_holders_down: true,
  skip_creator_dump_after_migrate: true,
  same_funding_source: { cluster_wallet_count_max: 5 },
};

const base = (overrides: Partial<PairSnapshot> = {}): PairSnapshot => ({
  mint: 'm',
  pool: 'p',
  launchSource: 'pump',
  creator: 'c',
  createdAt: Date.now(),
  pairAgeSec: 120,
  liquidityUsd: 5000,
  uniqueBuyers5m: 20,
  safety: {
    mintAuthorityDisabled: true,
    freezeAuthorityDisabled: true,
    top10HolderPct: 0.2,
    creatorHoldingPct: 0.05,
  },
  migration: { isMigrated: false },
  wallets: {
    first20Buyers: [],
    trackedSmartWalletsIn: 0,
    trackedSniperWalletsIn: 0,
    trackedCallerWalletsIn: 0,
    clusterWalletCount: 0,
    sameFundingSource: false,
  },
  signals: {},
  ...overrides,
});

describe('evaluateAutoSkip', () => {
  it('lolos gate untuk snapshot sehat', () => {
    const r = evaluateAutoSkip(base(), cfg);
    expect(r.skipped).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it('skip bila likuiditas terlalu rendah', () => {
    const r = evaluateAutoSkip(base({ liquidityUsd: 500 }), cfg);
    expect(r.skipped).toBe(true);
    expect(r.reasons[0]).toMatch(/liquidity_usd/);
  });

  it('skip bila top10 holder terlalu tinggi', () => {
    const r = evaluateAutoSkip(
      base({ safety: { ...base().safety, top10HolderPct: 0.5 } }),
      cfg,
    );
    expect(r.skipped).toBe(true);
    expect(r.reasons.some((x) => x.includes('top10_holder_pct'))).toBe(true);
  });

  it('skip bila mint authority enabled', () => {
    const r = evaluateAutoSkip(
      base({ safety: { ...base().safety, mintAuthorityDisabled: false } }),
      cfg,
    );
    expect(r.skipped).toBe(true);
    expect(r.reasons).toContain('mint_authority=enabled');
  });

  it('skip creator_dump setelah migrate', () => {
    const r = evaluateAutoSkip(
      base({ migration: { isMigrated: true }, signals: { creatorDump: true } }),
      cfg,
    );
    expect(r.skipped).toBe(true);
    expect(r.reasons).toContain('creator_dump_after_migrate');
  });

  it('skip bila cluster same-funding ≥ threshold', () => {
    const r = evaluateAutoSkip(
      base({
        wallets: { ...base().wallets, sameFundingSource: true, clusterWalletCount: 6 },
      }),
      cfg,
    );
    expect(r.skipped).toBe(true);
  });
});
