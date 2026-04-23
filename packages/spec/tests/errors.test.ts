import { describe, expect, it } from 'vitest';
import { ErrorCode, ErrorResponse, errorStatusFor } from '../src/errors';

describe('ErrorCode enum', () => {
  it('includes core codes', () => {
    expect(ErrorCode.Enum.item_not_found).toBe('item_not_found');
    expect(ErrorCode.Enum.quote_expired).toBe('quote_expired');
    expect(ErrorCode.Enum.payment_declined).toBe('payment_declined');
    expect(ErrorCode.Enum.cart_must_be_homogeneous).toBe('cart_must_be_homogeneous');
  });
});

describe('errorStatusFor', () => {
  it('maps item_not_found to 404', () => {
    expect(errorStatusFor('item_not_found')).toBe(404);
  });

  it('maps quote_expired to 410', () => {
    expect(errorStatusFor('quote_expired')).toBe(410);
  });

  it('maps payment_declined to 402', () => {
    expect(errorStatusFor('payment_declined')).toBe(402);
  });

  it('maps internal to 500', () => {
    expect(errorStatusFor('internal')).toBe(500);
  });
});

describe('ErrorResponse', () => {
  it('parses a valid response', () => {
    const e = ErrorResponse.parse({
      error: { code: 'item_not_found', message: 'Not found', retryable: false },
      requestId: 'req_1',
    });
    expect(e.error.code).toBe('item_not_found');
  });
});
