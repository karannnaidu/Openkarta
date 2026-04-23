import { z } from 'zod';

export const ErrorCode = z.enum([
  'item_not_found',
  'quote_expired',
  'quote_invalid',
  'cart_must_be_homogeneous',
  'payment_declined',
  'payment_required',
  'inventory_unavailable',
  'slot_unavailable',
  'unauthorized',
  'forbidden',
  'rate_limited',
  'validation_failed',
  'unsupported_item_type',
  'unsupported_action',
  'idempotency_conflict',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

const STATUS: Record<ErrorCode, number> = {
  item_not_found:           404,
  quote_expired:            410,
  quote_invalid:            422,
  cart_must_be_homogeneous: 422,
  payment_declined:         402,
  payment_required:         402,
  inventory_unavailable:    409,
  slot_unavailable:         409,
  unauthorized:             401,
  forbidden:                403,
  rate_limited:             429,
  validation_failed:        400,
  unsupported_item_type:    400,
  unsupported_action:       400,
  idempotency_conflict:     409,
  internal:                 500,
};
export const errorStatusFor = (c: ErrorCode): number => STATUS[c];

export const ErrorResponse = z.object({
  error: z.object({
    code:      ErrorCode,
    message:   z.string(),
    retryable: z.boolean(),
    details:   z.record(z.unknown()).optional(),
  }),
  requestId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
