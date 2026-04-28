import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFixtures, makeHandlers } from "@openkarta/reference-agent-stays/dist/agent.js";
import { createServer } from "@openkarta/sdk-node";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addLine,
  checkoutCart,
  createOrchestrator,
  createOrderStore,
  newCart,
  quoteCart,
} from "../src/index.js";

let url: string;
let app: FastifyInstance;
let tmp: string;

beforeAll(async () => {
  const fx = loadFixtures("fixtures");
  app = createServer({
    handlers: makeHandlers(fx, "test-secret-32-bytes-________"),
    secret: "test-secret-32-bytes-________",
  });
  url = await app.listen({ port: 0, host: "127.0.0.1" });
  tmp = mkdtempSync(join(tmpdir(), "okt-stay-"));
});
afterAll(async () => {
  await app.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("orchestrator e2e (stay)", () => {
  it("search → cart → quote → checkout", async () => {
    const orch = createOrchestrator({
      registry: {
        version: "0.1",
        updated: "2026-04-24",
        agents: [
          {
            agentId: "stays",
            displayName: "Stays",
            baseUrl: url,
            tier: "http",
            supportedItemTypes: ["stay"],
            regions: [{ country: "IN" }],
            addedAt: "2026-04-24",
          },
        ],
      },
    });
    const results = await orch.search({
      itemType: "stay",
      extra: {
        location: { country: "IN", city: "Anjuna" },
        checkIn: "2026-05-01",
        checkOut: "2026-05-04",
        guests: 2,
      },
    });
    expect(results.length).toBeGreaterThan(0);
    const top = results[0]!;

    let cart = newCart({
      agentId: top.agentId,
      agentBaseUrl: url,
      itemType: "stay",
      currency: "INR",
    });
    cart = addLine(cart, {
      itemId: top.item.id,
      quantity: 1,
      extra: { checkIn: "2026-05-01", checkOut: "2026-05-04", guests: 2 },
    });
    const quote = await quoteCart(cart);
    const store = createOrderStore({ ordersFile: join(tmp, "orders.json") });
    const order = await checkoutCart({ cart, quote, payment: { method: "cod" }, store });
    expect(order.orderId).toBeTruthy();
  });
});
