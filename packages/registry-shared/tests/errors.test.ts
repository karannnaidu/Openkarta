import { describe, it, expect } from 'vitest';
import { RegistryError, REGISTRY_ERROR_CODES, httpStatusFor } from '../src/errors.js';

describe('RegistryError', () => {
  it('exposes a closed enum of codes', () => {
    expect(REGISTRY_ERROR_CODES).toEqual([
      'account_required',
      'agent_not_found',
      'agent_id_taken',
      'domain_verification_pending',
      'rate_limited',
      'validation_failed',
      'forbidden',
    ]);
  });

  it('maps codes to HTTP status', () => {
    expect(httpStatusFor('account_required')).toBe(401);
    expect(httpStatusFor('forbidden')).toBe(403);
    expect(httpStatusFor('agent_not_found')).toBe(404);
    expect(httpStatusFor('agent_id_taken')).toBe(409);
    expect(httpStatusFor('rate_limited')).toBe(429);
    expect(httpStatusFor('validation_failed')).toBe(400);
    expect(httpStatusFor('domain_verification_pending')).toBe(409);
  });

  it('serialises to wire JSON', () => {
    const err = new RegistryError('agent_not_found', 'no such agent');
    expect(err.toJSON()).toEqual({
      error: { code: 'agent_not_found', message: 'no such agent' },
    });
  });
});
