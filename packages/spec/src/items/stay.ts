import { z } from "zod";
import { Address } from "../common.js";
import { ItemBase } from "./base.js";

export const StayItem = ItemBase.extend({
  type: z.literal("stay"),
  propertyId: z.string().min(1),
  propertyType: z.enum(["hotel", "homestay", "apartment", "villa", "hostel"]),
  maxGuests: z.number().int().positive(),
  minStayNights: z.number().int().positive(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/),
  amenities: z.array(z.string()).optional(),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict", "non-refundable"]),
  houseRules: z.array(z.string()).optional(),
  location: z.object({ lat: z.number(), lng: z.number(), address: Address }),
});
export type StayItem = z.infer<typeof StayItem>;
