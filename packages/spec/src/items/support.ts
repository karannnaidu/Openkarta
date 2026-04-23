import { z } from 'zod';

export const Variant = z.object({
  sku:         z.string().min(1),
  attributes:  z.record(z.string()),
  priceMinor:  z.number().int().nonnegative().optional(),
  images:      z.array(z.string().url()).max(5).optional(),
});
export type Variant = z.infer<typeof Variant>;

export const BoardingPoint = z.object({
  id:      z.string().min(1),
  name:    z.string().min(1),
  address: z.string().optional(),
  time:    z.string().datetime({ offset: true }),
  lat:     z.number().min(-90).max(90).optional(),
  lng:     z.number().min(-180).max(180).optional(),
});
export type BoardingPoint = z.infer<typeof BoardingPoint>;
