import type { PairSnapshot, TriggerKind } from '@liquidius/core';

/**
 * Deteksi trigger event dari transisi state (prev → next).
 * Function pure — tidak side-effect. Dispatcher yang decide kirim/tidak.
 */
export function detectTriggers(
  prev: PairSnapshot | undefined,
  next: PairSnapshot,
  opts: { bondingThreshold?: number; liqDropThresholdPct?: number } = {},
): TriggerKind[] {
  const triggers: TriggerKind[] = [];
  const bondingThreshold = opts.bondingThreshold ?? 0.7;
  const liqDropThreshold = opts.liqDropThresholdPct ?? 0.3;

  if (!prev) {
    triggers.push('new_pair_detected');
  }

  if (
    prev &&
    prev.migration.bondingProgressPct !== undefined &&
    next.migration.bondingProgressPct !== undefined &&
    prev.migration.bondingProgressPct < bondingThreshold &&
    next.migration.bondingProgressPct >= bondingThreshold
  ) {
    triggers.push('bonding_almost_done');
  }

  if (prev && prev.migration.isMigrated === false && next.migration.isMigrated === true) {
    triggers.push('just_migrated');
  }

  if (
    prev &&
    next.wallets.trackedSmartWalletsIn > prev.wallets.trackedSmartWalletsIn
  ) {
    triggers.push('smart_wallet_buy');
  }

  if (next.signals.creatorDump === true && prev?.signals.creatorDump !== true) {
    triggers.push('creator_dump');
  }

  if (
    next.signals.liqDropPct5m !== undefined &&
    next.signals.liqDropPct5m >= liqDropThreshold
  ) {
    triggers.push('liq_too_low');
  }

  if (
    prev &&
    prev.safety.top10HolderPct !== undefined &&
    next.safety.top10HolderPct !== undefined &&
    prev.safety.top10HolderPct <= 0.3 &&
    next.safety.top10HolderPct > 0.3
  ) {
    triggers.push('holder_concentration_high');
  }

  if (next.signals.volumeUpHoldersUp === true) triggers.push('volume_up_holders_up');
  if (next.signals.volumeUpHoldersDown === true) triggers.push('volume_up_holders_down');

  return triggers;
}
