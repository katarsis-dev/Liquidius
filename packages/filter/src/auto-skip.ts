import type { AutoSkipConfig, PairSnapshot } from '@liquidius/core';

export interface AutoSkipResult {
  skipped: boolean;
  reasons: string[];
}

/**
 * Global auto-skip gate — dijalankan SEBELUM filter per-mode (PRD §7).
 * Bila salah satu kondisi terpenuhi, token di-skip total.
 */
export function evaluateAutoSkip(pair: PairSnapshot, cfg: AutoSkipConfig): AutoSkipResult {
  const reasons: string[] = [];

  if (pair.liquidityUsd !== undefined && pair.liquidityUsd < cfg.liquidity_usd_min) {
    reasons.push(`liquidity_usd<${cfg.liquidity_usd_min} (actual=${pair.liquidityUsd.toFixed(0)})`);
  }
  if (
    pair.safety.top10HolderPct !== undefined &&
    pair.safety.top10HolderPct > cfg.top10_holder_pct_max
  ) {
    reasons.push(
      `top10_holder_pct>${cfg.top10_holder_pct_max} (actual=${pair.safety.top10HolderPct.toFixed(3)})`,
    );
  }
  if (
    pair.safety.creatorHoldingPct !== undefined &&
    pair.safety.creatorHoldingPct > cfg.creator_holding_pct_max
  ) {
    reasons.push(
      `creator_holding_pct>${cfg.creator_holding_pct_max} (actual=${pair.safety.creatorHoldingPct.toFixed(3)})`,
    );
  }
  if (
    cfg.require_mint_authority_disabled &&
    pair.safety.mintAuthorityDisabled === false
  ) {
    reasons.push('mint_authority=enabled');
  }
  if (
    cfg.require_freeze_authority_disabled &&
    pair.safety.freezeAuthorityDisabled === false
  ) {
    reasons.push('freeze_authority=enabled');
  }
  if (
    pair.uniqueBuyers5m !== undefined &&
    pair.uniqueBuyers5m < cfg.unique_buyers_5m_min
  ) {
    reasons.push(
      `unique_buyers_5m<${cfg.unique_buyers_5m_min} (actual=${pair.uniqueBuyers5m})`,
    );
  }
  if (cfg.skip_volume_up_holders_down && pair.signals.volumeUpHoldersDown === true) {
    reasons.push('volume_up_holders_down');
  }
  if (
    cfg.skip_creator_dump_after_migrate &&
    pair.migration.isMigrated &&
    pair.signals.creatorDump === true
  ) {
    reasons.push('creator_dump_after_migrate');
  }
  if (
    pair.wallets.sameFundingSource &&
    pair.wallets.clusterWalletCount >= cfg.same_funding_source.cluster_wallet_count_max
  ) {
    reasons.push(
      `same_funding_source_cluster>=${cfg.same_funding_source.cluster_wallet_count_max}`,
    );
  }

  return { skipped: reasons.length > 0, reasons };
}
