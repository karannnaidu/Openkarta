import { RegistryError } from "@openkarta/registry-shared";
import { Hono } from "hono";
import { requireSession } from "../auth/middleware.js";
import type { Bindings, Variables } from "../index.js";

const COOLDOWN_SECONDS = 60 * 60; // 1/hr per agent

export function agentsReverifyRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.post("/agents/:id/reverify-conformance", requireSession, async (c) => {
    const id = c.req.param("id");
    const account = c.get("account")!;
    const row = await c.env.DB.prepare(
      "SELECT account_id, base_url, verification_status FROM agents WHERE id = ?",
    )
      .bind(id)
      .first<{ account_id: string; base_url: string; verification_status: string }>();
    if (!row) {
      return c.json(new RegistryError("agent_not_found", "no such agent").toJSON(), 404);
    }
    if (row.account_id !== account.id) {
      return c.json(new RegistryError("forbidden", "not the owner").toJSON(), 403);
    }
    if (row.verification_status !== "verified") {
      return c.json(
        new RegistryError("domain_verification_pending", "verify domain first").toJSON(),
        409,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const key = `reverify:${id}`;
    const last = await c.env.DB.prepare("SELECT last_at FROM rate_limits WHERE key = ?")
      .bind(key)
      .first<{ last_at: number }>();
    if (last && now - last.last_at < COOLDOWN_SECONDS) {
      return c.json(new RegistryError("rate_limited", "try again later").toJSON(), 429);
    }
    await c.env.DB.prepare(
      "INSERT INTO rate_limits (key, last_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_at = excluded.last_at",
    )
      .bind(key, now)
      .run();

    try {
      await c.env.VERIFY_QUEUE.send({ agentId: id, baseUrl: row.base_url });
    } catch {
      // best-effort
    }
    return c.json({ status: "enqueued" });
  });

  return router;
}
