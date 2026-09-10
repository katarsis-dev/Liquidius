import { EventEmitter } from 'node:events';
import type { MigrateEvent } from '@liquidius/ingest';

/**
 * P2: Migration monitor.
 * Terima `migrate` event dari ingest, catat waktu & schedule snapshot enrichment
 * di menit 1 dan menit 5 pasca-migrate.
 */
export class MigrationMonitor extends EventEmitter {
  private pending = new Map<string, { at: number }>();

  onMigrate(ev: MigrateEvent): void {
    this.pending.set(ev.mint, { at: ev.ts });
    setTimeout(() => this.emit('post_migrate_1m', ev.mint), 60_000);
    setTimeout(() => this.emit('post_migrate_5m', ev.mint), 5 * 60_000);
    this.emit('just_migrated', ev);
  }

  isRecentlyMigrated(mint: string, maxAgeMs = 10 * 60_000): boolean {
    const p = this.pending.get(mint);
    if (!p) return false;
    return Date.now() - p.at <= maxAgeMs;
  }
}
