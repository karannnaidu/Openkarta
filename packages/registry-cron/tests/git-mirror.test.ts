import { applyD1Migrations, env, fetchMock } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type MirrorPayload, buildMirrorPayload, gitMirrorSnapshot } from "../src/git-mirror.js";

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
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

async function seedAgent(opts: {
  id: string;
  itemTypes?: string[];
  regions?: unknown[];
  tags?: string[];
  healthStatus?: "unknown" | "healthy" | "stale" | "delisted";
  verificationStatus?: "pending" | "verified";
  lastVerifiedAt?: number;
  createdAt?: number;
}) {
  const accountId = `acc-${opts.id}`;
  const now = opts.createdAt ?? Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)")
    .bind(accountId, `${opts.id}@example.com`, now)
    .run();
  await env.DB.prepare(
    `INSERT INTO agents (id, account_id, display_name, description, base_url, manifest_url, tier,
                          supported_item_types, regions, tags,
                          verification_status, health_status, last_verified_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      opts.id,
      accountId,
      opts.id,
      `desc-${opts.id}`,
      `https://${opts.id}.example.com`,
      `https://${opts.id}.example.com/v0/discover`,
      "http",
      JSON.stringify(opts.itemTypes ?? ["product"]),
      JSON.stringify(opts.regions ?? []),
      JSON.stringify(opts.tags ?? []),
      opts.verificationStatus ?? "verified",
      opts.healthStatus ?? "healthy",
      opts.lastVerifiedAt ?? null,
      now,
      now,
    )
    .run();
}

