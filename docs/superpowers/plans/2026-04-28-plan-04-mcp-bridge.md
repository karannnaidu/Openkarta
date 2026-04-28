# Plan 04 — `@openkarta/mcp-bridge` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@openkarta/mcp-bridge` — a stdio MCP server that exposes OpenKarta's 8 verbs as MCP tools to any MCP-capable host. Land it lockstep with `v0.5.0` of the monorepo.

**Architecture:** Two waves in one release. Wave 1 adds a stateless dispatcher + tool-defs to `@openkarta/orchestrator` (cart and quote threaded through I/O) and an error-hint table to `@openkarta/spec`. Wave 2 is the bridge package itself: a thin adapter that wraps the stateless dispatcher and translates between MCP envelopes and OpenKarta closed-enum errors. CLI REPL keeps using the existing stateful path — untouched.

**Tech stack:** TypeScript, `@modelcontextprotocol/sdk` (server), `zod` + `zod-to-json-schema` (already used in orchestrator), `vitest`, `tsup`, pnpm workspaces, turbo.

**Spec:** `docs/superpowers/specs/2026-04-28-plan-04-mcp-bridge-design.md`

---

## Task 1: Add error-hint table to `@openkarta/spec`

**Files:**
- Create: `packages/spec/src/error-hints.ts`
- Test: `packages/spec/tests/error-hints.test.ts`
- Modify: `packages/spec/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/spec/tests/error-hints.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ErrorCode } from '../src/errors.js';
import { errorHintFor, ERROR_HINTS } from '../src/error-hints.js';

describe('errorHintFor', () => {
  it('returns a non-empty hint for every closed-enum code', () => {
    for (const code of ErrorCode.options) {
      const hint = errorHintFor(code);
      expect(hint, `missing hint for ${code}`).toBeTruthy();
      expect(hint.length).toBeGreaterThan(10);
    }
  });

  it('returns the canonical hint for quote_expired', () => {
    expect(errorHintFor('quote_expired')).toMatch(/quote/i);
    expect(errorHintFor('quote_expired')).toMatch(/again/i);
  });

  it('returns empty string for an unknown code', () => {
    expect(errorHintFor('not_a_real_code' as never)).toBe('');
  });

  it('exports ERROR_HINTS as a frozen record', () => {
    expect(Object.isFrozen(ERROR_HINTS)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/spec test`
Expected: FAIL with "Cannot find module '../src/error-hints.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/spec/src/error-hints.ts`:

```typescript
import type { ErrorCode } from './errors.js';

export const ERROR_HINTS: Readonly<Record<ErrorCode, string>> = Object.freeze({
  item_not_found:
    "The item is no longer available from this merchant. Run search again to find a current alternative.",
  quote_expired:
    "The signed quote has expired. Call quote again on the same cart to get a fresh token, then checkout.",
  quote_invalid:
    "The quote token is malformed or was rejected by the merchant. Call quote again to get a new one.",
  cart_must_be_homogeneous:
    "All cart lines must share the same agentId and itemType. Start a new cart to add items from a different merchant or vertical.",
  payment_declined:
    "The payment was declined by the processor. Ask the user to try a different payment method.",
  payment_required:
    "Checkout requires a valid payment method that is supported by this quote. Inspect the quote.paymentOptions and pick one.",
  inventory_unavailable:
    "The merchant cannot fulfil this quantity. Reduce the quantity or pick a different item.",
  slot_unavailable:
    "The requested time slot is no longer available. Search again to see open slots.",
  unauthorized:
    "The merchant rejected this request as unauthorized. This usually means a stale or missing user token.",
  forbidden:
    "The merchant refused this action for the current user. Do not retry without changing the request.",
  rate_limited:
    "The merchant is rate-limiting requests. Wait a few seconds before retrying.",
  validation_failed:
    "The merchant rejected the request payload. Check the details field for the offending field path.",
  unsupported_item_type:
    "This merchant does not support the requested item type. Pick a different agent that lists this type in supportedItemTypes.",
  unsupported_action:
    "This merchant does not support this verb. The agent's manifest declares which verbs it implements.",
  idempotency_conflict:
    "A different request has already used this idempotency key. Generate a new key and retry.",
  internal:
    "The merchant returned a server error. Retry once; if it persists, pick a different agent.",
});

export function errorHintFor(code: ErrorCode | string): string {
  return (ERROR_HINTS as Record<string, string | undefined>)[code] ?? '';
}
```

- [ ] **Step 4: Modify spec index to export the new symbols**

Edit `packages/spec/src/index.ts`. Add this line at the end of the file:

```typescript
export * from './error-hints.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @openkarta/spec test`
Expected: PASS — 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/spec/src/error-hints.ts packages/spec/src/index.ts packages/spec/tests/error-hints.test.ts
git commit -m "feat(spec): add errorHintFor lookup for closed-enum error codes"
```

---

## Task 2: Add stateless cart/quote types and tool-defs to `@openkarta/orchestrator`

**Files:**
- Create: `packages/orchestrator/src/llm/stateless-tool-defs.ts`
- Test: `packages/orchestrator/tests/stateless-tool-defs.test.ts`
- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/orchestrator/tests/stateless-tool-defs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildStatelessToolDefs, STATELESS_TOOL_NAMES } from '../src/llm/stateless-tool-defs.js';

describe('buildStatelessToolDefs', () => {
  it('returns 8 tool definitions matching STATELESS_TOOL_NAMES', () => {
    const defs = buildStatelessToolDefs();
    expect(defs).toHaveLength(8);
    expect(defs.map((d) => d.name).sort()).toEqual([...STATELESS_TOOL_NAMES].sort());
  });

  it('every tool has a description and a JSON schema with type=object', () => {
    for (const def of buildStatelessToolDefs()) {
      expect(def.description.length).toBeGreaterThan(10);
      expect(def.parameters.type).toBe('object');
    }
  });

  it('add_to_cart accepts an optional cart input', () => {
    const def = buildStatelessToolDefs().find((d) => d.name === 'add_to_cart')!;
    const props = def.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('cart');
    expect(props).toHaveProperty('agentId');
    expect(props).toHaveProperty('itemType');
    expect(props).toHaveProperty('itemId');
  });

  it('view_cart, quote, checkout require a cart input', () => {
    const defs = buildStatelessToolDefs();
    for (const name of ['view_cart', 'quote', 'checkout'] as const) {
      const def = defs.find((d) => d.name === name)!;
      expect((def.parameters.required as string[]) ?? []).toContain('cart');
    }
  });

  it('checkout requires a quote input', () => {
    const def = buildStatelessToolDefs().find((d) => d.name === 'checkout')!;
    expect((def.parameters.required as string[]) ?? []).toContain('quote');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/orchestrator test`
