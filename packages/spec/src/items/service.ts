import { z } from 'zod';
import { Address } from '../common.js';
import { ItemBase } from './base.js';

const ServiceLocation = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('at_customer'), serviceRadius: z.number().positive().optional() }),
  z.object({ mode: z.literal('at_provider'), address: Address }),
  z.object({ mode: z.literal('online'),      joinUrl: z.string().url().optional() }),
  z.object({ mode: z.literal('venue'),       venueAddress: Address }),
]);

export const ServiceItem = ItemBase.extend({
  type:               z.literal('service'),
  serviceCategory:    z.string().min(1),
  providerName:       z.string().optional(),
  durationMinutes:    z.number().int().positive(),
  location:           ServiceLocation,
  availableSlots:     z.array(z.string().datetime({ offset: true })).optional(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
});
export type ServiceItem = z.infer<typeof ServiceItem>;
