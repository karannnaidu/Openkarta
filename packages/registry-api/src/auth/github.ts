import { Hono } from 'hono';
import { ulid, sessionId as randomState } from '@openkarta/registry-shared';
import { createSession, sessionCookieValue } from './session.js';
import type { Bindings } from '../index.js';

const STATE_COOKIE = 'okr_oauth_state';

export function githubRouter() {
  const router = new Hono<{ Bindings: Bindings }>();

  router.get('/github/start', (c) => {
    const state = randomState();
    const cb = `${c.env.PUBLIC_BASE_URL}/auth/github/callback`;
    const url =
      `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(c.env.GITHUB_OAUTH_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(cb)}` +
      `&scope=${encodeURIComponent('user:email')}&state=${encodeURIComponent(state)}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
      },
    });
  });

  router.get('/github/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const cookieHeader = c.req.header('cookie') ?? '';
    const m = new RegExp(`(?:^|; )${STATE_COOKIE}=([^;]+)`).exec(cookieHeader);
    const storedState = m?.[1];
    if (!code || !state || state !== storedState) {
      return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=oauth_state`, 302);
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: c.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
      }),
    });
    const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!tok.access_token) {
      return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=oauth_token`, 302);
    }

    const headers = {
      Authorization: `Bearer ${tok.access_token}`,
      'User-Agent': 'openkarta-registry',
      Accept: 'application/vnd.github+json',
    };
    const userRes = await fetch('https://api.github.com/user', { headers });
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
    if (!userRes.ok || !emailsRes.ok) {
      return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=oauth_user`, 302);
    }
    const user = (await userRes.json()) as { login: string };
    const emails = (await emailsRes.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = emails.find((e) => e.primary && e.verified);
    if (!primary) {
      return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=no_verified_email`, 302);
    }

    const now = Math.floor(Date.now() / 1000);
    const email = primary.email.toLowerCase();
    let acct = await c.env.DB.prepare('SELECT id FROM accounts WHERE email = ?')
      .bind(email)
      .first<{ id: string }>();
    if (!acct) {
      const id = ulid();
      await c.env.DB.prepare(
        'INSERT INTO accounts (id, email, github_login, created_at) VALUES (?,?,?,?)',
      )
        .bind(id, email, user.login, now)
        .run();
      acct = { id };
    } else {
      await c.env.DB.prepare('UPDATE accounts SET github_login = ? WHERE id = ?')
        .bind(user.login, acct.id)
        .run();
    }
    const sid = await createSession(c.env, acct.id);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${c.env.WEB_BASE_URL}/me`,
        'Set-Cookie': sessionCookieValue(sid),
      },
    });
  });

  return router;
}
