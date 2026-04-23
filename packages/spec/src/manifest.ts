import { z } from 'zod';
import { Region } from './common.js';

const Money = z.object({
  minMinor: z.number().int().nonnegative(),
  maxMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const ProductCapabilities = z.object({
  categories:    z.array(z.string()).min(1),
  serviceAreas:  z.array(Region).min(1),
  deliveryModes: z.array(z.enum(['instant','same_day','scheduled','pickup','standard'])).min(1),
  returnWindow:  z.number().int().nonnegative(),
});

export const StayCapabilities = z.object({
  locations:         z.array(Region).min(1),
  propertyTypes:     z.array(z.enum(['hotel','homestay','apartment','villa','hostel'])).min(1),
  priceTierPerNight: Money,
});

export const FlightCapabilities = z.object({
  carriers:    z.array(z.string().length(2)).min(1),
  routes:      z.union([
    z.literal('global'),
    z.array(z.object({ origin: z.string().length(3), destination: z.string().length(3) })),
  ]),
  fareClasses: z.array(z.enum(['economy','premium-economy','business','first'])).min(1),
});

export const BusCapabilities = z.object({
  operators:   z.array(z.string()).min(1),
  regions:     z.array(Region).min(1),
  seatClasses: z.array(z.enum(['seater','sleeper','ac-seater','ac-sleeper','volvo'])).min(1),
});

export const ServiceCapabilities = z.object({
  serviceCategories: z.array(z.string()).min(1),
  serviceAreas:      z.array(Region).min(1),
  locationModes:     z.array(z.enum(['at_customer','at_provider','online','venue'])).min(1),
});

export const CapabilitiesManifest = z.object({
  agentId:         z.string().min(1),
  displayName:     z.string().min(1),
  protocolVersion: z.literal('0.1'),
  tier:            z.enum(['http','mcp','feed','lite']),
  baseUrl:         z.string().url(),

  actions:            z.array(z.enum([
    'discover','search','get','quote','checkout','status','cancel','return',
  ])).min(1),
  supportedItemTypes: z.array(z.enum(['product','stay','flight','bus','service'])).min(1),

  paymentRails:        z.array(z.enum(['razorpay_routes','stripe_connect','upi_direct','cod'])).min(1),
  languages:           z.array(z.string()).min(1),
  regions:             z.array(Region).min(1),
  inventoryVolatility: z.enum(['static','hourly','realtime']),
  catalogSize:         z.enum(['small','medium','large']),
  priceRange:          Money,

  productCapabilities: ProductCapabilities.optional(),
  stayCapabilities:    StayCapabilities.optional(),
  flightCapabilities:  FlightCapabilities.optional(),
  busCapabilities:     BusCapabilities.optional(),
  serviceCapabilities: ServiceCapabilities.optional(),
});
export type CapabilitiesManifest = z.infer<typeof CapabilitiesManifest>;
