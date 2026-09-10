import { Telegraf } from 'telegraf';
import { loadEnv, logger, type AlertMode } from '@liquidius/core';
import { toTelegramMarkdown } from './formatter.js';
import type { AlertPayload } from '@liquidius/core';

let bot: Telegraf | null = null;

function getBot(): Telegraf | null {
  const env = loadEnv();
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  if (!bot) bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
  return bot;
}

function chatIdFor(mode: AlertMode): string | undefined {
  const env = loadEnv();
  if (mode === 'DEGEN') return env.TELEGRAM_CHAT_ID_DEGEN;
  if (mode === 'MEDIUM') return env.TELEGRAM_CHAT_ID_MEDIUM;
  return env.TELEGRAM_CHAT_ID_SAFE;
}

export async function sendTelegramAlert(payload: AlertPayload): Promise<void> {
  const b = getBot();
  const chatId = chatIdFor(payload.mode);
  if (!b || !chatId) {
    logger.debug({ mode: payload.mode }, '[telegram] disabled or no chat id — skipping');
    return;
  }
  try {
    await b.telegram.sendMessage(chatId, toTelegramMarkdown(payload), {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[telegram] send failed');
  }
}
