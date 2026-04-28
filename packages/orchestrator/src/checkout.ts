import { OpenKartaError, createClient } from "@openkarta/sdk-node";
import type { Cart, Order, Quote } from "@openkarta/spec";
import type { OrchestratorCart } from "./cart.js";
import type { OrderStore } from "./orders.js";

export interface CheckoutInput {
  cart: OrchestratorCart;
  quote: Quote;
  payment: { method: string; ref?: string };
  userToken?: string;
  store?: OrderStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function checkoutCart(input: CheckoutInput): Promise<Order> {
  if (input.cart.lines.length === 0) throw new Error("cannot checkout empty cart");

  const client = createClient({
    baseUrl: input.cart.agentBaseUrl,
    timeoutMs: input.timeoutMs ?? 30_000,
    ...(input.userToken ? { userToken: input.userToken } : {}),
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
  });

  const protocolCart: Cart = {
    cartId: `oc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    lines: input.cart.lines.map((l) => ({
      itemType: l.itemType,
      itemId: l.itemId,
      quantity: l.quantity,
    })) as Cart["lines"],
  };

  let order: Order;
  try {
    order = await client.checkout({
      cart: protocolCart,
      quoteToken: input.quote.quoteToken,
      payment: input.payment,
    });
  } catch (err) {
    if (err instanceof OpenKartaError) throw err;
    throw new OpenKartaError("network_error", 0, err instanceof Error ? err.message : String(err));
  }

  if (input.store) {
    await input.store.add({
      orderId: order.orderId,
      agentId: input.cart.agentId,
      agentBaseUrl: input.cart.agentBaseUrl,
      itemType: input.cart.itemType,
      totalMinor: input.quote.totalMinor,
      currency: input.quote.currency,
      placedAt: new Date().toISOString(),
    });
  }

  return order;
}
