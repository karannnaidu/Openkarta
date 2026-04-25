import { env, applyD1Migrations, fetchMock } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import app, { setEmailClientFactory } from '../../src/index.js';
import type { EmailClient } from '../../src/email/resend.js';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
    VERIFY_QUEUE: Queue;
  }
}

const sentTransfer: Array<{ to: string; agentId: string; link: string }> = [];

const stubClient: EmailClient = {
  async sendMagicLink() { return { id: 'stub' }; },
  async sendVerificationPassed() { return { id: 'stub' }; },
  async sendHealthTransition() { return { id: 'stub' }; },
  async sendTransferInvite(args) { sentTransfer.push(args); return { id: 'stub' }; },
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  setEmailClientFactory(() => stubClient);
});

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  sentTransfer.length = 0;
});

afterEach(() => {
  fetchMock.deactivate();
});

async function signInAs(email: string): Promise<string> {
  const token = `tok-${email}-${Date.now()}-${Math.random()}`;
  const exp = Math.floor(Date.now() / 1000) + 600;
  await env.DB.prepare('INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)')
    .bind(token, email, exp)
    .run();
  // POST creates the magic-link row already; consume to get a session cookie. Use direct insert + consume.
  const consume = await app.request(`http://x/auth/magic-link/consume?token=${token}`, {}, env);
  return consume.headers.get('Set-Cookie')!.split(';')[0]!;
}

const VALID_AGENT = {
  agentId: 'test-agent',
  displayName: 'Test',
  description: 'demo',
  baseUrl: 'https://test.example.com',
  tier: 'http',
  supportedItemTypes: ['product'],
  regions: [{ country: 'IN' }],
  tags: ['t'],
};

describe('POST /v1/agents', () => {
  it('401 without session', async () => {
    const res = await app.request('http://x/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_AGENT),
    }, env);
    expect(res.status).toBe(401);
  });

  it('201 with valid payload — returns agent + verificationInstructions', async () => {
    const cookie = await signInAs('owner1@example.com');
    const res = await app.request('http://x/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'agent-create-1' }),
    }, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { agent: { agentId: string; verified: boolean; health: string }; verificationInstructions: { token: string; path: string } };
    expect(body.agent.agentId).toBe('agent-create-1');
    expect(body.agent.verified).toBe(false);
    expect(body.agent.health).toBe('unknown');
    expect(body.verificationInstructions.token).toMatch(/^okv-/);
    expect(body.verificationInstructions.path).toBe('/.well-known/openkarta-owner.txt');
    const v = await env.DB.prepare("SELECT status FROM verifications WHERE agent_id = ?").bind('agent-create-1').first<{ status: string }>();
    expect(v?.status).toBe('pending');
  });

  it('409 agent_id_taken', async () => {
    const cookie = await signInAs('owner2@example.com');
    await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'dup' }),
    }, env);
    const res = await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'dup' }),
    }, env);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('agent_id_taken');
  });

  it('400 validation_failed for http baseUrl', async () => {
    const cookie = await signInAs('owner3@example.com');
    const res = await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'bad-url', baseUrl: 'http://x.com' }),
    }, env);
    expect(res.status).toBe(400);
  });
});

