import { loadFixtures, makeHandlers } from "@openkarta/reference-agent-shop/dist/agent.js";
import { createServer } from "@openkarta/sdk-node";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createManifestCache } from "../src/discover.js";
import { searchAcrossAgents } from "../src/search.js";
import type { RegistryAgent } from "../src/types.js";

const SECRET = "test-secret-32-bytes-________";

let url1: string;
let url2: string;
let app1: FastifyInstance;
let app2: FastifyInstance;

beforeAll(async () => {
  const fx1 = loadFixtures("fixtures");
  app1 = createServer({ handlers: makeHandlers(fx1, SECRET), secret: SECRET });
  url1 = await app1.listen({ port: 0, host: "127.0.0.1" });

  const fx2 = loadFixtures("fixtures");
  app2 = createServer({ handlers: makeHandlers(fx2, SECRET), secret: SECRET });
  url2 = await app2.listen({ port: 0, host: "127.0.0.1" });
});

afterAll(async () => {
  await app1.close();
  await app2.close();
});

describe("searchAcrossAgents", () => {
  it("aggregates results across multiple agents", async () => {
    const agents: RegistryAgent[] = [
      {
        agentId: "shop1",
        displayName: "Shop 1",
        baseUrl: url1,
        tier: "http",
        supportedItemTypes: ["product"],
        addedAt: "2024-01-01",
      },
      {
        agentId: "shop2",
        displayName: "Shop 2",
        baseUrl: url2,
        tier: "http",
        supportedItemTypes: ["product"],
        addedAt: "2024-01-01",
      },
    ];
    const cache = createManifestCache({ ttlMs: 30_000 });
    const out = await searchAcrossAgents({
      agents,
      plan: { itemType: "product", q: "coffee" },
      manifestCache: cache,
    });
    const agentIds = new Set(out.map((r) => r.agentId));
    expect(agentIds).toEqual(new Set(["shop1", "shop2"]));
    expect(out.every((r) => r.item.type === "product")).toBe(true);
  });

  it("continues past a failing agent", async () => {
    const agents: RegistryAgent[] = [
      {
        agentId: "shop1",
        displayName: "Shop 1",
        baseUrl: url1,
        tier: "http",
        supportedItemTypes: ["product"],
        addedAt: "2024-01-01",
      },
      {
        agentId: "dead",
        displayName: "Dead Agent",
        baseUrl: "http://127.0.0.1:1",
        tier: "http",
        supportedItemTypes: ["product"],
        addedAt: "2024-01-01",
      },
    ];
    const cache = createManifestCache({ ttlMs: 30_000 });
    const out = await searchAcrossAgents({
      agents,
      plan: { itemType: "product", q: "coffee" },
      manifestCache: cache,
      perAgentTimeoutMs: 2_000,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.agentId === "shop1")).toBe(true);
  });
});
