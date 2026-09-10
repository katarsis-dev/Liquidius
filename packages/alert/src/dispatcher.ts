import { logger, type AlertMode, type PairSnapshot, type TriggerKind } from '@liquidius/core';
import { toAlertPayload } from './formatter.js';
import { sendTelegramAlert } from './telegram.js';
import { publishWebAlert } from './web-publisher.js';
import { shouldSend } from './dedupe.js';

/**
 * Dispatcher — untuk setiap (mode, trigger) yang lolos, buat payload,
 * cek dedupe, lalu publish paralel ke Telegram + Web (Redis pub/sub).
 */
export async function dispatchAlerts(
  pair: PairSnapshot,
  matches: Array<{ mode: AlertMode; triggers: TriggerKind[] }>,
): Promise<void> {
  for (const m of matches) {
    for (const trigger of m.triggers) {
      const payload = toAlertPayload(pair, m.mode, trigger);
      const ok = await shouldSend(payload);
      if (!ok) continue;
      logger.info(
        { mint: pair.mint, mode: m.mode, trigger, mc: pair.marketCap, lp: pair.liquidityUsd },
        '[alert] dispatch',
      );
      await Promise.all([sendTelegramAlert(payload), publishWebAlert(payload)]);
    }
  }
}
