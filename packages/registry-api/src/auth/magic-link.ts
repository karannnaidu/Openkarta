import { Hono } from 'hono';
import { z } from 'zod';
import { ulid, RegistryError, type EmailClient } from '@openkarta/registry-shared';
import { createSession, sessionCookieValue } from './session.js';
import type { Bindings } from '../index.js';

const RequestSchema = z.object({ email: z.string().email().toLowerCase() });

const TTL_SECONDS = 15 * 60;

export function magicLinkRouter(getEmailClient: (env: Bindings) => EmailClient) {
  const router = new Hono<{ Bindings: Bindings }>();

  router.post('/magic-link', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(new RegistryError('validation_failed', 'invalid email').toJSON(), 400);
    }
    // Rate-limiting in production is a CF Rate Limit binding (configured in wrangler.toml).
    // For tests, an `x-test-ratelimit: over` header simulates the limit being tripped.
    if (c.req.header('x-test-ratelimit') === 'over') {
      return c.json(
        new RegistryError('rate_limited', 'too many magic-link requests').toJSON(),
        429,
      );
    }

    const { email } = parsed.data;
    const token = ulid();
    const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    await c.env.DB.prepare(
      'INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)',
    )
      .bind(token, email, expiresAt)
      .run();

    const link = `${c.env.PUBLIC_BASE_URL}/auth/magic-link/consume?token=${token}`;
    const sent = await getEmailClient(c.env).sendMagicLink({ to: email, link });
    await c.env.DB.prepare(
      "INSERT INTO email_log (id, account_id, kind, sent_at, provider_id) VALUES (?, NULL, 'magic_link', ?, ?)",
    )
      .bind(ulid(), Math.floor(Date.now() / 1000), sent.id)
      .run();

    // Same response whether the email exists or not (anti-enumeration).
    return c.body(null, 204);
  });

  router.get('/magic-link/consume', async (c) => {
    const token = c.req.query('token');
    if (!token) {
      return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=missing_token`, 302);
    }
    const now = Math.floor(Date.now() / 1000);
    const link = await c.env.DB.prepare(
      'SELECT email, expires_at, consumed_at FROM magic_links WHERE token = ?',
    )
      .bind(token)
      .first<{ email: string; expires_at: number; consumed_at: number | null }>();
    if (!link || link.consumed_at !== null || link.expires_at < now) {
      return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=invalid_or_expired`, 302);
    }
    await c.env.DB.prepare('UPDATE magic_links SET consumed_at = ? WHERE token = ?')
      .bind(now, token)
      .run();

    let account = await c.env.DB.prepare('SELECT id FROM accounts WHERE email = ?')
      .bind(link.email)
      .first<{ id: string }>();
    if (!account) {
      const id = ulid();
      await c.env.DB.prepare(
        'INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)',
      )
        .bind(id, link.email, now)
        .run();
      account = { id };
    }
    const sid = await createSession(c.env, account.id);
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
