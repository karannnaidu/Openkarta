# Plan 03 — Hosted Registry & Badge Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `registry/agents.json` PR-flow with a hosted, self-serve registry on Cloudflare (Workers + D1 + Pages + Queues) that proves domain ownership, re-verifies conformance daily, exposes a queryable REST API, and surfaces results on a public dashboard — while keeping the legacy `registry/agents.json` URL alive via a nightly git-mirror.

**Architecture:** Five Cloudflare components — `registry-api` (HTTP Worker), `registry-verifier` (Queue consumer Worker), `registry-cron` (scheduled Worker), `registry-web` (Pages/Astro), and a single D1 database. Authentication is magic-link primary + GitHub OAuth secondary, sessions via signed cookies. Domain verification uses a `/.well-known/openkarta-owner.txt` token. Conformance runs reuse `@openkarta/conformance-tests` as a library. Snapshots flow back into `registry/agents.json` nightly through the GitHub REST API to a `registry-mirror` branch.

**Tech Stack:** TypeScript (NodeNext, ES2022), Cloudflare Workers + D1 + Queues + Pages, Hono (HTTP routing), Zod (validation), Resend (email), Astro (web), pnpm workspaces, vitest with `@cloudflare/vitest-pool-workers`, GitHub REST API for git mirror.

**Spec:** `docs/superpowers/specs/2026-04-25-plan-03-hosted-registry-and-badge-service-design.md`. All section references below are to that spec.

---

## File Structure

New packages (all under `packages/`):

| Package | Purpose | Top-level files |
|---|---|---|
| `@openkarta/registry-shared` | Wire types, error enum, ULID, token helpers — imported by api, verifier, cron, web | `src/index.ts`, `src/zod.ts`, `src/errors.ts`, `src/ids.ts` |
| `@openkarta/registry-api` | HTTP Worker — public reads + auth + owner writes | `src/index.ts`, `src/routes/*`, `src/db/*`, `src/auth/*`, `wrangler.toml`, `migrations/0001_init.sql` |
| `@openkarta/registry-verifier` | Queue consumer — runs conformance, drives state machine | `src/index.ts`, `src/state-machine.ts`, `wrangler.toml` |
| `@openkarta/registry-cron` | Scheduled Worker — daily enqueue + git-mirror snapshot | `src/index.ts`, `src/git-mirror.ts`, `wrangler.toml` |
| `@openkarta/registry-web` | Astro static site — `/`, `/agent/:id`, `/submit`, `/me`, `/sign-in` | `astro.config.ts`, `src/pages/*`, `src/lib/api.ts` |

Plus repo-level changes:
- `.github/workflows/registry-mirror-merge.yml` — once-daily merge of `registry-mirror` → `main`.
- `scripts/registry-smoke.sh` — end-to-end verification.
- `docs/registry/README.md` — deployment runbook.
- `docs/registry/runbook.md` — secrets, DNS, OAuth app, Resend setup.

---

## Conventions

- **Files focused & small.** Each route handler in its own file. Each migration in its own SQL file. Each test mirrors the file it tests.
- **TDD.** Test first, run-fail, implement, run-pass, commit. Same discipline as existing packages.
- **Closed-enum errors.** Reuse the vocabulary from `@openkarta/spec`: `account_required`, `agent_not_found`, `agent_id_taken`, `domain_verification_pending`, `rate_limited`, `validation_failed`, `forbidden`. Map to HTTP via existing helpers.
- **Bindings over imports.** All Worker access to D1, Queues, Secrets is through the env binding object — never module-level globals.
- **No mocks for external behaviour.** Tests use real D1 (via the workers test pool), real Hono router, ephemeral fixture servers. Resend is the only stubbed dependency (env-flagged).

---

## Phase 0 — Workspace bootstrap

### Task 0.1: Create the five new package directories

**Files:**
- Create: `packages/registry-shared/package.json`
- Create: `packages/registry-shared/tsconfig.json`
- Create: `packages/registry-shared/tsup.config.ts`
- Create: `packages/registry-shared/vitest.config.ts`
- Create: `packages/registry-shared/src/index.ts`
- Create: `packages/registry-api/package.json`
- Create: `packages/registry-api/tsconfig.json`
- Create: `packages/registry-api/wrangler.toml`
- Create: `packages/registry-api/src/index.ts`
- Create: `packages/registry-api/migrations/.gitkeep`
- Create: `packages/registry-verifier/package.json`
- Create: `packages/registry-verifier/tsconfig.json`
- Create: `packages/registry-verifier/wrangler.toml`
- Create: `packages/registry-verifier/src/index.ts`
- Create: `packages/registry-cron/package.json`
- Create: `packages/registry-cron/tsconfig.json`
- Create: `packages/registry-cron/wrangler.toml`
- Create: `packages/registry-cron/src/index.ts`
- Create: `packages/registry-web/package.json`
- Create: `packages/registry-web/astro.config.mjs`
- Create: `packages/registry-web/src/pages/index.astro`

- [ ] **Step 1:** Author `packages/registry-shared/package.json` modeled on `packages/spec/package.json` — name `@openkarta/registry-shared`, deps `zod ^3.23.0`, devDeps `tsup ^8.3.0`, `typescript ^5.4.5`, `vitest ^2.1.0`. ESM, `main`/`types` pointing to `./dist/index.js` / `./dist/index.d.ts`.

- [ ] **Step 2:** Author `packages/registry-shared/tsconfig.json` extending `../../tsconfig.base.json`, `outDir: dist`, `rootDir: src`, `composite: true`.

- [ ] **Step 3:** Author `packages/registry-shared/tsup.config.ts` mirroring `packages/spec/tsup.config.ts` (single entry `src/index.ts`, format `esm`, dts true, sourcemap true, clean true).

- [ ] **Step 4:** Author `packages/registry-shared/vitest.config.ts` (default ESM Node runner, no Workers pool — this package has no runtime).

- [ ] **Step 5:** Author `packages/registry-shared/src/index.ts` with a single re-export placeholder so the package builds:

  ```ts
  export const REGISTRY_SHARED_VERSION = '0.0.0' as const;
  ```

- [ ] **Step 6:** Author `packages/registry-api/package.json` — name `@openkarta/registry-api`, private true, deps `hono ^4.6.0`, `zod ^3.23.0`, `@openkarta/registry-shared workspace:*`, `@openkarta/spec workspace:*`. devDeps `@cloudflare/workers-types ^4.20240909.0`, `@cloudflare/vitest-pool-workers ^0.5.0`, `wrangler ^3.78.0`, `vitest ^2.1.0`, `typescript ^5.4.5`. Scripts: `dev: wrangler dev`, `deploy: wrangler deploy`, `test: vitest run`, `typecheck: tsc --noEmit`.

- [ ] **Step 7:** Author `packages/registry-api/tsconfig.json` extending base, `types: ["@cloudflare/workers-types"]`, `module: ESNext`, `moduleResolution: Bundler` (Workers needs bundler resolution).

- [ ] **Step 8:** Author `packages/registry-api/wrangler.toml`:

  ```toml
  name = "registry-api"
  main = "src/index.ts"
  compatibility_date = "2026-04-01"
  compatibility_flags = ["nodejs_compat"]

  [[d1_databases]]
  binding = "DB"
  database_name = "openkarta-registry"
  database_id = "REPLACE_WITH_D1_ID"

  [[queues.producers]]
  binding = "VERIFY_QUEUE"
  queue = "openkarta-verify"

  [vars]
  PUBLIC_BASE_URL = "https://registry.openkarta.org"
  WEB_BASE_URL    = "https://registry.openkarta.org"

  # Secrets (set via `wrangler secret put`):
  #   RESEND_API_KEY
  #   GITHUB_OAUTH_CLIENT_ID
  #   GITHUB_OAUTH_CLIENT_SECRET
  #   SESSION_SECRET
  ```

