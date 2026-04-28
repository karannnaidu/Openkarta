import { z } from "zod";

export const Refund = z.object({
  refundId: z.string().min(1),
  orderId: z.string().min(1),
  reason: z.enum([
    "user_cancelled",
    "merchant_cancelled",
    "failed_fulfilment",
    "damaged",
    "not_as_described",
    "other",
  ]),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.enum(["initiated", "processing", "refunded", "failed"]),
  processedAt: z.string().datetime().optional(),
});
export type Refund = z.infer<typeof Refund>;
