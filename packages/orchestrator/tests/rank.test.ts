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
