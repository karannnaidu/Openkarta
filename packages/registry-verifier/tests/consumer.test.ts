import { env, applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker, { setRunner, setEmailFactory, type VerifyMessage } from '../src/index.js';
import type { ConformanceResult } from '@openkarta/conformance-tests';
import type { EmailClient } from '@openkarta/registry-shared';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
    RESEND_API_KEY: string;
    BADGE_SIGNING_SECRET: string;
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const sentEmails: Array<{ to: string; kind: string; agentId: string }> = [];

const stubEmail: EmailClient = {
  async sendMagicLink() { return { id: 'm' }; },
  async sendTransferInvite() { return { id: 't' }; },
  async sendVerificationPassed({ to, agentId }) {
    sentEmails.push({ to, agentId, kind: 'verification_passed' });
    return { id: 'vp' };
  },
  async sendHealthTransition({ to, agentId, kind }) {
    sentEmails.push({ to, agentId, kind });
    return { id: 'ht' };
  },
};

function fakeResult(passed: boolean): ConformanceResult {
  return {
    passed,
    testsPassed: passed ? 5 : 2,
    testsFailed: passed ? 0 : 3,
    packs: ['core', 'product'],
    ...(passed ? {} : { errorSummary: 'core/manifest: failed' }),
    signedBadge: {
      agentId: 'test-agent',
      protocolVersion: '0.1',
      tierDetected: 'compliant',
      packsPassed: passed ? ['core', 'product'] : [],
      testsPassed: passed ? 5 : 2,
      testsFailed: passed ? 0 : 3,
      signedAt: new Date(0).toISOString(),
      signature: 'sig',
    },
  };
}

let nextResult: ConformanceResult = fakeResult(true);

setRunner(async () => nextResult);
setEmailFactory(() => stubEmail);

async function seedAgent(opts: {
  agentId: string;
  email: string;
  healthStatus?: 'unknown' | 'healthy' | 'stale' | 'delisted';
  consecutiveFailures?: number;
  lastVerifiedAt?: number | null;
}) {
  const accountId = 'acc-' + opts.agentId;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)')
    .bind(accountId, opts.email, now)
    .run();
  await env.DB.prepare(
    `INSERT INTO agents (id, account_id, display_name, base_url, manifest_url, tier, supported_item_types,
                          verification_status, health_status, consecutive_failures, last_verified_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      opts.agentId,
      accountId,
      'Test',
      'https://example.com',
      'https://example.com/v0/discover',
      'lite',
      JSON.stringify(['product']),
      'verified',
      opts.healthStatus ?? 'unknown',
      opts.consecutiveFailures ?? 0,
      opts.lastVerifiedAt === undefined ? null : opts.lastVerifiedAt,
      now,
      now,
    )
    .run();
}

function makeBatch(msgs: VerifyMessage[]): MessageBatch<VerifyMessage> {
  return {
    queue: 'verify-queue',
    messages: msgs.map((body, i) => ({
      id: `m${i}`,
      timestamp: new Date(),
      body,
      attempts: 1,
      ack() { /* no-op for test */ },
      retry() { /* no-op for test */ },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any,
    ackAll() { /* no-op */ },
    retryAll() { /* no-op */ },
  };
}

beforeEach(async () => {
  sentEmails.length = 0;
  // Wipe state between tests.
  await env.DB.exec('DELETE FROM badge_runs');
  await env.DB.exec('DELETE FROM email_log');
  await env.DB.exec('DELETE FROM agents');
  await env.DB.exec('DELETE FROM accounts');
});

describe('verifier queue consumer', () => {
  it('first-ever pass writes badge_run, sets healthy, emails verification_passed', async () => {
    nextResult = fakeResult(true);
    await seedAgent({ agentId: 'agent-a', email: 'owner@example.com', lastVerifiedAt: null });

    await worker.queue(makeBatch([{ agentId: 'agent-a', baseUrl: 'https://example.com' }]), env);

    const agent = await env.DB
      .prepare('SELECT health_status, consecutive_failures, last_verified_at FROM agents WHERE id = ?')
      .bind('agent-a')
      .first<{ health_status: string; consecutive_failures: number; last_verified_at: number }>();
    expect(agent?.health_status).toBe('healthy');
    expect(agent?.consecutive_failures).toBe(0);
    expect(agent?.last_verified_at).toBeGreaterThan(0);

    const runs = await env.DB.prepare('SELECT passed, tests_passed FROM badge_runs WHERE agent_id = ?')
      .bind('agent-a')
      .all<{ passed: number; tests_passed: number }>();
    expect(runs.results.length).toBe(1);
    expect(runs.results[0]!.passed).toBe(1);
    expect(runs.results[0]!.tests_passed).toBe(5);

    expect(sentEmails).toEqual([
      { to: 'owner@example.com', agentId: 'agent-a', kind: 'verification_passed' },
    ]);
  });

  it('healthy → 3rd consecutive fail → stale, emails stale', async () => {
    nextResult = fakeResult(false);
    await seedAgent({
      agentId: 'agent-b',
      email: 'b@example.com',
      healthStatus: 'healthy',
      consecutiveFailures: 2,
      lastVerifiedAt: 1000,
    });

    await worker.queue(makeBatch([{ agentId: 'agent-b', baseUrl: 'https://example.com' }]), env);

    const agent = await env.DB
      .prepare('SELECT health_status, consecutive_failures FROM agents WHERE id = ?')
      .bind('agent-b')
      .first<{ health_status: string; consecutive_failures: number }>();
    expect(agent?.health_status).toBe('stale');
    expect(agent?.consecutive_failures).toBe(3);

    expect(sentEmails).toEqual([{ to: 'b@example.com', agentId: 'agent-b', kind: 'stale' }]);

    const runs = await env.DB.prepare('SELECT passed, error_summary FROM badge_runs WHERE agent_id = ?')
      .bind('agent-b')
      .all<{ passed: number; error_summary: string }>();
    expect(runs.results[0]!.passed).toBe(0);
    expect(runs.results[0]!.error_summary).toContain('core/manifest');
  });

  it('stale + pass → healthy, emails back_to_healthy', async () => {
    nextResult = fakeResult(true);
    await seedAgent({
      agentId: 'agent-c',
      email: 'c@example.com',
      healthStatus: 'stale',
      consecutiveFailures: 5,
      lastVerifiedAt: 1000,
    });

    await worker.queue(makeBatch([{ agentId: 'agent-c', baseUrl: 'https://example.com' }]), env);

    const agent = await env.DB
      .prepare('SELECT health_status, consecutive_failures FROM agents WHERE id = ?')
      .bind('agent-c')
      .first<{ health_status: string; consecutive_failures: number }>();
    expect(agent?.health_status).toBe('healthy');
    expect(agent?.consecutive_failures).toBe(0);
    expect(sentEmails).toEqual([
      { to: 'c@example.com', agentId: 'agent-c', kind: 'back_to_healthy' },
    ]);
  });

  it('stale + 7th fail → delisted, emails delisted', async () => {
    nextResult = fakeResult(false);
    await seedAgent({
      agentId: 'agent-d',
      email: 'd@example.com',
      healthStatus: 'stale',
      consecutiveFailures: 6,
      lastVerifiedAt: 1000,
    });

    await worker.queue(makeBatch([{ agentId: 'agent-d', baseUrl: 'https://example.com' }]), env);

    const agent = await env.DB
      .prepare('SELECT health_status, consecutive_failures FROM agents WHERE id = ?')
      .bind('agent-d')
      .first<{ health_status: string; consecutive_failures: number }>();
    expect(agent?.health_status).toBe('delisted');
    expect(agent?.consecutive_failures).toBe(7);
    expect(sentEmails).toEqual([{ to: 'd@example.com', agentId: 'agent-d', kind: 'delisted' }]);
  });

  it('skips silently when agent was deleted before processing', async () => {
    nextResult = fakeResult(true);
    // No seedAgent — DB has no row for this id.

    await worker.queue(
      makeBatch([{ agentId: 'agent-missing', baseUrl: 'https://example.com' }]),
      env,
    );

    const runs = await env.DB.prepare('SELECT count(*) as c FROM badge_runs')
      .first<{ c: number }>();
    expect(runs?.c).toBe(0);
    expect(sentEmails).toEqual([]);
  });
});
