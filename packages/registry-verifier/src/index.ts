import { runConformance, type ConformanceResult } from '@openkarta/conformance-tests';
import { ulid, makeResendClient, type EmailClient } from '@openkarta/registry-shared';
import { transition, type AgentHealthState } from './state-machine.js';

export type Bindings = {
  DB: D1Database;
  RESEND_API_KEY: string;
  BADGE_SIGNING_SECRET: string;
};

export type VerifyMessage = {
  agentId: string;
  baseUrl: string;
};

export type Runner = (opts: { baseUrl: string; badgeSecret: string }) => Promise<ConformanceResult>;
export type EmailFactory = (env: Bindings) => EmailClient;

let runnerImpl: Runner = ({ baseUrl, badgeSecret }) => runConformance({ baseUrl, badgeSecret });
let emailFactoryImpl: EmailFactory = (env) => makeResendClient(env.RESEND_API_KEY);

export function setRunner(r: Runner): void { runnerImpl = r; }
export function setEmailFactory(f: EmailFactory): void { emailFactoryImpl = f; }

type AgentRow = {
  health_status: AgentHealthState['status'];
  consecutive_failures: number;
  last_verified_at: number | null;
};

async function processOne(env: Bindings, msg: VerifyMessage): Promise<void> {
  const { agentId, baseUrl } = msg;
  const now = Math.floor(Date.now() / 1000);

  let result: ConformanceResult;
  try {
    result = await runnerImpl({ baseUrl, badgeSecret: env.BADGE_SIGNING_SECRET });
  } catch (err) {
    result = {
      passed: false,
      testsPassed: 0,
      testsFailed: 1,
      packs: [],
      errorSummary: `runner error: ${err instanceof Error ? err.message : String(err)}`,
      signedBadge: {
        agentId,
        protocolVersion: '0.1',
        tierDetected: 'lite',
        packsPassed: [],
        testsPassed: 0,
        testsFailed: 1,
        signedAt: new Date(now * 1000).toISOString(),
        signature: '',
      },
    };
  }

  const prev = await env.DB
    .prepare(
      'SELECT health_status, consecutive_failures, last_verified_at FROM agents WHERE id = ?',
    )
    .bind(agentId)
    .first<AgentRow>();

  if (!prev) return; // agent was deleted between enqueue and process

  const isFirstEverRun = prev.last_verified_at == null;
  const prevState: AgentHealthState | null = isFirstEverRun
    ? null
    : { status: prev.health_status, consecutiveFailures: prev.consecutive_failures };
  const t = transition(prevState, result.passed);

  await env.DB.batch([
    env.DB
      .prepare(
        'INSERT INTO badge_runs (id, agent_id, ran_at, passed, tests_passed, tests_failed, packs, error_summary, signed_badge) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        ulid(),
        agentId,
        now,
        result.passed ? 1 : 0,
        result.testsPassed,
        result.testsFailed,
        JSON.stringify(result.packs),
        result.errorSummary ?? null,
        JSON.stringify(result.signedBadge),
      ),
    env.DB
      .prepare(
        'UPDATE agents SET health_status = ?, consecutive_failures = ?, last_verified_at = ?, updated_at = ? WHERE id = ?',
      )
      .bind(t.next.status, t.next.consecutiveFailures, now, now, agentId),
  ]);

  if (t.emails.length === 0) return;

  const owner = await env.DB
    .prepare('SELECT a.email FROM accounts a JOIN agents g ON g.account_id = a.id WHERE g.id = ?')
    .bind(agentId)
    .first<{ email: string }>();
  if (!owner) return;

  const email = emailFactoryImpl(env);
  for (const e of t.emails) {
    if (e.kind === 'verification_passed') {
      await email.sendVerificationPassed({ to: owner.email, agentId });
    } else {
      await email.sendHealthTransition({ to: owner.email, agentId, kind: e.kind });
    }
    await env.DB
      .prepare(
        "INSERT INTO email_log (id, account_id, kind, sent_at, provider_id) SELECT ?, account_id, ?, ?, ? FROM agents WHERE id = ?",
      )
      .bind(ulid(), e.kind, now, '', agentId)
      .run();
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(null, { status: 204 });
  },
  async queue(batch: MessageBatch<VerifyMessage>, env: Bindings): Promise<void> {
    for (const m of batch.messages) {
      try {
        await processOne(env, m.body);
        m.ack();
      } catch (err) {
        console.error('verifier failed', m.body, err);
        m.retry();
      }
    }
  },
};
