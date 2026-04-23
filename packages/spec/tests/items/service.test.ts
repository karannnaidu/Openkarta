import { describe, expect, it } from 'vitest';
import { ServiceItem } from '../../src/items/service';

const atCustomer = {
  id: 'sv_1', brandId: 'b_uc', title: 'Massage therapy 60 min',
  priceMinor: 149900, currency: 'INR',
  type: 'service' as const,
  serviceCategory: 'wellness.massage',
  durationMinutes: 60,
  location: { mode: 'at_customer' as const, serviceRadius: 15 },
  cancellationPolicy: 'moderate' as const,
};

describe('ServiceItem', () => {
  it('parses at_customer service', () => {
    const s = ServiceItem.parse(atCustomer);
    expect(s.location.mode).toBe('at_customer');
  });

  it('parses at_provider service with address', () => {
    const s = ServiceItem.parse({
      ...atCustomer,
      location: { mode: 'at_provider', address: {
        line1: '1 MG Road', city: 'Bengaluru', country: 'IN',
      }},
    });
    expect(s.location.mode).toBe('at_provider');
  });

  it('parses online service with joinUrl', () => {
    const s = ServiceItem.parse({
      ...atCustomer,
      location: { mode: 'online', joinUrl: 'https://meet.example.com/abc' },
    });
    expect(s.location.mode).toBe('online');
  });

  it('rejects invalid location mode', () => {
    expect(() => ServiceItem.parse({
      ...atCustomer, location: { mode: 'telepathy' } as never,
    })).toThrow();
  });
});
