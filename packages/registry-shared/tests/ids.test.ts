import { describe, it, expect } from 'vitest';
import { ulid, verificationToken, sessionId } from '../src/ids.js';

describe('ids', () => {
  it('ulid is 26 chars Crockford base32', () => {
    const id = ulid();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('two ulids generated in sequence differ', () => {
    const a = ulid();
    const b = ulid();
    expect(a).not.toEqual(b);
  });

  it('verificationToken starts with okv- and 24 base32 chars', () => {
    const tok = verificationToken();
    expect(tok).toMatch(/^okv-[0-9A-HJKMNP-TV-Z]{24}$/);
  });

  it('sessionId is 43 base64url chars', () => {
    const sid = sessionId();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('two sessionIds differ', () => {
    expect(sessionId()).not.toEqual(sessionId());
  });
});
