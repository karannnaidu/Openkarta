import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, "..", "registry-api", "migrations"),
  );
  return {
    test: {
      include: ["tests/**/*.test.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          miniflare: {
            compatibilityDate: "2024-12-30",
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: ["DB"],
            bindings: {
              TEST_MIGRATIONS: migrations,
              RESEND_API_KEY: "test-resend-key",
              BADGE_SIGNING_SECRET: "test-badge-secret",
            },
          },
        },
      },
    },
  };
});
