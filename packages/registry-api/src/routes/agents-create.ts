import {
  AgentSubmissionSchema,
  RegistryError,
  verificationToken,
} from "@openkarta/registry-shared";
import { Hono } from "hono";
import { requireSession } from "../auth/middleware.js";
import { type AgentRow, rowToListing } from "../db/agents.js";
import type { Bindings, Variables } from "../index.js";

export function agentsCreateRouter() {
  const router = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  router.post("/agents", requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = AgentSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        new RegistryError(
          "validation_failed",
          parsed.error.issues[0]?.message ?? "invalid payload",
        ).toJSON(),
        400,
      );
    }
    const a = parsed.data;
    const account = c.get("account")!;
    const now = Math.floor(Date.now() / 1000);
    const manifestUrl = a.manifestUrl ?? `${a.baseUrl.replace(/\/$/, "")}/v0/discover`;

    const exists = await c.env.DB.prepare("SELECT 1 FROM agents WHERE id = ?")
      .bind(a.agentId)
      .first();
    if (exists) {
      return c.json(new RegistryError("agent_id_taken", "agent id already in use").toJSON(), 409);
    }

    const tok = verificationToken();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO agents (id, account_id, display_name, description, base_url, manifest_url,
                              tier, supported_item_types, regions, tags, public_key,
                              verification_status, health_status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?, 'pending', 'unknown', ?, ?)`,
      ).bind(
        a.agentId,
        account.id,
        a.displayName,
        a.description,
        a.baseUrl,
        manifestUrl,
        a.tier,
        JSON.stringify(a.supportedItemTypes),
        JSON.stringify(a.regions),
        JSON.stringify(a.tags),
        a.publicKey ?? null,
        now,
        now,
      ),
      c.env.DB.prepare(
        `INSERT INTO verifications (agent_id, token, created_at, status) VALUES (?,?,?, 'pending')`,
      ).bind(a.agentId, tok, now),
    ]);

    const row = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?")
      .bind(a.agentId)
      .first<AgentRow>();
    return c.json(
      {
        agent: rowToListing(row!),
        verificationInstructions: { token: tok, path: "/.well-known/openkarta-owner.txt" },
      },
      201,
    );
  });

  return router;
}
