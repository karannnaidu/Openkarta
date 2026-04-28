import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_REGISTRY_URL, filterAgents, loadRegistry } from "../src/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "..", "fixtures", "agents-fixture.json");

describe("loadRegistry", () => {
  it("parses a valid registry from a string", async () => {
    const json = await readFile(fixturePath, "utf-8");
    const reg = await loadRegistry({ inline: json });
    expect(reg.agents).toHaveLength(2);
    expect(reg.agents[0].agentId).toBe("halcyon-shop");
  });

  it("rejects an invalid registry version", async () => {
    await expect(
      loadRegistry({ inline: '{"version":"0.0","updated":"2026-04-24","agents":[]}' }),
    ).rejects.toThrow(/version/);
  });

  it("rejects an agent with a non-https baseUrl", async () => {
    const bad = JSON.stringify({
      version: "0.1",
      updated: "2026-04-24",
      agents: [
        {
          agentId: "x",
          displayName: "x",
          baseUrl: "http://x",
          tier: "http",
          supportedItemTypes: ["product"],
          addedAt: "2026-04-24",
        },
      ],
    });
    await expect(loadRegistry({ inline: bad })).rejects.toThrow(/https/);
  });
});

describe("filterAgents", () => {
  it("filters by item type", async () => {
    const json = await readFile(fixturePath, "utf-8");
    const reg = await loadRegistry({ inline: json });
    const matches = filterAgents(reg.agents, { itemType: "stay" });
    expect(matches.map((a) => a.agentId)).toEqual(["halcyon-stays"]);
  });

  it("filters by country", async () => {
    const json = await readFile(fixturePath, "utf-8");
    const reg = await loadRegistry({ inline: json });
    const matches = filterAgents(reg.agents, { itemType: "product", country: "US" });
    expect(matches).toEqual([]);
  });
});

describe("DEFAULT_REGISTRY_URL", () => {
  it("points to the hosted registry", () => {
    expect(DEFAULT_REGISTRY_URL).toMatch(/^https:\/\//);
    expect(DEFAULT_REGISTRY_URL).toContain("registry.openkarta.org");
    expect(DEFAULT_REGISTRY_URL).toMatch(/\/v1\/agents$/);
  });
});

describe("loadRegistry — hosted shape", () => {
  function makeFetch(pages: Array<{ items: unknown[]; nextCursor?: string | null }>): typeof fetch {
    let call = 0;
    return (async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : (input as URL).toString());
      const cursor = url.searchParams.get("cursor");
      const expected = call === 0 ? null : (pages[call - 1]?.nextCursor ?? null);
      if (cursor !== expected) {
        throw new Error(`unexpected cursor at call ${call}: got ${cursor}, expected ${expected}`);
      }
      const body = pages[call] ?? { items: [], nextCursor: null };
      call += 1;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  }

  const baseListing = {
    agentId: "halcyon-shop",
    displayName: "Halcyon Shop",
    baseUrl: "https://halcyon.example.com",
    tier: "http" as const,
    supportedItemTypes: ["product"],
    verificationStatus: "verified",
    healthStatus: "healthy",
    createdAt: "2026-04-24T10:00:00.000Z",
  };

  it("paginates through cursor pages and projects to static shape", async () => {
    const fetchImpl = makeFetch([
      { items: [{ ...baseListing, agentId: "a-one" }], nextCursor: "c1" },
      { items: [{ ...baseListing, agentId: "a-two" }], nextCursor: null },
    ]);
    const reg = await loadRegistry({ url: "https://example.test/v1/agents", fetchImpl });
    expect(reg.version).toBe("0.1");
    expect(reg.agents.map((a) => a.agentId)).toEqual(["a-one", "a-two"]);
    expect(reg.agents[0].verified).toBe(true);
    expect(reg.agents[0].addedAt).toBe("2026-04-24");
  });

  it("filters out delisted agents", async () => {
    const fetchImpl = makeFetch([
      {
        items: [
          { ...baseListing, agentId: "a-live" },
          { ...baseListing, agentId: "a-gone", healthStatus: "delisted" },
        ],
        nextCursor: null,
      },
    ]);
    const reg = await loadRegistry({ url: "https://example.test/v1/agents", fetchImpl });
    expect(reg.agents.map((a) => a.agentId)).toEqual(["a-live"]);
  });

  it("marks unverified entries as verified=false", async () => {
    const fetchImpl = makeFetch([
      {
        items: [{ ...baseListing, agentId: "a-pending", verificationStatus: "pending" }],
        nextCursor: null,
      },
    ]);
    const reg = await loadRegistry({ url: "https://example.test/v1/agents", fetchImpl });
    expect(reg.agents[0].verified).toBe(false);
  });
});
