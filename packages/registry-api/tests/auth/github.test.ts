import { env, applyD1Migrations, fetchMock } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import app from '../../src/index.js';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
    GITHUB_OAUTH_CLIENT_ID: string;
    GITHUB_OAUTH_CLIENT_SECRET: string;
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
  fetchMock.deactivate();
});

describe('GET /auth/github/start', () => {
  it('redirects to github authorize with state cookie', async () => {
    const res = await app.request('http://x/auth/github/start', {}, env);
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location')!;
    expect(loc).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);
    expect(loc).toContain('client_id=');
    expect(loc).toContain('scope=user%3Aemail');
    const setCookie = res.headers.get('Set-Cookie')!;
    expect(setCookie).toMatch(/^okr_oauth_state=[A-Za-z0-9_-]+/);
  });
});

describe('GET /auth/github/callback', () => {
  function stubGitHub(login = 'octocat', email = 'octo@example.com'): void {
    fetchMock
      .get('https://github.com')
      .intercept({ path: '/login/oauth/access_token', method: 'POST' })
      .reply(200, { access_token: 'gho_test' });
    fetchMock
      .get('https://api.github.com')
      .intercept({ path: '/user' })
      .reply(200, { login });
    fetchMock
      .get('https://api.github.com')
      .intercept({ path: '/user/emails' })
      .reply(200, [{ email, primary: true, verified: true }]);
  }

  it('mismatched state → redirect with err=oauth_state', async () => {
    const res = await app.request(
      'http://x/auth/github/callback?code=c&state=wrong',
      { headers: { cookie: 'okr_oauth_state=expected' } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/err=oauth_state/);
  });

  it('happy path: creates account, sets github_login, redirects with session cookie', async () => {
    stubGitHub('octocat', 'octo@example.com');
    const state = 'test-state-1';
    const res = await app.request(
      `http://x/auth/github/callback?code=c&state=${state}`,
      { headers: { cookie: `okr_oauth_state=${state}` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/\/me$/);
    expect(res.headers.get('Set-Cookie')).toMatch(/okr_sess=/);
    const acct = await env.DB.prepare('SELECT github_login FROM accounts WHERE email = ?')
      .bind('octo@example.com')
      .first<{ github_login: string }>();
    expect(acct?.github_login).toBe('octocat');
  });

  it('existing account by email gets github_login backfilled', async () => {
    await env.DB.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)')
      .bind('a-existing', 'existing@example.com', 0)
      .run();
    stubGitHub('hubuser', 'existing@example.com');
    const state = 'test-state-2';
    const res = await app.request(
      `http://x/auth/github/callback?code=c&state=${state}`,
      { headers: { cookie: `okr_oauth_state=${state}` } },
      env,
    );
    expect(res.status).toBe(302);
    const acct = await env.DB.prepare('SELECT id, github_login FROM accounts WHERE email = ?')
      .bind('existing@example.com')
      .first<{ id: string; github_login: string }>();
    expect(acct?.id).toBe('a-existing');
    expect(acct?.github_login).toBe('hubuser');
  });

  it('no verified primary email → err=no_verified_email', async () => {
    fetchMock
      .get('https://github.com')
      .intercept({ path: '/login/oauth/access_token', method: 'POST' })
      .reply(200, { access_token: 'gho_test' });
    fetchMock.get('https://api.github.com').intercept({ path: '/user' }).reply(200, { login: 'x' });
    fetchMock
      .get('https://api.github.com')
      .intercept({ path: '/user/emails' })
      .reply(200, [{ email: 'x@y.com', primary: true, verified: false }]);
    const state = 'test-state-3';
    const res = await app.request(
      `http://x/auth/github/callback?code=c&state=${state}`,
      { headers: { cookie: `okr_oauth_state=${state}` } },
      env,
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/err=no_verified_email/);
  });
});
