import { z } from 'zod';

export const PaymentOption = z.object({
  rail:    z.enum(['razorpay_routes','stripe_connect','upi_direct','cod']),
  methods: z.array(z.enum(['upi','card','netbanking','wallet','cod','apple_pay','google_pay'])),
});
export type PaymentOption = z.infer<typeof PaymentOption>;

export const Fee      = z.object({ label: z.string(), amountMinor: z.number().int().nonnegative() });
export const Tax      = z.object({ label: z.string(), rate: z.number().optional(), amountMinor: z.number().int().nonnegative() });
export const Discount = z.object({ label: z.string(), amountMinor: z.number().int().nonnegative() });

const QuoteLine = z.object({
  itemId:      z.string(),
  description: z.string(),
  quantity:    z.number().int().positive(),
  unitMinor:   z.number().int().nonnegative(),
  totalMinor:  z.number().int().nonnegative(),
});

export const Quote = z.object({
  quoteToken:            z.string().min(1),
  cartId:                z.string(),
  itemType:              z.enum(['product','stay','flight','bus','service']),
  lineItems:             z.array(QuoteLine).min(1),
  fees:                  z.array(Fee).optional(),
  taxes:                 z.array(Tax).optional(),
  discounts:             z.array(Discount).optional(),
  totalMinor:            z.number().int().nonnegative(),
  currency:              z.string().length(3),
  paymentOptions:        z.array(PaymentOption).min(1),
  expiresAt:             z.string().datetime(),
  estimatedFulfilmentAt: z.string().datetime().optional(),
  cancellationPolicy:    z.enum(['flexible','moderate','strict','non-refundable']).optional(),
});
export type Quote = z.infer<typeof Quote>;
