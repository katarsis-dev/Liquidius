import type { ModeConfig, PairSnapshot, PreMigrate, PostMigrate } from '@liquidius/core';

export interface ModeMatch {
  matched: boolean;
  mode: ModeConfig['name'];
  failures: string[];
}

const inRangeUsd = (v: number | undefined, r?: { min_usd?: number; max_usd?: number }) => {
  if (!r) return true;
  if (v === undefined) return false;
  if (r.min_usd !== undefined && v < r.min_usd) return false;
  if (r.max_usd !== undefined && v > r.max_usd) return false;
  return true;
};
const inRange = (v: number | undefined, r?: { min?: number; max?: number }) => {
  if (!r) return true;
  if (v === undefined) return false;
  if (r.min !== undefined && v < r.min) return false;
  if (r.max !== undefined && v > r.max) return false;
  return true;
};
const inRangeSec = (v: number | undefined, r?: { min_sec?: number; max_sec?: number }) => {
  if (!r) return true;
  if (v === undefined) return false;
  if (r.min_sec !== undefined && v < r.min_sec) return false;
  if (r.max_sec !== undefined && v > r.max_sec) return false;
  return true;
};

function checkPre(pair: PairSnapshot, pre: PreMigrate, out: string[]) {
  if (!inRangeSec(pair.pairAgeSec, pre.pair_age)) out.push('pair_age');
  if (!inRangeUsd(pair.marketCap, pre.market_cap)) out.push('market_cap');
  if (!inRange(pair.liquidityUsd, pre.liquidity_usd)) out.push('liquidity_usd');
  if (!inRange(pair.volume1mUsd, pre.volume_1m_usd)) out.push('volume_1m');
  if (!inRange(pair.volume5mUsd, pre.volume_5m_usd)) out.push('volume_5m');
  if (!inRange(pair.uniqueBuyers5m, pre.unique_buyers_5m)) out.push('unique_buyers_5m');
  if (!inRange(pair.buySellRatio5m, pre.buy_sell_ratio_5m)) out.push('buy_sell_ratio_5m');
  if (!inRange(pair.safety.top10HolderPct, pre.top10_holder_pct)) out.push('top10_holder_pct');
  if (!inRange(pair.safety.creatorHoldingPct, pre.creator_holding_pct))
    out.push('creator_holding_pct');
  if (!inRange(pair.safety.bundlePct, pre.bundle_pct)) out.push('bundle_pct');
  if (!inRange(pair.safety.sniperPct, pre.sniper_pct)) out.push('sniper_pct');
  if (pre.mint_authority === 'disabled' && pair.safety.mintAuthorityDisabled !== true)
    out.push('mint_authority');
  if (pre.freeze_authority === 'disabled' && pair.safety.freezeAuthorityDisabled !== true)
    out.push('freeze_authority');
  if (pre.lp_burned_or_locked === 'required') {
    const ok = pair.safety.lpBurned === true || pair.safety.lpLocked === true;
    if (!ok) out.push('lp_burned_or_locked');
    if (pre.lp_lock_min_days && pair.safety.lpLockUntil) {
      const days = (pair.safety.lpLockUntil - Date.now()) / (86400 * 1000);
      if (!(pair.safety.lpBurned === true || days >= pre.lp_lock_min_days)) {
        out.push('lp_lock_min_days');
      }
    }
  }
  if (!inRange(pair.migration.bondingProgressPct, pre.bonding_progress_pct))
    out.push('bonding_progress_pct');
  if (pre.is_migrated === true && !pair.migration.isMigrated) out.push('is_migrated');
}

function checkPost(pair: PairSnapshot, post: PostMigrate, out: string[]) {
  if (!pair.migration.isMigrated) return; // rules post hanya berlaku setelah migrate
  if (!inRangeUsd(pair.migration.mcAtMigrate, post.mc_at_migrate)) out.push('mc_at_migrate');
  if (!inRange(pair.migration.volumeAfterMigrate1m, post.volume_after_migrate_1m_usd))
    out.push('volume_after_migrate_1m');
  if (!inRange(pair.migration.volumeAfterMigrate5m, post.volume_after_migrate_5m_usd))
    out.push('volume_after_migrate_5m');
  if (!inRange(pair.migration.holdersDelta5m, post.holders_delta_5m))
    out.push('holders_delta_5m');
  if (!inRange(pair.migration.creatorSoldAfterMigratePct, post.creator_sold_after_migrate))
    out.push('creator_sold_after_migrate');
  if (
    !inRange(pair.migration.topHolderSoldAfterMigratePct, post.top_holder_sold_after_migrate)
  )
    out.push('top_holder_sold_after_migrate');
  if (!inRange(pair.wallets.trackedSmartWalletsIn, post.tracked_smart_wallets_in))
    out.push('tracked_smart_wallets_in');
  if (!inRange(pair.wallets.clusterWalletCount, post.cluster_wallet_count))
    out.push('cluster_wallet_count');
  if (post.creator_dump === 'forbidden' && pair.signals.creatorDump === true)
    out.push('creator_dump');
  if (post.skip_volume_up_holders_down === true && pair.signals.volumeUpHoldersDown === true)
    out.push('volume_up_holders_down');
}

/** Evaluasi satu snapshot terhadap satu mode. */
export function evaluateMode(pair: PairSnapshot, mode: ModeConfig): ModeMatch {
  const failures: string[] = [];
  if (mode.pre_migrate) checkPre(pair, mode.pre_migrate, failures);
  if (mode.post_migrate) checkPost(pair, mode.post_migrate, failures);
  return { matched: failures.length === 0, mode: mode.name, failures };
}

/** Jalankan semua mode paralel; satu token bisa lolos di lebih dari 1 mode. */
export function evaluateAllModes(pair: PairSnapshot, modes: ModeConfig[]): ModeMatch[] {
  return modes.map((m) => evaluateMode(pair, m));
}
