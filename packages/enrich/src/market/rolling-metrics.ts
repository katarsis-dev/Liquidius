import { redis, KEYS } from '@liquidius/core';
import type { SwapEvent } from '@liquidius/ingest';

/**
 * Sliding-window market metrics via Redis:
 * per menit-bucket, kita simpan hash `metrics:{pair}:{minute}` dgn field:
 *   buys, sells, volumeUsd, buyers (set, count = uniqueBuyers)
 * Retention 10 menit (cukup untuk 1m + 5m window).
 */
export class RollingMetrics {
  async record(ev: SwapEvent): Promise<void> {
    if (!ev.mint || !ev.wallet) return;
    const minute = Math.floor(ev.ts / 60_000);
    const key = KEYS.metricsWindow(ev.mint, minute);
    const r = redis();
    const pipe = r.multi();
    pipe.hincrby(key, ev.side === 'buy' ? 'buys' : 'sells', 1);
    if (ev.amountUsd) pipe.hincrbyfloat(key, 'volumeUsd', ev.amountUsd);
    if (ev.side === 'buy') pipe.sadd(`${key}:buyers`, ev.wallet);
    pipe.expire(key, 600);
    pipe.expire(`${key}:buyers`, 600);
    await pipe.exec();
  }

  async snapshot(
    mint: string,
    now = Date.now(),
  ): Promise<{
    buys1m: number;
    sells1m: number;
    volume1mUsd: number;
    volume5mUsd: number;
    uniqueBuyers5m: number;
    buySellRatio5m: number;
  }> {
    const r = redis();
    const curMinute = Math.floor(now / 60_000);
    const minutes = [0, 1, 2, 3, 4].map((i) => curMinute - i);
    const [oneM, ...rest] = minutes;

    const pipe = r.multi();
    for (const m of minutes) {
      pipe.hgetall(KEYS.metricsWindow(mint, m));
      pipe.scard(`${KEYS.metricsWindow(mint, m)}:buyers`);
    }
    const raw = (await pipe.exec()) ?? [];

    // hasil = [[err, hash], [err, scard], ...]
    let buys5 = 0,
      sells5 = 0,
      vol5 = 0,
      uniq5 = 0;
    let buys1 = 0,
      sells1 = 0,
      vol1 = 0;

    for (let i = 0; i < minutes.length; i++) {
      const hash = (raw[i * 2]?.[1] ?? {}) as Record<string, string>;
      const uniq = Number(raw[i * 2 + 1]?.[1] ?? 0);
      const b = Number(hash['buys'] ?? 0);
      const s = Number(hash['sells'] ?? 0);
      const v = Number(hash['volumeUsd'] ?? 0);
      buys5 += b;
      sells5 += s;
      vol5 += v;
      uniq5 += uniq;
      if (minutes[i] === oneM) {
        buys1 = b;
        sells1 = s;
        vol1 = v;
      }
    }
    void rest;

    return {
      buys1m: buys1,
      sells1m: sells1,
      volume1mUsd: vol1,
      volume5mUsd: vol5,
      uniqueBuyers5m: uniq5,
      buySellRatio5m: sells5 > 0 ? buys5 / sells5 : buys5 > 0 ? Infinity : 0,
    };
  }
}
