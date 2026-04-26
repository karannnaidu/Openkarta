import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-shop/src/agent';
import { runConformance } from '../src/run-conformance.js';

const secret = 'x'.repeat(32);
let baseUrl = '';

beforeAll(async () => {
  baseUrl = await bootAgent(loadFixtures('./fixtures'), 0, secret);
});
afterAll(async () => { /* fastify closes when vitest ends */ });

describe('runConformance() library API', () => {
  it('runs against a live reference agent and signs a badge', async () => {
    const result = await runConformance({ baseUrl, badgeSecret: 'test-secret' });

    expect(result.passed).toBe(true);
    expect(result.testsPassed).toBeGreaterThan(0);
    expect(result.testsFailed).toBe(0);
    expect(result.packs).toEqual(['core', 'product']);
    expect(result.errorSummary).toBeUndefined();

    expect(result.signedBadge.agentId).toBe('halcyon-shop');
    expect(result.signedBadge.tierDetected).toBeDefined();
    expect(result.signedBadge.packsPassed).toEqual(['core', 'product']);
    expect(result.signedBadge.signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.signedBadge.signedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns errorSummary when the target is unreachable', async () => {
    await expect(runConformance({ baseUrl: 'http://127.0.0.1:1' })).rejects.toThrow();
  });
});
