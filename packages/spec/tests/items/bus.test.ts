import { describe, expect, it } from 'vitest';
import { BusItem } from '../../src/items/bus';

const base = {
  id: 'b_1', brandId: 'b_op', title: 'VRL Overnight BLR→HYD',
  priceMinor: 120000, currency: 'INR',
  type: 'bus' as const,
  operator: 'VRL Travels',
  origin: 'Bengaluru', destination: 'Hyderabad',
  departure: '2026-05-10T21:30:00Z',
  arrival:   '2026-05-11T06:00:00Z',
  durationMinutes: 510,
  seatClass: 'ac-sleeper' as const,
  boardingPoints: [{ id: 'bp1', name: 'Majestic', time: '2026-05-10T21:00:00Z' }],
  droppingPoints: [{ id: 'dp1', name: 'Ameerpet', time: '2026-05-11T06:00:00Z' }],
  cancellationPolicy: 'moderate' as const,
};

describe('BusItem', () => {
  it('parses a valid bus', () => {
    const b = BusItem.parse(base);
    expect(b.operator).toBe('VRL Travels');
  });

  it('rejects empty boardingPoints', () => {
    expect(() => BusItem.parse({ ...base, boardingPoints: [] })).toThrow();
  });

  it('rejects unknown seatClass', () => {
    expect(() => BusItem.parse({ ...base, seatClass: 'bed' })).toThrow();
  });
});
