# OpenKarta Plan 02 — Orchestrator & Consumer CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@openkarta/orchestrator` (a typed consumer-side library) and `@openkarta/cli` (a user-facing CLI) so that real consumer agents can discover, search, cart, quote, checkout, and track orders across every agent listed in the OpenKarta registry. Without this layer, Plan 01 produced merchants but no one calling them. v0.2.0 publishes both packages to npm.

**Architecture:** Three additions to the monorepo:

1. A typed HTTP client in `@openkarta/sdk-node` (`createClient`) — currently the SDK only exposes server-side helpers and the signing primitives. The orchestrator needs a typed wrapper around all 8 verbs.
2. A new package `@openkarta/orchestrator` that fans out across multiple agents using the typed client, applies a homogeneous-cart constraint, verifies signed quote tokens before checkout, and persists order IDs in a local SQLite-free JSON store. The orchestrator is **stateless across calls** — caller passes the cart in, gets a new cart out — except for the local `~/.openkarta/orders.json` which records placed orders.
3. A new package `@openkarta/cli` that wraps the orchestrator in `openkarta search`, `openkarta cart`, `openkarta checkout`, `openkarta orders`, and `openkarta chat` (the last one is the LLM-bridged natural-language entrypoint).

**LLM bridge:** Anthropic-only for v0.2 (we use `@anthropic-ai/sdk`). The bridge converts the 8 verbs' Zod schemas into Anthropic tool definitions with `zod-to-json-schema`, dispatches `tool_use` blocks back to orchestrator methods, and injects results back into the conversation. Other model vendors are deferred to Plan 02.1.

**Tech Stack:** Same as Plan 01 (TS 5.4+, Node 22, pnpm 9, Turborepo, Vitest 2, Biome 1.9, tsup). New dependencies: `zod-to-json-schema@^3.23.0` (deterministic), `@anthropic-ai/sdk@^0.30.0`, `commander@^12.1.0` (CLI flag parsing), `kleur@^4.1.5` (ANSI colour, zero deps), `cli-table3@^0.6.5` (search results table). No `ink` — keeps install footprint small and tests easier.

**Timeline:** 12 working days (≈2.5 weeks calendar). Phase 5 (LLM bridge) and Phase 6 (CLI) can be done in parallel after Phase 4.

**Testing discipline:** Strict TDD. Every orchestrator function: failing integration test that boots one or more reference agents on ephemeral ports → implementation → passing test. The orchestrator never has unit tests against mocks of agents — we always boot the real reference agents from `@openkarta/reference-agent-shop|stays|travel`. The CLI gets thin unit tests on argument parsing and integration tests that spawn the binary with `--target <local-fixture-server>`.

**Source of truth:** This plan inherits all schema decisions from `docs/superpowers/specs/2026-04-24-unified-acp-multivertical-design.md` and `docs/superpowers/plans/2026-04-24-plan-01-openkarta-protocol-and-node-sdk.md`. The orchestrator does not invent new wire shapes; it composes the existing 8 verbs.

---

## File structure

```
packages/
  sdk-node/
    src/
      client.ts                   ← NEW: createClient(baseUrl, opts)
      index.ts                    ← MODIFY: re-export createClient
    tests/
      client.test.ts              ← NEW

  orchestrator/                   ← NEW PACKAGE
    package.json
    tsconfig.json
    tsup.config.ts
    vitest.config.ts
    README.md
    src/
      index.ts                    ← public API barrel
      types.ts                    ← OrchestratorOptions, SearchPlan, RankedResult
      registry.ts                 ← registry fetcher with ETag cache
      discover.ts                 ← manifest cache, TTL
      search.ts                   ← multi-agent fan-out
      rank.ts                     ← deterministic ranking strategies
      cart.ts                     ← homogeneous cart builder
      quote.ts                    ← quote + signed-token verification
      checkout.ts                 ← checkout passthrough
      orders.ts                   ← status / cancel / return + local store
      llm/
        tool-defs.ts              ← Zod → Anthropic tool-defs
        dispatcher.ts             ← tool_use → orchestrator method
        memory.ts                 ← conversation state
        chat.ts                   ← high-level chat() loop
    tests/
      registry.test.ts
      discover.test.ts
      search.test.ts
      rank.test.ts
      cart.test.ts
      quote.test.ts
      checkout.test.ts
      orders.test.ts
      llm-tool-defs.test.ts
      llm-dispatcher.test.ts
      e2e-product.test.ts
      e2e-stay.test.ts
      e2e-flight.test.ts
    fixtures/
      agents-fixture.json

  cli/                            ← NEW PACKAGE
    package.json
    tsconfig.json
    tsup.config.ts
    vitest.config.ts
    README.md
    src/
      bin.ts                      ← #!/usr/bin/env node entry
      program.ts                  ← commander wiring
      storage.ts                  ← ~/.openkarta dir
      output.ts                   ← table + colour helpers
      commands/
        search.ts
        cart.ts
        checkout.ts
        orders.ts
        chat.ts
    tests/
      argv.test.ts
      storage.test.ts
      e2e-cli.test.ts

docs/
  orchestrator.md                 ← NEW: how to embed @openkarta/orchestrator
  cli.md                          ← NEW: openkarta CLI reference
```

The orchestrator owns no protocol opinions — it composes the existing verbs. The CLI owns no orchestration logic — it parses argv and prints results. Each file has one responsibility.

---

## Phase 0 — Scaffolding (Day 1, ~3 hours)

### Task 0.1: Add a typed HTTP client to `@openkarta/sdk-node`

The orchestrator needs to call all 8 verbs against any agent. Currently the SDK exposes `bootAgent`, `signQuoteToken`, `verifyQuoteToken`, and the schemas — but no client. Add one.

**Files:**
- Create: `packages/sdk-node/src/client.ts`
- Create: `packages/sdk-node/tests/client.test.ts`
- Modify: `packages/sdk-node/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/sdk-node/tests/client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createClient } from '../src/client.js';

let url: string;
let stop: () => Promise<void>;

beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
});
afterAll(async () => { await stop(); });

describe('createClient', () => {
  it('discovers a manifest', async () => {
    const client = createClient({ baseUrl: url });
    const manifest = await client.discover();
    expect(manifest.agentId).toBe('halcyon-shop');
    expect(manifest.protocolVersion).toBe('0.1');
  });

  it('searches by item type', async () => {
    const client = createClient({ baseUrl: url });
    const res = await client.search({ itemType: 'product', q: 'coffee' });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].itemType).toBe('product');
  });

  it('throws OpenKartaError on a 4xx response', async () => {
    const client = createClient({ baseUrl: url });
    await expect(client.get('does-not-exist')).rejects.toThrow(/item_not_found/);
  });

  it('honours a per-call timeout', async () => {
    const client = createClient({ baseUrl: url, timeoutMs: 1 });
    await expect(client.discover()).rejects.toThrow(/timeout|abort/i);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @openkarta/sdk-node test client
```
Expected: FAIL — `createClient` is not exported.

- [ ] **Step 3: Implement `createClient`**

```ts
// packages/sdk-node/src/client.ts
import {
  CapabilitiesManifest,
  ItemBase,
  Cart,
  CartLine,
  Quote,
  Order,
  OrderStatus,
  SearchQuery,
  SearchResults,
  ErrorResponse,
} from '@openkarta/spec';

export interface ClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  userToken?: string;
  fetchImpl?: typeof fetch;
}

export class OpenKartaError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;
  constructor(code: string, httpStatus: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export interface OpenKartaClient {
  baseUrl: string;
  discover(): Promise<CapabilitiesManifest>;
  search(query: SearchQuery): Promise<SearchResults>;
  get(itemId: string): Promise<ItemBase>;
  quote(cart: Cart): Promise<Quote>;
  checkout(input: { quoteToken: string; payment: { method: string; ref?: string } }): Promise<Order>;
  status(orderId: string): Promise<OrderStatus>;
  cancel(orderId: string, reason: string): Promise<OrderStatus>;
  return(orderId: string, reason: string): Promise<OrderStatus>;
}

export function createClient(opts: ClientOptions): OpenKartaClient {
  const baseUrl = opts.baseUrl.replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = {
      'accept': 'application/json',
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (opts.userToken) headers['x-openkarta-user-token'] = opts.userToken;

    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new OpenKartaError('network_error', 0, (err as Error).message);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const json = text.length > 0 ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const e = json as ErrorResponse | undefined;
      throw new OpenKartaError(
        e?.error?.code ?? 'unknown_error',
        res.status,
        e?.error?.message ?? `HTTP ${res.status}`,
        e?.error?.details,
      );
    }
    return json as T;
  }

  return {
    baseUrl,
    discover: () => call('GET', '/v0/discover'),
    search:   (q) => call('POST', '/v0/search', q),
    get:      (id) => call('GET', `/v0/items/${encodeURIComponent(id)}`),
    quote:    (cart) => call('POST', '/v0/quote', { cart }),
    checkout: (input) => call('POST', '/v0/checkout', input),
    status:   (id) => call('GET', `/v0/orders/${encodeURIComponent(id)}/status`),
    cancel:   (id, reason) => call('POST', `/v0/orders/${encodeURIComponent(id)}/cancel`, { reason }),
    return:   (id, reason) => call('POST', `/v0/orders/${encodeURIComponent(id)}/return`, { reason }),
  };
}
```

- [ ] **Step 4: Re-export from the SDK barrel**

```ts
// packages/sdk-node/src/index.ts (append to existing exports)
export { createClient, OpenKartaError } from './client.js';
export type { ClientOptions, OpenKartaClient } from './client.js';
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm --filter @openkarta/sdk-node test client
```
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/sdk-node/src/client.ts packages/sdk-node/src/index.ts packages/sdk-node/tests/client.test.ts
git commit -m "feat(sdk-node): typed createClient wrapping the 8 verbs"
```

---

### Task 0.2: Scaffold `@openkarta/orchestrator`

**Files:**
- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`
- Create: `packages/orchestrator/tsup.config.ts`
- Create: `packages/orchestrator/vitest.config.ts`
- Create: `packages/orchestrator/README.md`
- Create: `packages/orchestrator/src/index.ts`
- Create: `packages/orchestrator/src/types.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@openkarta/orchestrator",
  "version": "0.2.0",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@openkarta/spec":     "workspace:*",
    "@openkarta/sdk-node": "workspace:*",
    "zod": "^3.23.0",
    "zod-to-json-schema": "^3.23.0"
  },
  "devDependencies": {
    "@openkarta/reference-agent-shop":   "workspace:*",
    "@openkarta/reference-agent-stays":  "workspace:*",
    "@openkarta/reference-agent-travel": "workspace:*",
    "tsup": "^8.3.0",
    "typescript": "^5.4.5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    pool: 'forks',
  },
});
```

- [ ] **Step 5: Create `src/types.ts`**

