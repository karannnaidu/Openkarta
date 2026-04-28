import { loadFixtures, makeHandlers } from "@openkarta/reference-agent-shop/dist/agent.js";
import { createServer } from "@openkarta/sdk-node";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrchestrator } from "../src/orchestrator.js";

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

describe("orchestrator.search (product)", () => {
  it("returns ranked results across two shop agents", async () => {
    const orch = createOrchestrator({
      registry: {
        version: "0.1",
        updated: "2026-04-24",
        agents: [
          {
            agentId: "a",
            displayName: "A",
            baseUrl: url1,
            tier: "http",
            supportedItemTypes: ["product"],
            regions: [{ country: "IN" }],
            addedAt: "2026-04-24",
          },
          {
            agentId: "b",
            displayName: "B",
            baseUrl: url2,
            tier: "http",
            supportedItemTypes: ["product"],
            regions: [{ country: "IN" }],
            addedAt: "2026-04-24",
          },
        ],
      },
    });
    const out = await orch.search({ itemType: "product", q: "coffee" });
    expect(out.length).toBeGreaterThan(0);
    for (let i = 1; i < out.length; i++) {
      const prev = (out[i - 1]!.item as { priceMinor: number }).priceMinor;
      const curr = (out[i]!.item as { priceMinor: number }).priceMinor;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });
});
