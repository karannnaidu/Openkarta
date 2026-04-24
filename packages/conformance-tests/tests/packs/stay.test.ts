import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootAgent, loadFixtures } from '@openkarta/reference-agent-stays/src/agent';
import { runStayPack } from '../../src/packs/stay';

let baseUrl = '';
const secret = 'x'.repeat(32);
const fx = loadFixtures('./fixtures');

beforeAll(async () => { baseUrl = await bootAgent(fx, 0, secret); });
afterAll(async () => { /* fastify closed implicitly when vitest ends */ });

describe('stay pack', () => {
  it('passes all 5 stay tests against Halcyon Stays', async () => {
    const report = await runStayPack({ baseUrl });
    expect(report.pack).toBe('stay');
    expect(report.tests).toHaveLength(5);
    const failures = report.tests.filter((t) => !t.passed).map((t) => `${t.name}: ${t.message}`);
    expect(failures, failures.join('\n')).toEqual([]);
    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(5);
  });
});
