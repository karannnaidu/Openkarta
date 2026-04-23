import { describe, expect, it } from 'vitest';
import { toErrorResponse } from '../src/errors';

describe('toErrorResponse', () => {
  it('builds a 404 body for item_not_found', () => {
    const { status, body } = toErrorResponse('item_not_found', 'Gone', false, { id: 'p_99' });
    expect(status).toBe(404);
    expect(body.error.code).toBe('item_not_found');
    expect(body.error.retryable).toBe(false);
  });

  it('defaults retryable to false when omitted', () => {
    const { body } = toErrorResponse('validation_failed', 'Bad');
    expect(body.error.retryable).toBe(false);
  });
});
