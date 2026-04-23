import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/items/union';
import { Item as ItemSchema, isBus, isFlight, isProduct, isService, isStay } from '../../src/items/union';

const product: Item = {
  id: 'p', brandId: 'b', title: 't', priceMinor: 1, currency: 'INR',
  type: 'product', sku: 'SKU', inventoryStatus: 'in_stock',
};
const stay: Item = {
  id: 's', brandId: 'b', title: 't', priceMinor: 1, currency: 'INR',
  type: 'stay', propertyId: 'p', propertyType: 'villa',
  maxGuests: 2, minStayNights: 1, checkInTime: '14:00', checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  location: { lat: 0, lng: 0, address: { line1: 'x', city: 'x', country: 'IN' } },
};

describe('Item discriminated union', () => {
  it('accepts a product', () => {
    expect(ItemSchema.parse(product).type).toBe('product');
  });

  it('accepts a stay', () => {
    expect(ItemSchema.parse(stay).type).toBe('stay');
  });

  it('rejects unknown type', () => {
    expect(() => ItemSchema.parse({ ...product, type: 'widget' as never })).toThrow();
  });
});

describe('narrowing helpers', () => {
  it('isProduct narrows correctly', () => {
    expect(isProduct(product)).toBe(true);
    expect(isProduct(stay)).toBe(false);
  });

  it('isStay narrows correctly', () => {
    expect(isStay(stay)).toBe(true);
  });

  it('remaining helpers return false for non-matching', () => {
    expect(isFlight(product)).toBe(false);
    expect(isBus(product)).toBe(false);
    expect(isService(product)).toBe(false);
  });
});
