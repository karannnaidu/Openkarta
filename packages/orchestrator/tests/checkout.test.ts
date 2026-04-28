import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFixtures, makeHandlers } from "@openkarta/reference-agent-shop/dist/agent.js";
import { createServer } from "@openkarta/sdk-node";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addLine, newCart } from "../src/cart.js";
import { checkoutCart } from "../src/checkout.js";
import { createOrderStore } from "../src/orders.js";
import { quoteCart } from "../src/quote.js";

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
  tmp = mkdtempSync(join(tmpdir(), "okt-"));
});
afterAll(async () => {
  await app.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("checkoutCart", () => {
  it("places an order and persists it locally", async () => {
    let cart = newCart({
      agentId: "halcyon-shop",
      agentBaseUrl: url,
      itemType: "product",
      currency: "INR",
    });
    cart = addLine(cart, { itemId: "p_espresso_250", quantity: 1 });
    const quote = await quoteCart(cart);
    const store = createOrderStore({ ordersFile: join(tmp, "orders.json") });
    const order = await checkoutCart({ cart, quote, payment: { method: "cod" }, store });
    expect(order.orderId).toBeTruthy();
    const all = await store.list();
    expect(all.find((o) => o.orderId === order.orderId)).toBeDefined();
    const reopened = createOrderStore({ ordersFile: join(tmp, "orders.json") });
    const persisted = await reopened.list();
    expect(persisted.find((o) => o.orderId === order.orderId)).toBeDefined();
  });
});