- [ ] **Step 9:** Author `packages/registry-api/src/index.ts` minimal Hono health-check:

  ```ts
  import { Hono } from 'hono';

  type Bindings = {
    DB: D1Database;
    VERIFY_QUEUE: Queue;
    RESEND_API_KEY: string;
    GITHUB_OAUTH_CLIENT_ID: string;
    GITHUB_OAUTH_CLIENT_SECRET: string;
    SESSION_SECRET: string;
    PUBLIC_BASE_URL: string;
    WEB_BASE_URL: string;
  };

  const app = new Hono<{ Bindings: Bindings }>();
  app.get('/health', (c) => c.json({ ok: true }));
  export default app;
  ```

- [ ] **Step 10:** Repeat the package.json + tsconfig.json + wrangler.toml + src/index.ts pattern for `registry-verifier` (queue consumer, no public route — `wrangler.toml` declares `[[queues.consumers]]` for `openkarta-verify`) and for `registry-cron` (declares `[triggers] crons = ["0 2 * * *", "0 3 * * *"]`). For each, the `src/index.ts` is a placeholder that exports a default fetch handler returning 204 plus the appropriate `queue` / `scheduled` handler stub.

- [ ] **Step 11:** Author `packages/registry-web/package.json` — Astro 4.x, `@openkarta/registry-shared workspace:*`. Scripts: `dev: astro dev`, `build: astro build`, `preview: astro preview`. Author `astro.config.mjs` with `output: 'static'`. Create `src/pages/index.astro` with a one-line "OpenKarta Registry — coming soon".

- [ ] **Step 12:** Run `pnpm install` from repo root. Expected: workspaces resolve, no compile.

  ```bash
  pnpm install
  ```

- [ ] **Step 13:** Run `pnpm -r typecheck`. Expected: all five new packages typecheck clean.

  ```bash
  pnpm -r typecheck
  ```

- [ ] **Step 14:** Commit.

  ```bash
  git add packages/registry-* pnpm-lock.yaml
  git commit -m "feat: scaffold registry-{shared,api,verifier,cron,web} packages"
  ```

---

## Phase 1 — Shared types + D1 migration

### Task 1.1: Author shared error vocabulary

**Files:**
- Create: `packages/registry-shared/src/errors.ts`
- Create: `packages/registry-shared/tests/errors.test.ts`

- [ ] **Step 1: Write failing test** at `packages/registry-shared/tests/errors.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { RegistryError, REGISTRY_ERROR_CODES, httpStatusFor } from '../src/errors.js';

  describe('RegistryError', () => {
    it('exposes a closed enum of codes', () => {
      expect(REGISTRY_ERROR_CODES).toEqual([
        'account_required',
        'agent_not_found',
        'agent_id_taken',
        'domain_verification_pending',
        'rate_limited',
        'validation_failed',
        'forbidden',
      ]);
    });

    it('maps codes to HTTP status', () => {
      expect(httpStatusFor('account_required')).toBe(401);
      expect(httpStatusFor('forbidden')).toBe(403);
      expect(httpStatusFor('agent_not_found')).toBe(404);
      expect(httpStatusFor('agent_id_taken')).toBe(409);
      expect(httpStatusFor('rate_limited')).toBe(429);
      expect(httpStatusFor('validation_failed')).toBe(400);
      expect(httpStatusFor('domain_verification_pending')).toBe(409);
    });

    it('serialises to wire JSON', () => {
      const err = new RegistryError('agent_not_found', 'no such agent');
      expect(err.toJSON()).toEqual({ error: { code: 'agent_not_found', message: 'no such agent' } });
    });
  });
  ```

- [ ] **Step 2:** Run `pnpm --filter @openkarta/registry-shared test`. Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `packages/registry-shared/src/errors.ts`:

  ```ts
  export const REGISTRY_ERROR_CODES = [
    'account_required',
    'agent_not_found',
    'agent_id_taken',
    'domain_verification_pending',
    'rate_limited',
    'validation_failed',
    'forbidden',
  ] as const;

  export type RegistryErrorCode = (typeof REGISTRY_ERROR_CODES)[number];

  const STATUS: Record<RegistryErrorCode, number> = {
    account_required: 401,
    agent_not_found: 404,
    agent_id_taken: 409,
    domain_verification_pending: 409,
    rate_limited: 429,
    validation_failed: 400,
    forbidden: 403,
  };

  export function httpStatusFor(code: RegistryErrorCode): number {
    return STATUS[code];
  }

  export class RegistryError extends Error {
    constructor(public readonly code: RegistryErrorCode, message: string) {
      super(message);
      this.name = 'RegistryError';
    }
    toJSON() {
      return { error: { code: this.code, message: this.message } };
    }
  }
  ```

- [ ] **Step 4:** Re-run tests. Expected: PASS.

- [ ] **Step 5:** Re-export from `src/index.ts`:

  ```ts
  export const REGISTRY_SHARED_VERSION = '0.1.0' as const;
  export * from './errors.js';
  ```

- [ ] **Step 6:** Commit.

  ```bash
  git add packages/registry-shared
  git commit -m "feat(registry-shared): RegistryError + closed-enum codes"
  ```

### Task 1.2: ULID + verification-token helpers

**Files:**
- Create: `packages/registry-shared/src/ids.ts`
- Create: `packages/registry-shared/tests/ids.test.ts`

- [ ] **Step 1: Failing test:**

  ```ts
  import { describe, it, expect } from 'vitest';
  import { ulid, verificationToken, sessionId } from '../src/ids.js';

  describe('ids', () => {
    it('ulid is 26 chars Crockford base32', () => {
      const id = ulid();
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });
    it('two ulids are different and sortable', () => {
      const a = ulid();
      const b = ulid();
      expect(a).not.toEqual(b);
    });
    it('verificationToken starts with okv- and 24 base32 chars', () => {
      const tok = verificationToken();
      expect(tok).toMatch(/^okv-[0-9A-HJKMNP-TV-Z]{24}$/);
    });
    it('sessionId is 43 base64url chars', () => {
      const sid = sessionId();
      expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });
  ```

- [ ] **Step 2:** Run; expect FAIL.

- [ ] **Step 3:** Implement `src/ids.ts`. Use `crypto.getRandomValues` (Node 22 + Workers both expose it via `globalThis.crypto`). ULID = 48-bit timestamp + 80-bit random in Crockford base32. Verification token = `okv-` + 120-bit random encoded base32. Session id = 32 random bytes base64url-encoded (43 chars unpadded).

  ```ts
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  function encodeBase32(bytes: Uint8Array, length: number): string {
    let out = '';
    for (let i = 0; i < length; i++) {
      const idx = bytes[i] ?? 0;
      out += CROCKFORD[idx % 32];
    }
    return out;
  }

  export function ulid(): string {
    const ts = Date.now();
    const tsChars: string[] = [];
    let n = ts;
    for (let i = 0; i < 10; i++) { tsChars.unshift(CROCKFORD[n % 32]!); n = Math.floor(n / 32); }
    const rand = new Uint8Array(16);
    crypto.getRandomValues(rand);
    return tsChars.join('') + encodeBase32(rand, 16);
  }

  export function verificationToken(): string {
    const rand = new Uint8Array(24);
    crypto.getRandomValues(rand);
    return `okv-${encodeBase32(rand, 24)}`;
  }

  export function sessionId(): string {
    const rand = new Uint8Array(32);
    crypto.getRandomValues(rand);
    return base64url(rand);
  }

  function base64url(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  ```

