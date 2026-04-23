import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { createServer } from '../src/server';

const handlers = {
  async discover() { return {
    agentId: 't', displayName: 'T', protocolVersion: '0.1' as const, tier: 'http' as const,
    baseUrl: 'http://localhost:0',
    actions: ['discover','search','get','quote','checkout','status','cancel','return'],
    supportedItemTypes: ['product'],
    paymentRails: ['razorpay_routes'], languages: ['en'], regions: [{ country: 'IN' }],
    inventoryVolatility: 'realtime', catalogSize: 'small',
    priceRange: { minMinor: 0, maxMinor: 1, currency: 'INR' },
    productCapabilities: {
      categories: ['x'], serviceAreas: [{ country: 'IN' }],
      deliveryModes: ['standard'], returnWindow: 7,
    },
  }; },
  async search() { return { items: [] }; },
  async get() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
  async quote() { throw Object.assign(new Error('n'), { code: 'quote_invalid' }); },
  async checkout() { throw Object.assign(new Error('n'), { code: 'quote_invalid' }); },
  async status() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
  async cancel() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
  async return() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
};

let url = '';
const app = createServer({ handlers: handlers as never, secret: 'x'.repeat(32) });
beforeAll(async () => { url = await app.listen({ port: 0, host: '127.0.0.1' }); });
afterAll(async () => { await app.close(); });

describe('createClient', () => {
  it('discover() returns manifest', async () => {
    const c = createClient({ baseUrl: url });
    const m = await c.discover();
    expect(m.agentId).toBe('t');
  });

  it('get() throws typed OpenKartaError on 404', async () => {
    const c = createClient({ baseUrl: url });
    await expect(c.get('missing')).rejects.toMatchObject({ code: 'item_not_found', status: 404 });
  });
});