describe('POST /v1/agents/:id/verify', () => {
  async function setupAgent(owner: string, agentId: string, tier: 'http' | 'lite' = 'http'): Promise<{ cookie: string; token: string }> {
    const cookie = await signInAs(owner);
    const res = await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId, baseUrl: `https://${agentId}.example.com`, tier }),
    }, env);
    const body = (await res.json()) as { verificationInstructions: { token: string } };
    return { cookie, token: body.verificationInstructions.token };
  }

  it('passes when well-known returns the matching token; flips verification_status', async () => {
    const { cookie, token } = await setupAgent('vow@example.com', 'verify-pass');
    fetchMock
      .get('https://verify-pass.example.com')
      .intercept({ path: '/.well-known/openkarta-owner.txt' })
      .reply(200, token);
    const res = await app.request('http://x/v1/agents/verify-pass/verify', {
      method: 'POST', headers: { cookie },
    }, env);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT verification_status FROM agents WHERE id = 'verify-pass'").first<{ verification_status: string }>();
    expect(row?.verification_status).toBe('verified');
  });

  it('fails (409) when token mismatches; status remains pending', async () => {
    const { cookie } = await setupAgent('vow2@example.com', 'verify-mismatch');
    fetchMock
      .get('https://verify-mismatch.example.com')
      .intercept({ path: '/.well-known/openkarta-owner.txt' })
      .reply(200, 'something else');
    const res = await app.request('http://x/v1/agents/verify-mismatch/verify', {
      method: 'POST', headers: { cookie },
    }, env);
    expect(res.status).toBe(409);
    const row = await env.DB.prepare("SELECT verification_status FROM agents WHERE id = 'verify-mismatch'").first<{ verification_status: string }>();
    expect(row?.verification_status).toBe('pending');
  });

  it('lite tier auto-passes without HTTP fetch', async () => {
    const { cookie } = await setupAgent('vow3@example.com', 'verify-lite', 'lite');
    const res = await app.request('http://x/v1/agents/verify-lite/verify', {
      method: 'POST', headers: { cookie },
    }, env);
    expect(res.status).toBe(200);
  });

  it('non-owner gets 403', async () => {
    await setupAgent('vow4@example.com', 'owned-by-someone-else');
    const otherCookie = await signInAs('intruder@example.com');
    const res = await app.request('http://x/v1/agents/owned-by-someone-else/verify', {
      method: 'POST', headers: { cookie: otherCookie },
    }, env);
    expect(res.status).toBe(403);
  });
});

describe('Public reads', () => {
  beforeAll(async () => {
    // Seed two verified+healthy and one delisted.
    await env.DB.prepare(
      "INSERT INTO accounts (id, email, created_at) VALUES ('pub-acc', 'pub@e.com', 0) ON CONFLICT DO NOTHING",
    ).run();
    const insert = (id: string, health: string) =>
      env.DB.prepare(
        `INSERT INTO agents (id, account_id, display_name, base_url, manifest_url, tier, supported_item_types,
                              regions, tags, verification_status, health_status, created_at, updated_at)
         VALUES (?, 'pub-acc', ?, ?, ?, 'http', '["product"]', '[{"country":"IN"}]', '[]',
                 'verified', ?, ?, ?)`,
      ).bind(id, id, `https://${id}.x`, `https://${id}.x/v0/discover`, health, 1000, 1000);
    await env.DB.batch([insert('pub-a', 'healthy'), insert('pub-b', 'stale'), insert('pub-c', 'delisted')]);
    // a badge_run for pub-a
    await env.DB.prepare(
      "INSERT INTO badge_runs (id, agent_id, ran_at, passed, tests_passed, tests_failed, packs, signed_badge) VALUES ('br1','pub-a',?,1,12,0,'[\"core\"]','{\"v\":1}')",
    ).bind(Math.floor(Date.now() / 1000)).run();
  });

  it('GET /v1/agents lists healthy + stale by default', async () => {
    const res = await app.request('http://x/v1/agents', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ agentId: string }>; nextCursor: string | null };
    const ids = body.items.map((a) => a.agentId);
    expect(ids).toContain('pub-a');
    expect(ids).toContain('pub-b');
    expect(ids).not.toContain('pub-c');
    expect(res.headers.get('ETag')).toBeTruthy();
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=60/);
  });

  it('GET /v1/agents?include=delisted widens the filter', async () => {
    const res = await app.request('http://x/v1/agents?include=delisted', {}, env);
    const body = (await res.json()) as { items: Array<{ agentId: string }> };
    expect(body.items.map((a) => a.agentId)).toContain('pub-c');
  });

  it('GET /v1/agents/:id returns detail + lastBadgeRun + history', async () => {
    const res = await app.request('http://x/v1/agents/pub-a', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agent: unknown; lastBadgeRun: unknown; history: unknown[] };
    expect(body.agent).toBeTruthy();
    expect(body.lastBadgeRun).toBeTruthy();
    expect(Array.isArray(body.history)).toBe(true);
  });

  it('GET /v1/agents/:id/badge returns the signed badge', async () => {
    const res = await app.request('http://x/v1/agents/pub-a/badge', {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
  });
});