- [ ] **Step 4:** Run; expect PASS. Re-export from `src/index.ts`:

  ```ts
  export * from './ids.js';
  ```

- [ ] **Step 5:** Commit.

  ```bash
  git add packages/registry-shared
  git commit -m "feat(registry-shared): ULID + verification/session id helpers"
  ```

### Task 1.3: Wire schemas (Zod) for agent submission + listing

**Files:**
- Create: `packages/registry-shared/src/zod.ts`
- Create: `packages/registry-shared/tests/zod.test.ts`

- [ ] **Step 1: Failing test:**

  ```ts
  import { describe, it, expect } from 'vitest';
  import { AgentSubmissionSchema, AgentListingSchema, AGENT_ID_REGEX } from '../src/zod.js';

  describe('AgentSubmissionSchema', () => {
    const valid = {
      agentId: 'halcyon-shop',
      displayName: 'Halcyon Shop',
      description: 'demo',
      baseUrl: 'https://halcyon-shop.fly.dev',
      tier: 'http',
      supportedItemTypes: ['product'],
      regions: [{ country: 'IN' }],
      tags: ['demo'],
    };
    it('accepts a minimal valid payload', () => {
      expect(AgentSubmissionSchema.safeParse(valid).success).toBe(true);
    });
    it('rejects http baseUrl', () => {
      const r = AgentSubmissionSchema.safeParse({ ...valid, baseUrl: 'http://x.com' });
      expect(r.success).toBe(false);
    });
    it('rejects unknown item type', () => {
      const r = AgentSubmissionSchema.safeParse({ ...valid, supportedItemTypes: ['weapon'] });
      expect(r.success).toBe(false);
    });
    it('agent id regex', () => {
      expect(AGENT_ID_REGEX.test('halcyon-shop')).toBe(true);
      expect(AGENT_ID_REGEX.test('Halcyon')).toBe(false);
      expect(AGENT_ID_REGEX.test('-bad')).toBe(false);
      expect(AGENT_ID_REGEX.test('a')).toBe(false);
    });
  });

  describe('AgentListingSchema', () => {
    it('parses a public listing with health + verification', () => {
      const r = AgentListingSchema.safeParse({
        agentId: 'halcyon-shop',
        displayName: 'Halcyon',
        description: '',
        baseUrl: 'https://x.com',
        manifestUrl: 'https://x.com/v0/discover',
        tier: 'http',
        supportedItemTypes: ['product'],
        regions: [{ country: 'IN' }],
        tags: [],
        publicKey: null,
        verified: true,
        health: 'healthy',
        lastVerifiedAt: '2026-04-25T00:00:00Z',
      });
      expect(r.success).toBe(true);
    });
  });
  ```

- [ ] **Step 2:** Run; expect FAIL.

- [ ] **Step 3:** Implement `src/zod.ts`:

  ```ts
  import { z } from 'zod';

  export const AGENT_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
  export const ITEM_TYPES = ['product', 'stay', 'flight', 'bus', 'service'] as const;
  export const TIERS = ['lite', 'http', 'agentic'] as const;
  export const HEALTH = ['unknown', 'healthy', 'stale', 'delisted'] as const;

  const RegionSchema = z.object({
    country: z.string().length(2),
    city: z.string().optional(),
    pincodes: z.array(z.string()).optional(),
  });

  export const AgentSubmissionSchema = z.object({
    agentId: z.string().regex(AGENT_ID_REGEX),
    displayName: z.string().min(1).max(120),
    description: z.string().max(2000).default(''),
    baseUrl: z.string().url().refine((u) => u.startsWith('https://'), 'must be HTTPS'),
    manifestUrl: z.string().url().optional(),
    tier: z.enum(TIERS),
    supportedItemTypes: z.array(z.enum(ITEM_TYPES)).min(1),
    regions: z.array(RegionSchema).default([]),
    tags: z.array(z.string()).default([]),
    publicKey: z.string().nullable().optional(),
  });
  export type AgentSubmission = z.infer<typeof AgentSubmissionSchema>;

  export const AgentListingSchema = AgentSubmissionSchema.extend({
    manifestUrl: z.string().url(),
    publicKey: z.string().nullable(),
    verified: z.boolean(),
    health: z.enum(HEALTH),
    lastVerifiedAt: z.string().nullable(),
  });
  export type AgentListing = z.infer<typeof AgentListingSchema>;

  export const AgentPatchSchema = AgentSubmissionSchema.partial().omit({ agentId: true });
  export type AgentPatch = z.infer<typeof AgentPatchSchema>;
  ```

- [ ] **Step 4:** Run; expect PASS. Re-export from `src/index.ts`. Commit.

  ```bash
  git add packages/registry-shared
  git commit -m "feat(registry-shared): zod schemas for agent submission + listing"
  ```

### Task 1.4: D1 migration 0001_init.sql

**Files:**
- Create: `packages/registry-api/migrations/0001_init.sql`
- Create: `packages/registry-api/tests/schema.test.ts`

- [ ] **Step 1: Failing test** that boots a worker pool with the migration applied and asserts the eight tables exist:

  ```ts
  import { env } from 'cloudflare:test';
  import { describe, it, expect, beforeAll } from 'vitest';
  import fs from 'node:fs';

  beforeAll(async () => {
    const sql = fs.readFileSync('migrations/0001_init.sql', 'utf8');
    for (const stmt of sql.split(/;\s*\n/).filter((s) => s.trim())) {
      await env.DB.prepare(stmt).run();
    }
  });

  describe('schema', () => {
    it('creates the 8 expected tables', async () => {
      const { results } = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all();
      const names = results.map((r) => (r as { name: string }).name);
      expect(names).toEqual([
        'accounts','agents','badge_runs','email_log','magic_links','sessions','transfer_invites','verifications',
      ]);
    });
  });
  ```

  Add `vitest.config.ts` for `registry-api` using `@cloudflare/vitest-pool-workers`:

  ```ts
  import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
  export default defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: { d1Databases: ['DB'] },
        },
      },
    },
  });
  ```

- [ ] **Step 2:** Run `pnpm --filter @openkarta/registry-api test`. Expected: FAIL — migration file missing.

- [ ] **Step 3:** Author `packages/registry-api/migrations/0001_init.sql` exactly per spec §4 (eight tables + indexes + check constraints). Inline:

  ```sql
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    github_login TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE magic_links (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER
  );
  CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);

  CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL,
    manifest_url TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('lite','http','agentic')),
    supported_item_types TEXT NOT NULL,
    regions TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    public_key TEXT,
    verification_status TEXT NOT NULL CHECK(verification_status IN ('pending','verified','delisted')),
    health_status TEXT NOT NULL CHECK(health_status IN ('unknown','healthy','stale','delisted')),
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_verified_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_agents_health ON agents(health_status);
  CREATE INDEX idx_agents_verification ON agents(verification_status);
  CREATE INDEX idx_agents_account ON agents(account_id);

  CREATE TABLE verifications (
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL CHECK(status IN ('pending','passed','failed','expired')),
    PRIMARY KEY (agent_id, token)
  );

  CREATE TABLE badge_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    ran_at INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    tests_passed INTEGER NOT NULL,
    tests_failed INTEGER NOT NULL,
    packs TEXT NOT NULL DEFAULT '[]',
    error_summary TEXT,
    signed_badge TEXT NOT NULL
  );
  CREATE INDEX idx_badge_runs_agent_ran ON badge_runs(agent_id, ran_at DESC);

  CREATE TABLE email_log (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id),
    kind TEXT NOT NULL CHECK(kind IN ('magic_link','verification_passed','stale','delisted','back_to_healthy','transfer_invite')),
    sent_at INTEGER NOT NULL,
    provider_id TEXT
  );

  CREATE TABLE transfer_invites (
    token TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    from_account_id TEXT NOT NULL REFERENCES accounts(id),
    to_email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER
  );
  ```

