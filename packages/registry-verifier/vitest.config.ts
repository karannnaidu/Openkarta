import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            RESEND_API_KEY: 'test-resend-key',
            BADGE_SIGNING_SECRET: 'test-badge-secret',
          },
          d1Databases: { DB: 'test-db' },
          queueProducers: { VERIFY_QUEUE: 'verify-queue' },
        },
      },
    },
  },
});
