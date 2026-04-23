import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@openkarta/sdk-node';
import { bootAgent, loadFixtures } from '../src/agent';

let url = '';
const secret = 'x'.repeat(32);
const fx = loadFixtures('./fixtures');
beforeAll(async () => { url = await bootAgent(fx, 0, secret); });
afterAll(async () => { /* fastify closed implicitly when vitest ends */ });

describe('Halcyon Shop e2e', () => {
  const c = () => createClient({ baseUrl: url });

  it('discovers with supportedItemTypes=[product]', async () => {
    const m = (await c().discover()) as { agentId: string; supportedItemTypes: string[] };
    expect(m.agentId).toBe('halcyon-shop');
    expect(m.supportedItemTypes).toEqual(['product']);
  });

  it('searches products', async () => {
    const r = (await c().search({ type: 'product' })) as { items: Array<{ type: string }> };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.type === 'product')).toBe(true);
  });

  it('quote → checkout → status → cancel', async () => {
    const items = (await c().search({ type: 'product' })) as { items: Array<{ id: string }> };
    const itemId = items.items[0]!.id;
    const cart  = { cartId: 'c_e2e', lines: [{ itemType: 'product', itemId, quantity: 1 }] };
    const q = (await c().quote(cart)) as { quoteToken: string; totalMinor: number };
    expect(q.quoteToken).toBeTruthy();

    const order = (await c().checkout({ cart, payment: { rail: 'razorpay_routes', method: 'upi' }, quoteToken: q.quoteToken })) as { orderId: string };
    expect(order.orderId).toMatch(/^ord_/);

    const status = (await c().status(order.orderId)) as { fulfilmentStatus: { state: string } };
    expect(status.fulfilmentStatus.state).toBe('confirmed');

    const cancelled = (await c().cancel(order.orderId, 'user_cancelled')) as { fulfilmentStatus: { state: string } };
    expect(cancelled.fulfilmentStatus.state).toBe('cancelled');
  });

  it('rejects expired quote on checkout', async () => {
    const cart  = { cartId: 'c_e2e2', lines: [{ itemType: 'product', itemId: 'p_espresso_250', quantity: 1 }] };
    await expect(c().checkout({ cart, payment: { rail: 'razorpay_routes', method: 'upi' }, quoteToken: 'tampered.sig' }))
      .rejects.toMatchObject({ code: 'quote_invalid' });
  });
});