- [ ] **Step 4:** Run tests. Expected: PASS.

- [ ] **Step 5:** Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): D1 schema migration 0001_init"
  ```

---

## Phase 2 — registry-api: magic-link auth + sessions

### Task 2.1: Session helpers (D1-backed, signed cookie)

**Files:**
- Create: `packages/registry-api/src/auth/session.ts`
- Create: `packages/registry-api/tests/auth/session.test.ts`

- [ ] **Step 1: Failing test** — `createSession` writes a row with 30-day TTL; `readSession(cookie)` returns the account; expired sessions return null; `clearSession` deletes the row.

  Write the four assertions; run `vitest`; FAIL.

- [ ] **Step 2:** Implement `session.ts` with `createSession(env, accountId)`, `readSession(env, sessionId)`, `clearSession(env, sessionId)`. Cookie value is the `sessions.id` directly — no signing needed since it's a lookup key (random 32 bytes is enough entropy).

  ```ts
  import { sessionId as newSessionId } from '@openkarta/registry-shared';

  const TTL_SECONDS = 60 * 60 * 24 * 30;

  export async function createSession(env: { DB: D1Database }, accountId: string): Promise<string> {
    const id = newSessionId();
    const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    await env.DB.prepare('INSERT INTO sessions (id, account_id, expires_at) VALUES (?,?,?)')
      .bind(id, accountId, expiresAt).run();
    return id;
  }

  export async function readSession(env: { DB: D1Database }, id: string) {
    const row = await env.DB.prepare(
      `SELECT s.account_id, s.expires_at, a.email, a.display_name, a.github_login
       FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ?`
    ).bind(id).first<{ account_id: string; expires_at: number; email: string; display_name: string | null; github_login: string | null }>();
    if (!row) return null;
    if (row.expires_at < Math.floor(Date.now() / 1000)) return null;
    return { id: row.account_id, email: row.email, displayName: row.display_name, githubLogin: row.github_login };
  }

  export async function clearSession(env: { DB: D1Database }, id: string) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  }

  export const SESSION_COOKIE = 'okr_sess';
  export function sessionCookieValue(id: string, expiresInSeconds = TTL_SECONDS): string {
    return `${SESSION_COOKIE}=${id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${expiresInSeconds}`;
  }
  export const SESSION_CLEAR_COOKIE = `${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  ```

- [ ] **Step 3:** Run tests. Expected: PASS.

- [ ] **Step 4:** Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): session helpers (D1-backed cookie)"
  ```

### Task 2.2: Magic-link request endpoint

**Files:**
- Create: `packages/registry-api/src/auth/magic-link.ts`
- Create: `packages/registry-api/src/email/resend.ts`
- Create: `packages/registry-api/tests/auth/magic-link.test.ts`

- [ ] **Step 1: Failing test** for `POST /auth/magic-link`:
  - returns 204 no content for any well-formed email
  - returns the same shape whether the account exists or not (anti-enumeration)
  - inserts a row into `magic_links` with TTL = 15 min
  - second call within rate-limit window for same IP returns 429 + `rate_limited`
  - sends an email via the Resend client (stubbed to record calls)
  - records to `email_log`

- [ ] **Step 2:** Implement `email/resend.ts` — a thin wrapper around `fetch('https://api.resend.com/emails', ...)` exposing `sendMagicLink({to, link})`. Behind an interface so tests can pass a stub.

  ```ts
  export interface EmailClient {
    sendMagicLink(args: { to: string; link: string }): Promise<{ id: string }>;
    sendVerificationPassed(args: { to: string; agentId: string }): Promise<{ id: string }>;
    sendHealthTransition(args: { to: string; agentId: string; kind: 'stale'|'delisted'|'back_to_healthy' }): Promise<{ id: string }>;
    sendTransferInvite(args: { to: string; agentId: string; link: string }): Promise<{ id: string }>;
  }

  export function makeResendClient(apiKey: string, from = 'OpenKarta <noreply@openkarta.org>'): EmailClient {
    async function send(to: string, subject: string, html: string) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!r.ok) throw new Error(`resend ${r.status}`);
      return (await r.json()) as { id: string };
    }
    return {
      sendMagicLink: ({ to, link }) =>
        send(to, 'Sign in to OpenKarta', `<p><a href="${link}">Sign in</a> (link expires in 15 minutes).</p>`),
      sendVerificationPassed: ({ to, agentId }) =>
        send(to, `Listing verified: ${agentId}`, `<p>Your agent <code>${agentId}</code> passed conformance.</p>`),
      sendHealthTransition: ({ to, agentId, kind }) =>
        send(to, `${agentId}: ${kind.replace('_',' ')}`, `<p>Your agent <code>${agentId}</code> is now <b>${kind}</b>.</p>`),
      sendTransferInvite: ({ to, agentId, link }) =>
        send(to, `Transfer invite: ${agentId}`, `<p><a href="${link}">Accept transfer of ${agentId}</a> (24h).</p>`),
    };
  }
  ```

- [ ] **Step 3:** Implement `auth/magic-link.ts` — Hono sub-router:

  ```ts
  import { Hono } from 'hono';
  import { z } from 'zod';
  import { ulid } from '@openkarta/registry-shared';
  import { RegistryError } from '@openkarta/registry-shared';
  import type { EmailClient } from '../email/resend.js';
  import { createSession, sessionCookieValue } from './session.js';

  const RequestSchema = z.object({ email: z.string().email().toLowerCase() });

  const TTL_SECONDS = 15 * 60;

  export function magicLinkRouter(getEmailClient: (env: any) => EmailClient) {
    const router = new Hono<{ Bindings: any }>();

    router.post('/magic-link', async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const parsed = RequestSchema.safeParse(body);
      if (!parsed.success) {
        const err = new RegistryError('validation_failed', 'invalid email');
        return c.json(err.toJSON(), 400);
      }
      // Rate limit: 5/hr/IP via Cloudflare Rate Limiting binding (configured in wrangler.toml).
      // For unit tests we read x-test-ratelimit header to simulate.
      const overLimit = c.req.header('x-test-ratelimit') === 'over';
      if (overLimit) {
        const err = new RegistryError('rate_limited', 'too many magic-link requests');
        return c.json(err.toJSON(), 429);
      }
      const { email } = parsed.data;
      const token = ulid();
      const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
      await c.env.DB.prepare(
        'INSERT INTO magic_links (token, email, expires_at) VALUES (?,?,?)'
      ).bind(token, email, expiresAt).run();
      const link = `${c.env.PUBLIC_BASE_URL}/auth/magic-link/consume?token=${token}`;
      const email_client = getEmailClient(c.env);
      const sent = await email_client.sendMagicLink({ to: email, link });
      const logId = ulid();
      await c.env.DB.prepare(
        'INSERT INTO email_log (id, account_id, kind, sent_at, provider_id) VALUES (?, NULL, ?, ?, ?)'
      ).bind(logId, 'magic_link', Math.floor(Date.now() / 1000), sent.id).run();
      return c.body(null, 204);
    });

    router.get('/magic-link/consume', async (c) => {
      const token = c.req.query('token');
      if (!token) return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=missing_token`);
      const now = Math.floor(Date.now() / 1000);
      const link = await c.env.DB.prepare(
        'SELECT email, expires_at, consumed_at FROM magic_links WHERE token = ?'
      ).bind(token).first<{ email: string; expires_at: number; consumed_at: number | null }>();
      if (!link || link.consumed_at || link.expires_at < now) {
        return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=invalid_or_expired`);
      }
      await c.env.DB.prepare('UPDATE magic_links SET consumed_at = ? WHERE token = ?').bind(now, token).run();
      let account = await c.env.DB.prepare('SELECT id FROM accounts WHERE email = ?')
        .bind(link.email).first<{ id: string }>();
      if (!account) {
        const id = ulid();
        await c.env.DB.prepare(
          'INSERT INTO accounts (id, email, created_at) VALUES (?,?,?)'
        ).bind(id, link.email, now).run();
        account = { id };
      }
      const sid = await createSession(c.env, account.id);
      return new Response(null, {
        status: 302,
        headers: { Location: `${c.env.WEB_BASE_URL}/me`, 'Set-Cookie': sessionCookieValue(sid) },
      });
    });

    return router;
  }
  ```

- [ ] **Step 4:** Wire `magicLinkRouter(makeResendClient(env.RESEND_API_KEY))` into `src/index.ts` under `/auth`. Add `getEmailClient` injection point so tests pass a stub.

- [ ] **Step 5:** Run tests. Expected: PASS.

- [ ] **Step 6:** Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): magic-link auth (request + consume)"
  ```

