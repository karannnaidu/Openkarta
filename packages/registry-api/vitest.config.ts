import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));
  return {
    test: {
      include: ['tests/**/*.test.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            compatibilityFlags: ['nodejs_compat'],
            d1Databases: ['DB'],
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