Expected: FAIL with "Cannot find module '../src/llm/stateless-tool-defs.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/orchestrator/src/llm/stateless-tool-defs.ts`:

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDef } from './tool-defs.js';

export const STATELESS_TOOL_NAMES = [
  'search', 'add_to_cart', 'view_cart', 'quote', 'checkout',
  'order_status', 'cancel_order', 'return_order',
] as const;

export type StatelessToolName = typeof STATELESS_TOOL_NAMES[number];

const itemTypeEnum = z.enum(['product', 'stay', 'flight', 'bus', 'service']);

const StatelessCartZ = z.object({
  agentId: z.string(),
  agentBaseUrl: z.string().url(),
  itemType: itemTypeEnum,
  currency: z.string(),
  lines: z.array(z.object({
    itemType: itemTypeEnum,
    itemId: z.string(),
    quantity: z.number().int().min(1),
    extra: z.record(z.unknown()).optional(),
  })),
});

const StatelessQuoteZ = z.object({
  quoteToken: z.string(),
  cartId: z.string(),
  itemType: itemTypeEnum,
  totalMinor: z.number().int().nonnegative(),
  currency: z.string(),
  expiresAt: z.string(),
}).passthrough();

export type StatelessCart = z.infer<typeof StatelessCartZ>;
export type StatelessQuote = z.infer<typeof StatelessQuoteZ>;

const Schemas: Record<StatelessToolName, z.ZodTypeAny> = {
  search: z.object({
    itemType: itemTypeEnum,
    q: z.string().optional().describe('Free-text query'),
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
  }),
  add_to_cart: z.object({
    agentId: z.string().describe('From a search result.'),
    itemType: itemTypeEnum.describe('Item vertical. Must match the cart if cart is provided.'),
    itemId: z.string(),
    quantity: z.number().int().min(1).default(1),
    cart: StatelessCartZ.optional().describe('Existing cart from a previous add_to_cart result. Omit to start a fresh cart.'),
  }),
  view_cart: z.object({
    cart: StatelessCartZ,
  }),
  quote: z.object({
    cart: StatelessCartZ,
  }),
  checkout: z.object({
    cart: StatelessCartZ,
    quote: StatelessQuoteZ,
    paymentMethod: z.string().describe('e.g. cod, razorpay_routes, stripe_connect'),
    paymentRef: z.string().optional(),
  }),
  order_status: z.object({ orderId: z.string() }),
  cancel_order: z.object({ orderId: z.string(), reason: z.string() }),
  return_order: z.object({ orderId: z.string(), reason: z.string() }),
};

const Descriptions: Record<StatelessToolName, string> = {
  search: 'Search across registered OpenKarta agents for items of a given type. Returns a list of items each tagged with agentId.',
  add_to_cart: 'Add an item to a cart. Pass the prior cart to extend it; omit cart to start a new one. Returns the updated cart, which you must thread into subsequent view_cart, quote, and checkout calls.',
  view_cart: 'Echo the cart contents. Stateless — pass the cart you got from add_to_cart.',
  quote: 'Quote the supplied cart against the agent. Returns a signed quote token plus the cart unchanged. Pass both into checkout.',
  checkout: 'Place an order using the supplied cart and signed quote token plus a payment method. Returns the orderId.',
  order_status: 'Read fulfilment status for a placed order.',
  cancel_order: 'Cancel an open order with a reason.',
  return_order: 'Initiate a return for a delivered order.',
};

export function buildStatelessToolDefs(): ToolDef[] {
  return STATELESS_TOOL_NAMES.map((name) => ({
    name,
    description: Descriptions[name],
    parameters: zodToJsonSchema(Schemas[name], { target: 'openApi3' }) as ToolDef['parameters'],
  }));
}

