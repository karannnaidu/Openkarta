import { describe, expect, it } from 'vitest';
import { Refund } from '../src/refund';

describe('Refund', () => {
  it('parses a valid refund', () => {
    const r = Refund.parse({
      refundId: 'rf_1', orderId: 'ord_1',
      reason: 'user_cancelled',
      amountMinor: 89900, currency: 'INR',
      status: 'processing',
    });
    expect(r.status).toBe('processing');
  });

  it('rejects unknown reason', () => {
    expect(() => Refund.parse({
      refundId: 'r', orderId: 'o', reason: 'alien_abduction',
      amountMinor: 1, currency: 'INR', status: 'initiated',
    })).toThrow();
  });
});
