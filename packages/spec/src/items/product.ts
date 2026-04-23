import { z } from 'zod';
import { Region } from '../common.js';
import { ItemBase } from './base.js';
import { Variant } from './support.js';

export const ProductItem = ItemBase.extend({
  type:            z.literal('product'),
  sku:             z.string().min(1),
  variants:        z.array(Variant).optional(),
  inventoryStatus: z.enum(['in_stock', 'low', 'out']),
  shipsFrom:       Region.optional(),
  category:        z.array(z.string()).optional(),
});
export type ProductItem = z.infer<typeof ProductItem>;
