import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadFixtures, makeHandlers } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createServer } from '@openkarta/sdk-node';
import { newCart, addLine } from '../src/cart.js';
import { quoteCart } from '../src/quote.js';

let url: string;
let app: FastifyInstance;
beforeAll(async () => {
  const fx = loadFixtures('fixtures');
  app = createServer({ handlers: makeHandlers(fx, 'test-secret-32-bytes-________'), secret: 'test-secret-32-bytes-________' });
  url = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(async () => { await app.close(); });

describe('quoteCart', () => {
  it('returns a verified quote', async () => {
    const cart = addLine(
      newCart({ agentId: 'halcyon-shop', agentBaseUrl: url, itemType: 'product', currency: 'INR' }),
      { itemId: 'p_espresso_250', quantity: 1 },
    );
    const q = await quoteCart(cart);
    expect(q.quoteToken).toBeTruthy();
    expect(q.totalMinor).toBeGreaterThan(0);
    expect(new Date(q.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('throws on a cart with no lines', async () => {
    const cart = newCart({ agentId: 'halcyon-shop', agentBaseUrl: url, itemType: 'product', currency: 'INR' });
    await expect(quoteCart(cart)).rejects.toThrow(/empty/);
  });
});