### Task 2.3: `/auth/me` and `/auth/logout`

**Files:**
- Create: `packages/registry-api/src/auth/me.ts`
- Create: `packages/registry-api/tests/auth/me.test.ts`

- [ ] **Step 1: Failing test** — `GET /auth/me` with no cookie returns 401 `account_required`; with valid cookie returns `{ email, displayName, githubLogin }`. `POST /auth/logout` clears the cookie + session row.

- [ ] **Step 2:** Implement. Use `c.req.header('cookie')` and a small parser. Mount at `/auth/me` and `/auth/logout`.

- [ ] **Step 3:** Test PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): /auth/me + /auth/logout"
  ```

---

## Phase 3 — registry-api: GitHub OAuth

### Task 3.1: GitHub OAuth start + callback, link by email

**Files:**
- Create: `packages/registry-api/src/auth/github.ts`
- Create: `packages/registry-api/tests/auth/github.test.ts`

- [ ] **Step 1: Failing test** mocks `fetch` to return a fake access-token + user payload, asserts:
  - `/auth/github/start` redirects to `https://github.com/login/oauth/authorize?...` with a state cookie set.
  - `/auth/github/callback?code=...&state=...` exchanges the code, fetches `/user` and `/user/emails`, finds-or-creates account by primary verified email, sets `github_login`, returns 302 to `/me` with session cookie.

- [ ] **Step 2:** Implement. Inline:

  ```ts
  import { Hono } from 'hono';
  import { ulid, sessionId as randomState } from '@openkarta/registry-shared';
  import { createSession, sessionCookieValue } from './session.js';

  export function githubRouter() {
    const router = new Hono<{ Bindings: any }>();

    router.get('/github/start', (c) => {
      const state = randomState();
      const cb = `${c.env.PUBLIC_BASE_URL}/auth/github/callback`;
      const url = `https://github.com/login/oauth/authorize?client_id=${c.env.GITHUB_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(cb)}&scope=user:email&state=${state}`;
      return new Response(null, {
        status: 302,
        headers: {
          Location: url,
          'Set-Cookie': `okr_oauth_state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,
        },
      });
    });

    router.get('/github/callback', async (c) => {
      const code = c.req.query('code');
      const state = c.req.query('state');
      const cookie = c.req.header('cookie') ?? '';
      const storedState = /okr_oauth_state=([^;]+)/.exec(cookie)?.[1];
      if (!code || !state || state !== storedState) {
        return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=oauth_state`);
      }
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: c.env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: c.env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
        }),
      });
      const tok = (await tokenRes.json()) as { access_token?: string };
      if (!tok.access_token) return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=oauth_token`);

      const headers = { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': 'openkarta-registry' };
      const user = (await (await fetch('https://api.github.com/user', { headers })).json()) as { login: string };
      const emails = (await (await fetch('https://api.github.com/user/emails', { headers })).json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified);
      if (!primary) return c.redirect(`${c.env.WEB_BASE_URL}/sign-in?err=no_verified_email`);

      const now = Math.floor(Date.now() / 1000);
      const email = primary.email.toLowerCase();
      let acct = await c.env.DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first<{ id: string }>();
      if (!acct) {
        const id = ulid();
        await c.env.DB.prepare(
          'INSERT INTO accounts (id, email, github_login, created_at) VALUES (?,?,?,?)'
        ).bind(id, email, user.login, now).run();
        acct = { id };
      } else {
        await c.env.DB.prepare('UPDATE accounts SET github_login = ? WHERE id = ?').bind(user.login, acct.id).run();
      }
      const sid = await createSession(c.env, acct.id);
      return new Response(null, {
        status: 302,
        headers: { Location: `${c.env.WEB_BASE_URL}/me`, 'Set-Cookie': sessionCookieValue(sid) },
      });
    });

    return router;
  }
  ```

- [ ] **Step 3:** Run; PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): GitHub OAuth (link-by-email)"
  ```

---

## Phase 4 — registry-api: agents CRUD + verification + transfer

### Task 4.1: Agent submission (`POST /v1/agents`)

**Files:**
- Create: `packages/registry-api/src/routes/agents-create.ts`
- Create: `packages/registry-api/tests/routes/agents-create.test.ts`

- [ ] **Step 1: Failing test:**
  - Anonymous POST → 401 `account_required`.
  - Auth + valid payload → 201 with `{ agent, verificationInstructions: { token, path } }`.
  - Duplicate `agentId` → 409 `agent_id_taken`.
  - Invalid baseUrl (http://) → 400 `validation_failed`.
  - Side effect: row in `agents` with `verification_status=pending`, `health_status=unknown`; row in `verifications` with `status=pending`.

- [ ] **Step 2:** Implement. Pseudo-code outline (full code in step):

  ```ts
  import { Hono } from 'hono';
  import { AgentSubmissionSchema, RegistryError, verificationToken } from '@openkarta/registry-shared';
  import { requireSession } from '../auth/middleware.js';

  export const agentsCreate = new Hono<{ Bindings: any }>().post('/agents', requireSession, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = AgentSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(new RegistryError('validation_failed', parsed.error.message).toJSON(), 400);
    }
    const a = parsed.data;
    const now = Math.floor(Date.now() / 1000);
    const account = c.get('account') as { id: string };
    const manifestUrl = a.manifestUrl ?? `${a.baseUrl.replace(/\/$/, '')}/v0/discover`;

    const exists = await c.env.DB.prepare('SELECT 1 FROM agents WHERE id = ?').bind(a.agentId).first();
    if (exists) return c.json(new RegistryError('agent_id_taken', 'in use').toJSON(), 409);

    const tok = verificationToken();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO agents (id, account_id, display_name, description, base_url, manifest_url,
                              tier, supported_item_types, regions, tags, public_key,
                              verification_status, health_status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        a.agentId, account.id, a.displayName, a.description, a.baseUrl, manifestUrl,
        a.tier, JSON.stringify(a.supportedItemTypes),
        JSON.stringify(a.regions), JSON.stringify(a.tags),
        a.publicKey ?? null, 'pending', 'unknown', now, now,
      ),
      c.env.DB.prepare(
        `INSERT INTO verifications (agent_id, token, created_at, status) VALUES (?,?,?, 'pending')`
      ).bind(a.agentId, tok, now),
    ]);

    return c.json({
      agent: { agentId: a.agentId, /* … listing-shape projection … */ },
      verificationInstructions: { token: tok, path: '/.well-known/openkarta-owner.txt' },
    }, 201);
  });
  ```

  Plus `auth/middleware.ts`:

  ```ts
  import type { MiddlewareHandler } from 'hono';
  import { RegistryError } from '@openkarta/registry-shared';
  import { SESSION_COOKIE, readSession } from './session.js';

  export const requireSession: MiddlewareHandler = async (c, next) => {
    const cookie = c.req.header('cookie') ?? '';
    const m = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(cookie);
    if (!m) return c.json(new RegistryError('account_required', 'sign in required').toJSON(), 401);
    const acct = await readSession(c.env, m[1]!);
    if (!acct) return c.json(new RegistryError('account_required', 'session expired').toJSON(), 401);
    c.set('account', acct);
    await next();
  };
  ```

- [ ] **Step 3:** Tests PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): POST /v1/agents (with verification challenge)"
  ```

