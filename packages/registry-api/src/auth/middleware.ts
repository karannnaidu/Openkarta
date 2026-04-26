import type { MiddlewareHandler } from 'hono';
import { RegistryError } from '@openkarta/registry-shared';
import { SESSION_COOKIE, readCookieFromHeader, readSession, type SessionAccount } from './session.js';
import type { Bindings, Variables } from '../index.js';

export const requireSession: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (
  c,
  next,
) => {
  const sid = readCookieFromHeader(c.req.header('cookie'), SESSION_COOKIE);
  if (!sid) {
    return c.json(new RegistryError('account_required', 'sign in required').toJSON(), 401);
  }
  const acct = await readSession(c.env, sid);
  if (!acct) {
    return c.json(new RegistryError('account_required', 'session expired').toJSON(), 401);
  }
  c.set('account', acct as SessionAccount);
  await next();
};
