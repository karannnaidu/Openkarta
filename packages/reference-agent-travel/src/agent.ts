import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Handlers, createServer, signQuoteToken, verifyQuoteToken } from '@openkarta/sdk-node';
import { type CapabilitiesManifest, type Cart, type Item, type Quote } from '@openkarta/spec';

export interface AgentFixtures {
  manifest: CapabilitiesManifest;
  items:    Item[];
  orders:   Map<string, unknown>;
}

export const loadFixtures = (dir: string): AgentFixtures => {
  const here = dirname(fileURLToPath(import.meta.url));
  const base = resolve(here, dir);
  const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'));
  const items    = JSON.parse(readFileSync(resolve(base, 'items.json'), 'utf8'));
  return { manifest, items, orders: new Map() };
};

export const makeHandlers = (fx: AgentFixtures, secret: string): Handlers => ({
  async discover() { return fx.manifest; },
  async search({ query }) {
    const q = query as { type: string };
    const items = fx.items.filter((i) => i.type === q.type);
    return { items };
  },
  async get({ itemId }) {
    const item = fx.items.find((i) => i.id === itemId);
    if (!item) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    return item;
  },
  async quote({ cart }) {
    const c = cart as Cart;
    const total = c.lines.reduce((acc, _l) => acc + 10000, 0); // agents override as needed
    const quote: Quote = {
      quoteToken: '',
      cartId: c.cartId,
      itemType: c.lines[0]!.itemType,
      lineItems: c.lines.map((l, idx) => ({
        itemId: (l as { itemId: string }).itemId,
        description: `Line ${idx + 1}`,
        quantity: 1,
        unitMinor: 10000,
        totalMinor: 10000,
      })),
      totalMinor: total,
      currency: 'INR',
      paymentOptions: [{ rail: 'razorpay_routes', methods: ['upi','card'] }],
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    quote.quoteToken = signQuoteToken(
      { cartId: c.cartId, totalMinor: total, currency: 'INR', expiresAt: quote.expiresAt },
      secret,
    );
    return quote;
  },
  async checkout({ quoteToken, cart }) {
    try {
      verifyQuoteToken(quoteToken, secret); // throws quote_expired | quote_invalid
    } catch (e) {
      const msg = (e as Error).message ?? '';
      const code = msg.includes('quote_expired') ? 'quote_expired' : 'quote_invalid';
      throw Object.assign(new Error(msg), { code });
    }
    const c = cart as Cart;
    const orderId = `ord_${Math.random().toString(36).slice(2, 10)}`;
    const order = {
      orderId,
      quoteFingerprint: quoteToken.slice(0, 16),
      itemType: c.lines[0]!.itemType,
      lines: c.lines,
      paymentStatus: 'authorized' as const,
      fulfilmentStatus: { itemType: c.lines[0]!.itemType, state: 'confirmed' } as never,
      totalMinor: 0,
      currency: 'INR',
      createdAt: new Date().toISOString(),
    };
    fx.orders.set(orderId, order);
    return order;
  },
  async status({ orderId }) {
    const order = fx.orders.get(orderId);
    if (!order) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    return order;
  },
  async cancel({ orderId }) {
    const order = fx.orders.get(orderId) as { fulfilmentStatus: { state: string } } | undefined;
    if (!order) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    order.fulfilmentStatus.state = 'cancelled';
    return order;
  },
  async return({ orderId }) {
    const order = fx.orders.get(orderId);
    if (!order) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    return { refundId: `rf_${Math.random().toString(36).slice(2, 8)}`, orderId,
             reason: 'user_cancelled', amountMinor: 0, currency: 'INR', status: 'initiated' };
  },
});

export const bootAgent = async (fx: AgentFixtures, port: number, secret: string): Promise<string> => {
  const app = createServer({ handlers: makeHandlers(fx, secret), secret });
  return app.listen({ port, host: '0.0.0.0' });
};
