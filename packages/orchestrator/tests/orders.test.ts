import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadFixtures, makeHandlers } from "@openkarta/reference-agent-shop/dist/agent.js";
import { createServer } from "@openkarta/sdk-node";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addLine, newCart } from "../src/cart.js";
import { checkoutCart } from "../src/checkout.js";
import { cancelOrder, createOrderStore, getOrderStatus, returnOrder } from "../src/orders.js";
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

async function placeOrder() {
  let cart = newCart({
    agentId: "halcyon-shop",
    agentBaseUrl: url,
    itemType: "product",
    currency: "INR",
  });
  cart = addLine(cart, { itemId: "p_espresso_250", quantity: 1 });
  const quote = await quoteCart(cart);
  const store = createOrderStore({
    ordersFile: join(tmp, `orders-${Math.random().toString(36).slice(2, 8)}.json`),
  });
  const order = await checkoutCart({ cart, quote, payment: { method: "cod" }, store });
  return { order, store };
}

describe("order operations", () => {
  it("reads status by orderId", async () => {
    const { order, store } = await placeOrder();
    const s = await getOrderStatus(order.orderId, { store });
    expect(s.orderId).toBe(order.orderId);
    expect(s.fulfilmentStatus.state).toBeTruthy();
  });

  it("cancels an order", async () => {
    const { order, store } = await placeOrder();
    const s = await cancelOrder(order.orderId, "changed mind", { store });
    expect(s.fulfilmentStatus.state).toBe("cancelled");
  });

  it("initiates a return", async () => {
    const { order, store } = await placeOrder();
    const refund = await returnOrder(order.orderId, "damaged on arrival", { store });
    expect(refund.orderId).toBe(order.orderId);
    expect(refund.refundId).toBeTruthy();
  });

  it("throws when orderId is unknown to the store", async () => {
    const store = createOrderStore({
      ordersFile: join(tmp, `orders-${Math.random().toString(36).slice(2, 8)}.json`),
    });
    await expect(getOrderStatus("nonexistent_order", { store })).rejects.toThrow(/order not found/);
  });
});
