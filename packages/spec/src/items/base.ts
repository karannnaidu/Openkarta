import { z } from 'zod';

export const ItemBase = z.object({
  id:          z.string().min(1),
  brandId:     z.string().min(1),
  title:       z.string().min(1),
  description: z.string().optional(),
  images:      z.array(z.string().url()).max(10).optional(),
  priceMinor:  z.number().int().nonnegative(),
  currency:    z.string().length(3),
  metadata:    z.record(z.unknown()).optional(),
});
export type ItemBase = z.infer<typeof ItemBase>;
