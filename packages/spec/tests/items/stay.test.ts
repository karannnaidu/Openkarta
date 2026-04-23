import { describe, expect, it } from 'vitest';
import { StayItem } from '../../src/items/stay';

const base = {
  id: 's_1', brandId: 'b_1', title: 'Beach villa, Goa',
  priceMinor: 2500000, currency: 'INR',
  type: 'stay' as const,
  propertyId: 'prop_123',
  propertyType: 'villa' as const,
  maxGuests: 6,
  minStayNights: 2,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate' as const,
  location: { lat: 15.49, lng: 73.82, address: {
    line1: 'Anjuna Beach Rd', city: 'Anjuna', country: 'IN',
  }},
};

describe('StayItem', () => {
  it('parses a minimal valid stay', () => {
    const s = StayItem.parse(base);
    expect(s.type).toBe('stay');
    expect(s.propertyType).toBe('villa');
  });

  it('rejects malformed checkInTime', () => {
    expect(() => StayItem.parse({ ...base, checkInTime: '3pm' })).toThrow();
  });

  it('rejects zero minStayNights', () => {
    expect(() => StayItem.parse({ ...base, minStayNights: 0 })).toThrow();
  });

  it('rejects invalid propertyType', () => {
    expect(() => StayItem.parse({ ...base, propertyType: 'spaceship' })).toThrow();
  });

  it('accepts amenities and houseRules', () => {
    const s = StayItem.parse({ ...base, amenities: ['wifi','pool'], houseRules: ['no smoking'] });
    expect(s.amenities).toEqual(['wifi','pool']);
  });
});
