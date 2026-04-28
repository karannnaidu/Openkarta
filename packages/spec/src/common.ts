import { z } from "zod";

export const Money = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof Money>;

export const Address = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().length(2), // ISO-3166 alpha-2
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type Address = z.infer<typeof Address>;

export const Region = z.object({
  country: z.string().length(2),
  state: z.string().optional(),
  city: z.string().optional(),
  pincodes: z.array(z.string()).optional(),
  radiusKm: z.number().positive().optional(),
});
export type Region = z.infer<typeof Region>;
