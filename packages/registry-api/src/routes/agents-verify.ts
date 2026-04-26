import { Hono } from 'hono';
import { RegistryError } from '@openkarta/registry-shared';
import { requireSession } from '../auth/middleware.js';
import type { Bindings, Variables } from '../index.js';

export function agentsVerifyRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.post('/agents/:id/verify', requireSession, async (c) => {
    const id = c.req.param('id');
    const account = c.get('account')!;
    const agent = await c.env.DB.prepare(
      'SELECT id, account_id, base_url, tier FROM agents WHERE id = ?',
    )
      .bind(id)
      .first<{ id: string; account_id: string; base_url: string; tier: string }>();
    if (!agent) {
      return c.json(new RegistryError('agent_not_found', 'no such agent').toJSON(), 404);
    }
    if (agent.account_id !== account.id) {
      return c.json(new RegistryError('forbidden', 'not the owner').toJSON(), 403);
    }

    const challenge = await c.env.DB.prepare(
      "SELECT token FROM verifications WHERE agent_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    )
      .bind(id)
      .first<{ token: string }>();
    if (!challenge) {
      return c.json(
        new RegistryError('domain_verification_pending', 'no pending challenge').toJSON(),
        409,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let passed = false;

    if (agent.tier === 'lite') {
      // Lite-tier agents are hosted on OpenKarta infra — domain verification auto-passes.
      passed = true;
    } else {
      const wellKnownUrl = `${agent.base_url.replace(/\/$/, '')}/.well-known/openkarta-owner.txt`;
      try {
        const r = await fetch(wellKnownUrl, { redirect: 'manual' });
        if (r.ok) {
          const body = (await r.text()).trim();
          passed = body === challenge.token;
        }
      } catch {
        passed = false;
      }
    }

    if (passed) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE verifications SET status='passed', completed_at=? WHERE agent_id=? AND token=?",
        ).bind(now, id, challenge.token),
        c.env.DB.prepare(
          "UPDATE agents SET verification_status='verified', updated_at=? WHERE id=?",
        ).bind(now, id),
      ]);
      try {
        await c.env.VERIFY_QUEUE.send({ agentId: id, baseUrl: agent.base_url });
      } catch {
        // Queue send failures don't block verification — cron will pick it up tomorrow.
      }
      return c.json({ status: 'verified' });
    }

    // Don't burn the challenge on a single fetch failure — the well-known file
    // may not be hosted yet. The challenge stays 'pending' so the user can retry
    // after fixing their hosting. The challenge itself is one-time-use; cron's
    // 24h TTL on `pending` rows handles long-stale tokens.
    return c.json(
      new RegistryError('domain_verification_pending', 'token mismatch or unreachable').toJSON(),
      409,
    );
  });

  return router;
}
