import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadFixtures, makeHandlers } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createServer } from '@openkarta/sdk-node';
import { createOrchestrator } from '../src/orchestrator.js';
import { createDispatcher } from '../src/llm/dispatcher.js';
import { newState } from '../src/llm/memory.js';

let url: string;
let app: FastifyInstance;
beforeAll(async () => {
  const fx = loadFixtures('fixtures');
  app = createServer({ handlers: makeHandlers(fx, 'test-secret-32-bytes-________'), secret: 'test-secret-32-bytes-________' });
  url = await app.listen({ port: 0, host: '127.0.0.1' });
});
afterAll(async () => { await app.close(); });

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
    expect((sRes as unknown[]).length).toBeGreaterThan(0);
    const first = (sRes as { agentId: string; itemId: string }[])[0]!;

    await dispatch('add_to_cart', { agentId: first.agentId, itemId: first.itemId, quantity: 1 });
    const cart = await dispatch('view_cart', {});
    expect((cart as { lines: unknown[] }).lines.length).toBe(1);
  });
});
