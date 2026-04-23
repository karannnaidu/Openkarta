import { describe, expect, it } from 'vitest';
import { Address, Money, Region } from '../src/common';

describe('Money', () => {
  it('accepts integer minor units and 3-letter ISO currency', () => {
    const m = Money.parse({ amountMinor: 12500, currency: 'INR' });
    expect(m.amountMinor).toBe(12500);
    expect(m.currency).toBe('INR');
  });

  it('rejects floats', () => {
    expect(() => Money.parse({ amountMinor: 12.5, currency: 'INR' })).toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() => Money.parse({ amountMinor: -1, currency: 'INR' })).toThrow();
  });

  it('rejects non-3-letter currency', () => {
    expect(() => Money.parse({ amountMinor: 100, currency: 'INRR' })).toThrow();
  });
});

describe('Address', () => {
  it('requires line1, city, country', () => {
    const a = Address.parse({ line1: '1 MG Road', city: 'Bengaluru', country: 'IN' });
    expect(a.line1).toBe('1 MG Road');
  });

  it('accepts optional pincode, state, line2, lat/lng', () => {
    const a = Address.parse({
      line1: '1 MG Road', line2: 'Apt 4', city: 'Bengaluru',
      state: 'KA', pincode: '560001', country: 'IN', lat: 12.97, lng: 77.59,
    });
    expect(a.pincode).toBe('560001');
  });

  it('rejects 2-char country code', () => {
    expect(() => Address.parse({ line1: 'x', city: 'x', country: 'IND' })).toThrow();
  });
});

describe('Region', () => {
  it('parses a region with country + optional subdivisions', () => {
    const r = Region.parse({ country: 'IN', state: 'KA', pincodes: ['560001'] });
    expect(r.country).toBe('IN');
  });
});
