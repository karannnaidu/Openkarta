import { describe, expect, it } from 'vitest';
import { FlightItem } from '../../src/items/flight';

const base = {
  id: 'f_1', brandId: 'b_air', title: '6E 5023 BLR→DEL',
  priceMinor: 750000, currency: 'INR',
  type: 'flight' as const,
  carrier: '6E', flightNumber: '5023',
  origin: 'BLR', destination: 'DEL',
  departure: '2026-05-10T06:30:00Z',
  arrival:   '2026-05-10T09:15:00Z',
  durationMinutes: 165,
  fareClass: 'economy' as const,
  stops: 0,
  refundable: false,
};

describe('FlightItem', () => {
  it('parses a valid flight', () => {
    const f = FlightItem.parse(base);
    expect(f.carrier).toBe('6E');
    expect(f.origin).toBe('BLR');
  });

  it('rejects 3-letter carrier', () => {
    expect(() => FlightItem.parse({ ...base, carrier: 'IDG' })).toThrow();
  });

  it('rejects 2-letter IATA airport code', () => {
    expect(() => FlightItem.parse({ ...base, origin: 'BL' })).toThrow();
  });

  it('accepts optional baggage', () => {
    const f = FlightItem.parse({ ...base, baggage: { cabinKg: 7, checkedKg: 15 } });
    expect(f.baggage?.checkedKg).toBe(15);
  });

  it('rejects non-datetime departure', () => {
    expect(() => FlightItem.parse({ ...base, departure: 'tomorrow 6am' })).toThrow();
  });
});
