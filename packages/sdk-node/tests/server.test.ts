import { describe, expect, it } from 'vitest';
import { createServer, type Handlers } from '../src/server';

const stubHandlers: Handlers = {
  async discover() { return {
    agentId: 'test', displayName: 'Test', protocolVersion: '0.1', tier: 'http',
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
  async get({ itemId }) { throw Object.assign(new Error('nope'), { code: 'item_not_found' }); },
  async quote() { throw Object.assign(new Error('unused'), { code: 'quote_invalid' }); },
  async checkout() { throw Object.assign(new Error('unused'), { code: 'quote_invalid' }); },
  async status() { throw Object.assign(new Error('unused'), { code: 'item_not_found' }); },
  async cancel() { throw Object.assign(new Error('unused'), { code: 'item_not_found' }); },
  async return() { throw Object.assign(new Error('unused'), { code: 'item_not_found' }); },
};

describe('createServer', () => {
  it('serves /v0/discover', async () => {
    const app = createServer({ handlers: stubHandlers, secret: 'x'.repeat(32) });
    const res = await app.inject({ method: 'GET', url: '/v0/discover' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).agentId).toBe('test');
  });

  it('maps thrown code "item_not_found" to 404', async () => {
    const app = createServer({ handlers: stubHandlers, secret: 'x'.repeat(32) });
    const res = await app.inject({ method: 'GET', url: '/v0/items/missing' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('item_not_found');
  });

  it('returns 422 when cart is heterogeneous', async () => {
    const app = createServer({ handlers: stubHandlers, secret: 'x'.repeat(32) });
    const res = await app.inject({
      method: 'POST', url: '/v0/quote',
      payload: {
        cart: {
          cartId: 'c1',
          lines: [
            { itemType: 'product', itemId: 'p1', quantity: 1 },
            { itemType: 'stay', itemId: 's1', checkIn: '2026-05-01', checkOut: '2026-05-02', guests: 1 },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe('cart_must_be_homogeneous');
  });
});
