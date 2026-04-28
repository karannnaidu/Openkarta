import { RegistryError } from "@openkarta/registry-shared";
import { Hono } from "hono";
import { type AgentRow, rowToListing } from "../db/agents.js";
import type { Bindings } from "../index.js";

const PAGE_SIZE = 50;

function encodeCursor(createdAt: number, id: string): string {
  return Buffer.from(`${createdAt}:${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: number; id: string } | null {
  try {
    const [a, b] = Buffer.from(cursor, "base64url").toString("utf8").split(":");
    if (!a || !b) return null;
    const createdAt = Number(a);
    if (Number.isNaN(createdAt)) return null;
    return { createdAt, id: b };
  } catch {
    return null;
  }
}

async function etagOf(payload: unknown): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

export function agentsPublicRouter() {
  const router = new Hono<{ Bindings: Bindings }>();

  router.get("/agents", async (c) => {
    const url = new URL(c.req.url);
    const itemType = url.searchParams.get("itemType");
    const country = url.searchParams.get("country");
    const city = url.searchParams.get("city");
    const pincode = url.searchParams.get("pincode");
    const tier = url.searchParams.get("tier");
    const include = url.searchParams.get("include");
    const cursor = url.searchParams.get("cursor");

    const includeDelisted = include === "delisted";
    const healthClause = includeDelisted
      ? "health_status IN ('healthy','stale','delisted')"
      : "health_status IN ('healthy','stale')";

    const conds: string[] = [`verification_status = 'verified'`, healthClause];
    const binds: unknown[] = [];
    if (itemType) {
      conds.push("instr(supported_item_types, ?) > 0");
      binds.push(`"${itemType}"`);
    }
    if (country) {
      conds.push("instr(regions, ?) > 0");
      binds.push(`"country":"${country}"`);
    }
    if (city) {
      conds.push("instr(regions, ?) > 0");
      binds.push(`"city":"${city}"`);
    }
    if (pincode) {
      conds.push("instr(regions, ?) > 0");
      binds.push(`"${pincode}"`);
    }
    if (tier) {
      conds.push("tier = ?");
      binds.push(tier);
    }
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        conds.push("(created_at, id) < (?, ?)");
        binds.push(decoded.createdAt, decoded.id);
      }
    }
    const sql = `SELECT * FROM agents WHERE ${conds.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ${PAGE_SIZE + 1}`;
    const { results } = await c.env.DB.prepare(sql)
      .bind(...binds)
      .all<AgentRow>();
    const hasMore = results.length > PAGE_SIZE;
    const slice = results.slice(0, PAGE_SIZE);
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;
    const payload = { items: slice.map(rowToListing), nextCursor };
    const etag = await etagOf(payload);
    if (c.req.header("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return c.json(payload, 200, {
      ETag: etag,
      "Cache-Control": "public, max-age=60",
    });
  });

  router.get("/agents/:id", async (c) => {
    const id = c.req.param("id");
    const row = await c.env.DB.prepare(
      "SELECT * FROM agents WHERE id = ? AND verification_status = 'verified'",
    )
      .bind(id)
      .first<AgentRow>();
    if (!row) {
      return c.json(new RegistryError("agent_not_found", "no such agent").toJSON(), 404);
    }
    const lastBadge = await c.env.DB.prepare(
      "SELECT id, ran_at, passed, tests_passed, tests_failed, packs, error_summary FROM badge_runs WHERE agent_id = ? ORDER BY ran_at DESC LIMIT 1",
    )
      .bind(id)
      .first();
    const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const { results: history } = await c.env.DB.prepare(
      `SELECT date(ran_at, 'unixepoch') as day,
              SUM(passed) as passed,
              SUM(1 - passed) as failed
       FROM badge_runs WHERE agent_id = ? AND ran_at >= ?
       GROUP BY day ORDER BY day ASC`,
    )
      .bind(id, since)
      .all();
    const payload = { agent: rowToListing(row), lastBadgeRun: lastBadge, history };
    const etag = await etagOf(payload);
    if (c.req.header("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return c.json(payload, 200, { ETag: etag, "Cache-Control": "public, max-age=60" });
  });

  router.get("/agents/:id/badge", async (c) => {
    const id = c.req.param("id");
    const row = await c.env.DB.prepare(
      "SELECT signed_badge FROM badge_runs WHERE agent_id = ? ORDER BY ran_at DESC LIMIT 1",
    )
      .bind(id)
      .first<{ signed_badge: string }>();
    if (!row) {
      return c.json(new RegistryError("agent_not_found", "no badge run yet").toJSON(), 404);
    }
    return new Response(row.signed_badge, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  });

  return router;
}
