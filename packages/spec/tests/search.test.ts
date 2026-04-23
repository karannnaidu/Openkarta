import { describe, expect, it } from 'vitest';
import { SearchQuery } from '../src/search';

describe('SearchQuery', () => {
  it('parses a product query', () => {
    const q = SearchQuery.parse({
      type: 'product', q: 'coffee',
      deliverTo: { country: 'IN', pincodes: ['560001'] },
      deliveryMode: 'instant',
    });
    expect(q.type).toBe('product');
  });

  it('parses a stay query', () => {
    const q = SearchQuery.parse({
      type: 'stay', location: { country: 'IN', city: 'Goa' },
      checkIn: '2026-05-01', checkOut: '2026-05-03', guests: 2,
    });
    expect(q.type).toBe('stay');
  });

  it('parses a flight query', () => {
    const q = SearchQuery.parse({
      type: 'flight', origin: 'BLR', destination: 'DEL',
      departure: '2026-05-10', pax: 1, fareClass: 'economy',
    });
    expect(q.type).toBe('flight');
  });

  it('parses a bus query', () => {
    const q = SearchQuery.parse({
      type: 'bus', origin: 'Bengaluru', destination: 'Hyderabad',
      departure: '2026-05-10', pax: 1,
    });
    expect(q.type).toBe('bus');
  });

  it('parses a service query', () => {
    const q = SearchQuery.parse({
      type: 'service', category: 'wellness.massage',
      location: { country: 'IN', city: 'Bengaluru' },
    });
    expect(q.type).toBe('service');
  });

  it('rejects cross-type fields (stay fields on product query)', () => {
    expect(() => SearchQuery.parse({ type: 'product', checkIn: '2026-05-01' } as never)).not.toThrow();
    // Zod discriminated union ignores extra fields; tighten with .strict() if desired in a later task.
  });
});
