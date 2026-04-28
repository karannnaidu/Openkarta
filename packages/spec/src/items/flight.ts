import { z } from "zod";
import { ItemBase } from "./base.js";

export const FlightItem = ItemBase.extend({
  type: z.literal("flight"),
  carrier: z.string().length(2),
  flightNumber: z.string().min(1),
  origin: z.string().length(3),
  destination: z.string().length(3),
  departure: z.string().datetime({ offset: true }),
  arrival: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive(),
  fareClass: z.enum(["economy", "premium-economy", "business", "first"]),
  stops: z.number().int().nonnegative(),
  baggage: z
    .object({
      cabinKg: z.number().nonnegative(),
      checkedKg: z.number().nonnegative(),
    })
    .optional(),
  refundable: z.boolean(),
});
export type FlightItem = z.infer<typeof FlightItem>;
