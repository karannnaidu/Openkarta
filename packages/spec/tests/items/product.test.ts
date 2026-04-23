import { describe, expect, it } from 'vitest';
import { ProductItem } from '../../src/items/product';

const base = {
  id: 'p_1', brandId: 'b_1', title: 'Espresso blend 250g',
  priceMinor: 89900, currency: 'INR',
  type: 'product' as const, sku: 'SKU-ESP-250',
  inventoryStatus: 'in_stock' as const,
};

describe('ProductItem', () => {
  it('parses a minimal valid product', () => {
    const p = ProductItem.parse(base);
    expect(p.type).toBe('product');
    expect(p.sku).toBe('SKU-ESP-250');
  });

  it('accepts variants', () => {
    const p = ProductItem.parse({
      ...base,
      variants: [{ sku: 'SKU-ESP-250-BOLD', attributes: { roast: 'bold' } }],
    });
    expect(p.variants).toHaveLength(1);
  });

  it('accepts optional shipsFrom region', () => {
    const p = ProductItem.parse({
      ...base,
      shipsFrom: { country: 'IN', state: 'KA', pincodes: ['560001'] },
    });
    expect(p.shipsFrom?.country).toBe('IN');
  });

  it('rejects invalid inventoryStatus', () => {
    expect(() => ProductItem.parse({ ...base, inventoryStatus: 'maybe' })).toThrow();
  });

  it('rejects wrong type literal', () => {
    expect(() => ProductItem.parse({ ...base, type: 'stay' })).toThrow();
  });
});