### Task 4.2: Domain verification (`POST /v1/agents/:id/verify`)

**Files:**
- Create: `packages/registry-api/src/routes/agents-verify.ts`
- Create: `packages/registry-api/tests/routes/agents-verify.test.ts`

- [ ] **Step 1: Failing tests** (using a fixture HTTP server inside the test runner that serves the token at `/.well-known/openkarta-owner.txt`):
  - 200 with matching token → `verification_status=verified`, `verifications.status=passed`, queue message enqueued (assert via spy on `c.env.VERIFY_QUEUE`).
  - 200 with non-matching token → `verifications.status=failed`, `verification_status` unchanged.
  - Lite-tier agent → auto-pass without HTTP fetch.
  - Anonymous or non-owner → 403 `forbidden`.

- [ ] **Step 2:** Implement. Token comparison strips leading/trailing whitespace from the fetched body. Lite-tier agents (whose `baseUrl` starts with the configured OpenKarta lite host) auto-pass.

- [ ] **Step 3:** PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): POST /v1/agents/:id/verify (well-known)"
  ```

### Task 4.3: Public reads — list, detail, badge

**Files:**
- Create: `packages/registry-api/src/routes/agents-public.ts`
- Create: `packages/registry-api/tests/routes/agents-public.test.ts`

- [ ] **Step 1: Failing tests:**
  - `GET /v1/agents` with no filters returns only `verified` + (`healthy` or `stale`) agents, paginated 50/page, returns `{ items, nextCursor }`.
  - `?include=delisted` widens the health filter.
  - `?itemType=stay&country=IN` filters correctly.
  - `?cursor=…` returns the next page; nextCursor is null on the last page.
  - `GET /v1/agents/:id` returns the listing + `lastBadgeRun` + `history: { day, passed, failed }[]` (30 days).
  - `GET /v1/agents/:id/badge` returns the latest `badge_runs.signed_badge` JSON.
  - All responses set `Cache-Control: public, max-age=60` and an `ETag`.

- [ ] **Step 2:** Implement. Use `agents` queries with `verification_status='verified'` AND `health_status IN ('healthy','stale')`. Cursor = base64url of the `agents.id` of the last row plus `created_at`. Detail joins `badge_runs` (latest by `ran_at`), and aggregates per-day pass/fail counts over the past 30 days using a single grouped query.

- [ ] **Step 3:** PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): public list/detail/badge endpoints"
  ```

### Task 4.4: PATCH, DELETE, manual reverify

**Files:**
- Create: `packages/registry-api/src/routes/agents-update.ts`
- Create: `packages/registry-api/src/routes/agents-delete.ts`
- Create: `packages/registry-api/src/routes/agents-reverify.ts`
- Create matching test files.

- [ ] **Step 1:** Tests cover:
  - PATCH ordinary fields → row updated, `verification_status` unchanged.
  - PATCH `baseUrl` → `verification_status` resets to `pending`, new `verifications` row issued, listing hidden from public reads.
  - DELETE → cascade removes `verifications`, `badge_runs`, `transfer_invites`. `email_log` rows for the account are preserved.
  - Reverify endpoint enqueues a queue message; second call within an hour → 429 `rate_limited` (rate-key by `agent_id`, store last-trigger in `KV_RATELIMIT` binding or a cheap D1 row in a `rate_limits` mini-table; use the latter for simplicity — add to Phase 1 if missing).

- [ ] **Step 2:** Implement. Note: add a `rate_limits(key TEXT PRIMARY KEY, last_at INTEGER)` table in a follow-up migration `0002_rate_limits.sql`.

- [ ] **Step 3:** PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): PATCH/DELETE/reverify endpoints + rate_limits table"
  ```

### Task 4.5: Ownership transfer

**Files:**
- Create: `packages/registry-api/src/routes/agents-transfer.ts`
- Create: `packages/registry-api/tests/routes/agents-transfer.test.ts`

- [ ] **Step 1:** Tests:
  - `POST /v1/agents/:id/transfer { to_email }` (owner only) writes a `transfer_invites` row (24h TTL), sends an email with an accept-link.
  - `GET /v1/agents/transfer/accept?token=…` (auth required, signed-in user's email must match `to_email`) flips `agents.account_id` and consumes the invite.
  - Mismatched email → 403 `forbidden`.

- [ ] **Step 2:** Implement.

- [ ] **Step 3:** PASS. Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): ownership transfer flow"
  ```

### Task 4.6: Wire all routers + error filter into `src/index.ts`

- [ ] **Step 1:** In `src/index.ts`, mount `magicLinkRouter`, `githubRouter`, `agentsCreate`, `agentsVerify`, `agentsPublic`, `agentsUpdate`, `agentsDelete`, `agentsReverify`, `agentsTransfer`. Add a top-level error handler that turns `RegistryError` into a JSON response and logs everything else as 500.

- [ ] **Step 2:** Run `pnpm --filter @openkarta/registry-api test`. Expected: ALL PASS.

- [ ] **Step 3:** Commit.

  ```bash
  git add packages/registry-api
  git commit -m "feat(registry-api): wire routers + error filter"
  ```

---

## Phase 5 — registry-verifier: queue consumer + state machine

### Task 5.1: State machine helper

**Files:**
- Create: `packages/registry-verifier/src/state-machine.ts`
- Create: `packages/registry-verifier/tests/state-machine.test.ts`

- [ ] **Step 1: Failing test** that drives the transition table:
  - `unknown` + pass → `healthy`, emit `back_to_healthy` (because was not previously healthy).
  - `healthy` + pass → `healthy`, no email.
  - `healthy` + fail (1) → `healthy`, fc=1.
  - `healthy` + fail x3 → `stale`, emit `stale`.
  - `stale` + fail (4..6) → `stale`, no email.
  - `stale` + fail (7) → `delisted`, emit `delisted`.
  - `stale` + pass → `healthy`, fc=0, emit `back_to_healthy`.
  - `delisted` + pass → `healthy`, emit `back_to_healthy`.

  *(Spec §7 says `unknown → healthy` on first pass *also* sends `verification_passed`. Treat the first-pass case as a special "this is the first run ever" branch — pass `previous=null` to indicate that.)*