export const StatelessSchemas = Schemas;
```

- [ ] **Step 4: Modify orchestrator index to export the new symbols**

Edit `packages/orchestrator/src/index.ts`. Add these lines after the existing `tool-defs` export:

```typescript
export { buildStatelessToolDefs, STATELESS_TOOL_NAMES, StatelessSchemas } from './llm/stateless-tool-defs.js';
export type { StatelessCart, StatelessQuote, StatelessToolName } from './llm/stateless-tool-defs.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @openkarta/orchestrator test`
Expected: PASS — 5 tests pass for stateless-tool-defs (existing tests still pass).

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/llm/stateless-tool-defs.ts packages/orchestrator/src/index.ts packages/orchestrator/tests/stateless-tool-defs.test.ts
git commit -m "feat(orchestrator): add stateless tool-defs with cart/quote in I/O"
```

---

## Task 3: Add `createStatelessDispatcher` to `@openkarta/orchestrator`

**Files:**
- Create: `packages/orchestrator/src/llm/stateless-dispatcher.ts`
- Test: `packages/orchestrator/tests/stateless-dispatcher.test.ts`
- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/orchestrator/tests/stateless-dispatcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createStatelessDispatcher } from '../src/llm/stateless-dispatcher.js';
import type { Orchestrator } from '../src/orchestrator.js';
import type { RankedResult } from '../src/types.js';

function fakeOrchestrator(results: Partial<RankedResult>[] = []): Orchestrator {
  return {
    async search() {
      return results as RankedResult[];
    },
  };
}

describe('createStatelessDispatcher', () => {
  it('search returns a compact projection of items with agentId', async () => {
    const orch = fakeOrchestrator([
      {
        agentId: 'halcyon-shop',
        agentDisplayName: 'Halcyon Shop',
        manifest: { baseUrl: 'https://halcyon.example/api' } as never,
        item: { id: 'sku-1', title: 'Paneer Tikka', priceMinor: 25000, currency: 'INR' } as never,
      },
    ]);
    const dispatch = createStatelessDispatcher(orch);
    const result = await dispatch('search', { itemType: 'product', q: 'paneer' }) as Array<{ agentId: string }>;
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('halcyon-shop');
  });

  it('add_to_cart with no cart creates a new cart bound to the agent', async () => {
    const orch = fakeOrchestrator([
      {
        agentId: 'halcyon-shop',
        agentDisplayName: 'Halcyon Shop',
        manifest: { baseUrl: 'https://halcyon.example/api' } as never,
        item: { id: 'sku-1', title: 'Paneer Tikka', priceMinor: 25000, currency: 'INR' } as never,
      },
    ]);
    const dispatch = createStatelessDispatcher(orch);
    const out = await dispatch('add_to_cart', {
      agentId: 'halcyon-shop',
      itemType: 'product',
      itemId: 'sku-1',
      quantity: 2,
    }) as { cart: { agentId: string; lines: Array<{ itemId: string; quantity: number }> } };
    expect(out.cart.agentId).toBe('halcyon-shop');
    expect(out.cart.lines).toHaveLength(1);
    expect(out.cart.lines[0]!.itemId).toBe('sku-1');
    expect(out.cart.lines[0]!.quantity).toBe(2);
  });

  it('add_to_cart with an existing cart appends a line', async () => {
    const orch = fakeOrchestrator();
    const dispatch = createStatelessDispatcher(orch);
    const out = await dispatch('add_to_cart', {
      agentId: 'halcyon-shop',
      itemType: 'product',
      itemId: 'sku-2',
      quantity: 1,
      cart: {
        agentId: 'halcyon-shop',
        agentBaseUrl: 'https://halcyon.example/api',
        itemType: 'product',
        currency: 'INR',
        lines: [{ itemType: 'product', itemId: 'sku-1', quantity: 2 }],
      },
    }) as { cart: { lines: Array<unknown> } };
    expect(out.cart.lines).toHaveLength(2);
  });

  it('add_to_cart refuses to mix agents in one cart', async () => {
    const orch = fakeOrchestrator();
    const dispatch = createStatelessDispatcher(orch);
    await expect(dispatch('add_to_cart', {
      agentId: 'other-agent',
      itemType: 'product',
      itemId: 'sku-2',
      quantity: 1,
      cart: {
        agentId: 'halcyon-shop',
        agentBaseUrl: 'https://halcyon.example/api',
        itemType: 'product',
        currency: 'INR',
        lines: [{ itemType: 'product', itemId: 'sku-1', quantity: 2 }],
      },
    })).rejects.toThrow(/agent/);
  });

  it('view_cart echoes the cart it was given', async () => {
    const dispatch = createStatelessDispatcher(fakeOrchestrator());
    const cart = {
      agentId: 'halcyon-shop',
      agentBaseUrl: 'https://halcyon.example/api',
      itemType: 'product' as const,
      currency: 'INR',
      lines: [{ itemType: 'product' as const, itemId: 'sku-1', quantity: 2 }],
    };
    const out = await dispatch('view_cart', { cart }) as { cart: typeof cart };
    expect(out.cart).toEqual(cart);
  });

  it('throws on unknown tool name', async () => {
    const dispatch = createStatelessDispatcher(fakeOrchestrator());
    await expect(dispatch('not_a_tool', {})).rejects.toThrow(/unknown tool/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/orchestrator test`
Expected: FAIL with "Cannot find module '../src/llm/stateless-dispatcher.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/orchestrator/src/llm/stateless-dispatcher.ts`:

```typescript
import type { ItemType } from '@openkarta/spec';
import type { Orchestrator } from '../orchestrator.js';
import { newCart, addLine, type OrchestratorCart } from '../cart.js';
import { quoteCart } from '../quote.js';
import { checkoutCart } from '../checkout.js';
import { getOrderStatus, cancelOrder, returnOrder, createOrderStore } from '../orders.js';
import { StatelessSchemas, type StatelessCart, type StatelessQuote } from './stateless-tool-defs.js';
import type { DispatchFn } from './dispatcher.js';

export function createStatelessDispatcher(
  orch: Orchestrator,
  opts: { ordersFile?: string } = {},
): DispatchFn {
  const store = createOrderStore(opts.ordersFile ? { ordersFile: opts.ordersFile } : {});

  return async function dispatch(toolName, input) {
    switch (toolName) {
      case 'search': {
        const args = StatelessSchemas.search.parse(input);
        const results = await orch.search({
          itemType: args.itemType,
          ...(args.q ? { q: args.q } : {}),
          ...(args.country ? {
            region: {
              country: args.country,
              ...(args.city ? { city: args.city } : {}),
              ...(args.pincode ? { pincode: args.pincode } : {}),
            },
          } : {}),
        });
        return results.slice(0, 10).map((r) => ({
          agentId: r.agentId,
          agentDisplayName: r.agentDisplayName,
          itemId: r.item.id,
          title: r.item.title,
          priceMinor: r.item.priceMinor,
          currency: r.item.currency,
        }));
      }

      case 'add_to_cart': {
        const args = StatelessSchemas.add_to_cart.parse(input);
        let cart: OrchestratorCart;
        if (args.cart) {
          if (args.cart.agentId !== args.agentId) {
            throw new Error(`cart is bound to agent "${args.cart.agentId}"; cannot add items from "${args.agentId}"`);
          }
          if (args.cart.itemType !== args.itemType) {
            throw new Error(`cart is bound to itemType "${args.cart.itemType}"; cannot add itemType "${args.itemType}"`);
          }
          cart = args.cart as OrchestratorCart;
        } else {
          // Look up the agent's baseUrl + currency by querying the orchestrator.
          const sample = await orch.search({
            itemType: args.itemType as ItemType,
            agentIds: [args.agentId],
          });
          if (sample.length === 0) {
            throw new Error(`agent "${args.agentId}" returned no items for itemType "${args.itemType}"`);
          }
          const first = sample[0]!;
          cart = newCart({
            agentId: args.agentId,
            agentBaseUrl: first.manifest.baseUrl,
            itemType: args.itemType as ItemType,
            currency: first.item.currency,
          });
        }
        cart = addLine(cart, { itemId: args.itemId, quantity: args.quantity });
        return { cart: cart as StatelessCart };
      }

      case 'view_cart': {
        const args = StatelessSchemas.view_cart.parse(input);
        return { cart: args.cart };
      }

      case 'quote': {
        const args = StatelessSchemas.quote.parse(input);
        const q = await quoteCart(args.cart as OrchestratorCart);
        return { cart: args.cart, quote: q as StatelessQuote };
      }

      case 'checkout': {
        const args = StatelessSchemas.checkout.parse(input);
        const order = await checkoutCart({
          cart: args.cart as OrchestratorCart,
          quote: args.quote as never,
          payment: {
            method: args.paymentMethod,
            ...(args.paymentRef ? { ref: args.paymentRef } : {}),
          },
          store,
        });
        return { orderId: order.orderId };
      }

      case 'order_status': {
        const args = StatelessSchemas.order_status.parse(input);
        return getOrderStatus(args.orderId, { store });
      }

      case 'cancel_order': {
        const args = StatelessSchemas.cancel_order.parse(input);
        return cancelOrder(args.orderId, args.reason, { store });
      }

      case 'return_order': {
        const args = StatelessSchemas.return_order.parse(input);
        return returnOrder(args.orderId, args.reason, { store });
      }

      default:
        throw new Error(`unknown tool: ${toolName}`);
    }
  };
}
```

