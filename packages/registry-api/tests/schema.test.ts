import { env, applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('schema', () => {
  it('creates the expected tables', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' ORDER BY name",
    ).all();
    const names = results.map((r) => (r as { name: string }).name);
    expect(names).toEqual([
      'accounts',
      'agents',
      'badge_runs',
      'email_log',
      'magic_links',
      'rate_limits',
      'sessions',
      'transfer_invites',
      'verifications',
    ]);
  });

  it('enforces tier check constraint', async () => {
    await env.DB.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)')
      .bind('a1', 'a@b.com', 0)
      .run();
    await expect(
      env.DB.prepare(
        `INSERT INTO agents (id, account_id, display_name, base_url, manifest_url, tier, supported_item_types,
                              verification_status, health_status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
        .bind(
          'bad',
          'a1',
          'X',
          'https://x.com',
          'https://x.com/v0/discover',
          'WRONG',
          '["product"]',
          'pending',
          'unknown',
          0,
          0,
        )
        .run(),
    ).rejects.toThrow();
  });
});
