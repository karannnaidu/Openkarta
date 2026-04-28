import { z } from "zod";
import { CartLine } from "./cart.js";

const ProductFulfilment = z.object({
  itemType: z.literal("product"),
  state: z.enum(["confirmed", "packed", "shipped", "out_for_delivery", "delivered", "returned"]),
});
const StayFulfilment = z.object({
  itemType: z.literal("stay"),
  state: z.enum(["confirmed", "checked_in", "checked_out", "cancelled", "no_show"]),
});
const FlightFulfilment = z.object({
  itemType: z.literal("flight"),
  state: z.enum(["confirmed", "checked_in", "boarded", "flown", "cancelled", "refunded"]),
});
const BusFulfilment = z.object({
  itemType: z.literal("bus"),
  state: z.enum(["confirmed", "boarded", "completed", "cancelled"]),
});
const ServiceFulfilment = z.object({
  itemType: z.literal("service"),
  state: z.enum(["confirmed", "en_route", "started", "completed", "cancelled"]),
});

export const FulfilmentStatus = z.discriminatedUnion("itemType", [
  ProductFulfilment,
  StayFulfilment,
  FlightFulfilment,
  BusFulfilment,
  ServiceFulfilment,
]);
export type FulfilmentStatus = z.infer<typeof FulfilmentStatus>;

export const Order = z.object({
  orderId: z.string().min(1),
  quoteFingerprint: z.string(),
  itemType: z.enum(["product", "stay", "flight", "bus", "service"]),
  lines: z.array(CartLine).min(1),
  paymentStatus: z.enum(["pending", "authorized", "captured", "refunded", "failed"]),
  fulfilmentStatus: FulfilmentStatus,
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.string().datetime(),
  trackingRef: z.string().optional(),
});
export type Order = z.infer<typeof Order>;
