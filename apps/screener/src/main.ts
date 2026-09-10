import 'dotenv/config';
import { Connection } from '@solana/web3.js';
import {
  loadEnv,
  loadAllModes,
  loadAutoSkip,
  logger,
  buildLinks,
  type PairSnapshot,
} from '@liquidius/core';
import { HeliusLogsClient, type IngestEvent } from '@liquidius/ingest';
import {
  RollingMetrics,
  WatchlistMatcher,
  MigrationMonitor,
} from '@liquidius/enrich';
import { evaluateAutoSkip, evaluateAllModes, detectTriggers } from '@liquidius/filter';
import { dispatchAlerts, publishWebAlert, toAlertPayload } from '@liquidius/alert';
import { startHttp } from './health.js';

/**
 * Bootstrap screener:
 *  1. Load config + env
 *  2. Start HTTP (health + metrics + optional dev-fixture)
 *  3. Start Helius WS → route event ke enrichers → filter → dispatch
 */
async function main() {
  const env = loadEnv();
  const modes = loadAllModes();
  const autoSkip = loadAutoSkip();
  const conn = new Connection(env.HELIUS_RPC_URL, 'processed');

  logger.info({ modes: modes.map((m) => m.name) }, '[boot] modes loaded');
  void conn; // dipakai enricher yang butuh RPC read

  const metrics = new RollingMetrics();
  const migration = new MigrationMonitor();
  const watchlist = new WatchlistMatcher();
  watchlist.watch();

  const snapshotStore = new Map<string, PairSnapshot>();

  const handleEvent = async (ev: IngestEvent) => {
    if (ev.kind === 'pair_detected' && ev.mint) {
      const snap: PairSnapshot = {
        mint: ev.mint,
        pool: ev.pool,
        launchSource: ev.launchSource,
        creator: ev.creator,
        createdAt: ev.ts,
        pairAgeSec: 0,
        safety: {},
        migration: { isMigrated: ev.launchSource !== 'pump' },
        wallets: {
          first20Buyers: [],
          trackedSmartWalletsIn: 0,
          trackedSniperWalletsIn: 0,
          trackedCallerWalletsIn: 0,
          clusterWalletCount: 0,
          sameFundingSource: false,
        },
        signals: {},
        meta: {},
      };
      snapshotStore.set(ev.mint, snap);
      await evaluateAndDispatch(snap);
      return;
    }

    if (ev.kind === 'swap' && ev.mint) {
      await metrics.record(ev);
      const cur = snapshotStore.get(ev.mint);
      if (!cur) return;
      const m = await metrics.snapshot(ev.mint);
      const label = watchlist.labelOf(ev.wallet);
      if (label === 'smart') cur.wallets.trackedSmartWalletsIn++;
      else if (label === 'sniper') cur.wallets.trackedSniperWalletsIn++;
      else if (label === 'caller') cur.wallets.trackedCallerWalletsIn++;
      Object.assign(cur, m);
      cur.pairAgeSec = Math.floor((Date.now() - cur.createdAt) / 1000);
      await evaluateAndDispatch(cur);
      return;
    }

    if (ev.kind === 'migrate' && ev.mint) {
      migration.onMigrate(ev);
      const cur = snapshotStore.get(ev.mint);
      if (!cur) return;
      cur.migration.isMigrated = true;
      cur.migration.migrateTime = ev.ts;
      await evaluateAndDispatch(cur);
    }
  };

  const evaluateAndDispatch = async (next: PairSnapshot) => {
    const skip = evaluateAutoSkip(next, autoSkip);
    if (skip.skipped) {
      logger.debug({ mint: next.mint, reasons: skip.reasons }, '[skip]');
      return;
    }
    const matches = evaluateAllModes(next, modes);
    const passed = matches.filter((m) => m.matched);
    if (passed.length === 0) return;

    const prev = snapshotStore.get(next.mint);
    const triggers = detectTriggers(prev, next);
    if (triggers.length === 0) return;

    await dispatchAlerts(
      next,
      passed.map((p) => ({ mode: p.mode, triggers })),
    );
  };

  startHttp(env.SCREENER_HTTP_PORT);

  if (env.DEV_FIXTURE_ALERTS) {
    logger.warn('[dev] DEV_FIXTURE_ALERTS enabled — injecting fake alerts every 5s');
    devFixtureLoop();
    return;
  }

  const client = new HeliusLogsClient();
  client.on('event', handleEvent);
  client.start();

  const shutdown = () => {
    logger.info('[boot] shutting down');
    client.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function devFixtureLoop() {
  const modes: Array<'DEGEN' | 'MEDIUM' | 'SAFE'> = ['DEGEN', 'MEDIUM', 'SAFE'];
  let i = 0;
  setInterval(async () => {
    const mode = modes[i++ % modes.length]!;
    const mint = `Fx${Math.random().toString(36).slice(2, 8)}${'k'.repeat(30)}`.slice(0, 44);
    const snap: PairSnapshot = {
      mint,
      pool: mint.slice(0, 44),
      launchSource: mode === 'DEGEN' ? 'pump' : 'raydium',
      creator: 'Cr' + mint.slice(2),
      createdAt: Date.now() - 60_000,
      pairAgeSec: 60,
      marketCap: 12_000 + Math.random() * 20_000,
      liquidityUsd: 8_000 + Math.random() * 10_000,
      volume5mUsd: 5_000 + Math.random() * 20_000,
      volume1mUsd: 1_000 + Math.random() * 5_000,
      uniqueBuyers5m: 20 + Math.floor(Math.random() * 60),
      buySellRatio5m: 1.2 + Math.random(),
      safety: {
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
        lpBurned: mode !== 'DEGEN',
        lpLocked: false,
        top10HolderPct: 0.1 + Math.random() * 0.15,
        creatorHoldingPct: Math.random() * 0.05,
        bundlePct: Math.random() * 0.1,
        sniperPct: Math.random() * 0.1,
      },
      migration: { isMigrated: mode !== 'DEGEN', bondingProgressPct: 0.95 },
      wallets: {
        first20Buyers: [],
        trackedSmartWalletsIn: mode === 'SAFE' ? 2 : 1,
        trackedSniperWalletsIn: 0,
        trackedCallerWalletsIn: 0,
        clusterWalletCount: 1,
        sameFundingSource: false,
      },
      signals: {},
      meta: { symbol: 'DEMO', name: 'Fixture Token' },
    };
    const payload = toAlertPayload(snap, mode, 'new_pair_detected');
    payload.links = buildLinks(payload.mint, payload.pool);
    await publishWebAlert(payload);
  }, 5000);
}

main().catch((err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'fatal');
  process.exit(1);
});
