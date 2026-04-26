import { Hono } from 'hono';
import {
  AgentPatchSchema,
  RegistryError,
  verificationToken,
} from '@openkarta/registry-shared';
import { requireSession } from '../auth/middleware.js';
import { rowToListing, type AgentRow } from '../db/agents.js';
import type { Bindings, Variables } from '../index.js';

export function agentsUpdateRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.patch('/agents/:id', requireSession, async (c) => {
    const id = c.req.param('id');
    const account = c.get('account')!;
    const body = await c.req.json().catch(() => ({}));
    const parsed = AgentPatchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        new RegistryError('validation_failed', parsed.error.issues[0]?.message ?? 'invalid').toJSON(),
        400,
      );
    }

    const existing = await c.env.DB.prepare('SELECT account_id, base_url FROM agents WHERE id = ?')
      .bind(id)
      .first<{ account_id: string; base_url: string }>();
    if (!existing) {
      return c.json(new RegistryError('agent_not_found', 'no such agent').toJSON(), 404);
    }
    if (existing.account_id !== account.id) {
      return c.json(new RegistryError('forbidden', 'not the owner').toJSON(), 403);
    }

    const sets: string[] = [];
    const binds: unknown[] = [];
    const p = parsed.data;
    if (p.displayName !== undefined) { sets.push('display_name = ?'); binds.push(p.displayName); }
    if (p.description !== undefined) { sets.push('description = ?'); binds.push(p.description); }
    if (p.tier !== undefined) { sets.push('tier = ?'); binds.push(p.tier); }
    if (p.supportedItemTypes !== undefined) { sets.push('supported_item_types = ?'); binds.push(JSON.stringify(p.supportedItemTypes)); }
    if (p.regions !== undefined) { sets.push('regions = ?'); binds.push(JSON.stringify(p.regions)); }
    if (p.tags !== undefined) { sets.push('tags = ?'); binds.push(JSON.stringify(p.tags)); }
    if (p.publicKey !== undefined) { sets.push('public_key = ?'); binds.push(p.publicKey); }
    if (p.manifestUrl !== undefined) { sets.push('manifest_url = ?'); binds.push(p.manifestUrl); }

    const baseUrlChanged = p.baseUrl !== undefined && p.baseUrl !== existing.base_url;
    if (p.baseUrl !== undefined) {
      sets.push('base_url = ?');
      binds.push(p.baseUrl);
    }
    if (baseUrlChanged) {
      sets.push("verification_status = 'pending'");
    }

    const now = Math.floor(Date.now() / 1000);
    sets.push('updated_at = ?');
    binds.push(now);
    binds.push(id);

    if (sets.length > 1) {
      await c.env.DB.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    }
    if (baseUrlChanged) {
      const tok = verificationToken();
      await c.env.DB.prepare(
        "INSERT INTO verifications (agent_id, token, created_at, status) VALUES (?,?,?, 'pending')",
      )
        .bind(id, tok, now)
        .run();
    }

    const row = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first<AgentRow>();
    return c.json({ agent: rowToListing(row!) });
  });

  return router;
}
