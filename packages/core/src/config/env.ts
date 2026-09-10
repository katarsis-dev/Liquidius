import { z } from 'zod';

/**
 * Env schema — divalidasi fail-fast di startup.
 * JANGAN pernah hardcode value key di sini; semua dari process.env.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  HELIUS_API_KEY: z.string().min(1, 'HELIUS_API_KEY wajib diisi'),
  HELIUS_RPC_URL: z.string().url(),
  HELIUS_WSS_URL: z.string().startsWith('wss://'),
  BIRDEYE_API_KEY: z.string().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID_DEGEN: z.string().optional(),
  TELEGRAM_CHAT_ID_MEDIUM: z.string().optional(),
  TELEGRAM_CHAT_ID_SAFE: z.string().optional(),

  WEB_ADMIN_TOKEN: z.string().min(16).optional(),
  SCREENER_API_URL: z.string().url().default('http://localhost:8080'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  SCREENER_HTTP_PORT: z.coerce.number().int().positive().default(8080),
  DEV_FIXTURE_ALERTS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Load env sekali di startup. Fail-fast bila field wajib hilang.
 * Di dev, izinkan mode-fixture (DEV_FIXTURE_ALERTS=true) untuk skip Helius.
 */
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('[env] validation failed:\n' + parsed.error.toString());
    throw new Error('Invalid environment configuration');
  }
  cached = parsed.data;
  return cached;
}

/** Untuk unit test — reset cache. */
export function resetEnvForTest(): void {
  cached = null;
}
