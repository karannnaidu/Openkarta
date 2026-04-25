import { Hono } from 'hono';
import { RegistryError } from '@openkarta/registry-shared';
import { requireSession } from '../auth/middleware.js';
import type { Bindings, Variables } from '../index.js';

export function agentsDeleteRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.delete('/agents/:id', requireSession, async (c) => {
    const id = c.req.param('id');
    const account = c.get('account')!;
    const row = await c.env.DB.prepare('SELECT account_id FROM agents WHERE id = ?')
      .bind(id)
      .first<{ account_id: string }>();
    if (!row) {
      return c.json(new RegistryError('agent_not_found', 'no such agent').toJSON(), 404);
    }
    if (row.account_id !== account.id) {
      return c.json(new RegistryError('forbidden', 'not the owner').toJSON(), 403);
    }
    await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  });

  return router;
}
