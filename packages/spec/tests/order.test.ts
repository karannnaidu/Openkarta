import { describe, expect, it } from 'vitest';
import { FulfilmentStatus, Order } from '../src/order';

const base = {
  orderId: 'ord_1',
  quoteFingerprint: 'sha256:abc',
  itemType: 'product' as const,
  lines: [{ itemType: 'product', itemId: 'p1', quantity: 1 }],
  paymentStatus: 'authorized' as const,
  fulfilmentStatus: { itemType: 'product' as const, state: 'confirmed' as const },
  totalMinor: 89900,
  currency: 'INR',
  createdAt: new Date().toISOString(),
};

describe('Order', () => {
  it('parses a minimal product order', () => {
    expect(Order.parse(base).orderId).toBe('ord_1');
  });

  it('rejects flight fulfilment state on a product order', () => {
    expect(() => FulfilmentStatus.parse({ itemType: 'product', state: 'boarded' } as never)).toThrow();
  });

  it('accepts flight boarded state', () => {
    const fs = FulfilmentStatus.parse({ itemType: 'flight', state: 'boarded' });
    expect(fs.state).toBe('boarded');
  });

  it('accepts service en_route state', () => {
    const fs = FulfilmentStatus.parse({ itemType: 'service', state: 'en_route' });
    expect(fs.state).toBe('en_route');
  });
});
