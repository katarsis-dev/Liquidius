import { describe, it, expect } from 'vitest';
import { evaluateMode } from '../src/mode-evaluator.js';
import type { PairSnapshot, ModeConfig } from '@liquidius/core';

const medium: ModeConfig = {
  name: 'MEDIUM',
  channelEnv: 'TELEGRAM_CHAT_ID_MEDIUM',
  color: '#eab308',
  pre_migrate: {
    pair_age: { min_sec: 60, max_sec: 1200 },
    market_cap: { min_usd: 6000, max_usd: 35000 },
    liquidity_usd: { min: 5000, max: 25000 },
    volume_5m_usd: { min: 5000 },
    unique_buyers_5m: { min: 25 },
    buy_sell_ratio_5m: { min: 1.4 },
    top10_holder_pct: { max: 0.28 },
    creator_holding_pct: { max: 0.07 },
    bundle_pct: { max: 0.15 },
    sniper_pct: { max: 0.12 },
    mint_authority: 'disabled',
    freeze_authority: 'disabled',
    lp_burned_or_locked: 'required',
    bonding_progress_pct: { min: 0.9 },
  },
};

const happy: PairSnapshot = {
  mint: 'm',
  pool: 'p',
  launchSource: 'pump',
  creator: 'c',
  createdAt: Date.now(),
  pairAgeSec: 300,
  marketCap: 12000,
  liquidityUsd: 8000,
  volume5mUsd: 7000,
  uniqueBuyers5m: 30,
  buySellRatio5m: 1.6,
  safety: {
    mintAuthorityDisabled: true,
    freezeAuthorityDisabled: true,
    lpBurned: true,
    top10HolderPct: 0.2,
    creatorHoldingPct: 0.03,
    bundlePct: 0.05,
    sniperPct: 0.06,
  },
  migration: { isMigrated: false, bondingProgressPct: 0.95 },
  wallets: {
    first20Buyers: [],
    trackedSmartWalletsIn: 0,
    trackedSniperWalletsIn: 0,
    trackedCallerWalletsIn: 0,
    clusterWalletCount: 0,
    sameFundingSource: false,
  },
  signals: {},
};

describe('evaluateMode MEDIUM', () => {
  it('matches happy path', () => {
    const r = evaluateMode(happy, medium);
    expect(r.matched).toBe(true);
    expect(r.failures).toHaveLength(0);
  });

  it('fails when market cap too low', () => {
    const r = evaluateMode({ ...happy, marketCap: 1000 }, medium);
    expect(r.matched).toBe(false);
    expect(r.failures).toContain('market_cap');
  });

  it('fails when LP burn/lock required but neither', () => {
    const r = evaluateMode(
      { ...happy, safety: { ...happy.safety, lpBurned: false, lpLocked: false } },
      medium,
    );
    expect(r.matched).toBe(false);
    expect(r.failures).toContain('lp_burned_or_locked');
  });

  it('fails when mint authority not disabled', () => {
    const r = evaluateMode(
      { ...happy, safety: { ...happy.safety, mintAuthorityDisabled: false } },
      medium,
    );
    expect(r.matched).toBe(false);
    expect(r.failures).toContain('mint_authority');
  });
});
