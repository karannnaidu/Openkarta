import { Hono } from 'hono';
import { z } from 'zod';
import { RegistryError, ulid, type EmailClient } from '@openkarta/registry-shared';
import { requireSession } from '../auth/middleware.js';
import type { Bindings, Variables } from '../index.js';

const RequestSchema = z.object({ to_email: z.string().email().toLowerCase() });

const TTL_SECONDS = 24 * 60 * 60;

export function agentsTransferRouter(getEmailClient: (env: Bindings) => EmailClient) {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.post('/agents/:id/transfer', requireSession, async (c) => {
    const id = c.req.param('id');
    const account = c.get('account')!;
    const body = await c.req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(new RegistryError('validation_failed', 'invalid email').toJSON(), 400);
    }

    const row = await c.env.DB.prepare('SELECT account_id FROM agents WHERE id = ?')
      .bind(id)
      .first<{ account_id: string }>();
    if (!row) {
      return c.json(new RegistryError('agent_not_found', 'no such agent').toJSON(), 404);
    }
    if (row.account_id !== account.id) {
      return c.json(new RegistryError('forbidden', 'not the owner').toJSON(), 403);
    }

    const now = Math.floor(Date.now() / 1000);
    const tok = ulid();
    await c.env.DB.prepare(
      'INSERT INTO transfer_invites (token, agent_id, from_account_id, to_email, expires_at) VALUES (?,?,?,?,?)',
    )
      .bind(tok, id, account.id, parsed.data.to_email, now + TTL_SECONDS)
      .run();

    const link = `${c.env.PUBLIC_BASE_URL}/v1/agents/transfer/accept?token=${tok}`;
    const sent = await getEmailClient(c.env).sendTransferInvite({
      to: parsed.data.to_email,
      agentId: id,
      link,
    });
    await c.env.DB.prepare(
      "INSERT INTO email_log (id, account_id, kind, sent_at, provider_id) VALUES (?, ?, 'transfer_invite', ?, ?)",
    )
      .bind(ulid(), account.id, now, sent.id)
      .run();
    return c.json({ status: 'invited', expiresAt: now + TTL_SECONDS });
  });

  router.get('/agents/transfer/accept', requireSession, async (c) => {
    const tok = c.req.query('token');
    const account = c.get('account')!;
    if (!tok) {
      return c.json(new RegistryError('validation_failed', 'missing token').toJSON(), 400);
    }
    const invite = await c.env.DB.prepare(
      'SELECT agent_id, to_email, expires_at, consumed_at FROM transfer_invites WHERE token = ?',
    )
      .bind(tok)
      .first<{ agent_id: string; to_email: string; expires_at: number; consumed_at: number | null }>();
    const now = Math.floor(Date.now() / 1000);
    if (!invite || invite.consumed_at !== null || invite.expires_at < now) {
      return c.json(new RegistryError('forbidden', 'invite invalid or expired').toJSON(), 403);
    }
    if (invite.to_email !== account.email) {
      return c.json(new RegistryError('forbidden', 'invite addressed to another email').toJSON(), 403);
    }
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE agents SET account_id = ?, updated_at = ? WHERE id = ?').bind(
        account.id,
        now,
        invite.agent_id,
      ),
      c.env.DB.prepare('UPDATE transfer_invites SET consumed_at = ? WHERE token = ?').bind(now, tok),
    ]);
    return c.json({ status: 'transferred', agentId: invite.agent_id });
  });

  return router;
}
