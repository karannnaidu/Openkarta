import { z } from 'zod';
import { Region } from './common.js';

const ProductQuery = z.object({
  type:         z.literal('product'),
  q:            z.string().optional(),
  categories:   z.array(z.string()).optional(),
  priceRange:   z.object({ minMinor: z.number().int(), maxMinor: z.number().int() }).optional(),
  deliverTo:    Region.optional(),
  deliveryMode: z.enum(['instant', 'same_day', 'scheduled', 'pickup', 'standard']).optional(),
});

const StayQuery = z.object({
  type:         z.literal('stay'),
  location:     Region,
  checkIn:      z.string(),
  checkOut:     z.string(),
  guests:       z.number().int().positive(),
  propertyType: z.enum(['hotel','homestay','apartment','villa','hostel']).optional(),
});

const FlightQuery = z.object({
  type:        z.literal('flight'),
  origin:      z.string().length(3),
  destination: z.string().length(3),
  departure:   z.string(),
  return:      z.string().optional(),
  pax:         z.number().int().positive(),
  fareClass:   z.enum(['economy','premium-economy','business','first']).optional(),
  nonstop:     z.boolean().optional(),
});

const BusQuery = z.object({
  type:        z.literal('bus'),
  origin:      z.string().min(1),
  destination: z.string().min(1),
  departure:   z.string(),
  pax:         z.number().int().positive(),
  seatClass:   z.enum(['seater','sleeper','ac-seater','ac-sleeper','volvo']).optional(),
});

const ServiceQuery = z.object({
  type:          z.literal('service'),
  category:      z.string().min(1),
  location:      Region,
  preferredSlot: z.string().optional(),
});

export const SearchQuery = z.discriminatedUnion('type', [
  ProductQuery, StayQuery, FlightQuery, BusQuery, ServiceQuery,
]);
export type SearchQuery = z.infer<typeof SearchQuery>;