- [ ] **Step 4: Modify orchestrator index to export the new symbol**

Edit `packages/orchestrator/src/index.ts`. Add this line after the existing `dispatcher` export:

```typescript
export { createStatelessDispatcher } from './llm/stateless-dispatcher.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @openkarta/orchestrator test`
Expected: PASS — 6 stateless-dispatcher tests pass; existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/llm/stateless-dispatcher.ts packages/orchestrator/src/index.ts packages/orchestrator/tests/stateless-dispatcher.test.ts
git commit -m "feat(orchestrator): add createStatelessDispatcher for MCP bridge"
```

---

## Task 4: Scaffold `@openkarta/mcp-bridge` package

**Files:**
- Create: `packages/mcp-bridge/package.json`
- Create: `packages/mcp-bridge/tsconfig.json`
- Create: `packages/mcp-bridge/tsup.config.ts`
- Create: `packages/mcp-bridge/src/index.ts` (placeholder)

- [ ] **Step 1: Create the package directory and package.json**

Create `packages/mcp-bridge/package.json`:

```json
{
  "name": "@openkarta/mcp-bridge",
  "version": "0.4.0",
  "license": "MIT",
  "type": "module",
  "bin": { "openkarta-mcp": "./dist/bin.js" },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@openkarta/spec":         "workspace:*",
    "@openkarta/orchestrator": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "tsup": "^8.3.0",
    "typescript": "^5.4.5",
    "vitest": "^2.1.0"
  }
}
```

> Note on the SDK version: at install time, run `pnpm view @modelcontextprotocol/sdk version` and update the `^1.0.0` here to the actual current major if it differs. Pin one major; do not use `*` or `latest`.

- [ ] **Step 2: Create tsconfig.json**

Create `packages/mcp-bridge/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

Create `packages/mcp-bridge/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node22',
  banner: { js: '#!/usr/bin/env node' },
});
```

> The banner adds the shebang to every emitted ESM file. `bin.ts` is the CLI entrypoint; the banner being on every file is harmless because index.js is also valid as a script.

- [ ] **Step 4: Create placeholder src/index.ts so tsup has an entry**

Create `packages/mcp-bridge/src/index.ts`:

```typescript
export const PACKAGE = '@openkarta/mcp-bridge';
```

- [ ] **Step 5: Wire the new package into the workspace**

Run: `pnpm install`
Expected: pnpm picks up the new package, installs `@modelcontextprotocol/sdk`, links workspace deps. No errors.

- [ ] **Step 6: Verify build is clean**

Run: `pnpm --filter @openkarta/mcp-bridge build`
Expected: tsup emits `dist/index.js` without errors. (`bin.js` will fail at runtime since the placeholder doesn't define a server — that's fine; we'll fill it in.)

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-bridge/package.json packages/mcp-bridge/tsconfig.json packages/mcp-bridge/tsup.config.ts packages/mcp-bridge/src/index.ts pnpm-lock.yaml
git commit -m "feat(mcp-bridge): scaffold package with @modelcontextprotocol/sdk dep"
```

---

## Task 5: Implement `src/registry.ts` — startup registry loader

**Files:**
- Create: `packages/mcp-bridge/src/registry.ts`
- Test: `packages/mcp-bridge/tests/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-bridge/tests/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadBridgeRegistry } from '../src/registry.js';

