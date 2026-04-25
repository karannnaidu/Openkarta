import { createClient, OpenKartaError } from '@openkarta/sdk-node';
import type { Quote, Cart } from '@openkarta/spec';
import type { OrchestratorCart } from './cart.js';

export async function quoteCart(
  cart: OrchestratorCart,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<Quote> {
  if (cart.lines.length === 0) throw new Error('cannot quote empty cart');
  const client = createClient({
    baseUrl: cart.agentBaseUrl,
    timeoutMs: opts.timeoutMs ?? 10_000,
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  });
  const protocolCart: Cart = {
    cartId: `oc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    lines: cart.lines.map((l) => ({
      ...(l.extra ?? {}),
      itemType: l.itemType,
      itemId: l.itemId,
      quantity: l.quantity,
    })) as Cart['lines'],
  };
  try {
    return await client.quote(protocolCart);
  } catch (err) {
    if (err instanceof OpenKartaError) throw err;
    throw new OpenKartaError('network_error', 0, err instanceof Error ? err.message : String(err));
  }
}
