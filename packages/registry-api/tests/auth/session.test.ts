import { env, applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  createSession,
  readSession,
  clearSession,
  sessionCookieValue,
  SESSION_COOKIE,
  readCookieFromHeader,
} from '../../src/auth/session.js';
import { ulid } from '@openkarta/registry-shared';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

async function makeAccount(email = `${ulid()}@x.com`): Promise<string> {
  const id = ulid();
  await env.DB.prepare(
    'INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)',
  )
    .bind(id, email, Math.floor(Date.now() / 1000))
    .run();
  return id;
}

describe('session helpers', () => {
  it('createSession then readSession returns the account', async () => {
    const accountId = await makeAccount();
    const sid = await createSession(env, accountId);
    const acct = await readSession(env, sid);
    expect(acct?.id).toBe(accountId);
    expect(acct?.githubLogin).toBeNull();
  });

  it('readSession returns null for unknown id', async () => {
    expect(await readSession(env, 'nope')).toBeNull();
  });

  it('expired session returns null', async () => {
    const accountId = await makeAccount();
    const sid = 'sid-expired';
    await env.DB.prepare(
      'INSERT INTO sessions (id, account_id, expires_at) VALUES (?,?,?)',
    )
      .bind(sid, accountId, 0)
      .run();
    expect(await readSession(env, sid)).toBeNull();
  });

  it('clearSession removes the row', async () => {
    const accountId = await makeAccount();
    const sid = await createSession(env, accountId);
    await clearSession(env, sid);
    expect(await readSession(env, sid)).toBeNull();
  });

  it('cookie helpers round-trip', () => {
    const c = sessionCookieValue('abc123');
    expect(c).toContain(`${SESSION_COOKIE}=abc123`);
    expect(c).toContain('Secure');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(readCookieFromHeader(`${SESSION_COOKIE}=abc123; other=x`, SESSION_COOKIE)).toBe('abc123');
    expect(readCookieFromHeader(undefined, SESSION_COOKIE)).toBeUndefined();
  });
});
