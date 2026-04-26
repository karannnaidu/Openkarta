import { describe, it, expect } from 'vitest';
import { buildToolDefs, TOOL_NAMES } from '../src/llm/tool-defs.js';

describe('buildToolDefs', () => {
  it('produces one definition per orchestrator action', () => {
    const defs = buildToolDefs();
    expect(defs.map((d) => d.name).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('every def has parameters with type:object', () => {
    for (const d of buildToolDefs()) {
      expect(d.parameters.type).toBe('object');
    }
  });

  it('view_cart and quote have no required fields', () => {
    const defs = buildToolDefs();
    const viewCart = defs.find((d) => d.name === 'view_cart');
    const quote = defs.find((d) => d.name === 'quote');
    expect(viewCart?.parameters.required).toBeUndefined();
    expect(quote?.parameters.required).toBeUndefined();
  });
});
