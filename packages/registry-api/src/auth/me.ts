import { Hono } from 'hono';
import { RegistryError } from '@openkarta/registry-shared';
import {
  SESSION_COOKIE,
  SESSION_CLEAR_COOKIE,
  readCookieFromHeader,
  readSession,
  clearSession,
} from './session.js';
import type { Bindings } from '../index.js';

export function meRouter() {
  const router = new Hono<{ Bindings: Bindings }>();

  router.get('/me', async (c) => {
    const sid = readCookieFromHeader(c.req.header('cookie'), SESSION_COOKIE);
    if (!sid) {
      return c.json(new RegistryError('account_required', 'sign in required').toJSON(), 401);
    }
    const acct = await readSession(c.env, sid);
    if (!acct) {
      return c.json(new RegistryError('account_required', 'session expired').toJSON(), 401);
    }
    return c.json({
      account: {
        id: acct.id,
        email: acct.email,
        displayName: acct.displayName,
        githubLogin: acct.githubLogin,
      },
    });
  });

  router.post('/logout', async (c) => {
    const sid = readCookieFromHeader(c.req.header('cookie'), SESSION_COOKIE);
    if (sid) await clearSession(c.env, sid);
    return new Response(null, { status: 204, headers: { 'Set-Cookie': SESSION_CLEAR_COOKIE } });
  });

  return router;
}
