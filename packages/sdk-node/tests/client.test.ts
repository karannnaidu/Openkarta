import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OpenKartaError, createClient } from "../src/index.js";
import { type Handlers, createServer } from "../src/server.js";

// Inline test agent — avoids a workspace dep on @openkarta/reference-agent-shop
// (which itself depends on sdk-node, so importing it here would cycle).
// Stub handlers mirror the shape used by packages/sdk-node/tests/server.test.ts.
const stubHandlers: Handlers = {
  async discover() {
    return {
      agentId: "test-agent",
      displayName: "Test Agent",
      protocolVersion: "0.1",
      tier: "http",
      baseUrl: "http://localhost:0",
      actions: ["discover", "search", "get", "quote", "checkout", "status", "cancel", "return"],
      supportedItemTypes: ["product"],
      paymentRails: ["razorpay_routes"],
      languages: ["en"],
      regions: [{ country: "IN" }],
      inventoryVolatility: "realtime",
      catalogSize: "small",
      priceRange: { minMinor: 0, maxMinor: 1, currency: "INR" },
      productCapabilities: {
        categories: ["x"],
        serviceAreas: [{ country: "IN" }],
        deliveryModes: ["standard"],
        returnWindow: 7,
      },
    };
  },
  async search() {
    return {
      items: [{ type: "product", id: "p1", title: "Coffee", priceMinor: 100, currency: "INR" }],
    };
  },
  async get() {
    throw Object.assign(new Error("not found"), { code: "item_not_found" });
  },
  async quote() {
    throw Object.assign(new Error("unused"), { code: "quote_invalid" });
  },
  async checkout() {
    throw Object.assign(new Error("unused"), { code: "quote_invalid" });
  },
  async status() {
    throw Object.assign(new Error("unused"), { code: "item_not_found" });
  },
  async cancel() {
    throw Object.assign(new Error("unused"), { code: "item_not_found" });
  },
  async return() {
    throw Object.assign(new Error("unused"), { code: "item_not_found" });
  },
};

let app: FastifyInstance;
let url: string;

beforeAll(async () => {
  app = createServer({ handlers: stubHandlers, secret: "test-secret-32-bytes-________xx" });
  // port: 0 → kernel-assigned ephemeral port; host '127.0.0.1' avoids IPv6 quirks on Windows CI.
  url = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterAll(async () => {
  await app.close();
});

describe("createClient", () => {
  it("discovers a manifest", async () => {
    const client = createClient({ baseUrl: url });
    const manifest = await client.discover();
    expect(manifest.agentId).toBe("test-agent");
    expect(manifest.protocolVersion).toBe("0.1");
  });

  it("exposes the configured baseUrl", () => {
    const client = createClient({ baseUrl: url });
    expect(client.baseUrl).toBe(url);
  });

  it("searches by item type", async () => {
    const client = createClient({ baseUrl: url });
    // SearchQuery is a discriminated union on `type` (not `itemType`); items use `type` as well.
    const res = await client.search({ type: "product", q: "coffee" });
    expect(res.items.length).toBeGreaterThan(0);
    expect((res.items[0] as { type: string }).type).toBe("product");
  });

  it("throws OpenKartaError on a 4xx response", async () => {
    const client = createClient({ baseUrl: url });
    await expect(client.get("does-not-exist")).rejects.toMatchObject({
      code: "item_not_found",
      httpStatus: 404,
    });
  });

  it("honours a per-call timeout with a dedicated `timeout` code", async () => {
    const client = createClient({ baseUrl: url, timeoutMs: 1 });
    // 1ms is reliably shorter than network setup, so the abort fires before the response.
    await expect(client.discover()).rejects.toBeInstanceOf(OpenKartaError);
    await expect(client.discover()).rejects.toMatchObject({
      code: "timeout",
      httpStatus: 0,
    });
  });
});
