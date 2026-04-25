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