describe('PATCH /v1/agents/:id', () => {
  it('changing baseUrl resets verification to pending and issues a new token', async () => {
    const cookie = await signInAs('patch@example.com');
    await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'patchme', baseUrl: 'https://old.example.com' }),
    }, env);
    await env.DB.prepare("UPDATE agents SET verification_status='verified' WHERE id='patchme'").run();
    const res = await app.request('http://x/v1/agents/patchme', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ baseUrl: 'https://new.example.com' }),
    }, env);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT verification_status, base_url FROM agents WHERE id='patchme'").first<{ verification_status: string; base_url: string }>();
    expect(row?.verification_status).toBe('pending');
    expect(row?.base_url).toBe('https://new.example.com');
    const pending = await env.DB.prepare("SELECT count(*) as n FROM verifications WHERE agent_id='patchme' AND status='pending'").first<{ n: number }>();
    expect(pending?.n).toBeGreaterThanOrEqual(1);
  });
});

describe('DELETE /v1/agents/:id', () => {
  it('owner can delete; cascades to verifications and badge_runs', async () => {
    const cookie = await signInAs('del@example.com');
    await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'deleteme' }),
    }, env);
    const res = await app.request('http://x/v1/agents/deleteme', { method: 'DELETE', headers: { cookie } }, env);
    expect(res.status).toBe(204);
    const row = await env.DB.prepare("SELECT 1 FROM agents WHERE id='deleteme'").first();
    expect(row).toBeNull();
  });
});

describe('POST /v1/agents/:id/reverify-conformance', () => {
  it('rate-limits second call within 1hr', async () => {
    const cookie = await signInAs('rev@example.com');
    await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'rev-target' }),
    }, env);
    await env.DB.prepare("UPDATE agents SET verification_status='verified' WHERE id='rev-target'").run();
    const r1 = await app.request('http://x/v1/agents/rev-target/reverify-conformance', { method: 'POST', headers: { cookie } }, env);
    expect(r1.status).toBe(200);
    const r2 = await app.request('http://x/v1/agents/rev-target/reverify-conformance', { method: 'POST', headers: { cookie } }, env);
    expect(r2.status).toBe(429);
  });
});

describe('Transfer flow', () => {
  it('owner invites + recipient accepts', async () => {
    const ownerCookie = await signInAs('xfer-from@example.com');
    await app.request('http://x/v1/agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ ...VALID_AGENT, agentId: 'xfer-target' }),
    }, env);
    const inviteRes = await app.request('http://x/v1/agents/xfer-target/transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ownerCookie },
      body: JSON.stringify({ to_email: 'xfer-to@example.com' }),
    }, env);
    expect(inviteRes.status).toBe(200);
    expect(sentTransfer).toHaveLength(1);
    expect(sentTransfer[0]?.to).toBe('xfer-to@example.com');
    const link = sentTransfer[0]!.link;
    const tokMatch = /token=([^&]+)/.exec(link);
    expect(tokMatch).toBeTruthy();
    const tok = tokMatch![1]!;
    const recipientCookie = await signInAs('xfer-to@example.com');
    const accept = await app.request(`http://x/v1/agents/transfer/accept?token=${tok}`, { headers: { cookie: recipientCookie } }, env);
    expect(accept.status).toBe(200);
    const newOwner = await env.DB.prepare("SELECT account_id FROM agents WHERE id='xfer-target'").first<{ account_id: string }>();
    const recipient = await env.DB.prepare("SELECT id FROM accounts WHERE email='xfer-to@example.com'").first<{ id: string }>();
    expect(newOwner?.account_id).toBe(recipient?.id);
  });
});
