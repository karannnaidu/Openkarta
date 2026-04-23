import { describe, expect, it } from 'vitest';
import { USER_TOKEN_HEADER, UserTokenPayload } from '../src/auth';

describe('UserTokenPayload', () => {
  it('parses a valid delegation payload', () => {
    const p = UserTokenPayload.parse({
      sub:    'user_123',
      aud:    'agent_halcyon_shop',
      iss:    'orchestrator_openkarta',
      iat:    Math.floor(Date.now()/1000),
      exp:    Math.floor(Date.now()/1000) + 600,
      scopes: ['search','quote','checkout'],
    });
    expect(p.sub).toBe('user_123');
  });

  it('rejects scope outside the closed enum', () => {
    expect(() => UserTokenPayload.parse({
      sub: 'u', aud: 'a', iss: 'i', iat: 1, exp: 2, scopes: ['delete_the_earth'] as never,
    })).toThrow();
  });
});

describe('header constant', () => {
  it('is x-openkarta-user-token', () => {
    expect(USER_TOKEN_HEADER).toBe('x-openkarta-user-token');
  });
});