describe("buildMirrorPayload()", () => {
  it("produces a payload that matches the static schema shape", async () => {
    await seedAgent({
      id: "halcyon-shop",
      itemTypes: ["product"],
      regions: [{ country: "IN" }],
      tags: ["reference"],
      lastVerifiedAt: 1714300000,
      createdAt: 1714000000,
    });
    await seedAgent({
      id: "agent-delisted",
      healthStatus: "delisted",
    });
    await seedAgent({
      id: "agent-pending",
      verificationStatus: "pending",
    });

    const payload = await buildMirrorPayload(env, "2026-04-25");
    expect(payload.$schema).toBe("./schema.json");
    expect(payload.version).toBe("0.1");
    expect(payload.updated).toBe("2026-04-25");
    expect(payload.agents.length).toBe(1);

    const a = payload.agents[0]!;
    expect(a.agentId).toBe("halcyon-shop");
    expect(a.displayName).toBe("halcyon-shop");
    expect(a.description).toBe("desc-halcyon-shop");
    expect(a.tier).toBe("http");
    expect(a.supportedItemTypes).toEqual(["product"]);
    expect(a.regions).toEqual([{ country: "IN" }]);
    expect(a.tags).toEqual(["reference"]);
    expect(a.publicKey).toBeNull();
    expect(a.badgeUrl).toBe("https://registry.example.com/v1/agents/halcyon-shop/badge");
    expect(a.verified).toBe(true);
    expect(a.health).toBe("healthy");
    expect(a.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("gitMirrorSnapshot()", () => {
  it("makes the expected GitHub REST sequence and lands a new commit", async () => {
    await seedAgent({ id: "halcyon-shop", createdAt: 1714000000, lastVerifiedAt: 1714300000 });

    const calls: Array<{ method: string; path: string; body: unknown }> = [];

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/refs/heads/registry-mirror",
        method: "GET",
      })
      .reply(200, { object: { sha: "parent-sha-123" } });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/commits/parent-sha-123",
        method: "GET",
      })
      .reply(200, { tree: { sha: "base-tree-sha" } });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/blobs",
        method: "POST",
      })
      .reply(201, (req) => {
        calls.push({ method: "POST", path: "/git/blobs", body: JSON.parse(req.body as string) });
        return { sha: "blob-sha" };
      });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/trees",
        method: "POST",
      })
      .reply(201, (req) => {
        calls.push({ method: "POST", path: "/git/trees", body: JSON.parse(req.body as string) });
        return { sha: "tree-sha" };
      });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/commits",
        method: "POST",
      })
      .reply(201, (req) => {
        calls.push({ method: "POST", path: "/git/commits", body: JSON.parse(req.body as string) });
        return { sha: "new-commit-sha" };
      });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/refs/heads/registry-mirror",
        method: "PATCH",
      })
      .reply(200, (req) => {
        calls.push({
          method: "PATCH",
          path: "/git/refs/heads/registry-mirror",
          body: JSON.parse(req.body as string),
        });
        return { object: { sha: "new-commit-sha" } };
      });

    const result = await gitMirrorSnapshot(env);
    expect(result.commitSha).toBe("new-commit-sha");
    expect(result.branch).toBe("registry-mirror");
    expect(result.agentsCount).toBe(1);

    // Blob carries the JSON payload.
    const blobCall = calls.find((c) => c.path === "/git/blobs")!;
    const blobBody = blobCall.body as { content: string; encoding: string };
    expect(blobBody.encoding).toBe("utf-8");
    const parsed = JSON.parse(blobBody.content) as MirrorPayload;
    expect(parsed.agents[0]!.agentId).toBe("halcyon-shop");

    // Tree references the blob at registry/agents.json with the right mode.
    const treeCall = calls.find((c) => c.path === "/git/trees")!;
    const treeBody = treeCall.body as {
      base_tree: string;
      tree: Array<{ path: string; mode: string; sha: string }>;
    };
    expect(treeBody.base_tree).toBe("base-tree-sha");
    expect(treeBody.tree).toEqual([
      { path: "registry/agents.json", mode: "100644", type: "blob", sha: "blob-sha" },
    ]);

    // Commit's parent is the existing branch tip.
    const commitCall = calls.find((c) => c.path === "/git/commits")!;
    const commitBody = commitCall.body as { parents: string[]; tree: string };
    expect(commitBody.parents).toEqual(["parent-sha-123"]);
    expect(commitBody.tree).toBe("tree-sha");

    // Ref update points to the new commit.
    const refCall = calls.find((c) => c.path === "/git/refs/heads/registry-mirror")!;
    expect((refCall.body as { sha: string }).sha).toBe("new-commit-sha");
  });

  it("falls back to main + creates the branch when the mirror branch does not exist", async () => {
    await seedAgent({ id: "first-agent", createdAt: 1714000000 });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/refs/heads/registry-mirror",
        method: "GET",
      })
      .reply(404, { message: "Not Found" });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/refs/heads/main",
        method: "GET",
      })
      .reply(200, { object: { sha: "main-sha" } });

    let createBranchCalled = false;
    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/refs",
        method: "POST",
      })
      .reply(201, (req) => {
        createBranchCalled = true;
        const body = JSON.parse(req.body as string) as { ref: string; sha: string };
        expect(body.ref).toBe("refs/heads/registry-mirror");
        expect(body.sha).toBe("main-sha");
        return { object: { sha: "main-sha" } };
      });

    fetchMock
      .get("https://api.github.com")
      .intercept({ path: "/repos/fake-owner/fake-repo/git/commits/main-sha", method: "GET" })
      .reply(200, { tree: { sha: "main-tree-sha" } });

    fetchMock
      .get("https://api.github.com")
      .intercept({ path: "/repos/fake-owner/fake-repo/git/blobs", method: "POST" })
      .reply(201, { sha: "b" });

    fetchMock
      .get("https://api.github.com")
      .intercept({ path: "/repos/fake-owner/fake-repo/git/trees", method: "POST" })
      .reply(201, { sha: "t" });

    fetchMock
      .get("https://api.github.com")
      .intercept({ path: "/repos/fake-owner/fake-repo/git/commits", method: "POST" })
      .reply(201, { sha: "new" });

    fetchMock
      .get("https://api.github.com")
      .intercept({
        path: "/repos/fake-owner/fake-repo/git/refs/heads/registry-mirror",
        method: "PATCH",
      })
      .reply(200, { object: { sha: "new" } });

    const result = await gitMirrorSnapshot(env);
    expect(result.commitSha).toBe("new");
    expect(createBranchCalled).toBe(true);
  });
});
