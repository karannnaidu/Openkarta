import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootAgent as bootShop, loadFixtures as fxShop } from '@openkarta/reference-agent-shop/src/agent';
import { bootAgent as bootStays, loadFixtures as fxStays } from '@openkarta/reference-agent-stays/src/agent';
import { bootAgent as bootTravel, loadFixtures as fxTravel } from '@openkarta/reference-agent-travel/src/agent';
import { runAll } from '../src/runner';

const secret = 'x'.repeat(32);
let shopUrl = '', staysUrl = '', travelUrl = '';

beforeAll(async () => {
  shopUrl   = await bootShop(fxShop('./fixtures'),     0, secret);
  staysUrl  = await bootStays(fxStays('./fixtures'),   0, secret);
  travelUrl = await bootTravel(fxTravel('./fixtures'), 0, secret);
});
afterAll(async () => { /* fastify closed implicitly when vitest ends */ });

describe('smoke against all 3 reference agents', () => {
  it('Halcyon Shop: core+product, all pass', async () => {
    const { manifest, packReports } = await runAll(shopUrl);
    expect(manifest.agentId).toBe('halcyon-shop');
    expect(packReports.map((r) => r.pack)).toEqual(['core', 'product']);
    const failed = packReports.flatMap((r) => r.tests.filter((t) => !t.passed).map((t) => `${r.pack}/${t.name}: ${t.message}`));
    expect(failed, failed.join('\n')).toEqual([]);
  });

  it('Halcyon Stays: core+stay+service, all pass', async () => {
    const { manifest, packReports } = await runAll(staysUrl);
    expect(manifest.agentId).toBe('halcyon-stays');
    expect(packReports.map((r) => r.pack)).toEqual(['core', 'stay', 'service']);
    const failed = packReports.flatMap((r) => r.tests.filter((t) => !t.passed).map((t) => `${r.pack}/${t.name}: ${t.message}`));
    expect(failed, failed.join('\n')).toEqual([]);
  });

  it('Halcyon Travel: core+flight+bus, all pass', async () => {
    const { manifest, packReports } = await runAll(travelUrl);
    expect(manifest.agentId).toBe('halcyon-travel');
    expect(packReports.map((r) => r.pack)).toEqual(['core', 'flight', 'bus']);
    const failed = packReports.flatMap((r) => r.tests.filter((t) => !t.passed).map((t) => `${r.pack}/${t.name}: ${t.message}`));
    expect(failed, failed.join('\n')).toEqual([]);
  });
});