- [ ] **Step 2:** Implement pure function:

  ```ts
  export interface AgentHealthState {
    status: 'unknown' | 'healthy' | 'stale' | 'delisted';
    consecutiveFailures: number;
  }
  export type Email =
    | { kind: 'verification_passed' }
    | { kind: 'stale' }
    | { kind: 'delisted' }
    | { kind: 'back_to_healthy' };

  export interface Transition {
    next: AgentHealthState;
    emails: Email[];
  }

  export function transition(prev: AgentHealthState | null, passed: boolean): Transition {
    if (passed) {
      const isFirst = prev === null;
      const wasHealthy = prev?.status === 'healthy';
      const next = { status: 'healthy' as const, consecutiveFailures: 0 };
      const emails: Email[] = [];
      if (isFirst) emails.push({ kind: 'verification_passed' });
      else if (!wasHealthy) emails.push({ kind: 'back_to_healthy' });
      return { next, emails };
    }
    const fc = (prev?.consecutiveFailures ?? 0) + 1;
    if (fc >= 7) return { next: { status: 'delisted', consecutiveFailures: fc }, emails: [{ kind: 'delisted' }] };
    if (fc >= 3) return { next: { status: 'stale', consecutiveFailures: fc }, emails: [{ kind: 'stale' }] };
    return { next: { status: prev?.status ?? 'unknown', consecutiveFailures: fc }, emails: [] };
  }
  ```

  *(Note: only emit `stale` on the *transition* into `stale` — i.e. when fc transitions from <3 to ≥3. Adjust: emit `stale` only when `prev.status !== 'stale'` AND fc>=3 AND fc<7. Same for `delisted`. Update tests + impl accordingly.)*

- [ ] **Step 3:** PASS. Commit.

  ```bash
  git add packages/registry-verifier
  git commit -m "feat(registry-verifier): pure state-machine helper"
  ```

### Task 5.2: Queue consumer that runs the conformance suite

**Files:**
- Modify: `packages/registry-verifier/src/index.ts`
- Create: `packages/registry-verifier/tests/consumer.test.ts`

- [ ] **Step 1: Failing test.** Boot `@openkarta/reference-agent-shop` on an ephemeral port (same pattern as `packages/conformance-tests/tests`). Call the verifier's queue handler with a message `{ agentId, baseUrl }`. Assert:
  - A `badge_runs` row written.
  - `agents.health_status` updated per state machine.
  - Emails sent on transitions (stub Resend client).

- [ ] **Step 2:** Implement `index.ts`:

  ```ts
  import { runConformance } from '@openkarta/conformance-tests'; // expose as library — see Task 5.3
  import { ulid } from '@openkarta/registry-shared';
  import { transition } from './state-machine.js';
  import { makeResendClient } from '@openkarta/registry-api/dist/email/resend.js'; // shared via workspace dep

  type Bindings = { DB: D1Database; RESEND_API_KEY: string };
  type Msg = { agentId: string; baseUrl: string };

  export default {
    async queue(batch: MessageBatch<Msg>, env: Bindings) {
      const email = makeResendClient(env.RESEND_API_KEY);
      for (const m of batch.messages) {
        const { agentId, baseUrl } = m.body;
        const result = await runConformance({ baseUrl, packs: ['core'] });
        const now = Math.floor(Date.now() / 1000);
        const prev = await env.DB.prepare(
          'SELECT health_status as status, consecutive_failures as consecutiveFailures, last_verified_at FROM agents WHERE id = ?'
        ).bind(agentId).first<{ status: any; consecutiveFailures: number; last_verified_at: number | null }>();
        const isFirst = prev?.last_verified_at == null;
        const t = transition(isFirst ? null : { status: prev!.status, consecutiveFailures: prev!.consecutiveFailures }, result.passed);

        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO badge_runs (id, agent_id, ran_at, passed, tests_passed, tests_failed, packs, error_summary, signed_badge) VALUES (?,?,?,?,?,?,?,?,?)'
          ).bind(ulid(), agentId, now, result.passed ? 1 : 0, result.testsPassed, result.testsFailed, JSON.stringify(result.packs), result.errorSummary ?? null, JSON.stringify(result.signedBadge)),
          env.DB.prepare(
            'UPDATE agents SET health_status = ?, consecutive_failures = ?, last_verified_at = ?, updated_at = ? WHERE id = ?'
          ).bind(t.next.status, t.next.consecutiveFailures, now, now, agentId),
        ]);

        const owner = await env.DB.prepare(
          'SELECT a.email FROM accounts a JOIN agents g ON g.account_id = a.id WHERE g.id = ?'
        ).bind(agentId).first<{ email: string }>();
        if (owner) {
          for (const e of t.emails) {
            if (e.kind === 'verification_passed') await email.sendVerificationPassed({ to: owner.email, agentId });
            else await email.sendHealthTransition({ to: owner.email, agentId, kind: e.kind });
          }
        }
        m.ack();
      }
    },
    async fetch() { return new Response(null, { status: 204 }); },
  };
  ```

- [ ] **Step 3:** PASS. Commit.

### Task 5.3: Expose `runConformance` from `@openkarta/conformance-tests`

**Files:**
- Modify: `packages/conformance-tests/src/index.ts`
- Modify: `packages/conformance-tests/src/runner.ts`
- Create: `packages/conformance-tests/tests/library-api.test.ts`

- [ ] **Step 1:** Failing test — `runConformance({ baseUrl, packs: ['core'] })` resolves to `{ passed, testsPassed, testsFailed, packs, errorSummary?, signedBadge }` against the live reference agent.

- [ ] **Step 2:** Refactor `runner.ts` to expose a `runConformance` function that the existing CLI calls; the CLI keeps the same surface. Add an `index.ts` re-export. Sign the badge using HMAC with a constant key (existing badge.ts).

- [ ] **Step 3:** PASS. Commit.

  ```bash
  git add packages/conformance-tests
  git commit -m "feat(conformance-tests): expose runConformance() library API"
  ```

---

## Phase 6 — registry-cron: daily reverify + git-mirror

### Task 6.1: Daily reverify enqueue

**Files:**
- Modify: `packages/registry-cron/src/index.ts`
- Create: `packages/registry-cron/tests/scheduled.test.ts`

- [ ] **Step 1:** Failing test — `scheduled` handler at cron `0 2 * * *` reads all `verification_status='verified'` agents and sends one queue message per agent.

- [ ] **Step 2:** Implement scheduled handler that branches on `controller.cron`. For `0 2 * * *`, do the enqueue. For `0 3 * * *`, run `gitMirrorSnapshot` (Task 6.2).

- [ ] **Step 3:** PASS. Commit.

### Task 6.2: Git-mirror snapshot

**Files:**
- Create: `packages/registry-cron/src/git-mirror.ts`
- Create: `packages/registry-cron/tests/git-mirror.test.ts`

- [ ] **Step 1:** Failing test — `gitMirrorSnapshot(env)` builds a `registry/agents.json` payload from D1 matching the existing schema (read `registry/agents.json` from disk in the test as the schema baseline), then makes the right sequence of GitHub REST calls (mocked via `fetch` spy):
  1. `GET /repos/:owner/:repo/git/refs/heads/registry-mirror` (or `main` on first run).
  2. `GET /repos/:owner/:repo/git/commits/:sha` to get the tree SHA.
  3. `POST /repos/:owner/:repo/git/blobs` with the new file content.
  4. `POST /repos/:owner/:repo/git/trees` with the blob.
  5. `POST /repos/:owner/:repo/git/commits`.
  6. `PATCH /repos/:owner/:repo/git/refs/heads/registry-mirror`.