```ts
import type { CapabilitiesManifest, ItemBase, ItemType } from '@openkarta/spec';

export interface OrchestratorOptions {
  registryUrl?: string;            // default: bundled fallback
  registry?: RegistrySnapshot;     // pre-loaded; bypasses fetch
  cacheTtlMs?: number;             // manifest cache TTL, default 5 min
  perAgentTimeoutMs?: number;      // default 8s
  searchConcurrency?: number;      // default 5
  ordersFile?: string;             // default ~/.openkarta/orders.json
  fetchImpl?: typeof fetch;
}

export interface RegistrySnapshot {
  version: string;
  updated: string;
  agents: RegistryAgent[];
}

export interface RegistryAgent {
  agentId: string;
  displayName: string;
  description?: string;
  baseUrl: string;
  manifestUrl?: string;
  tier: 'lite' | 'http' | 'agentic';
  supportedItemTypes: ItemType[];
  regions?: { country: string; city?: string; pincodes?: string[] }[];
  publicKey?: string | null;
  badgeUrl?: string | null;
  tags?: string[];
  addedAt: string;
  verified?: boolean;
}

export interface SearchPlan {
  itemType: ItemType;
  q?: string;
  region?: { country: string; city?: string; pincode?: string };
  /** Filter to a subset of agentIds. Empty means "all matching the item type". */
  agentIds?: string[];
}

export interface RankedResult {
  agentId: string;
  agentDisplayName: string;
  manifest: CapabilitiesManifest;
  item: ItemBase;
  rankScore: number;
}

export interface OrderRecord {
  orderId: string;
  agentId: string;
  agentBaseUrl: string;
  itemType: ItemType;
  totalMinor: number;
  currency: string;
  placedAt: string;
}
```

- [ ] **Step 6: Create stub `src/index.ts`**

```ts
// Public API barrel — populated by Phases 1-5.
export type { OrchestratorOptions, RegistrySnapshot, RegistryAgent, SearchPlan, RankedResult, OrderRecord } from './types.js';
```

- [ ] **Step 7: Create `README.md`**

```markdown
# @openkarta/orchestrator

Consumer-side library for OpenKarta. Discovers agents from the public registry, fans out search across them, builds homogeneous carts, verifies signed quotes, and checks out.

See [`docs/orchestrator.md`](../../docs/orchestrator.md) for usage.

License: MIT.
```

- [ ] **Step 8: Install workspace deps**

```bash
pnpm install
```
Expected: workspace resolves; new package appears in `pnpm list -r --depth -1`.

- [ ] **Step 9: Build the empty package to verify scaffolding**

```bash
pnpm --filter @openkarta/orchestrator build
```
Expected: `dist/index.js` and `dist/index.d.ts` produced.

- [ ] **Step 10: Commit**

```bash
git add packages/orchestrator/
git commit -m "feat(orchestrator): package scaffold"
```

---

### Task 0.3: Scaffold `@openkarta/cli`

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/README.md`
- Create: `packages/cli/src/bin.ts`
- Create: `packages/cli/src/program.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@openkarta/cli",
  "version": "0.2.0",
  "license": "MIT",
  "type": "module",
  "bin": { "openkarta": "./dist/bin.js" },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@openkarta/spec":         "workspace:*",
    "@openkarta/sdk-node":     "workspace:*",
    "@openkarta/orchestrator": "workspace:*",
    "commander":  "^12.1.0",
    "kleur":      "^4.1.5",
    "cli-table3": "^0.6.5"
  },
  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.4.5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (identical structure to Task 0.2 Step 2).

- [ ] **Step 3: Create `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  target: 'node22',
  banner: { js: '#!/usr/bin/env node' },
});
```

- [ ] **Step 4: Create `vitest.config.ts`** (identical to Task 0.2 Step 4).

- [ ] **Step 5: Create stub `src/program.ts`**

```ts
import { Command } from 'commander';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('openkarta')
    .description('OpenKarta consumer CLI — discover agents, build carts, check out')
    .version('0.2.0');

  program.command('search')
    .description('not yet implemented')
    .action(() => { throw new Error('not implemented'); });

  return program;
}
```

- [ ] **Step 6: Create `src/bin.ts`**

```ts
import { buildProgram } from './program.js';
buildProgram().parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 7: Create `README.md`**

```markdown
# @openkarta/cli

`openkarta` — the OpenKarta consumer CLI. See [`docs/cli.md`](../../docs/cli.md) for the full reference.

```

- [ ] **Step 8: Build to verify scaffolding**

```bash
pnpm install
pnpm --filter @openkarta/cli build
node packages/cli/dist/bin.js --help
```
Expected: commander prints `--help` output mentioning the `search` subcommand.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): package scaffold"
```

---

## Phase 1 — Registry client (Day 2, ~6 hours)

### Task 1.1: Fetch and validate the registry

**Files:**
- Create: `packages/orchestrator/src/registry.ts`
- Create: `packages/orchestrator/tests/registry.test.ts`
- Create: `packages/orchestrator/fixtures/agents-fixture.json`

- [ ] **Step 1: Create the test fixture**

```json
{
  "$schema": "../../../registry/schema.json",
  "version": "0.1",
  "updated": "2026-04-24",
  "agents": [
    {
      "agentId": "halcyon-shop",
      "displayName": "Halcyon Shop (test)",
      "baseUrl": "https://example.invalid",
      "tier": "http",
      "supportedItemTypes": ["product"],
      "regions": [{ "country": "IN" }],
      "addedAt": "2026-04-24"
    },
    {
      "agentId": "halcyon-stays",
      "displayName": "Halcyon Stays (test)",
      "baseUrl": "https://example.invalid",
      "tier": "http",
      "supportedItemTypes": ["stay", "service"],
      "regions": [{ "country": "IN", "city": "Goa" }],
      "addedAt": "2026-04-24"
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/orchestrator/tests/registry.test.ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { loadRegistry, filterAgents } from '../src/registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', 'fixtures', 'agents-fixture.json');

describe('loadRegistry', () => {
  it('parses a valid registry from a string', async () => {
    const json = await readFile(fixturePath, 'utf-8');
    const reg = await loadRegistry({ inline: json });
    expect(reg.agents).toHaveLength(2);
    expect(reg.agents[0].agentId).toBe('halcyon-shop');
  });

  it('rejects an invalid registry version', async () => {
    await expect(loadRegistry({ inline: '{"version":"0.0","updated":"2026-04-24","agents":[]}' }))
      .rejects.toThrow(/version/);
  });

  it('rejects an agent with a non-https baseUrl', async () => {
    const bad = JSON.stringify({
      version: '0.1', updated: '2026-04-24',
      agents: [{ agentId: 'x', displayName: 'x', baseUrl: 'http://x', tier: 'http',
                 supportedItemTypes: ['product'], addedAt: '2026-04-24' }],
    });
    await expect(loadRegistry({ inline: bad })).rejects.toThrow(/https/);
  });
});

describe('filterAgents', () => {
  it('filters by item type', async () => {
    const json = await readFile(fixturePath, 'utf-8');
    const reg = await loadRegistry({ inline: json });
    const matches = filterAgents(reg.agents, { itemType: 'stay' });
    expect(matches.map((a) => a.agentId)).toEqual(['halcyon-stays']);
  });

  it('filters by country', async () => {
    const json = await readFile(fixturePath, 'utf-8');
    const reg = await loadRegistry({ inline: json });
    const matches = filterAgents(reg.agents, { itemType: 'product', country: 'US' });
    expect(matches).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
pnpm --filter @openkarta/orchestrator test registry
```
Expected: FAIL — `loadRegistry` is not exported.

- [ ] **Step 4: Implement `registry.ts`**

```ts
// packages/orchestrator/src/registry.ts
import { z } from 'zod';
import type { ItemType } from '@openkarta/spec';
import type { RegistrySnapshot, RegistryAgent } from './types.js';

const ITEM_TYPES = ['product', 'stay', 'flight', 'bus', 'service'] as const;

const RegistryAgentZ = z.object({
  agentId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url().refine((u) => u.startsWith('https://'), 'baseUrl must be https'),
  manifestUrl: z.string().url().optional(),
  tier: z.enum(['lite', 'http', 'agentic']),
  supportedItemTypes: z.array(z.enum(ITEM_TYPES)).min(1),
  regions: z.array(z.object({
    country: z.string().regex(/^[A-Z]{2}$/),
    city: z.string().optional(),
    pincodes: z.array(z.string()).optional(),
  })).optional(),
  publicKey: z.string().nullable().optional(),
  badgeUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  addedAt: z.string(),
  verified: z.boolean().optional(),
});

const RegistryZ = z.object({
  version: z.literal('0.1'),
  updated: z.string(),
  agents: z.array(RegistryAgentZ),
});

export interface LoadRegistryInput {
  /** A registry URL to fetch. */
  url?: string;
  /** A pre-fetched JSON string (used in tests). Mutually exclusive with `url`. */
  inline?: string;
  fetchImpl?: typeof fetch;
}

export async function loadRegistry(input: LoadRegistryInput): Promise<RegistrySnapshot> {
  let raw: string;
  if (input.inline !== undefined) {
    raw = input.inline;
  } else if (input.url !== undefined) {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch;
    const res = await fetchImpl(input.url);
    if (!res.ok) throw new Error(`registry fetch failed: HTTP ${res.status}`);
    raw = await res.text();
  } else {
    throw new Error('loadRegistry requires either { url } or { inline }');
  }
  const parsed = RegistryZ.parse(JSON.parse(raw));
  return parsed as RegistrySnapshot;
}

export interface AgentFilter {
  itemType: ItemType;
  country?: string;
  city?: string;
  pincode?: string;
  tier?: 'lite' | 'http' | 'agentic';
  agentIds?: string[];
}

export function filterAgents(agents: RegistryAgent[], filter: AgentFilter): RegistryAgent[] {
  return agents.filter((a) => {
    if (!a.supportedItemTypes.includes(filter.itemType)) return false;
    if (filter.tier && a.tier !== filter.tier) return false;
    if (filter.agentIds && filter.agentIds.length > 0 && !filter.agentIds.includes(a.agentId)) return false;
    if (filter.country && (a.regions ?? []).every((r) => r.country !== filter.country)) return false;
    if (filter.city) {
      const r = (a.regions ?? []).find((r) => r.country === filter.country && (r.city === filter.city || !r.city));
      if (!r) return false;
    }
    if (filter.pincode) {
      const r = (a.regions ?? []).find((r) => (r.pincodes ?? []).includes(filter.pincode!));
      if (!r) return false;
    }
    return true;
  });
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
pnpm --filter @openkarta/orchestrator test registry
```
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/registry.ts \
        packages/orchestrator/tests/registry.test.ts \
        packages/orchestrator/fixtures/agents-fixture.json
git commit -m "feat(orchestrator): registry loader with Zod validation + filter helpers"
```

---

### Task 1.2: Default registry URL constant + bundled fallback

The orchestrator needs a sensible default registry URL when the caller does not supply one.

**Files:**
- Modify: `packages/orchestrator/src/registry.ts`

- [ ] **Step 1: Append the constant**

```ts
// packages/orchestrator/src/registry.ts (append)
export const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/karannnaidu/Openkarta/main/registry/agents.json';
```

- [ ] **Step 2: Add a one-line test**

```ts
// packages/orchestrator/tests/registry.test.ts (append)
import { DEFAULT_REGISTRY_URL } from '../src/registry.js';

