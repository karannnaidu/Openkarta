import { env, applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import app, { setEmailClientFactory } from '../../src/index.js';
import type { EmailClient } from '@openkarta/registry-shared';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
    PUBLIC_BASE_URL: string;
    WEB_BASE_URL: string;
  }
}

interface SentEmail {
  kind: string;
  to: string;
  link?: string;
}

let sent: SentEmail[] = [];

const stubClient: EmailClient = {
  async sendMagicLink({ to, link }) {
    sent.push({ kind: 'magic_link', to, link });
    return { id: `stub-${sent.length}` };
  },
  async sendVerificationPassed({ to }) { sent.push({ kind: 'verification_passed', to }); return { id: 'stub' }; },
  async sendHealthTransition({ to }) { sent.push({ kind: 'health_transition', to }); return { id: 'stub' }; },
  async sendTransferInvite({ to }) { sent.push({ kind: 'transfer_invite', to }); return { id: 'stub' }; },
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  setEmailClientFactory(() => stubClient);
});

beforeEach(() => {
  sent = [];
});

const ctx = env as unknown as { PUBLIC_BASE_URL: string; WEB_BASE_URL: string };

describe('POST /auth/magic-link', () => {
  it('returns 204 + writes magic_links row + sends email', async () => {
    const res = await app.request(
      'http://x/auth/magic-link',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'TEST@example.com' }) },
      env,
    );
    expect(res.status).toBe(204);
    const row = await env.DB.prepare('SELECT email, consumed_at FROM magic_links').first<{ email: string; consumed_at: number | null }>();
    expect(row?.email).toBe('test@example.com');
    expect(row?.consumed_at).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.kind).toBe('magic_link');
    expect(sent[0]?.to).toBe('test@example.com');
  });

  it('returns 400 validation_failed for malformed email', async () => {
    const res = await app.request(
      'http://x/auth/magic-link',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' }) },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
  });

  it('returns 429 rate_limited when simulated', async () => {
    const res = await app.request(
      'http://x/auth/magic-link',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-ratelimit': 'over' },
        body: JSON.stringify({ email: 'a@b.com' }),
      },
      env,
    );
    expect(res.status).toBe(429);
  });

  it('same response shape whether account exists or not (anti-enumeration)', async () => {
    // First call creates a magic-link row but no account.
    await app.request(
      'http://x/auth/magic-link',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'unknown@example.com' }) },
      env,
    );
    // Pre-create a matching account.
    await env.DB.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)').bind('a1', 'known@example.com', 0).run();
    const r1 = await app.request(
      'http://x/auth/magic-link',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'known@example.com' }) },
      env,
    );
    const r2 = await app.request(
      'http://x/auth/magic-link',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'still-unknown@example.com' }) },
      env,
    );
    expect(r1.status).toBe(r2.status);
  });
});

describe('GET /auth/magic-link/consume', () => {
  it('redirects to /sign-in?err= for missing token', async () => {
    const res = await app.request('http://x/auth/magic-link/consume', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/\/sign-in\?err=missing_token/);
  });

  it('redirects with err=invalid_or_expired for unknown token', async () => {
    const res = await app.request('http://x/auth/magic-link/consume?token=nope', {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/err=invalid_or_expired/);
  });

  it('on valid token: creates account if missing, sets session cookie, redirects to /me', async () => {
    const token = 'tok-valid';
    const exp = Math.floor(Date.now() / 1000) + 600;
    await env.DB.prepare('INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)')
      .bind(token, 'fresh@example.com', exp)
      .run();
    const res = await app.request(`http://x/auth/magic-link/consume?token=${token}`, {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/\/me$/);
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toMatch(/okr_sess=/);
    expect(setCookie).toMatch(/Secure/);
    expect(setCookie).toMatch(/HttpOnly/);
    const account = await env.DB.prepare('SELECT id FROM accounts WHERE email = ?')
      .bind('fresh@example.com')
      .first<{ id: string }>();
    expect(account).not.toBeNull();
  });

  it('rejects double-consume of the same token', async () => {
    const token = 'tok-once';
    const exp = Math.floor(Date.now() / 1000) + 600;
    await env.DB.prepare('INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)')
      .bind(token, 'once@example.com', exp)
      .run();
    const r1 = await app.request(`http://x/auth/magic-link/consume?token=${token}`, {}, env);
    expect(r1.status).toBe(302);
    expect(r1.headers.get('Location')).toMatch(/\/me$/);
    const r2 = await app.request(`http://x/auth/magic-link/consume?token=${token}`, {}, env);
    expect(r2.headers.get('Location')).toMatch(/err=invalid_or_expired/);
  });
});

describe('/auth/me + /auth/logout', () => {
  it('GET /auth/me without cookie returns 401 account_required', async () => {
    const res = await app.request('http://x/auth/me', {}, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('account_required');
  });

  it('GET /auth/me with valid session returns the account', async () => {
    const token = 'tok-me';
    const exp = Math.floor(Date.now() / 1000) + 600;
    await env.DB.prepare('INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)')
      .bind(token, 'me@example.com', exp)
      .run();
    const consume = await app.request(`http://x/auth/magic-link/consume?token=${token}`, {}, env);
    const cookie = consume.headers.get('Set-Cookie')!.split(';')[0]!;
    const res = await app.request('http://x/auth/me', { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { account: { email: string } };
    expect(body.account.email).toBe('me@example.com');
  });

  it('POST /auth/logout clears the session', async () => {
    const token = 'tok-logout';
    const exp = Math.floor(Date.now() / 1000) + 600;
    await env.DB.prepare('INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)')
      .bind(token, 'logout@example.com', exp)
      .run();
    const consume = await app.request(`http://x/auth/magic-link/consume?token=${token}`, {}, env);
    const cookie = consume.headers.get('Set-Cookie')!.split(';')[0]!;
    const out = await app.request('http://x/auth/logout', { method: 'POST', headers: { cookie } }, env);
    expect(out.status).toBe(204);
    expect(out.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
    const me = await app.request('http://x/auth/me', { headers: { cookie } }, env);
    expect(me.status).toBe(401);
  });
});

// keep ctx referenced so TS doesn't strip the import
void ctx;
