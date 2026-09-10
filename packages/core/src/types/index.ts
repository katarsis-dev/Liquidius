// Shared cross-package types — merepresentasikan snapshot state token,
// bukan row DB. Enricher berbeda mengisi bagian yang berbeda.

export type AlertMode = 'DEGEN' | 'MEDIUM' | 'SAFE';

export type LaunchSource = 'pump' | 'raydium' | 'pumpswap' | 'other';

/** Core §4.1 */
export interface PairCore {
  mint: string;
  pool: string;
  launchSource: LaunchSource;
  creator: string;
  createdAt: number; // unix ms
  tokenAgeSec?: number;
  pairAgeSec: number;
  marketCap?: number;
  liquidityUsd?: number;
  volume1mUsd?: number;
  volume5mUsd?: number;
  buys1m?: number;
  sells1m?: number;
  uniqueBuyers5m?: number;
  buySellRatio5m?: number;
}

/** Safety §4.2 */
export interface SafetySnapshot {
  mintAuthorityDisabled?: boolean;
  freezeAuthorityDisabled?: boolean;
  lpBurned?: boolean;
  lpLocked?: boolean;
  lpLockUntil?: number;
  top10HolderPct?: number;
  creatorHoldingPct?: number;
  creatorSoldPct?: number;
  bundlePct?: number;
  sniperPct?: number;
  honeypotFlag?: boolean;
  taxFee?: number;
}

/** Migration §4.3 */
export interface MigrationSnapshotT {
  isMigrated: boolean;
  migrateTime?: number;
  mcAtMigrate?: number;
  liqAtMigrate?: number;
  volumeAfterMigrate1m?: number;
  volumeAfterMigrate5m?: number;
  holdersAfterMigrate5m?: number;
  holdersDelta5m?: number;
  creatorSoldAfterMigratePct?: number;
  topHolderSoldAfterMigratePct?: number;
  bondingProgressPct?: number;
}

/** Wallet §4.4 */
export interface WalletInsights {
  first20Buyers: string[];
  trackedSmartWalletsIn: number;
  trackedSniperWalletsIn: number;
  trackedCallerWalletsIn: number;
  clusterWalletCount: number;
  sameFundingSource: boolean;
}

/** Kombinasi semua field yang dibutuhkan filter engine. */
export interface PairSnapshot extends PairCore {
  safety: SafetySnapshot;
  migration: MigrationSnapshotT;
  wallets: WalletInsights;
  /** signal turunan yang dihitung enricher tambahan */
  signals: {
    volumeUpHoldersUp?: boolean;
    volumeUpHoldersDown?: boolean;
    creatorDump?: boolean;
    liqDropPct5m?: number;
  };
  meta?: {
    symbol?: string;
    name?: string;
    logoUri?: string;
  };
}

export type TriggerKind =
  | 'new_pair_detected'
  | 'bonding_almost_done'
  | 'just_migrated'
  | 'smart_wallet_buy'
  | 'creator_dump'
  | 'liq_too_low'
  | 'holder_concentration_high'
  | 'volume_up_holders_up'
  | 'volume_up_holders_down';

export interface AlertPayload {
  id: string;
  mode: AlertMode;
  trigger: TriggerKind;
  mint: string;
  pool: string;
  symbol?: string;
  name?: string;
  logoUri?: string;
  age_sec: number;
  mc_usd?: number;
  liq_usd?: number;
  vol_1m_usd?: number;
  vol_5m_usd?: number;
  unique_buyers_5m?: number;
  buy_sell_ratio_5m?: number;
  safety: {
    mintDisabled?: boolean;
    freezeDisabled?: boolean;
    lpBurned?: boolean;
    lpLocked?: boolean;
    topPct?: number;
    creatorPct?: number;
    bundlePct?: number;
    sniperPct?: number;
    honeypot?: boolean;
  };
  trackedWallets: { smart: number; sniper: number; caller: number };
  isMigrated: boolean;
  bondingProgressPct?: number;
  links: {
    gmgn: string;
    solscan: string;
    dexscreener: string;
    birdeye: string;
  };
  createdAt: number;
}

/** Bangun links standar. GMGN adalah CTA utama di web UI. */
export function buildLinks(mint: string, pool?: string): AlertPayload['links'] {
  return {
    gmgn: `https://gmgn.ai/sol/token/${mint}`,
    solscan: `https://solscan.io/token/${mint}`,
    dexscreener: pool
      ? `https://dexscreener.com/solana/${pool}`
      : `https://dexscreener.com/solana/${mint}`,
    birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
  };
}
