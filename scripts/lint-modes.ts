#!/usr/bin/env tsx
/**
 * Validate config/modes/*.yaml + config/autoskip.yaml against zod schemas.
 * Dipakai di CI + local pre-commit.
 */
import { loadAllModes, loadAutoSkip } from '../packages/core/src/config/index.js';

try {
  const modes = loadAllModes('config/modes');
  const skip = loadAutoSkip('config/autoskip.yaml');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { ok: true, modes: modes.map((m) => m.name), autoSkip: skip },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[config:lint] FAILED\n', (err as Error).message);
  process.exit(1);
}
