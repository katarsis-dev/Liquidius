import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';

const NumRange = z.object({ min: z.number().optional(), max: z.number().optional() });
const NumRangeUsd = z.object({
  min_usd: z.number().optional(),
  max_usd: z.number().optional(),
});
const SecRange = z.object({ min_sec: z.number().optional(), max_sec: z.number().optional() });

const PreMigrateSchema = z
  .object({
    pair_age: SecRange.optional(),
    market_cap: NumRangeUsd.optional(),
    liquidity_usd: NumRange.optional(),
    volume_1m_usd: NumRange.optional(),
    volume_5m_usd: NumRange.optional(),
    unique_buyers_5m: NumRange.optional(),
    buy_sell_ratio_5m: NumRange.optional(),
    top10_holder_pct: NumRange.optional(),
    creator_holding_pct: NumRange.optional(),
    bundle_pct: NumRange.optional(),
    sniper_pct: NumRange.optional(),
    mint_authority: z.enum(['disabled', 'any']).optional(),
    freeze_authority: z.enum(['disabled', 'any']).optional(),
    lp_burned_or_locked: z.enum(['required', 'preferred', 'any']).optional(),
    lp_lock_min_days: z.number().optional(),
    bonding_progress_pct: NumRange.optional(),
    is_migrated: z.boolean().optional(),
  })
  .strict();

const PostMigrateSchema = z
  .object({
    mc_at_migrate: NumRangeUsd.optional(),
    volume_after_migrate_1m_usd: NumRange.optional(),
    volume_after_migrate_5m_usd: NumRange.optional(),
    holders_delta_5m: NumRange.optional(),
    creator_sold_after_migrate: NumRange.optional(),
    top_holder_sold_after_migrate: NumRange.optional(),
    tracked_smart_wallets_in: NumRange.optional(),
    cluster_wallet_count: NumRange.optional(),
    creator_dump: z.enum(['forbidden', 'any']).optional(),
    skip_volume_up_holders_down: z.boolean().optional(),
  })
  .strict();

export const ModeConfigSchema = z
  .object({
    name: z.enum(['DEGEN', 'MEDIUM', 'SAFE']),
    channelEnv: z.string(),
    color: z.string(),
    pre_migrate: PreMigrateSchema.optional(),
    post_migrate: PostMigrateSchema.optional(),
  })
  .strict();

export type ModeConfig = z.infer<typeof ModeConfigSchema>;
export type PreMigrate = z.infer<typeof PreMigrateSchema>;
export type PostMigrate = z.infer<typeof PostMigrateSchema>;

export function loadModeConfig(path: string): ModeConfig {
  const raw = readFileSync(path, 'utf8');
  const doc = parseYaml(raw);
  const parsed = ModeConfigSchema.safeParse(doc);
  if (!parsed.success) {
    throw new Error(`Invalid mode config at ${path}:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}

export function loadAllModes(configDir: string = 'config/modes'): ModeConfig[] {
  const base = resolve(process.cwd(), configDir);
  return (['degen', 'medium', 'safe'] as const).map((n) => loadModeConfig(`${base}/${n}.yaml`));
}