describe('loadBridgeRegistry', () => {
  it('uses DEFAULT_REGISTRY_URL when no override is supplied', async () => {
    let calledWith = '';
    const stubFetch: typeof fetch = async (input) => {
      calledWith = String(input);
      return new Response(
        JSON.stringify({ version: '0.1', updated: '2026-04-28', agents: [] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    const reg = await loadBridgeRegistry({ fetchImpl: stubFetch });
    expect(calledWith).toBe('https://registry.openkarta.org/v1/agents');
    expect(reg.agents).toEqual([]);
  });

  it('does not read OPENKARTA_REGISTRY_URL from env (no override)', async () => {
    const prev = process.env.OPENKARTA_REGISTRY_URL;
    process.env.OPENKARTA_REGISTRY_URL = 'https://evil-registry.example/v1/agents';
    try {
      let calledWith = '';
      const stubFetch: typeof fetch = async (input) => {
        calledWith = String(input);
        return new Response(
          JSON.stringify({ version: '0.1', updated: '2026-04-28', agents: [] }),
          { status: 200 },
        );
      };
      await loadBridgeRegistry({ fetchImpl: stubFetch });
      expect(calledWith).toBe('https://registry.openkarta.org/v1/agents');
    } finally {
      if (prev === undefined) delete process.env.OPENKARTA_REGISTRY_URL;
      else process.env.OPENKARTA_REGISTRY_URL = prev;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: FAIL with "Cannot find module '../src/registry.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/mcp-bridge/src/registry.ts`:

```typescript
import { loadRegistry, DEFAULT_REGISTRY_URL, type RegistrySnapshot } from '@openkarta/orchestrator';

export interface LoadBridgeRegistryOpts {
  fetchImpl?: typeof fetch;
}

/**
 * Load the registry for the bridge. Pinned to DEFAULT_REGISTRY_URL on purpose —
 * the bridge is a consumer surface and must not honour env-var overrides.
 * Developers who need a custom registry should use @openkarta/orchestrator directly.
 */
export async function loadBridgeRegistry(
  opts: LoadBridgeRegistryOpts = {},
): Promise<RegistrySnapshot> {
  return loadRegistry({
    url: DEFAULT_REGISTRY_URL,
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-bridge/src/registry.ts packages/mcp-bridge/tests/registry.test.ts
git commit -m "feat(mcp-bridge): registry loader pinned to DEFAULT_REGISTRY_URL"
```

---

## Task 6: Implement `src/errors.ts` — OpenKarta error → MCP error result

**Files:**
- Create: `packages/mcp-bridge/src/errors.ts`
- Test: `packages/mcp-bridge/tests/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-bridge/tests/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ErrorCode } from '@openkarta/spec';
import { toMcpError, BRIDGE_ERROR_HINTS, type BridgeErrorCode } from '../src/errors.js';

describe('toMcpError', () => {
  it('wraps a closed-enum OpenKarta error with a hint', () => {
    const err = {
      error: {
        code: 'quote_expired' as const,
        message: 'Quote expired at 2026-04-28T10:14:00Z',
        retryable: true,
      },
    };
    const out = toMcpError(err);
    expect(out.isError).toBe(true);
    expect(out.content).toHaveLength(1);
    expect(out.content[0].type).toBe('text');
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.code).toBe('quote_expired');
    expect(parsed.hint).toMatch(/quote/i);
    expect(parsed.message).toMatch(/expired/i);
  });

  it('wraps every closed-enum code with a non-empty hint', () => {
    for (const code of ErrorCode.options) {
      const err = { error: { code, message: 'x', retryable: false } };
      const out = toMcpError(err);
      const parsed = JSON.parse(out.content[0].text);
      expect(parsed.hint, `missing hint for ${code}`).toBeTruthy();
    }
  });

  it('synthesizes BRIDGE_INVALID_MERCHANT for unknown agentId', () => {
    const out = toMcpError({ bridgeCode: 'bridge_invalid_merchant', message: 'agentId not found: foo' });
    expect(out.isError).toBe(true);
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.code).toBe('bridge_invalid_merchant');
    expect(parsed.hint).toBeTruthy();
  });

  it('every BRIDGE_* code has a hint', () => {
    const codes: BridgeErrorCode[] = [
      'bridge_registry_unavailable',
      'bridge_network_error',
      'bridge_invalid_merchant_response',
      'bridge_invalid_merchant',
      'bridge_invalid_args',
    ];
    for (const code of codes) {
      expect(BRIDGE_ERROR_HINTS[code]).toBeTruthy();
    }
  });

  it('falls through with an internal code when input is unrecognized', () => {
    const out = toMcpError(new Error('boom'));
    expect(out.isError).toBe(true);
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.code).toBe('internal');
    expect(parsed.message).toContain('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: FAIL with "Cannot find module '../src/errors.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/mcp-bridge/src/errors.ts`:

```typescript
import { errorHintFor, type ErrorResponse, type ErrorCode } from '@openkarta/spec';

export const BRIDGE_ERROR_HINTS = {
  bridge_registry_unavailable: 'OpenKarta registry is unreachable. Retry shortly.',
  bridge_network_error: 'Merchant unreachable. Try a different agentId or retry shortly.',
  bridge_invalid_merchant_response: 'Merchant returned an invalid response. Pick a different agent.',
  bridge_invalid_merchant: 'agentId not found in the OpenKarta registry. Use search to find a valid agentId.',
  bridge_invalid_args: 'The supplied tool arguments did not validate. Inspect details for the offending field path.',
} as const;

export type BridgeErrorCode = keyof typeof BRIDGE_ERROR_HINTS;

export interface McpErrorResult {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
}

interface BridgeErrorInput {
  bridgeCode: BridgeErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

function isOpenKartaError(input: unknown): input is ErrorResponse {
  return (
    typeof input === 'object' &&
    input !== null &&
    'error' in input &&
    typeof (input as { error: unknown }).error === 'object' &&
    (input as { error: { code?: unknown } }).error !== null &&
    typeof (input as { error: { code?: unknown } }).error.code === 'string'
  );
}

function isBridgeError(input: unknown): input is BridgeErrorInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'bridgeCode' in input &&
    typeof (input as { bridgeCode: unknown }).bridgeCode === 'string'
  );
}

export function toMcpError(input: unknown): McpErrorResult {
  if (isOpenKartaError(input)) {
    const e = input.error;
    const payload = {
      code: e.code as ErrorCode,
      message: e.message,
      hint: errorHintFor(e.code as ErrorCode),
      retryable: e.retryable,
      ...(e.details ? { details: e.details } : {}),
    };
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(payload) }] };
  }
  if (isBridgeError(input)) {
    const payload = {
      code: input.bridgeCode,
      message: input.message,
      hint: BRIDGE_ERROR_HINTS[input.bridgeCode],
      ...(input.details ? { details: input.details } : {}),
    };
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(payload) }] };
  }
  const msg = input instanceof Error ? input.message : String(input);
  const payload = {
    code: 'internal',
    message: msg,
    hint: 'Unexpected bridge error. Retry; if it persists, file an issue.',
  };
  return { isError: true, content: [{ type: 'text', text: JSON.stringify(payload) }] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: PASS — 7 bridge tests total (2 from Task 5 registry + 5 new errors tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-bridge/src/errors.ts packages/mcp-bridge/tests/errors.test.ts
git commit -m "feat(mcp-bridge): toMcpError shapes OpenKarta + bridge errors with hints"
```

---

## Task 7: Implement `src/tools.ts` — call routing into stateless dispatcher

**Files:**
- Create: `packages/mcp-bridge/src/tools.ts`
- Test: `packages/mcp-bridge/tests/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-bridge/tests/tools.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { runTool } from '../src/tools.js';

describe('runTool', () => {
  it('returns a JSON content envelope on success', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const result = await runTool(dispatch, 'search', { itemType: 'product' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: true, value: 42 });
    expect(dispatch).toHaveBeenCalledWith('search', { itemType: 'product' });
  });

  it('shapes a thrown OpenKartaError-style object as MCP error', async () => {
    const dispatch = vi.fn().mockRejectedValue({
      error: { code: 'quote_expired', message: 'expired', retryable: true },
    });
    const result = await runTool(dispatch, 'quote', { cart: {} });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe('quote_expired');
    expect(parsed.hint).toBeTruthy();
  });

  it('shapes a thrown vanilla Error as bridge_internal', async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await runTool(dispatch, 'search', { itemType: 'product' });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.code).toBe('internal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: FAIL with "Cannot find module '../src/tools.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/mcp-bridge/src/tools.ts`:

```typescript
import type { DispatchFn } from '@openkarta/orchestrator';
import { toMcpError, type McpErrorResult } from './errors.js';

export interface McpSuccessResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: undefined;
}

export type McpToolResult = McpSuccessResult | McpErrorResult;

export async function runTool(
  dispatch: DispatchFn,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  try {
    const result = await dispatch(name, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  } catch (err) {
    return toMcpError(err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: PASS — 3 tools tests pass (10 total bridge tests: 2 registry + 5 errors + 3 tools).

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-bridge/src/tools.ts packages/mcp-bridge/tests/tools.test.ts
git commit -m "feat(mcp-bridge): runTool wraps dispatch with success/error envelopes"
```

---

## Task 8: Implement `src/server.ts` — MCP Server with tools/list + tools/call

**Files:**
- Create: `packages/mcp-bridge/src/server.ts`
- Test: `packages/mcp-bridge/tests/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/mcp-bridge/tests/server.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server.js';

const fakeRegistry = {
  version: '0.1' as const,
  updated: '2026-04-28',
  agents: [
    {
      agentId: 'halcyon-shop',
      displayName: 'Halcyon Shop',
      baseUrl: 'https://halcyon.example/api',
      tier: 'http' as const,
      supportedItemTypes: ['product' as const],
      addedAt: '2026-04-01',
    },
  ],
};

function harness(dispatchImpl: (name: string, input: Record<string, unknown>) => Promise<unknown>) {
  const server = buildServer({
    registry: fakeRegistry,
    dispatch: vi.fn(dispatchImpl),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} });
  return { server, client, clientTransport, serverTransport };
}

describe('buildServer', () => {
  it('publishes 8 tools on tools/list', async () => {
    const { server, client, clientTransport, serverTransport } = harness(async () => ({}));
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.listTools();
    expect(result.tools).toHaveLength(8);
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'add_to_cart', 'cancel_order', 'checkout', 'order_status',
      'quote', 'return_order', 'search', 'view_cart',
    ]);
  });

  it('routes tools/call into the supplied dispatch', async () => {
    const dispatch = vi.fn().mockResolvedValue([{ agentId: 'halcyon-shop', itemId: 'sku-1' }]);
    const { server, client, clientTransport, serverTransport } = harness(dispatch);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: 'search',
      arguments: { itemType: 'product', q: 'paneer' },
    });
    expect(dispatch).toHaveBeenCalledWith('search', { itemType: 'product', q: 'paneer' });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(payload[0].agentId).toBe('halcyon-shop');
  });

  it('returns isError envelope when dispatch throws an OpenKarta error', async () => {
    const dispatch = vi.fn().mockRejectedValue({
      error: { code: 'quote_expired', message: 'expired', retryable: true },
    });
    const { server, client, clientTransport, serverTransport } = harness(dispatch);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: 'quote',
      arguments: {
        cart: {
          agentId: 'halcyon-shop',
          agentBaseUrl: 'https://halcyon.example/api',
          itemType: 'product',
          currency: 'INR',
          lines: [{ itemType: 'product', itemId: 'sku-1', quantity: 1 }],
        },
      },
    });
    expect(result.isError).toBe(true);
    const payload = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(payload.code).toBe('quote_expired');
    expect(payload.hint).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: FAIL with "Cannot find module '../src/server.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/mcp-bridge/src/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { buildStatelessToolDefs, type DispatchFn, type RegistrySnapshot } from '@openkarta/orchestrator';
import { runTool } from './tools.js';

export interface BuildServerOpts {
  registry: RegistrySnapshot;
  dispatch: DispatchFn;
  serverInfo?: { name?: string; version?: string };
}

export function buildServer(opts: BuildServerOpts): Server {
  const server = new Server(
    {
      name: opts.serverInfo?.name ?? '@openkarta/mcp-bridge',
      version: opts.serverInfo?.version ?? '0.0.0',
    },
    {
      capabilities: { tools: {} },
    },
  );

  const tools = buildStatelessToolDefs().map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: d.parameters,
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    return runTool(opts.dispatch, name, (args ?? {}) as Record<string, unknown>);
  });

  return server;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: PASS — 3 server tests pass; 13 bridge tests total.

> If `InMemoryTransport.createLinkedPair` import path differs in the SDK version installed, run `pnpm view @modelcontextprotocol/sdk@$(node -p "require('./packages/mcp-bridge/package.json').dependencies['@modelcontextprotocol/sdk']") files` and adjust the test's import accordingly. The implementation file's imports are the public API and should be stable.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-bridge/src/server.ts packages/mcp-bridge/tests/server.test.ts
git commit -m "feat(mcp-bridge): MCP server with tools/list + tools/call"
```

---

## Task 9: Implement `src/bin.ts` — stdio entry point

**Files:**
- Create: `packages/mcp-bridge/src/bin.ts`
- Modify: `packages/mcp-bridge/src/index.ts`

- [ ] **Step 1: Write the failing test (smoke test for the bootstrap function)**

Add to `packages/mcp-bridge/tests/server.test.ts` (append a new describe block):

```typescript
import { bootstrap } from '../src/bin.js';

describe('bootstrap', () => {
  it('returns a connected server when given a registry snapshot and dispatch', async () => {
    const result = await bootstrap({
      registry: fakeRegistry,
      dispatch: async () => ({}),
      transport: 'noop',
    });
    expect(result.server).toBeDefined();
    expect(result.startedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: FAIL with "Cannot find module '../src/bin.js'".

- [ ] **Step 3: Write minimal implementation**

Create `packages/mcp-bridge/src/bin.ts`:

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createOrchestrator, createStatelessDispatcher, type DispatchFn, type RegistrySnapshot } from '@openkarta/orchestrator';
import { buildServer } from './server.js';
import { loadBridgeRegistry } from './registry.js';
import { toMcpError } from './errors.js';

export interface BootstrapOpts {
  registry?: RegistrySnapshot;
  dispatch?: DispatchFn;
  /** 'stdio' (real) or 'noop' (test). */
  transport?: 'stdio' | 'noop';
}

export async function bootstrap(opts: BootstrapOpts = {}) {
  let registry: RegistrySnapshot;
  if (opts.registry) {
    registry = opts.registry;
  } else {
    try {
      registry = await loadBridgeRegistry();
    } catch (err) {
      const e = toMcpError({ bridgeCode: 'bridge_registry_unavailable', message: err instanceof Error ? err.message : String(err) });
      process.stderr.write(e.content[0].text + '\n');
      throw err;
    }
  }

  const dispatch = opts.dispatch ?? createStatelessDispatcher(createOrchestrator({ registry }));
  const server = buildServer({ registry, dispatch });
  const startedAt = new Date();

  if (opts.transport === 'stdio' || opts.transport === undefined) {
    if (opts.transport === undefined && process.env.NODE_ENV === 'test') {
      // Default to noop in tests so `bootstrap()` doesn't hang on stdio.
      return { server, startedAt };
    }
    if (opts.transport === 'stdio') {
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
  }

  return { server, startedAt };
}

// CLI entry: only runs when invoked directly (not when imported).
const isDirectInvocation = import.meta.url === `file://${process.argv[1]}`
  || (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));
if (isDirectInvocation) {
  bootstrap({ transport: 'stdio' }).catch((err) => {
    process.stderr.write(`@openkarta/mcp-bridge failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Modify `src/index.ts` to export bootstrap and named pieces**

Replace `packages/mcp-bridge/src/index.ts` with:

```typescript
export { buildServer } from './server.js';
export type { BuildServerOpts } from './server.js';
export { bootstrap } from './bin.js';
export type { BootstrapOpts } from './bin.js';
export { runTool } from './tools.js';
export type { McpToolResult, McpSuccessResult } from './tools.js';
export { toMcpError, BRIDGE_ERROR_HINTS } from './errors.js';
export type { BridgeErrorCode, McpErrorResult } from './errors.js';
export { loadBridgeRegistry } from './registry.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @openkarta/mcp-bridge test`
Expected: PASS — bootstrap test passes; 14 total tests.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-bridge/src/bin.ts packages/mcp-bridge/src/index.ts packages/mcp-bridge/tests/server.test.ts
git commit -m "feat(mcp-bridge): bootstrap + bin.ts stdio entry point"
```

---

## Task 10: Build, typecheck, smoke-run the bridge

- [ ] **Step 1: Build**

Run: `pnpm --filter @openkarta/mcp-bridge build`
Expected: Clean build, `dist/bin.js` and `dist/index.js` produced.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @openkarta/mcp-bridge typecheck`
Expected: No errors.

- [ ] **Step 3: Smoke-run as a subprocess and confirm `tools/list` works**

Create `packages/mcp-bridge/tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

describe('subprocess smoke', () => {
  it('spawns dist/bin.js and lists 8 tools', async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const bin = path.resolve(here, '../dist/bin.js');
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin],
    });
    const client = new Client({ name: 'smoke', version: '0.0.0' }, { capabilities: {} });
    await client.connect(transport);
    try {
      const list = await client.listTools();
      expect(list.tools.length).toBe(8);
    } finally {
      await client.close();
    }
  }, 20_000);
});
```

> This test relies on `dist/bin.js` existing — it's a build smoke. If the registry fetch over the network fails in CI, the bridge logs a registry_unavailable error and exits. That is correct behaviour. To run this offline, mock the fetch via a test harness (out of scope here — flag if it shows up flaky in CI).

- [ ] **Step 4: Run test**

Run: `pnpm --filter @openkarta/mcp-bridge build && pnpm --filter @openkarta/mcp-bridge test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-bridge/tests/smoke.test.ts
git commit -m "test(mcp-bridge): subprocess smoke test for tools/list"
```

---

## Task 11: README for `@openkarta/mcp-bridge`

**Files:**
- Create: `packages/mcp-bridge/README.md`

- [ ] **Step 1: Write README**

Create `packages/mcp-bridge/README.md`:

````markdown
# @openkarta/mcp-bridge

Use OpenKarta from any MCP-aware host (Claude Desktop, MCP-aware editors, …).

The bridge is a thin local stdio MCP server. It exposes OpenKarta's 8 verbs as MCP tools and routes each call to the appropriate merchant in the OpenKarta registry. There is no LLM in the bridge — your host owns it. There is no account, no API key, no telemetry.

## Install (Claude Desktop)

Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openkarta": {
      "command": "npx",
      "args": ["-y", "@openkarta/mcp-bridge"]
    }
  }
}
```

Restart Claude Desktop. The 8 OpenKarta tools should appear under the connected servers.

## Tools

| Name | Purpose |
|---|---|
| `search` | Search across registered OpenKarta agents for items of a given type. |
| `add_to_cart` | Add an item to a cart. Stateless — the result returns the cart. |
| `view_cart` | Echo a cart you supply. |
| `quote` | Quote a cart against the agent. Returns a signed quote token. |
| `checkout` | Place an order using a cart + signed quote + payment method. |
| `order_status` | Fetch fulfilment status for an order. |
| `cancel_order` | Cancel an open order. |
| `return_order` | Initiate a return for a delivered order. |

The cart and quote are passed through tool I/O — the LLM threads them between calls. There is no per-process cart state, so multi-tab hosts are safe.

## Errors

Every error returns a structured JSON payload with `code`, `message`, and `hint`. Codes come from OpenKarta's closed enum (`quote_expired`, `payment_declined`, …) plus a small set of bridge-internal codes (`bridge_registry_unavailable`, `bridge_invalid_merchant`, …). The `hint` is an LLM-targeted recovery instruction.

## Troubleshooting

**Server didn't start.** Check Claude Desktop's developer log. Most failures are network-related — the bridge fetches the public registry on startup.

**A tool call failed with `bridge_invalid_merchant`.** The agentId you supplied isn't in the public registry. Run `search` first and use an `agentId` it returns.

**The quote expired.** Quote tokens are short-lived. Call `quote` again on the same cart to get a fresh token, then `checkout`.

## Browse merchants

The current registry is at <https://registry.openkarta.org>.

## License

MIT.
````

- [ ] **Step 2: Commit**

```bash
git add packages/mcp-bridge/README.md
git commit -m "docs(mcp-bridge): README with install snippet, tools, troubleshooting"
```

---

## Task 12: Bump all package versions to `0.5.0` and update root CHANGELOG

**Files:**
- Modify: `packages/spec/package.json`
- Modify: `packages/sdk-node/package.json`
- Modify: `packages/orchestrator/package.json`
- Modify: `packages/cli/package.json`
- Modify: `packages/mcp-bridge/package.json`
- Modify: `packages/conformance-tests/package.json` (if versioned)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: List the versioned, published packages**

Run: `pnpm -r --no-frozen-lockfile ls --depth -1 --json | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);for(const p of a){if(p.private!==true&&p.name?.startsWith('@openkarta/')) console.log(p.name, p.version);}})"`

Expected output: a list of `@openkarta/*` packages and their current versions. Confirm which ones publish (anything not marked `private: true`).

> The set we expect: `@openkarta/spec`, `@openkarta/sdk-node`, `@openkarta/orchestrator`, `@openkarta/cli`, `@openkarta/mcp-bridge`, `@openkarta/conformance-tests`. Reference agents and registry-* sub-packages stay private.

- [ ] **Step 2: Bump each `package.json` to `0.5.0`**

Manually edit each of the listed packages. In every file, change `"version": "0.4.0"` (or `"0.0.0"` for mcp-bridge) to `"version": "0.5.0"`.

Workspace deps (`workspace:*`) auto-resolve, no edits needed there.

- [ ] **Step 3: Update root CHANGELOG.md**

Edit `CHANGELOG.md`. At the top (above the `## 0.4.0 — 2026-04-26` line), insert:

```markdown
## 0.5.0 — 2026-04-XX

### Added
- **`@openkarta/mcp-bridge`** — stdio MCP server that exposes OpenKarta's 8 verbs as tools to any MCP-aware host (Claude Desktop, MCP-aware editors). Pure transport adapter: no LLM, no state, no auth, no env-driven registry override. Install via `npx @openkarta/mcp-bridge`.
- **`@openkarta/orchestrator`**: `createStatelessDispatcher()` + `buildStatelessToolDefs()` — cart and quote threaded through tool I/O, parallel-conversation safe. Existing stateful `createDispatcher()` is preserved for the CLI REPL.
- **`@openkarta/spec`**: `errorHintFor()` and `ERROR_HINTS` — LLM-targeted recovery hint per closed-enum error code.

### Why
v1.0 Track C of the roadmap calls for native MCP-host distribution so users can transact via OpenKarta from any MCP-capable assistant — no OpenKarta-specific install, no Anthropic-specific UI. The bridge is the safe-by-default consumer surface; developers who need custom registry behavior continue to use the orchestrator package directly.

```

(Replace `XX` with the actual day at release time.)

- [ ] **Step 4: Build and test the whole monorepo**

Run: `pnpm -r build && pnpm -r test`
Expected: All packages build and test cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/spec/package.json packages/sdk-node/package.json packages/orchestrator/package.json packages/cli/package.json packages/mcp-bridge/package.json packages/conformance-tests/package.json CHANGELOG.md pnpm-lock.yaml
git commit -m "chore(release): bump to 0.5.0 — Plan 04 (MCP bridge)"
```

---

## Task 13: Update ROADMAP — mark Plan 04 shipped

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update Plan 04 row in §5 Plan table**

Edit `docs/ROADMAP.md`. Find the Plan 04 row in the §5 table (status currently 🟢 Next). Change status to ✅ Shipped.

Update §6 v1.0 checklist: mark the MCP bridge checkbox as completed.

- [ ] **Step 2: Update §2 current state**

In §2, change "three plans shipped" → "four plans shipped" and add a one-line bullet for the bridge: "`@openkarta/mcp-bridge` 0.5.0 — stdio MCP server, ships OpenKarta's 8 verbs into any MCP-capable host."

- [ ] **Step 3: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(roadmap): mark Plan 04 (MCP bridge) shipped"
```

---

## Self-Review Notes (run before merge)

1. **Spec coverage** — every numbered section in `2026-04-28-plan-04-mcp-bridge-design.md` is implemented:
   - §1 Goal: Tasks 4–10 deliver the bridge; Tasks 1–3 deliver the orchestrator/spec foundations.
   - §2 Locked decisions: stdio-only (Task 9 bin), flat 8 (Task 2 `STATELESS_TOOL_NAMES`), stateless I/O (Task 3 dispatcher), explicit agentId (Task 2 schema), tools-only (Task 8 server registers no resource handlers), code+hint errors (Tasks 1, 6), in-monorepo (Task 4 scaffold), no env override (Task 5 registry).
   - §3 Architecture: Wave 1 = Tasks 1–3; Wave 2 = Tasks 4–10.
   - §4 File structure: matches Tasks 1–9 file layout.
   - §5 Data flow: implemented as Tasks 5 (registry), 8 (server), 7 (tools), 6 (errors), 9 (bin).
   - §6 Error handling: §6.1 Task 6 + Task 1; §6.2 Task 6 BRIDGE_*; §6.3 zod-driven path raises in Task 7.
   - §7 Testing: Tasks 1, 2, 3, 5, 6, 7, 8, 9, 10 each ship tests. Manual smoke documented in Task 11 README troubleshooting + Task 10 subprocess test.
   - §8 Distribution: Task 4 package.json + Task 11 README + Task 12 version bump.

2. **Placeholder scan** — none. The CHANGELOG date placeholder `XX` is intentional (resolved at release moment).

3. **Type consistency** — `DispatchFn`, `RegistrySnapshot`, `StatelessCart`, `StatelessQuote`, `BridgeErrorCode` used consistently across tasks. `ToolDef` reused from existing `tool-defs.ts`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-28-plan-04-mcp-bridge.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
