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
