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
            queueProducers: { VERIFY_QUEUE: "verify-queue" },
            bindings: {
              TEST_MIGRATIONS: migrations,
              GITHUB_BOT_PAT: "test-pat",
              GITHUB_REPO: "fake-owner/fake-repo",
              GIT_MIRROR_BRANCH: "registry-mirror",
              PUBLIC_BASE_URL: "https://registry.example.com",
            },
          },
        },
      },
    },
  };
});
