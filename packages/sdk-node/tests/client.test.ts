import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/dist/agent.js';
import { createClient } from '../src/client.js';

let url: string;
// loadFixtures resolves the path relative to its own module location (dist/),
// so './fixtures' points at packages/reference-agent-shop/dist/fixtures/.
const fx = loadFixtures('./fixtures');

beforeAll(async () => {
  url = await bootAgent(fx, 0, 'test-secret-32-bytes-________xx');
});
afterAll(async () => { /* fastify is closed implicitly when vitest exits */ });

describe('createClient', () => {
  it('discovers a manifest', async () => {
    const client = createClient({ baseUrl: url });
    const manifest = await client.discover();
    expect(manifest.agentId).toBe('halcyon-shop');
    expect(manifest.protocolVersion).toBe('0.1');
  });

  it('exposes the configured baseUrl', () => {
    const client = createClient({ baseUrl: url });
    expect(client.baseUrl).toBe(url);
  });

  it('searches by item type', async () => {
    const client = createClient({ baseUrl: url });
    // SearchQuery is a discriminated union on `type` (not `itemType`); items use `type` as well.
    const res = await client.search({ type: 'product', q: 'coffee' });
    expect(res.items.length).toBeGreaterThan(0);
    expect((res.items[0] as { type: string }).type).toBe('product');
  });

  it('throws OpenKartaError on a 4xx response', async () => {
    const client = createClient({ baseUrl: url });
    await expect(client.get('does-not-exist')).rejects.toMatchObject({
      code:       'item_not_found',
      httpStatus: 404,
    });
  });

  it('honours a per-call timeout', async () => {
    const client = createClient({ baseUrl: url, timeoutMs: 1 });
    await expect(client.discover()).rejects.toThrow(/timeout|abort/i);
  });
});
