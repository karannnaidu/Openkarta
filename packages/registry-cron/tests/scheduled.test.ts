import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { enqueueReverify } from "../src/index.js";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
    VERIFY_QUEUE: Queue;
    GITHUB_BOT_PAT: string;
    GITHUB_REPO: string;
    GIT_MIRROR_BRANCH: string;
    PUBLIC_BASE_URL: string;
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM agents");
  await env.DB.exec("DELETE FROM accounts");
});

async function seedAgent(opts: {
  id: string;
  verificationStatus?: "pending" | "verified";
  healthStatus?: "unknown" | "healthy" | "stale" | "delisted";
}) {
  const accountId = `a-${opts.id}`;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)")
    .bind(accountId, `${opts.id}@example.com`, now)
    .run();
  await env.DB.prepare(
    `INSERT INTO agents (id, account_id, display_name, base_url, manifest_url, tier, supported_item_types,
                          verification_status, health_status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      opts.id,
      accountId,
      opts.id,
      `https://${opts.id}.example.com`,
      `https://${opts.id}.example.com/v0/discover`,
      "http",
      JSON.stringify(["product"]),
      opts.verificationStatus ?? "verified",
      opts.healthStatus ?? "healthy",
      now,
      now,
    )
    .run();
}

describe("enqueueReverify()", () => {
  it("enqueues one message per verified, non-delisted agent", async () => {
    await seedAgent({ id: "agent-1" });
    await seedAgent({ id: "agent-2", healthStatus: "stale" });
    await seedAgent({ id: "agent-pending", verificationStatus: "pending" });
    await seedAgent({ id: "agent-delisted", healthStatus: "delisted" });

    const sent: unknown[] = [];
    const stubQueue: Queue = {
      send: async (body: unknown) => {
        sent.push(body);
      },
      sendBatch: async () => {
        /* unused */
      },
    } as unknown as Queue;

    const stubEnv = { ...env, VERIFY_QUEUE: stubQueue };
    const count = await enqueueReverify(stubEnv);

    expect(count).toBe(2);
    expect(sent).toContainEqual({
      agentId: "agent-1",
      baseUrl: "https://agent-1.example.com",
    });
    expect(sent).toContainEqual({
      agentId: "agent-2",
      baseUrl: "https://agent-2.example.com",
    });
    expect(sent.length).toBe(2);
  });

  it("returns 0 when no agents are verified", async () => {
    await seedAgent({ id: "pending-only", verificationStatus: "pending" });
    const sent: unknown[] = [];
    const stubQueue: Queue = {
      send: async (body: unknown) => {
        sent.push(body);
      },
      sendBatch: async () => {
        /* unused */
      },
    } as unknown as Queue;
    const count = await enqueueReverify({ ...env, VERIFY_QUEUE: stubQueue });
    expect(count).toBe(0);
    expect(sent).toEqual([]);
  });
});
