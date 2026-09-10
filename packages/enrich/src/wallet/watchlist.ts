import { watch } from 'node:fs';
import { loadAllWatchlists } from '@liquidius/core';
import { logger } from '@liquidius/core';

/**
 * P3: Watchlist matcher.
 * Load JSON watchlist di startup + hot-reload via fs.watch (debounced 500ms).
 * Query cepat via Set membership.
 */
export class WatchlistMatcher {
  private sets = loadAllWatchlists();
  private timer: NodeJS.Timeout | null = null;

  watch(dir = 'config/watchlists'): void {
    watch(dir, () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        try {
          this.sets = loadAllWatchlists(dir);
          logger.info(
            {
              smart: this.sets.smart.size,
              sniper: this.sets.sniper.size,
              caller: this.sets.caller.size,
            },
            '[watchlist] reloaded',
          );
        } catch (err) {
          logger.error({ err: (err as Error).message }, '[watchlist] reload failed');
        }
      }, 500);
    });
  }

  labelOf(address: string): 'smart' | 'sniper' | 'caller' | null {
    if (this.sets.smart.has(address)) return 'smart';
    if (this.sets.sniper.has(address)) return 'sniper';
    if (this.sets.caller.has(address)) return 'caller';
    return null;
  }

  countInWallets(addresses: string[]): { smart: number; sniper: number; caller: number } {
    let smart = 0,
      sniper = 0,
      caller = 0;
    for (const a of addresses) {
      const l = this.labelOf(a);
      if (l === 'smart') smart++;
      else if (l === 'sniper') sniper++;
      else if (l === 'caller') caller++;
    }
    return { smart, sniper, caller };
  }
}
