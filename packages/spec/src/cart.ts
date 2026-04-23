import { z } from 'zod';

const PassengerPayload = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  dob:       z.string().optional(),
  gender:    z.enum(['M','F','X']).optional(),
  nationality: z.string().length(2).optional(),
  idNumber:  z.string().optional(),
});

const ProductLine = z.object({
  itemType:   z.literal('product'),
  itemId:     z.string().min(1),
  quantity:   z.number().int().positive(),
  variantSku: z.string().optional(),
});

const StayLine = z.object({
  itemType: z.literal('stay'),
  itemId:   z.string().min(1),
  checkIn:  z.string(),
  checkOut: z.string(),
  guests:   z.number().int().positive(),
  specialRequests: z.string().optional(),
});

const FlightLine = z.object({
  itemType:   z.literal('flight'),
  itemId:     z.string().min(1),
  passengers: z.array(PassengerPayload).min(1),
  seatSelection: z.array(z.string()).optional(),
  addBaggage: z.array(z.object({ kg: z.number().positive() })).optional(),
});

const BusLine = z.object({
  itemType:        z.literal('bus'),
  itemId:          z.string().min(1),
  passengers:      z.array(PassengerPayload).min(1),
  seatSelection:   z.array(z.string()).optional(),
  boardingPointId: z.string().min(1),
  droppingPointId: z.string().min(1),
});

const ServiceLine = z.object({
  itemType:  z.literal('service'),
  itemId:    z.string().min(1),
  slotStart: z.string().datetime(),
  slotEnd:   z.string().datetime(),
  headcount: z.number().int().positive().default(1),
  notes:     z.string().optional(),
});

export const CartLine = z.discriminatedUnion('itemType', [
  ProductLine, StayLine, FlightLine, BusLine, ServiceLine,
]);
export type CartLine = z.infer<typeof CartLine>;

export const Cart = z.object({
  cartId: z.string().min(1),
  lines:  z.array(CartLine).min(1),
}).refine(
  (c) => c.lines.every((l) => l.itemType === c.lines[0]!.itemType),
  { message: 'cart_must_be_homogeneous: all lines must share itemType' },
);
export type Cart = z.infer<typeof Cart>;