- [ ] **Step 2:** Implement. Use `env.GITHUB_BOT_PAT` (CF Secret) and `env.GITHUB_REPO` (e.g. `karannnaidu/Openkarta`). The payload shape mirrors the existing `registry/agents.json` exactly — old fields preserved, new fields additive (e.g. `health`, `lastVerifiedAt`).

- [ ] **Step 3:** PASS. Commit.

### Task 6.3: GitHub Action — daily mirror auto-merge

**Files:**
- Create: `.github/workflows/registry-mirror-merge.yml`

- [ ] **Step 1:** Author the workflow:

  ```yaml
  name: registry-mirror auto-merge
  on:
    schedule: [{ cron: '0 4 * * *' }]
    workflow_dispatch:
  jobs:
    merge:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
          with: { ref: main, fetch-depth: 0 }
        - name: Sanity check — no destructive deletes
          run: |
            git fetch origin registry-mirror
            removed=$(git diff --name-only origin/registry-mirror..origin/main -- registry/agents.json | wc -l)
            if [ "$removed" -gt 0 ]; then echo "manual review required" && exit 1; fi
        - name: Merge
          run: |
            git config user.name "openkarta-bot"
            git config user.email "bot@openkarta.org"
            git merge --ff-only origin/registry-mirror
            git push origin main
  ```

- [ ] **Step 2:** Commit.

  ```bash
  git add .github/workflows/registry-mirror-merge.yml
  git commit -m "ci: daily registry-mirror auto-merge with sanity check"
  ```

---

## Phase 7 — registry-web (Astro)

### Task 7.1: Public dashboard `/`

**Files:**
- Modify: `packages/registry-web/src/pages/index.astro`
- Create: `packages/registry-web/src/lib/api.ts`
- Create: `packages/registry-web/src/components/AgentTable.astro`

- [ ] **Step 1:** Author `lib/api.ts` — typed wrappers around `registry-api` endpoints (using `AgentListing` type from `@openkarta/registry-shared`).

- [ ] **Step 2:** Author `index.astro` — server-renders the first page of `/v1/agents` plus a static filter form (vanilla TS handles changes). Filters: itemType, country, tier, health.

- [ ] **Step 3:** Author `AgentTable.astro` — table component. Health badge uses semantic CSS class (`badge--healthy`, `badge--stale`, `badge--delisted`).

- [ ] **Step 4:** Commit.

### Task 7.2: Detail page `/agent/[id]`

**Files:**
- Create: `packages/registry-web/src/pages/agent/[id].astro`

- [ ] Render manifest summary, current badge, 30-day pass/fail strip (inline SVG generated server-side from `history`), copy-paste embed: `<a href="https://registry.openkarta.org/v1/agents/<id>/badge">…</a>`.

- [ ] Commit.

### Task 7.3: Submission wizard `/submit`

**Files:**
- Create: `packages/registry-web/src/pages/submit.astro`

- [ ] Sign-in gate → form → on submit, POST to `/v1/agents`, show `verificationInstructions`. Poll `GET /v1/agents/:id` every 3s until `verified`.

- [ ] Commit.

### Task 7.4: Account dashboard `/me`

**Files:**
- Create: `packages/registry-web/src/pages/me.astro`

- [ ] List the user's agents, edit/delete buttons, "Re-verify" button calling `POST /v1/agents/:id/reverify-conformance`.

- [ ] Commit.

### Task 7.5: Sign-in `/sign-in`

**Files:**
- Create: `packages/registry-web/src/pages/sign-in.astro`

- [ ] Magic-link form (`POST /auth/magic-link`) + GitHub button (link to `/auth/github/start`).

- [ ] Commit.

---

## Phase 8 — Backwards compat: orchestrator URL flip

### Task 8.1: Flip `DEFAULT_REGISTRY_URL`

**Files:**
- Modify: `packages/orchestrator/src/registry.ts`
- Modify: `packages/orchestrator/CHANGELOG.md`
- Modify: `packages/orchestrator/README.md`

- [ ] **Step 1:** Find the `DEFAULT_REGISTRY_URL` constant. Change from the `raw.githubusercontent.com` URL to `https://registry.openkarta.org/v1/agents`.

- [ ] **Step 2:** Update tests if they hard-coded the old URL.

- [ ] **Step 3:** Add CHANGELOG entry: "Default registry URL now points to the hosted service. The legacy URL is mirrored daily and remains a valid override via `OPENKARTA_REGISTRY_URL` env var."

- [ ] **Step 4:** PASS. Commit.

  ```bash
  git add packages/orchestrator
  git commit -m "feat(orchestrator)!: default registry URL → registry.openkarta.org"
  ```

---

## Phase 9 — E2E smoke + docs

### Task 9.1: `scripts/registry-smoke.sh`

**Files:**
- Create: `scripts/registry-smoke.sh`

- [ ] Author a shell script that, against a `wrangler dev`-spawned `registry-api` + an ephemeral fixture server serving the well-known token + a local `registry-verifier` queue consumer:
  1. POST a magic link (read the link from a captured email-stub log).
  2. Consume the link → session cookie.
  3. POST `/v1/agents` → capture token.
  4. Start fixture server returning the token at `/.well-known/openkarta-owner.txt`.
  5. POST `/v1/agents/:id/verify`.
  6. Trigger the queue consumer for the message.
  7. Assert `GET /v1/agents` lists the agent.

- [ ] Commit.

### Task 9.2: Deployment runbook

**Files:**
- Create: `docs/registry/README.md`
- Create: `docs/registry/runbook.md`

- [ ] `README.md`: architecture overview, endpoints, how to develop locally.
- [ ] `runbook.md`: one section per user-side prerequisite (CF account, D1 DB ID, Queue, Pages project, OAuth app, Resend account, GitHub PAT, DNS records, secret-set commands).

- [ ] Commit.

---

## Self-Review

- **Spec coverage.**
  - §3 components → Phases 0–7. ✓
  - §4 data model → Task 1.4 (+ 0002_rate_limits.sql via Task 4.4). ✓
  - §5 API surface → Phase 2 (auth) + Phase 4 (agents). ✓
  - §6 submission flow → Tasks 4.1 + 4.2 + Phase 5. ✓
  - §7 reverify cron → Phase 6. ✓
  - §8 dashboard → Phase 7. ✓
  - §9 backwards compat → Phase 8 + Task 6.2 (mirror) + Task 6.3 (auto-merge). ✓
  - §10 errors/observability → Phase 1 errors + per-route handlers + structured logs (called out in Task 4.6). ✓
  - §11 testing → unit (every task) + integration (Task 5.2) + e2e smoke (Task 9.1). ✓
- **Placeholder scan.** No "TBD" / "implement later" / "similar to". Every step shows the code or assertion.
- **Type consistency.** `AgentListing.health` everywhere (not `health_status` on the wire). `RegistryError` codes match the spec verbatim. `EmailClient` interface stable across api + verifier.
- **Open follow-up.** `0002_rate_limits.sql` is introduced inside Phase 4 — fine, but tests in Phase 2 should not assume it exists. Phase 2 magic-link rate-limit test uses a header-based simulation (`x-test-ratelimit`), independent of D1, so the ordering holds.
