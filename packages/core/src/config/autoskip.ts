import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';

export const AutoSkipConfigSchema = z
  .object({
    liquidity_usd_min: z.number().default(2000),
    top10_holder_pct_max: z.number().default(0.45),
    creator_holding_pct_max: z.number().default(0.15),
    unique_buyers_5m_min: z.number().default(10),
    require_mint_authority_disabled: z.boolean().default(true),
    require_freeze_authority_disabled: z.boolean().default(true),
    skip_volume_up_holders_down: z.boolean().default(true),
    skip_creator_dump_after_migrate: z.boolean().default(true),
    same_funding_source: z
      .object({ cluster_wallet_count_max: z.number().default(5) })
      .default({ cluster_wallet_count_max: 5 }),
  })
  .strict();

export type AutoSkipConfig = z.infer<typeof AutoSkipConfigSchema>;

export function loadAutoSkip(path = 'config/autoskip.yaml'): AutoSkipConfig {
  const full = resolve(process.cwd(), path);
  const raw = readFileSync(full, 'utf8');
  const doc = parseYaml(raw);
  return AutoSkipConfigSchema.parse(doc);
}