describe('DEFAULT_REGISTRY_URL', () => {
  it('points to the canonical Stage-1 registry', () => {
    expect(DEFAULT_REGISTRY_URL).toMatch(/^https:\/\//);
    expect(DEFAULT_REGISTRY_URL).toContain('/registry/agents.json');
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test registry
git add packages/orchestrator/src/registry.ts packages/orchestrator/tests/registry.test.ts
git commit -m "feat(orchestrator): expose DEFAULT_REGISTRY_URL constant"
```

---

### Task 1.3: Re-export from the orchestrator barrel

**Files:**
- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: Add re-exports**

```ts
// packages/orchestrator/src/index.ts (replace)
export type { OrchestratorOptions, RegistrySnapshot, RegistryAgent, SearchPlan, RankedResult, OrderRecord } from './types.js';
export { loadRegistry, filterAgents, DEFAULT_REGISTRY_URL } from './registry.js';
export type { AgentFilter, LoadRegistryInput } from './registry.js';
```

- [ ] **Step 2: Build to confirm types resolve**

```bash
pnpm --filter @openkarta/orchestrator build
```
Expected: `dist/index.d.ts` includes `loadRegistry`.

- [ ] **Step 3: Commit**

```bash
git add packages/orchestrator/src/index.ts
git commit -m "chore(orchestrator): export registry helpers from barrel"
```

---

## Phase 2 — Discovery & search fan-out (Days 3-4, ~10 hours)

### Task 2.1: Manifest cache with TTL

Each agent has a `discover()` manifest that rarely changes. The orchestrator should cache them per `baseUrl` for the configured TTL to avoid hammering agents during a single user session.

**Files:**
- Create: `packages/orchestrator/src/discover.ts`
- Create: `packages/orchestrator/tests/discover.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/discover.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createManifestCache } from '../src/discover.js';

let url: string;
let stop: () => Promise<void>;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
});
afterAll(async () => { await stop(); });

describe('manifest cache', () => {
  it('returns the manifest from a live agent', async () => {
    const cache = createManifestCache({ ttlMs: 5_000 });
    const m = await cache.get(url);
    expect(m.agentId).toBe('halcyon-shop');
  });

  it('hits cache on the second call within TTL', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => { calls++; return globalThis.fetch(input, init); };
    const cache = createManifestCache({ ttlMs: 5_000, fetchImpl });
    await cache.get(url);
    await cache.get(url);
    expect(calls).toBe(1);
  });

  it('refetches after TTL expires', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => { calls++; return globalThis.fetch(input, init); };
    const cache = createManifestCache({ ttlMs: 10, fetchImpl });
    await cache.get(url);
    await new Promise((r) => setTimeout(r, 30));
    await cache.get(url);
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Confirm it fails**

```bash
pnpm --filter @openkarta/orchestrator test discover
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `discover.ts`**

```ts
// packages/orchestrator/src/discover.ts
import type { CapabilitiesManifest } from '@openkarta/spec';
import { createClient } from '@openkarta/sdk-node';

interface CacheEntry { manifest: CapabilitiesManifest; expiresAt: number; }

export interface ManifestCacheOptions {
  ttlMs?: number;            // default 5 min
  fetchImpl?: typeof fetch;
  perAgentTimeoutMs?: number; // default 8s
}

export interface ManifestCache {
  get(baseUrl: string): Promise<CapabilitiesManifest>;
  invalidate(baseUrl?: string): void;
}

export function createManifestCache(opts: ManifestCacheOptions = {}): ManifestCache {
  const ttlMs = opts.ttlMs ?? 5 * 60_000;
  const cache = new Map<string, CacheEntry>();

  return {
    async get(baseUrl: string) {
      const now = Date.now();
      const hit = cache.get(baseUrl);
      if (hit && hit.expiresAt > now) return hit.manifest;
      const client = createClient({
        baseUrl,
        timeoutMs: opts.perAgentTimeoutMs ?? 8_000,
        fetchImpl: opts.fetchImpl,
      });
      const manifest = await client.discover();
      cache.set(baseUrl, { manifest, expiresAt: now + ttlMs });
      return manifest;
    },
    invalidate(baseUrl?: string) {
      if (baseUrl) cache.delete(baseUrl);
      else cache.clear();
    },
  };
}
```

- [ ] **Step 4: Confirm it passes + commit**

```bash
pnpm --filter @openkarta/orchestrator test discover
git add packages/orchestrator/src/discover.ts packages/orchestrator/tests/discover.test.ts
git commit -m "feat(orchestrator): TTL-cached manifest discovery"
```

---

### Task 2.2: Multi-agent search with bounded concurrency

**Files:**
- Create: `packages/orchestrator/src/search.ts`
- Create: `packages/orchestrator/tests/search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/search.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent as bootShop, loadFixtures as fxShop } from '@openkarta/reference-agent-shop/dist/agent.js';
import { searchAcrossAgents } from '../src/search.js';
import { createManifestCache } from '../src/discover.js';

let url1: string, url2: string;
let stop1: () => Promise<void>, stop2: () => Promise<void>;

beforeAll(async () => {
  const fx = fxShop('packages/reference-agent-shop/dist/fixtures');
  ({ url: url1, stop: stop1 } = await bootShop(fx, 0, 'test-secret-32-bytes-________'));
  ({ url: url2, stop: stop2 } = await bootShop(fx, 0, 'test-secret-32-bytes-________'));
});
afterAll(async () => { await stop1(); await stop2(); });

describe('searchAcrossAgents', () => {
  it('aggregates results across multiple agents', async () => {
    const cache = createManifestCache({ ttlMs: 60_000 });
    const out = await searchAcrossAgents({
      agents: [
        { agentId: 'shop1', displayName: 'Shop 1', baseUrl: url1, tier: 'http',
          supportedItemTypes: ['product'], addedAt: '2026-04-24' },
        { agentId: 'shop2', displayName: 'Shop 2', baseUrl: url2, tier: 'http',
          supportedItemTypes: ['product'], addedAt: '2026-04-24' },
      ],
      plan: { itemType: 'product', q: 'coffee' },
      manifestCache: cache,
      perAgentTimeoutMs: 5_000,
      concurrency: 2,
    });
    const agentIds = new Set(out.map((r) => r.agentId));
    expect(agentIds).toEqual(new Set(['shop1', 'shop2']));
    for (const r of out) expect(r.item.itemType).toBe('product');
  });

  it('continues past a failing agent', async () => {
    const cache = createManifestCache({ ttlMs: 60_000 });
    const out = await searchAcrossAgents({
      agents: [
        { agentId: 'good', displayName: 'g', baseUrl: url1, tier: 'http',
          supportedItemTypes: ['product'], addedAt: '2026-04-24' },
        { agentId: 'dead', displayName: 'd', baseUrl: 'http://127.0.0.1:1', tier: 'http',
          supportedItemTypes: ['product'], addedAt: '2026-04-24' },
      ],
      plan: { itemType: 'product', q: 'coffee' },
      manifestCache: cache,
      perAgentTimeoutMs: 500,
      concurrency: 2,
    });
    expect(out.some((r) => r.agentId === 'good')).toBe(true);
    expect(out.some((r) => r.agentId === 'dead')).toBe(false);
  });
});
```

- [ ] **Step 2: Confirm it fails.**

```bash
pnpm --filter @openkarta/orchestrator test search
```
Expected: FAIL.

- [ ] **Step 3: Implement `search.ts`**

```ts
// packages/orchestrator/src/search.ts
import { createClient } from '@openkarta/sdk-node';
import type { SearchQuery } from '@openkarta/spec';
import type { ManifestCache } from './discover.js';
import type { RegistryAgent, SearchPlan, RankedResult } from './types.js';

export interface SearchInput {
  agents: RegistryAgent[];
  plan: SearchPlan;
  manifestCache: ManifestCache;
  perAgentTimeoutMs?: number;
  concurrency?: number;
  fetchImpl?: typeof fetch;
}

export async function searchAcrossAgents(input: SearchInput): Promise<RankedResult[]> {
  const concurrency = Math.max(1, input.concurrency ?? 5);
  const timeoutMs = input.perAgentTimeoutMs ?? 8_000;
  const queue = [...input.agents];
  const results: RankedResult[] = [];

  async function worker() {
    while (queue.length > 0) {
      const agent = queue.shift();
      if (!agent) return;
      try {
        const manifest = await input.manifestCache.get(agent.baseUrl);
        const client = createClient({
          baseUrl: agent.baseUrl, timeoutMs, fetchImpl: input.fetchImpl,
        });
        const query = buildQuery(input.plan);
        const res = await client.search(query);
        for (const item of res.items) {
          results.push({
            agentId: agent.agentId,
            agentDisplayName: agent.displayName,
            manifest,
            item,
            rankScore: 0,  // populated by rank.ts
          });
        }
      } catch {
        // dead/timeout agents are silently dropped — observable via metrics, not exceptions
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function buildQuery(plan: SearchPlan): SearchQuery {
  // SearchQuery is a discriminated union; the orchestrator passes through
  // the user's free-text and a region hint and lets each agent interpret.
  return {
    itemType: plan.itemType,
    q: plan.q,
    region: plan.region,
  } as SearchQuery;
}
```

- [ ] **Step 4: Confirm it passes + commit**

```bash
pnpm --filter @openkarta/orchestrator test search
git add packages/orchestrator/src/search.ts packages/orchestrator/tests/search.test.ts
git commit -m "feat(orchestrator): bounded-concurrency search fan-out"
```

---

### Task 2.3: Deterministic ranking (`rank.ts`)

The orchestrator never re-orders results based on hidden incentives — only documented signals. v0.2 ships a single strategy: lowest `priceMinor` first, then verified agents before unverified, then alphabetical by `agentId`. Caller can override.

**Files:**
- Create: `packages/orchestrator/src/rank.ts`
- Create: `packages/orchestrator/tests/rank.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/rank.test.ts
import { describe, it, expect } from 'vitest';
import { rankResults, lowestPriceFirst } from '../src/rank.js';
import type { RankedResult } from '../src/types.js';

const r = (price: number, agentId: string, verified = false): RankedResult => ({
  agentId,
  agentDisplayName: agentId,
  manifest: { agentId } as never,
  item: { itemId: `${agentId}-${price}`, itemType: 'product', priceMinor: price, currency: 'INR' } as never,
  rankScore: 0,
});

describe('rankResults', () => {
  it('orders cheapest first', () => {
    const out = rankResults([r(500, 'b'), r(100, 'a'), r(300, 'c')], lowestPriceFirst);
    expect(out.map((x) => x.item.itemId)).toEqual(['a-100', 'c-300', 'b-500']);
  });

  it('breaks ties alphabetically', () => {
    const out = rankResults([r(100, 'b'), r(100, 'a')], lowestPriceFirst);
    expect(out.map((x) => x.agentId)).toEqual(['a', 'b']);
  });

  it('writes the score back into rankScore', () => {
    const out = rankResults([r(100, 'a'), r(200, 'b')], lowestPriceFirst);
    expect(out[0].rankScore).toBeGreaterThan(out[1].rankScore);
  });
});
```

- [ ] **Step 2: Confirm it fails.**

- [ ] **Step 3: Implement `rank.ts`**

```ts
// packages/orchestrator/src/rank.ts
import type { RankedResult } from './types.js';

export type RankStrategy = (a: RankedResult, b: RankedResult) => number;

export const lowestPriceFirst: RankStrategy = (a, b) => {
  const pa = (a.item as { priceMinor?: number }).priceMinor ?? Number.MAX_SAFE_INTEGER;
  const pb = (b.item as { priceMinor?: number }).priceMinor ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return a.agentId.localeCompare(b.agentId);
};

export function rankResults(results: RankedResult[], strategy: RankStrategy = lowestPriceFirst): RankedResult[] {
  const sorted = [...results].sort(strategy);
  const n = sorted.length;
  // Deterministic score: higher = ranked earlier. Useful for downstream callers.
  for (let i = 0; i < n; i++) sorted[i].rankScore = n - i;
  return sorted;
}
```

- [ ] **Step 4: Confirm + commit.**

```bash
pnpm --filter @openkarta/orchestrator test rank
git add packages/orchestrator/src/rank.ts packages/orchestrator/tests/rank.test.ts
git commit -m "feat(orchestrator): deterministic price-first ranking"
```

---

### Task 2.4: High-level `search()` that ties it all together

**Files:**
- Create: `packages/orchestrator/src/orchestrator.ts`
- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: Write a failing integration test**

```ts
// packages/orchestrator/tests/e2e-product.test.ts (NEW)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createOrchestrator } from '../src/orchestrator.js';

let url1: string, url2: string;
let stop1: () => Promise<void>, stop2: () => Promise<void>;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url: url1, stop: stop1 } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
  ({ url: url2, stop: stop2 } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
});
afterAll(async () => { await stop1(); await stop2(); });

describe('orchestrator.search (product)', () => {
  it('returns ranked results across two shop agents', async () => {
    const orch = createOrchestrator({
      registry: {
        version: '0.1', updated: '2026-04-24',
        agents: [
          { agentId: 'a', displayName: 'A', baseUrl: url1, tier: 'http',
            supportedItemTypes: ['product'], regions: [{ country: 'IN' }], addedAt: '2026-04-24' },
          { agentId: 'b', displayName: 'B', baseUrl: url2, tier: 'http',
            supportedItemTypes: ['product'], regions: [{ country: 'IN' }], addedAt: '2026-04-24' },
        ],
      },
    });
    const out = await orch.search({ itemType: 'product', q: 'coffee' });
    expect(out.length).toBeGreaterThan(0);
    for (let i = 1; i < out.length; i++) {
      const prev = (out[i - 1].item as { priceMinor: number }).priceMinor;
      const curr = (out[i].item as { priceMinor: number }).priceMinor;
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });
});
```

- [ ] **Step 2: Confirm it fails.**

- [ ] **Step 3: Implement `orchestrator.ts`**

```ts
// packages/orchestrator/src/orchestrator.ts
import type { OrchestratorOptions, SearchPlan, RankedResult, RegistrySnapshot } from './types.js';
import { loadRegistry, filterAgents, DEFAULT_REGISTRY_URL } from './registry.js';
import { createManifestCache } from './discover.js';
import { searchAcrossAgents } from './search.js';
import { rankResults, lowestPriceFirst, type RankStrategy } from './rank.js';

export interface Orchestrator {
  search(plan: SearchPlan, ranker?: RankStrategy): Promise<RankedResult[]>;
}

export function createOrchestrator(opts: OrchestratorOptions = {}): Orchestrator {
  const cache = createManifestCache({
    ttlMs: opts.cacheTtlMs,
    fetchImpl: opts.fetchImpl,
    perAgentTimeoutMs: opts.perAgentTimeoutMs,
  });

  let registryPromise: Promise<RegistrySnapshot> | null = opts.registry
    ? Promise.resolve(opts.registry)
    : null;

  async function getRegistry(): Promise<RegistrySnapshot> {
    if (registryPromise) return registryPromise;
    registryPromise = loadRegistry({
      url: opts.registryUrl ?? DEFAULT_REGISTRY_URL,
      fetchImpl: opts.fetchImpl,
    });
    return registryPromise;
  }

  return {
    async search(plan, ranker = lowestPriceFirst) {
      const reg = await getRegistry();
      const agents = filterAgents(reg.agents, {
        itemType: plan.itemType,
        country: plan.region?.country,
        city: plan.region?.city,
        pincode: plan.region?.pincode,
        agentIds: plan.agentIds,
      });
      const results = await searchAcrossAgents({
        agents, plan, manifestCache: cache,
        perAgentTimeoutMs: opts.perAgentTimeoutMs,
        concurrency: opts.searchConcurrency,
        fetchImpl: opts.fetchImpl,
      });
      return rankResults(results, ranker);
    },
  };
}
```

- [ ] **Step 4: Add to barrel**

```ts
// packages/orchestrator/src/index.ts (append)
export { createOrchestrator } from './orchestrator.js';
export type { Orchestrator } from './orchestrator.js';
export { rankResults, lowestPriceFirst } from './rank.js';
export type { RankStrategy } from './rank.js';
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test e2e-product
git add packages/orchestrator/src/orchestrator.ts packages/orchestrator/src/index.ts packages/orchestrator/tests/e2e-product.test.ts
git commit -m "feat(orchestrator): top-level createOrchestrator + e2e product flow"
```

---

## Phase 3 — Cart, quote, checkout (Days 5-6, ~10 hours)

### Task 3.1: Homogeneous cart builder

A cart can only contain lines from one agent (the agent owns price + fulfilment) and one item type (protocol invariant).

**Files:**
- Create: `packages/orchestrator/src/cart.ts`
- Create: `packages/orchestrator/tests/cart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/cart.test.ts
import { describe, it, expect } from 'vitest';
import { newCart, addLine } from '../src/cart.js';

describe('cart builder', () => {
  it('starts empty with the chosen agentId + itemType', () => {
    const c = newCart({ agentId: 'a', agentBaseUrl: 'https://a', itemType: 'product', currency: 'INR' });
    expect(c.lines).toEqual([]);
  });

  it('adds a line with quantity', () => {
    const c0 = newCart({ agentId: 'a', agentBaseUrl: 'https://a', itemType: 'product', currency: 'INR' });
    const c1 = addLine(c0, { itemId: 'x', quantity: 2 });
    expect(c1.lines).toEqual([{ itemType: 'product', itemId: 'x', quantity: 2 }]);
  });

  it('rejects mixed agentId via type narrowing', () => {
    const c = newCart({ agentId: 'a', agentBaseUrl: 'https://a', itemType: 'product', currency: 'INR' });
    expect(() => addLine(c, { itemId: 'y', quantity: 1, _agentIdSanityCheck: 'b' as never }))
      .toThrow(/agent/);
  });
});
```

- [ ] **Step 2: Confirm fail, then implement**

```ts
// packages/orchestrator/src/cart.ts
import type { ItemType } from '@openkarta/spec';

export interface OrchestratorCart {
  agentId: string;
  agentBaseUrl: string;
  itemType: ItemType;
  currency: string;
  lines: { itemType: ItemType; itemId: string; quantity: number }[];
}

export function newCart(init: Pick<OrchestratorCart, 'agentId' | 'agentBaseUrl' | 'itemType' | 'currency'>): OrchestratorCart {
  return { ...init, lines: [] };
}

export interface AddLineInput {
  itemId: string;
  quantity: number;
  /** Internal type-narrow guard — callers should never pass this. */
  _agentIdSanityCheck?: string;
}

export function addLine(cart: OrchestratorCart, line: AddLineInput): OrchestratorCart {
  if (line._agentIdSanityCheck && line._agentIdSanityCheck !== cart.agentId) {
    throw new Error(`cart belongs to agent "${cart.agentId}", refusing line from "${line._agentIdSanityCheck}"`);
  }
  if (line.quantity < 1 || !Number.isInteger(line.quantity)) {
    throw new Error('quantity must be a positive integer');
  }
  return {
    ...cart,
    lines: [...cart.lines, { itemType: cart.itemType, itemId: line.itemId, quantity: line.quantity }],
  };
}
```

- [ ] **Step 3: Run + commit.**

```bash
pnpm --filter @openkarta/orchestrator test cart
git add packages/orchestrator/src/cart.ts packages/orchestrator/tests/cart.test.ts
git commit -m "feat(orchestrator): immutable homogeneous cart builder"
```

---

### Task 3.2: Quote orchestration with signed-token verification

The orchestrator quotes a cart against the agent, verifies the returned `quoteToken` against the agent's published HMAC scheme, and returns the verified `Quote` so the caller can show price + expiry to the user.

**Files:**
- Create: `packages/orchestrator/src/quote.ts`
- Create: `packages/orchestrator/tests/quote.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/quote.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { newCart, addLine } from '../src/cart.js';
import { quoteCart } from '../src/quote.js';

let url: string;
let stop: () => Promise<void>;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
});
afterAll(async () => { await stop(); });

describe('quoteCart', () => {
  it('returns a verified quote', async () => {
    let cart = newCart({ agentId: 'shop', agentBaseUrl: url, itemType: 'product', currency: 'INR' });
    cart = addLine(cart, { itemId: 'espresso_250g', quantity: 1 });
    const q = await quoteCart(cart);
    expect(q.quoteToken).toBeTruthy();
    expect(q.totalMinor).toBeGreaterThan(0);
    expect(new Date(q.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('throws on a cart with no lines', async () => {
    const cart = newCart({ agentId: 'shop', agentBaseUrl: url, itemType: 'product', currency: 'INR' });
    await expect(quoteCart(cart)).rejects.toThrow(/empty/);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// packages/orchestrator/src/quote.ts
import { createClient, OpenKartaError } from '@openkarta/sdk-node';
import type { Quote, Cart } from '@openkarta/spec';
import type { OrchestratorCart } from './cart.js';

export async function quoteCart(cart: OrchestratorCart, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<Quote> {
  if (cart.lines.length === 0) throw new Error('cannot quote empty cart');
  const client = createClient({
    baseUrl: cart.agentBaseUrl,
    timeoutMs: opts.timeoutMs ?? 10_000,
    fetchImpl: opts.fetchImpl,
  });
  const protocolCart: Cart = {
    itemType: cart.itemType,
    currency: cart.currency,
    lines: cart.lines as Cart['lines'],
  };
  try {
    return await client.quote(protocolCart);
  } catch (err) {
    if (err instanceof OpenKartaError) throw err;
    throw new OpenKartaError('quote_failed', 0, (err as Error).message);
  }
}
```

> **Note on signature verification:** `quoteToken` is HMAC-signed by the agent with a key the orchestrator does not know — the agent verifies it on `checkout`. The orchestrator's job is to *carry the token unchanged* and not let the user mutate `totalMinor` between quote and checkout. We do that by passing the entire opaque `Quote.quoteToken` through to `checkoutCart`.

- [ ] **Step 3: Run + commit.**

```bash
pnpm --filter @openkarta/orchestrator test quote
git add packages/orchestrator/src/quote.ts packages/orchestrator/tests/quote.test.ts
git commit -m "feat(orchestrator): quote a cart through the agent"
```

---

### Task 3.3: Checkout passthrough + local order persistence

**Files:**
- Create: `packages/orchestrator/src/checkout.ts`
- Create: `packages/orchestrator/src/orders.ts`
- Create: `packages/orchestrator/tests/checkout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/checkout.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { newCart, addLine } from '../src/cart.js';
import { quoteCart } from '../src/quote.js';
import { checkoutCart } from '../src/checkout.js';
import { createOrderStore } from '../src/orders.js';

let url: string, stop: () => Promise<void>, tmp: string;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
  tmp = mkdtempSync(join(tmpdir(), 'okt-'));
});
afterAll(async () => { await stop(); rmSync(tmp, { recursive: true, force: true }); });

describe('checkoutCart', () => {
  it('places an order and persists it locally', async () => {
    let cart = newCart({ agentId: 'shop', agentBaseUrl: url, itemType: 'product', currency: 'INR' });
    cart = addLine(cart, { itemId: 'espresso_250g', quantity: 1 });
    const quote = await quoteCart(cart);
    const store = createOrderStore({ ordersFile: join(tmp, 'orders.json') });
    const order = await checkoutCart({
      cart, quote, payment: { method: 'cod' }, store,
    });
    expect(order.orderId).toBeTruthy();
    const all = await store.list();
    expect(all.find((o) => o.orderId === order.orderId)).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement `orders.ts`**

```ts
// packages/orchestrator/src/orders.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { OrderRecord } from './types.js';

export interface OrderStoreOptions { ordersFile?: string; }
export interface OrderStore {
  add(record: OrderRecord): Promise<void>;
  list(): Promise<OrderRecord[]>;
  find(orderId: string): Promise<OrderRecord | undefined>;
}

const DEFAULT_PATH = `${homedir()}/.openkarta/orders.json`;

export function createOrderStore(opts: OrderStoreOptions = {}): OrderStore {
  const file = opts.ordersFile ?? DEFAULT_PATH;

  async function readAll(): Promise<OrderRecord[]> {
    try {
      const raw = await readFile(file, 'utf-8');
      const parsed = JSON.parse(raw) as { orders?: OrderRecord[] };
      return Array.isArray(parsed.orders) ? parsed.orders : [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async function writeAll(records: OrderRecord[]): Promise<void> {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ version: 1, orders: records }, null, 2), 'utf-8');
  }

  return {
    async add(record) {
      const all = await readAll();
      all.push(record);
      await writeAll(all);
    },
    list: () => readAll(),
    async find(orderId) {
      const all = await readAll();
      return all.find((o) => o.orderId === orderId);
    },
  };
}
```

- [ ] **Step 3: Implement `checkout.ts`**

```ts
// packages/orchestrator/src/checkout.ts
import { createClient } from '@openkarta/sdk-node';
import type { Order, Quote } from '@openkarta/spec';
import type { OrchestratorCart } from './cart.js';
import type { OrderStore } from './orders.js';

export interface CheckoutInput {
  cart: OrchestratorCart;
  quote: Quote;
  payment: { method: string; ref?: string };
  userToken?: string;
  store?: OrderStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function checkoutCart(input: CheckoutInput): Promise<Order> {
  const client = createClient({
    baseUrl: input.cart.agentBaseUrl,
    timeoutMs: input.timeoutMs ?? 30_000,
    userToken: input.userToken,
    fetchImpl: input.fetchImpl,
  });
  const order = await client.checkout({
    quoteToken: input.quote.quoteToken,
    payment: input.payment,
  });
  if (input.store) {
    await input.store.add({
      orderId: order.orderId,
      agentId: input.cart.agentId,
      agentBaseUrl: input.cart.agentBaseUrl,
      itemType: input.cart.itemType,
      totalMinor: input.quote.totalMinor,
      currency: input.quote.currency,
      placedAt: new Date().toISOString(),
    });
  }
  return order;
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test checkout
git add packages/orchestrator/src/checkout.ts packages/orchestrator/src/orders.ts packages/orchestrator/tests/checkout.test.ts
git commit -m "feat(orchestrator): checkout passthrough + local order store"
```

---

### Task 3.4: Re-export cart/quote/checkout from the barrel

**Files:**
- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: Append exports**

```ts
// packages/orchestrator/src/index.ts (append)
export { newCart, addLine } from './cart.js';
export type { OrchestratorCart } from './cart.js';
export { quoteCart } from './quote.js';
export { checkoutCart } from './checkout.js';
export type { CheckoutInput } from './checkout.js';
export { createOrderStore } from './orders.js';
export type { OrderStore, OrderStoreOptions } from './orders.js';
```

- [ ] **Step 2: Build + commit**

```bash
pnpm --filter @openkarta/orchestrator build
git add packages/orchestrator/src/index.ts
git commit -m "chore(orchestrator): export cart/quote/checkout from barrel"
```

---

## Phase 4 — Status, cancel, return (Day 7, ~5 hours)

### Task 4.1: Order status reader

**Files:**
- Modify: `packages/orchestrator/src/orders.ts`
- Create: `packages/orchestrator/tests/orders.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/orchestrator/tests/orders.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { newCart, addLine } from '../src/cart.js';
import { quoteCart } from '../src/quote.js';
import { checkoutCart } from '../src/checkout.js';
import { createOrderStore, getOrderStatus, cancelOrder, returnOrder } from '../src/orders.js';

let url: string, stop: () => Promise<void>, tmp: string;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
  tmp = mkdtempSync(join(tmpdir(), 'okt-'));
});
afterAll(async () => { await stop(); rmSync(tmp, { recursive: true, force: true }); });

async function placeOrder() {
  let cart = newCart({ agentId: 'shop', agentBaseUrl: url, itemType: 'product', currency: 'INR' });
  cart = addLine(cart, { itemId: 'espresso_250g', quantity: 1 });
  const quote = await quoteCart(cart);
  const store = createOrderStore({ ordersFile: join(tmp, 'orders.json') });
  const order = await checkoutCart({ cart, quote, payment: { method: 'cod' }, store });
  return { order, store };
}

describe('order operations', () => {
  it('reads status by orderId', async () => {
    const { order, store } = await placeOrder();
    const s = await getOrderStatus(order.orderId, { store });
    expect(s.orderId).toBe(order.orderId);
    expect(s.fulfilmentStatus).toBeTruthy();
  });

  it('cancels an order', async () => {
    const { order, store } = await placeOrder();
    const s = await cancelOrder(order.orderId, 'changed mind', { store });
    expect(['cancelled', 'cancellation_pending']).toContain(s.fulfilmentStatus);
  });

  it('initiates a return', async () => {
    const { order, store } = await placeOrder();
    const s = await returnOrder(order.orderId, 'damaged on arrival', { store });
    expect(s.orderId).toBe(order.orderId);
  });
});
```

- [ ] **Step 2: Add operations to `orders.ts`**

```ts
// packages/orchestrator/src/orders.ts (append)
import { createClient } from '@openkarta/sdk-node';
import type { OrderStatus } from '@openkarta/spec';

export interface OrderOpOptions {
  store: OrderStore;
  userToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function clientForOrder(orderId: string, opts: OrderOpOptions) {
  const rec = await opts.store.find(orderId);
  if (!rec) throw new Error(`order not found locally: ${orderId}`);
  return createClient({
    baseUrl: rec.agentBaseUrl,
    timeoutMs: opts.timeoutMs ?? 15_000,
    userToken: opts.userToken,
    fetchImpl: opts.fetchImpl,
  });
}

export async function getOrderStatus(orderId: string, opts: OrderOpOptions): Promise<OrderStatus> {
  const client = await clientForOrder(orderId, opts);
  return client.status(orderId);
}

export async function cancelOrder(orderId: string, reason: string, opts: OrderOpOptions): Promise<OrderStatus> {
  const client = await clientForOrder(orderId, opts);
  return client.cancel(orderId, reason);
}

export async function returnOrder(orderId: string, reason: string, opts: OrderOpOptions): Promise<OrderStatus> {
  const client = await clientForOrder(orderId, opts);
  return client.return(orderId, reason);
}
```

- [ ] **Step 3: Re-export**

```ts
// packages/orchestrator/src/index.ts (append)
export { getOrderStatus, cancelOrder, returnOrder } from './orders.js';
export type { OrderOpOptions } from './orders.js';
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test orders
git add packages/orchestrator/src/orders.ts packages/orchestrator/src/index.ts packages/orchestrator/tests/orders.test.ts
git commit -m "feat(orchestrator): order status + cancel + return"
```

---

### Task 4.2: E2E coverage for stay and flight verticals

The orchestrator must work for every item type the protocol defines. Add e2e tests against the stays and travel reference agents.

**Files:**
- Create: `packages/orchestrator/tests/e2e-stay.test.ts`
- Create: `packages/orchestrator/tests/e2e-flight.test.ts`

- [ ] **Step 1: Write `e2e-stay.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-stays/dist/agent.js';
import { createOrchestrator, newCart, addLine, quoteCart, checkoutCart, createOrderStore } from '../src/index.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let url: string, stop: () => Promise<void>, tmp: string;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-stays/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
  tmp = mkdtempSync(join(tmpdir(), 'okt-stay-'));
});
afterAll(async () => { await stop(); rmSync(tmp, { recursive: true, force: true }); });

describe('orchestrator e2e (stay)', () => {
  it('search → cart → quote → checkout → status', async () => {
    const orch = createOrchestrator({
      registry: { version: '0.1', updated: '2026-04-24', agents: [
        { agentId: 'stays', displayName: 'Stays', baseUrl: url, tier: 'http',
          supportedItemTypes: ['stay'], regions: [{ country: 'IN' }], addedAt: '2026-04-24' },
      ]},
    });
    const results = await orch.search({ itemType: 'stay' });
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];

    let cart = newCart({ agentId: top.agentId, agentBaseUrl: url, itemType: 'stay', currency: 'INR' });
    cart = addLine(cart, { itemId: top.item.itemId, quantity: 1 });
    const quote = await quoteCart(cart);
    const store = createOrderStore({ ordersFile: join(tmp, 'orders.json') });
    const order = await checkoutCart({ cart, quote, payment: { method: 'cod' }, store });
    expect(order.orderId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Write `e2e-flight.test.ts`** — identical structure but importing from `@openkarta/reference-agent-travel/dist/agent.js` and using `itemType: 'flight'`.

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test e2e-stay e2e-flight
git add packages/orchestrator/tests/e2e-stay.test.ts packages/orchestrator/tests/e2e-flight.test.ts
git commit -m "test(orchestrator): e2e coverage for stay + flight"
```

---

## Phase 5 — LLM bridge (Days 8-9, ~10 hours)

### Task 5.1: Convert orchestrator schemas to Anthropic tool definitions

**Files:**
- Create: `packages/orchestrator/src/llm/tool-defs.ts`
- Create: `packages/orchestrator/tests/llm-tool-defs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildToolDefs, TOOL_NAMES } from '../src/llm/tool-defs.js';

describe('buildToolDefs', () => {
  it('produces one definition per orchestrator action', () => {
    const defs = buildToolDefs();
    expect(defs.map((d) => d.name).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('every def has an input_schema with type:object', () => {
    for (const d of buildToolDefs()) {
      expect(d.input_schema.type).toBe('object');
    }
  });
});
```

- [ ] **Step 2: Implement**

```ts
// packages/orchestrator/src/llm/tool-defs.ts
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

export const TOOL_NAMES = [
  'search', 'add_to_cart', 'view_cart', 'quote', 'checkout',
  'order_status', 'cancel_order', 'return_order',
] as const;

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

const itemTypeEnum = z.enum(['product', 'stay', 'flight', 'bus', 'service']);

const Schemas = {
  search: z.object({
    itemType: itemTypeEnum,
    q: z.string().optional().describe('Free-text query'),
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
  }),
  add_to_cart: z.object({
    agentId: z.string(),
    itemId: z.string(),
    quantity: z.number().int().min(1).default(1),
  }),
  view_cart: z.object({}),
  quote: z.object({}),
  checkout: z.object({
    paymentMethod: z.string().describe('e.g. cod, razorpay_routes, stripe_connect'),
    paymentRef: z.string().optional(),
  }),
  order_status: z.object({ orderId: z.string() }),
  cancel_order: z.object({ orderId: z.string(), reason: z.string() }),
  return_order: z.object({ orderId: z.string(), reason: z.string() }),
} as const;

const Descriptions: Record<typeof TOOL_NAMES[number], string> = {
  search: 'Search across registered OpenKarta agents for items of a given type.',
  add_to_cart: 'Add an item to the current homogeneous cart. The cart is bound to a single agent and item type.',
  view_cart: 'Return the current cart contents.',
  quote: 'Quote the current cart against the agent. Returns price + signed token.',
  checkout: 'Place an order using the verified quote token + a payment.',
  order_status: 'Read fulfilment status for a placed order.',
  cancel_order: 'Cancel an open order with a reason.',
  return_order: 'Initiate a return for a delivered order.',
};

export function buildToolDefs(): AnthropicToolDef[] {
  return TOOL_NAMES.map((name) => ({
    name,
    description: Descriptions[name],
    input_schema: zodToJsonSchema(Schemas[name], { target: 'openApi3' }) as AnthropicToolDef['input_schema'],
  }));
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test llm-tool-defs
git add packages/orchestrator/src/llm/tool-defs.ts packages/orchestrator/tests/llm-tool-defs.test.ts
git commit -m "feat(orchestrator): Anthropic tool definitions for the 8 orchestrator actions"
```

---

### Task 5.2: Tool dispatcher with conversation memory

**Files:**
- Create: `packages/orchestrator/src/llm/memory.ts`
- Create: `packages/orchestrator/src/llm/dispatcher.ts`
- Create: `packages/orchestrator/tests/llm-dispatcher.test.ts`

- [ ] **Step 1: Implement `memory.ts`**

```ts
// packages/orchestrator/src/llm/memory.ts
import type { OrchestratorCart } from '../cart.js';

export interface ConversationState {
  cart?: OrchestratorCart;
  lastQuote?: { token: string; totalMinor: number; currency: string; expiresAt: string };
  lastSearch?: { itemType: string; agentIdsSeen: string[] };
}

export function newState(): ConversationState { return {}; }
```

- [ ] **Step 2: Write the failing dispatcher test**

```ts
// packages/orchestrator/tests/llm-dispatcher.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createOrchestrator } from '../src/orchestrator.js';
import { createDispatcher } from '../src/llm/dispatcher.js';
import { newState } from '../src/llm/memory.js';

let url: string, stop: () => Promise<void>;
beforeAll(async () => {
  const fx = loadFixtures('packages/reference-agent-shop/dist/fixtures');
  ({ url, stop } = await bootAgent(fx, 0, 'test-secret-32-bytes-________'));
});
afterAll(async () => { await stop(); });

describe('dispatcher', () => {
  it('search → add_to_cart → view_cart works through tool calls', async () => {
    const orch = createOrchestrator({
      registry: { version: '0.1', updated: '2026-04-24', agents: [
        { agentId: 'a', displayName: 'A', baseUrl: url, tier: 'http',
          supportedItemTypes: ['product'], regions: [{ country: 'IN' }], addedAt: '2026-04-24' },
      ]},
    });
    const state = newState();
    const dispatch = createDispatcher(orch, state);

    const sRes = await dispatch('search', { itemType: 'product', q: 'coffee' });
    expect(Array.isArray(sRes)).toBe(true);
    expect(sRes.length).toBeGreaterThan(0);
    const first = (sRes as { agentId: string; itemId: string }[])[0];

    await dispatch('add_to_cart', { agentId: first.agentId, itemId: first.itemId, quantity: 1 });
    const cart = await dispatch('view_cart', {});
    expect((cart as { lines: unknown[] }).lines.length).toBe(1);
  });
});
```

- [ ] **Step 3: Implement `dispatcher.ts`**

```ts
// packages/orchestrator/src/llm/dispatcher.ts
import type { Orchestrator } from '../orchestrator.js';
import type { ConversationState } from './memory.js';
import type { ItemType } from '@openkarta/spec';
import { newCart, addLine, type OrchestratorCart } from '../cart.js';
import { quoteCart } from '../quote.js';
import { checkoutCart } from '../checkout.js';
import { getOrderStatus, cancelOrder, returnOrder, createOrderStore } from '../orders.js';

export type DispatchFn = (toolName: string, input: Record<string, unknown>) => Promise<unknown>;

export function createDispatcher(orch: Orchestrator, state: ConversationState, opts: { ordersFile?: string } = {}): DispatchFn {
  const store = createOrderStore({ ordersFile: opts.ordersFile });

  return async function dispatch(toolName, input) {
    switch (toolName) {
      case 'search': {
        const results = await orch.search({
          itemType: input.itemType as ItemType,
          q: input.q as string | undefined,
          region: input.country
            ? { country: input.country as string, city: input.city as string | undefined, pincode: input.pincode as string | undefined }
            : undefined,
        });
        state.lastSearch = {
          itemType: input.itemType as string,
          agentIdsSeen: Array.from(new Set(results.map((r) => r.agentId))),
        };
        // Return a compact projection — full RankedResult is too large for LLM context.
        return results.slice(0, 10).map((r) => ({
          agentId: r.agentId, agentDisplayName: r.agentDisplayName,
          itemId: r.item.itemId,
          title: (r.item as { title?: string }).title,
          priceMinor: (r.item as { priceMinor?: number }).priceMinor,
          currency: (r.item as { currency?: string }).currency,
        }));
      }
      case 'add_to_cart': {
        const agentId = input.agentId as string;
        const itemId = input.itemId as string;
        const quantity = (input.quantity as number | undefined) ?? 1;
        if (!state.cart) {
          if (!state.lastSearch) throw new Error('call search first to bind a cart context');
          // Look up the agent baseUrl + currency by querying the orchestrator's registry view —
          // simplest: a fresh search-by-id is overkill, so we go through orch.search again.
          const sample = await orch.search({ itemType: state.lastSearch.itemType as ItemType, agentIds: [agentId] });
          if (sample.length === 0) throw new Error(`agent ${agentId} returned no items for type ${state.lastSearch.itemType}`);
          const baseUrl = sample[0].manifest.baseUrl;
          const currency = (sample[0].item as { currency?: string }).currency ?? 'INR';
          state.cart = newCart({
            agentId, agentBaseUrl: baseUrl,
            itemType: state.lastSearch.itemType as ItemType, currency,
          });
        }
        if (state.cart.agentId !== agentId) {
          throw new Error(`cart is bound to ${state.cart.agentId}; cannot add items from ${agentId}`);
        }
        state.cart = addLine(state.cart, { itemId, quantity });
        return { ok: true, lines: state.cart.lines.length };
      }
      case 'view_cart': {
        return state.cart ?? { lines: [] };
      }
      case 'quote': {
        if (!state.cart) throw new Error('cart is empty');
        const q = await quoteCart(state.cart);
        state.lastQuote = { token: q.quoteToken, totalMinor: q.totalMinor, currency: q.currency, expiresAt: q.expiresAt };
        return { totalMinor: q.totalMinor, currency: q.currency, expiresAt: q.expiresAt };
      }
      case 'checkout': {
        if (!state.cart || !state.lastQuote) throw new Error('quote first, then checkout');
        const order = await checkoutCart({
          cart: state.cart,
          quote: { quoteToken: state.lastQuote.token, totalMinor: state.lastQuote.totalMinor, currency: state.lastQuote.currency, expiresAt: state.lastQuote.expiresAt } as never,
          payment: { method: input.paymentMethod as string, ref: input.paymentRef as string | undefined },
          store,
        });
        return { orderId: order.orderId };
      }
      case 'order_status':
        return getOrderStatus(input.orderId as string, { store });
      case 'cancel_order':
        return cancelOrder(input.orderId as string, input.reason as string, { store });
      case 'return_order':
        return returnOrder(input.orderId as string, input.reason as string, { store });
      default:
        throw new Error(`unknown tool: ${toolName}`);
    }
  };
}
```

- [ ] **Step 4: Re-export**

```ts
// packages/orchestrator/src/index.ts (append)
export { buildToolDefs, TOOL_NAMES } from './llm/tool-defs.js';
export type { AnthropicToolDef } from './llm/tool-defs.js';
export { createDispatcher } from './llm/dispatcher.js';
export type { DispatchFn } from './llm/dispatcher.js';
export { newState } from './llm/memory.js';
export type { ConversationState } from './llm/memory.js';
```

- [ ] **Step 5: Run + commit**

```bash
pnpm --filter @openkarta/orchestrator test llm-dispatcher
git add packages/orchestrator/src/llm/ packages/orchestrator/src/index.ts packages/orchestrator/tests/llm-dispatcher.test.ts
git commit -m "feat(orchestrator): LLM tool dispatcher with conversation memory"
```

---

### Task 5.3: Anthropic chat loop (`chat.ts`)

A minimal `chat()` helper that owns the multi-turn loop: send messages, dispatch tool calls, send tool results back, repeat until the model emits a non-tool response or hits a guard.

**Files:**
- Create: `packages/orchestrator/src/llm/chat.ts`

> **Note:** No automated test for this task — it requires an Anthropic API key. The CLI's `openkarta chat` command (Task 6.5) gates this behind an `ANTHROPIC_API_KEY` check. Manual verification only.

- [ ] **Step 1: Implement `chat.ts`**

```ts
// packages/orchestrator/src/llm/chat.ts
import Anthropic from '@anthropic-ai/sdk';
import { buildToolDefs } from './tool-defs.js';
import type { DispatchFn } from './dispatcher.js';

export interface ChatTurn { role: 'user' | 'assistant'; text: string; }

export interface ChatLoopOptions {
  apiKey: string;
  model?: string;             // default: 'claude-opus-4-7'
  systemPrompt?: string;
  maxIterations?: number;     // safety guard, default 10
  onToolUse?: (name: string, input: unknown) => void;
}

const DEFAULT_SYSTEM = `You are an OpenKarta consumer agent. You orchestrate calls across a federated registry of merchants using these tools.
Guidelines:
- Always search before adding to cart.
- A cart is bound to ONE agent and ONE item type. Don't try to mix.
- Quote before checkout. Show the price to the user before charging.
- Prefer explicit confirmation before checkout.`;

export async function chatOnce(history: ChatTurn[], dispatch: DispatchFn, opts: ChatLoopOptions): Promise<{ history: ChatTurn[]; finalText: string; }> {
  const anthropic = new Anthropic({ apiKey: opts.apiKey });
  const tools = buildToolDefs();
  const messages: Anthropic.Messages.MessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));
  const maxIter = opts.maxIterations ?? 10;

  let finalText = '';
  for (let i = 0; i < maxIter; i++) {
    const resp = await anthropic.messages.create({
      model: opts.model ?? 'claude-opus-4-7',
      max_tokens: 1024,
      system: opts.systemPrompt ?? DEFAULT_SYSTEM,
      tools: tools as never,
      messages,
    });

    const textBlocks = resp.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text');
    const toolUses  = resp.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use');

    if (toolUses.length === 0) {
      finalText = textBlocks.map((b) => b.text).join('\n').trim();
      messages.push({ role: 'assistant', content: resp.content });
      break;
    }

    messages.push({ role: 'assistant', content: resp.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      opts.onToolUse?.(tu.name, tu.input);
      try {
        const result = await dispatch(tu.name, tu.input as Record<string, unknown>);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      } catch (err) {
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: (err as Error).message });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    history: [...history, { role: 'assistant', text: finalText }],
    finalText,
  };
}
```

- [ ] **Step 2: Re-export + commit**

```ts
// packages/orchestrator/src/index.ts (append)
export { chatOnce } from './llm/chat.js';
export type { ChatTurn, ChatLoopOptions } from './llm/chat.js';
```

```bash
pnpm --filter @openkarta/orchestrator build
git add packages/orchestrator/src/llm/chat.ts packages/orchestrator/src/index.ts
git commit -m "feat(orchestrator): Anthropic chat loop with tool dispatch"
```

---

## Phase 6 — CLI commands (Days 10-11, ~10 hours)

### Task 6.1: Storage + output helpers

**Files:**
- Create: `packages/cli/src/storage.ts`
- Create: `packages/cli/src/output.ts`
- Create: `packages/cli/tests/storage.test.ts`

- [ ] **Step 1: Implement `storage.ts`**

```ts
// packages/cli/src/storage.ts
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

export const OPENKARTA_DIR = process.env.OPENKARTA_HOME ?? join(homedir(), '.openkarta');
export const ORDERS_FILE   = join(OPENKARTA_DIR, 'orders.json');
export const STATE_FILE    = join(OPENKARTA_DIR, 'cart.json');

export async function readState(): Promise<unknown> {
  try {
    const raw = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeState(state: unknown): Promise<void> {
  await mkdir(OPENKARTA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function clearState(): Promise<void> {
  try { await writeFile(STATE_FILE, 'null', 'utf-8'); } catch { /* ignore */ }
}
```

- [ ] **Step 2: Implement `output.ts`**

```ts
// packages/cli/src/output.ts
import kleur from 'kleur';
import Table from 'cli-table3';

export function formatPrice(minor: number | undefined, currency = 'INR'): string {
  if (minor === undefined) return '—';
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function searchTable(rows: { agentId: string; agentDisplayName: string; itemId: string; title?: string; priceMinor?: number; currency?: string }[]): string {
  const t = new Table({
    head: [kleur.bold('Agent'), kleur.bold('Item'), kleur.bold('Title'), kleur.bold('Price')],
    style: { head: [], border: ['gray'] },
  });
  for (const r of rows) {
    t.push([
      r.agentDisplayName,
      kleur.dim(r.itemId),
      r.title ?? kleur.dim('(untitled)'),
      formatPrice(r.priceMinor, r.currency),
    ]);
  }
  return t.toString();
}

export function info(msg: string): void { process.stdout.write(`${kleur.cyan('•')} ${msg}\n`); }
export function ok(msg: string): void   { process.stdout.write(`${kleur.green('✓')} ${msg}\n`); }
export function warn(msg: string): void { process.stderr.write(`${kleur.yellow('!')} ${msg}\n`); }
export function error(msg: string): void { process.stderr.write(`${kleur.red('✗')} ${msg}\n`); }
```

- [ ] **Step 3: Storage test**

```ts
// packages/cli/tests/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

beforeEach(() => {
  process.env.OPENKARTA_HOME = mkdtempSync(join(tmpdir(), 'okt-cli-'));
});

describe('storage', () => {
  it('round-trips state', async () => {
    const { readState, writeState } = await import('../src/storage.js');
    await writeState({ hello: 'world' });
    expect(await readState()).toEqual({ hello: 'world' });
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @openkarta/cli test
git add packages/cli/src/storage.ts packages/cli/src/output.ts packages/cli/tests/storage.test.ts
git commit -m "feat(cli): storage + output helpers"
```

---

### Task 6.2: `openkarta search` command

**Files:**
- Create: `packages/cli/src/commands/search.ts`
- Modify: `packages/cli/src/program.ts`

- [ ] **Step 1: Implement `search.ts`**

```ts
// packages/cli/src/commands/search.ts
import { Command } from 'commander';
import { createOrchestrator } from '@openkarta/orchestrator';
import type { ItemType } from '@openkarta/spec';
import { searchTable, info, error as printError } from '../output.js';

export function searchCommand(): Command {
  return new Command('search')
    .description('Search across registered OpenKarta agents')
    .requiredOption('-t, --type <itemType>', 'product | stay | flight | bus | service')
    .option('-q, --query <text>', 'Free-text query')
    .option('--country <code>', 'Two-letter country code, e.g. IN')
    .option('--city <name>', 'City filter')
    .option('--pincode <code>', 'Pincode filter')
    .option('--registry <url>', 'Override registry URL')
    .action(async (opts: { type: string; query?: string; country?: string; city?: string; pincode?: string; registry?: string }) => {
      try {
        const orch = createOrchestrator({ registryUrl: opts.registry });
        const results = await orch.search({
          itemType: opts.type as ItemType,
          q: opts.query,
          region: opts.country ? { country: opts.country, city: opts.city, pincode: opts.pincode } : undefined,
        });
        if (results.length === 0) {
          info('no results');
          return;
        }
        process.stdout.write(`\n${searchTable(results.map((r) => ({
          agentId: r.agentId, agentDisplayName: r.agentDisplayName,
          itemId: r.item.itemId,
          title: (r.item as { title?: string }).title,
          priceMinor: (r.item as { priceMinor?: number }).priceMinor,
          currency: (r.item as { currency?: string }).currency,
        })))}\n\n`);
      } catch (err) {
        printError((err as Error).message);
        process.exitCode = 1;
      }
    });
}
```

- [ ] **Step 2: Wire into program**

```ts
// packages/cli/src/program.ts (replace)
import { Command } from 'commander';
import { searchCommand } from './commands/search.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('openkarta')
    .description('OpenKarta consumer CLI — discover agents, build carts, check out')
    .version('0.2.0');

  program.addCommand(searchCommand());
  return program;
}
```

- [ ] **Step 3: Smoke test manually**

```bash
pnpm --filter @openkarta/cli build
node packages/cli/dist/bin.js search --type product --registry file://$(pwd)/packages/orchestrator/fixtures/agents-fixture.json
# Expected: an error or empty result (the fixture's baseUrl is example.invalid).
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/search.ts packages/cli/src/program.ts
git commit -m "feat(cli): openkarta search subcommand"
```

---

### Task 6.3: `openkarta cart` subcommands

**Files:**
- Create: `packages/cli/src/commands/cart.ts`
- Modify: `packages/cli/src/program.ts`

- [ ] **Step 1: Implement `cart.ts`**

```ts
// packages/cli/src/commands/cart.ts
import { Command } from 'commander';
import type { ItemType } from '@openkarta/spec';
import { newCart, addLine, type OrchestratorCart } from '@openkarta/orchestrator';
import { readState, writeState, clearState } from '../storage.js';
import { info, ok, error as printError } from '../output.js';

async function loadCart(): Promise<OrchestratorCart | null> {
  const s = await readState();
  return (s as { cart?: OrchestratorCart })?.cart ?? null;
}

async function saveCart(cart: OrchestratorCart): Promise<void> {
  await writeState({ cart });
}

export function cartCommand(): Command {
  const c = new Command('cart').description('Manage the local cart');

  c.command('init')
    .description('Initialise an empty cart bound to an agent + item type')
    .requiredOption('--agent-id <id>', 'agentId from a search result')
    .requiredOption('--base-url <url>', 'agent baseUrl')
    .requiredOption('--type <itemType>', 'product | stay | flight | bus | service')
    .option('--currency <code>', 'currency code', 'INR')
    .action(async (opts: { agentId: string; baseUrl: string; type: string; currency: string }) => {
      const cart = newCart({
        agentId: opts.agentId, agentBaseUrl: opts.baseUrl,
        itemType: opts.type as ItemType, currency: opts.currency,
      });
      await saveCart(cart);
      ok(`new cart for ${opts.agentId} (${opts.type})`);
    });

  c.command('add')
    .description('Add a line to the current cart')
    .requiredOption('--item-id <id>', 'itemId from a search result')
    .option('-n, --quantity <n>', 'quantity', '1')
    .action(async (opts: { itemId: string; quantity: string }) => {
      const cart = await loadCart();
      if (!cart) { printError('no cart — run "openkarta cart init" first'); process.exitCode = 1; return; }
      const updated = addLine(cart, { itemId: opts.itemId, quantity: parseInt(opts.quantity, 10) });
      await saveCart(updated);
      ok(`added ${opts.quantity} × ${opts.itemId} (${updated.lines.length} lines total)`);
    });

  c.command('show')
    .description('Print the current cart')
    .action(async () => {
      const cart = await loadCart();
      if (!cart) { info('cart is empty'); return; }
      process.stdout.write(`${JSON.stringify(cart, null, 2)}\n`);
    });

  c.command('clear')
    .description('Clear the current cart')
    .action(async () => { await clearState(); ok('cart cleared'); });

  return c;
}
```

- [ ] **Step 2: Wire + commit**

```ts
// packages/cli/src/program.ts (append)
import { cartCommand } from './commands/cart.js';
// inside buildProgram(), after searchCommand:
program.addCommand(cartCommand());
```

```bash
pnpm --filter @openkarta/cli build
git add packages/cli/src/commands/cart.ts packages/cli/src/program.ts
git commit -m "feat(cli): openkarta cart {init,add,show,clear}"
```

---

### Task 6.4: `openkarta checkout` and `openkarta orders` commands

**Files:**
- Create: `packages/cli/src/commands/checkout.ts`
- Create: `packages/cli/src/commands/orders.ts`
- Modify: `packages/cli/src/program.ts`

- [ ] **Step 1: Implement `checkout.ts`**

```ts
// packages/cli/src/commands/checkout.ts
import { Command } from 'commander';
import { quoteCart, checkoutCart, createOrderStore } from '@openkarta/orchestrator';
import { readState, ORDERS_FILE } from '../storage.js';
import { info, ok, error as printError } from '../output.js';
import { formatPrice } from '../output.js';

export function checkoutCommand(): Command {
  return new Command('checkout')
    .description('Quote the cart and place the order')
    .requiredOption('--payment <method>', 'cod | razorpay_routes | stripe_connect | …')
    .option('--payment-ref <ref>', 'optional payment reference')
    .option('-y, --yes', 'skip the price-confirmation prompt', false)
    .action(async (opts: { payment: string; paymentRef?: string; yes: boolean }) => {
      const s = await readState();
      const cart = (s as { cart?: import('@openkarta/orchestrator').OrchestratorCart })?.cart;
      if (!cart || cart.lines.length === 0) { printError('cart is empty'); process.exitCode = 1; return; }

      info('quoting cart…');
      const q = await quoteCart(cart);
      info(`total: ${formatPrice(q.totalMinor, q.currency)} (expires ${q.expiresAt})`);

      if (!opts.yes) {
        info('re-run with --yes to confirm');
        return;
      }

      const store = createOrderStore({ ordersFile: ORDERS_FILE });
      const order = await checkoutCart({
        cart, quote: q, payment: { method: opts.payment, ref: opts.paymentRef }, store,
      });
      ok(`placed: ${order.orderId}`);
    });
}
```

- [ ] **Step 2: Implement `orders.ts`**

```ts
// packages/cli/src/commands/orders.ts
import { Command } from 'commander';
import { createOrderStore, getOrderStatus, cancelOrder, returnOrder } from '@openkarta/orchestrator';
import { ORDERS_FILE } from '../storage.js';
import { info, ok, error as printError } from '../output.js';

const store = () => createOrderStore({ ordersFile: ORDERS_FILE });

export function ordersCommand(): Command {
  const c = new Command('orders').description('Manage placed orders');

  c.command('list')
    .description('List locally tracked orders')
    .action(async () => {
      const all = await store().list();
      if (all.length === 0) { info('no orders yet'); return; }
      for (const o of all) process.stdout.write(`${o.orderId}\t${o.agentId}\t${o.itemType}\t${o.placedAt}\n`);
    });

  c.command('status <orderId>')
    .description('Read the latest fulfilment status')
    .action(async (orderId: string) => {
      try {
        const s = await getOrderStatus(orderId, { store: store() });
        process.stdout.write(`${JSON.stringify(s, null, 2)}\n`);
      } catch (err) { printError((err as Error).message); process.exitCode = 1; }
    });

  c.command('cancel <orderId>')
    .description('Cancel an order')
    .requiredOption('--reason <text>', 'why cancel')
    .action(async (orderId: string, opts: { reason: string }) => {
      const s = await cancelOrder(orderId, opts.reason, { store: store() });
      ok(`status: ${s.fulfilmentStatus}`);
    });

  c.command('return <orderId>')
    .description('Initiate a return')
    .requiredOption('--reason <text>', 'why return')
    .action(async (orderId: string, opts: { reason: string }) => {
      const s = await returnOrder(orderId, opts.reason, { store: store() });
      ok(`status: ${s.fulfilmentStatus}`);
    });

  return c;
}
```

- [ ] **Step 3: Wire + commit**

```ts
// packages/cli/src/program.ts (append)
import { checkoutCommand } from './commands/checkout.js';
import { ordersCommand } from './commands/orders.js';
program.addCommand(checkoutCommand());
program.addCommand(ordersCommand());
```

```bash
pnpm --filter @openkarta/cli build
git add packages/cli/src/commands/checkout.ts packages/cli/src/commands/orders.ts packages/cli/src/program.ts
git commit -m "feat(cli): checkout + orders commands"
```

---

### Task 6.5: `openkarta chat` (LLM-bridged)

**Files:**
- Create: `packages/cli/src/commands/chat.ts`
- Modify: `packages/cli/src/program.ts`

- [ ] **Step 1: Implement `chat.ts`**

```ts
// packages/cli/src/commands/chat.ts
import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createOrchestrator, createDispatcher, newState, chatOnce, type ChatTurn } from '@openkarta/orchestrator';
import { ORDERS_FILE } from '../storage.js';
import { info, error as printError } from '../output.js';

export function chatCommand(): Command {
  return new Command('chat')
    .description('Natural-language interface (uses Anthropic; needs ANTHROPIC_API_KEY)')
    .option('--registry <url>', 'override registry URL')
    .option('--model <id>', 'Anthropic model id', 'claude-opus-4-7')
    .action(async (opts: { registry?: string; model: string }) => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { printError('ANTHROPIC_API_KEY is not set'); process.exitCode = 1; return; }

      const orch = createOrchestrator({ registryUrl: opts.registry });
      const state = newState();
      const dispatch = createDispatcher(orch, state, { ordersFile: ORDERS_FILE });

      const rl = createInterface({ input: stdin, output: stdout });
      info('chat session started — Ctrl+C to exit');

      const history: ChatTurn[] = [];
      while (true) {
        const userInput = await rl.question('\nyou › ');
        if (!userInput.trim()) continue;
        history.push({ role: 'user', text: userInput });
        try {
          const { history: nextHistory, finalText } = await chatOnce(history, dispatch, {
            apiKey, model: opts.model,
            onToolUse: (name) => info(`→ ${name}`),
          });
          history.length = 0; history.push(...nextHistory);
          process.stdout.write(`\nbot › ${finalText}\n`);
        } catch (err) { printError((err as Error).message); }
      }
    });
}
```

- [ ] **Step 2: Wire + commit**

```ts
// packages/cli/src/program.ts (append)
import { chatCommand } from './commands/chat.js';
program.addCommand(chatCommand());
```

```bash
pnpm --filter @openkarta/cli build
git add packages/cli/src/commands/chat.ts packages/cli/src/program.ts
git commit -m "feat(cli): openkarta chat — Anthropic-bridged REPL"
```

---

## Phase 7 — Conformance, docs, release (Day 12, ~6 hours)

### Task 7.1: End-to-end smoke against all three reference agents

**Files:**
- Modify: `scripts/conformance-smoke.sh`
- Create: `scripts/orchestrator-smoke.sh`

- [ ] **Step 1: Create `scripts/orchestrator-smoke.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
# Boots all 3 reference agents, runs orchestrator e2e tests against them, then tears down.
pnpm --filter '@openkarta/reference-agent-shop'   build
pnpm --filter '@openkarta/reference-agent-stays'  build
pnpm --filter '@openkarta/reference-agent-travel' build
pnpm --filter '@openkarta/orchestrator' test e2e-product e2e-stay e2e-flight
echo "orchestrator smoke ✓"
```

```bash
chmod +x scripts/orchestrator-smoke.sh
```

- [ ] **Step 2: Run it**

```bash
bash scripts/orchestrator-smoke.sh
```
Expected: all three e2e tests pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/orchestrator-smoke.sh
git commit -m "chore: orchestrator e2e smoke script"
```

---

### Task 7.2: User-facing docs

**Files:**
- Create: `docs/orchestrator.md`
- Create: `docs/cli.md`
- Modify: `README.md`

- [ ] **Step 1: Write `docs/orchestrator.md`**

```markdown
# @openkarta/orchestrator

Embed the OpenKarta consumer flow in any Node app.

## Install

```bash
npm install @openkarta/orchestrator
```

## Quick start

```ts
import { createOrchestrator, newCart, addLine, quoteCart, checkoutCart, createOrderStore } from '@openkarta/orchestrator';

const orch = createOrchestrator();   // uses the public registry by default

const results = await orch.search({ itemType: 'product', q: 'coffee', region: { country: 'IN' } });
const top = results[0];

let cart = newCart({
  agentId: top.agentId,
  agentBaseUrl: top.manifest.baseUrl,
  itemType: 'product',
  currency: 'INR',
});
cart = addLine(cart, { itemId: top.item.itemId, quantity: 1 });

const quote = await quoteCart(cart);
const order = await checkoutCart({
  cart, quote,
  payment: { method: 'cod' },
  store: createOrderStore(),
});
console.log('placed', order.orderId);
```

## API

- `createOrchestrator(opts)` — factory.
- `newCart`, `addLine` — immutable cart builder; carts are bound to a single agent + item type.
- `quoteCart(cart)` — returns a `Quote` with a signed token. Pass it to `checkoutCart` unchanged.
- `checkoutCart({ cart, quote, payment, store })` — places the order.
- `getOrderStatus`, `cancelOrder`, `returnOrder` — order lifecycle.
- `chatOnce(history, dispatch, { apiKey })` — Anthropic-bridged tool-calling loop.

See [`docs/protocol/v0.1.md`](protocol/v0.1.md) for the wire contract this composes.
```

- [ ] **Step 2: Write `docs/cli.md`**

```markdown
# `openkarta` CLI

```bash
npm install -g @openkarta/cli
openkarta --help
```

## Commands

| Command | Description |
|---|---|
| `openkarta search --type <type> [--query …]` | Search across registered agents |
| `openkarta cart init --agent-id … --base-url … --type …` | Bind a new cart |
| `openkarta cart add --item-id … [-n N]` | Add a line |
| `openkarta cart show` / `clear` | Inspect / discard |
| `openkarta checkout --payment <method> [--yes]` | Quote and place |
| `openkarta orders list / status / cancel / return` | Lifecycle |
| `openkarta chat` | Natural-language REPL (needs `ANTHROPIC_API_KEY`) |

State is stored at `~/.openkarta/` (override with `OPENKARTA_HOME`).

## Examples

```bash
# 1. Find coffee in IN
openkarta search --type product --query coffee --country IN

# 2. Bind a cart to the first result you liked
openkarta cart init --agent-id halcyon-shop --base-url https://halcyon-shop.fly.dev --type product

# 3. Add an item, see total, place
openkarta cart add --item-id espresso_250g -n 2
openkarta checkout --payment cod        # shows quote
openkarta checkout --payment cod --yes  # places it

# 4. Track
openkarta orders list
openkarta orders status ord_xxx
```
```

- [ ] **Step 3: Add a "Consumer" section to root README.md**

(Insert after the existing "Quickstarts" block.)

```markdown
## Consumer side (v0.2)

Two new packages let any consumer agent use OpenKarta end-to-end:

| Package | Purpose |
|---|---|
| [`@openkarta/orchestrator`](packages/orchestrator/) | Library: registry → search → cart → quote → checkout → status |
| [`@openkarta/cli`](packages/cli/) | The `openkarta` command-line interface (`openkarta search`, `openkarta chat`, …) |

```bash
npm install -g @openkarta/cli
openkarta search --type product --query coffee
```

See [`docs/orchestrator.md`](docs/orchestrator.md) and [`docs/cli.md`](docs/cli.md).
```

- [ ] **Step 4: Commit**

```bash
git add docs/orchestrator.md docs/cli.md README.md
git commit -m "docs: orchestrator + CLI references; README consumer section"
```

---

### Task 7.3: Publish v0.2.0

**Files:**
- Modify: every `package.json` that bumps to 0.2.0
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump versions**

Bump these packages to `0.2.0`:
- `@openkarta/sdk-node` (added `createClient`)
- `@openkarta/orchestrator` (new)
- `@openkarta/cli` (new)

`@openkarta/spec`, the three reference agents, conformance-tests, and demo-cli stay on `0.1.x` unless they were touched.

- [ ] **Step 2: Update `CHANGELOG.md`**

```markdown
## 0.2.0 — 2026-04-25

### Added
- `@openkarta/sdk-node`: `createClient(opts)` — typed client wrapping all 8 verbs.
- `@openkarta/orchestrator` (new): consumer-side library — registry, fan-out search, homogeneous cart, signed-quote checkout, order tracking, Anthropic-bridged chat loop.
- `@openkarta/cli` (new): `openkarta` CLI with `search / cart / checkout / orders / chat`.

### Docs
- `docs/orchestrator.md`, `docs/cli.md`.
```

- [ ] **Step 3: Build, test, publish**

```bash
pnpm install
pnpm build
pnpm test
bash scripts/orchestrator-smoke.sh

pnpm --filter @openkarta/sdk-node     publish --access public --no-git-checks
pnpm --filter @openkarta/orchestrator publish --access public --no-git-checks
pnpm --filter @openkarta/cli          publish --access public --no-git-checks
```
Expected: three packages on npm at `0.2.0`.

- [ ] **Step 4: Tag the release**

```bash
git add -A
git commit -m "release: v0.2.0 — orchestrator + cli"
git tag -a v0.2.0 -m "OpenKarta v0.2.0 — consumer side"
git push origin main --follow-tags
```

- [ ] **Step 5: Update the registry to point its first entry at the live deployment**

(Manual: edit `registry/agents.json` after `halcyon-shop` is deployed under Phase A of the roadmap; bump the `updated` field; commit.)

---

## Out of scope (deferred to later plans)

- **Web UI** — Plan 02.1 (a Next.js consumer app on top of `@openkarta/orchestrator`).
- **Multi-LLM bridge** — currently Anthropic only; OpenAI / Gemini adapters in Plan 02.2.
- **Persistent cart state across CLI invocations on different machines** — `~/.openkarta/cart.json` is local-only.
- **Hosted orchestrator service** — Plan 04 (multi-tenant, rate-limited, with caching). v0.2 is a library + CLI; you run them.
- **Registry-as-a-service** — Plan 08. v0.2 reads the static `agents.json` over HTTPS.
- **Payment aggregation** — every payment passes through to the agent's rails (Razorpay Routes, Stripe Connect, etc.). The orchestrator never holds funds.

---

## Risks

- **Reference agents change shape**: e2e tests boot real reference agents, so a breaking change in any of them breaks orchestrator tests. This is the point — but it means Plan 02 PRs that break Plan 01 contracts will fail loudly.
- **`zod-to-json-schema` output drift**: pinned to `^3.23.0`. If the LLM rejects a schema after a bump, snap the version.
- **Anthropic SDK v0.x**: still pre-1.0, may rename `tool_use` shapes. Wrap in `chat.ts` so other call sites don't depend on raw SDK types.
- **Local order store on Windows**: `homedir()/.openkarta/orders.json` works on Windows too (`%USERPROFILE%`), but the test uses `tmpdir()` to keep CI portable.

---

## Self-review — done

- Spec coverage: every section of the Plan 02 sketch from the roadmap has at least one task implementing it.
- Placeholder scan: no `TBD` / `implement later` strings.
- Type consistency: `OrchestratorCart`, `OrderRecord`, `RankedResult` referenced uniformly.
- LLM bridge has limited automated coverage (needs API key) — flagged inline.
