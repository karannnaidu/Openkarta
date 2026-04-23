import { z } from 'zod';
import { ItemBase } from './base.js';
import { BoardingPoint } from './support.js';

export const BusItem = ItemBase.extend({
  type:               z.literal('bus'),
  operator:           z.string().min(1),
  origin:             z.string().min(1),
  destination:        z.string().min(1),
  departure:          z.string().datetime({ offset: true }),
  arrival:            z.string().datetime({ offset: true }),
  durationMinutes:    z.number().int().positive(),
  seatClass:          z.enum(['seater', 'sleeper', 'ac-seater', 'ac-sleeper', 'volvo']),
  amenities:          z.array(z.string()).optional(),
  boardingPoints:     z.array(BoardingPoint).min(1),
  droppingPoints:     z.array(BoardingPoint).min(1),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
});
export type BusItem = z.infer<typeof BusItem>;
