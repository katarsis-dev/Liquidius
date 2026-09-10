import pino from 'pino';

/**
 * Structured logger. Kunci sensitif (API key, token) di-redact ke `[Redacted]`
 * supaya tidak pernah bocor ke stdout/logfile.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'HELIUS_API_KEY',
      'BIRDEYE_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'WEB_ADMIN_TOKEN',
      '*.apiKey',
      '*.token',
      '*.secret',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: false,
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
      : undefined,
});

export type Logger = typeof logger;
