import { loadFixtures, makeHandlers } from "@openkarta/reference-agent-shop/dist/agent.js";
import { createServer } from "@openkarta/sdk-node";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createManifestCache } from "../src/discover.js";

let url: string;
let app: FastifyInstance;
beforeAll(async () => {
  const fx = loadFixtures("fixtures");
  app = createServer({
    handlers: makeHandlers(fx, "test-secret-32-bytes-________"),
    secret: "test-secret-32-bytes-________",
  });
  url = await app.listen({ port: 0, host: "127.0.0.1" });
});
afterAll(async () => {
  await app.close();
});

describe("manifest cache", () => {
  it("returns the manifest from a live agent", async () => {
    const cache = createManifestCache({ ttlMs: 5_000 });
    const m = await cache.get(url);
    expect(m.agentId).toBe("halcyon-shop");
  });

  it("hits cache on the second call within TTL", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      calls++;
      return globalThis.fetch(input, init);
    };
    const cache = createManifestCache({ ttlMs: 5_000, fetchImpl });
    await cache.get(url);
    await cache.get(url);
    expect(calls).toBe(1);
  });

  it("refetches after TTL expires", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      calls++;
      return globalThis.fetch(input, init);
    };
    const cache = createManifestCache({ ttlMs: 10, fetchImpl });
    await cache.get(url);
    await new Promise((r) => setTimeout(r, 30));
    await cache.get(url);
    expect(calls).toBe(2);
  });
});
