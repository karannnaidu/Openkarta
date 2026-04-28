import type { ErrorCode } from "./errors.js";

export const ERROR_HINTS: Readonly<Record<ErrorCode, string>> = Object.freeze({
  item_not_found:
    "The item is no longer available from this merchant. Run search again to find a current alternative.",
  quote_expired:
    "The signed quote has expired. Call quote again on the same cart to get a fresh token, then checkout.",
  quote_invalid:
    "The quote token is malformed or was rejected by the merchant. Call quote again to get a new one.",
  cart_must_be_homogeneous:
    "All cart lines must share the same agentId and itemType. Start a new cart to add items from a different merchant or vertical.",
  payment_declined:
    "The payment was declined by the processor. Ask the user to try a different payment method.",
  payment_required:
    "Checkout requires a valid payment method that is supported by this quote. Inspect the quote.paymentOptions and pick one.",
  inventory_unavailable:
    "The merchant cannot fulfil this quantity. Reduce the quantity or pick a different item.",
  slot_unavailable:
    "The requested time slot is no longer available. Search again to see open slots.",
  unauthorized:
    "The merchant rejected this request as unauthorized. This usually means a stale or missing user token.",
  forbidden:
    "The merchant refused this action for the current user. Do not retry without changing the request.",
  rate_limited: "The merchant is rate-limiting requests. Wait a few seconds before retrying.",
  validation_failed:
    "The merchant rejected the request payload. Check the details field for the offending field path.",
  unsupported_item_type:
    "This merchant does not support the requested item type. Pick a different agent that lists this type in supportedItemTypes.",
  unsupported_action:
    "This merchant does not support this verb. The agent's manifest declares which verbs it implements.",
  idempotency_conflict:
    "A different request has already used this idempotency key. Generate a new key and retry.",
  internal:
    "The merchant returned a server error. Retry once; if it persists, pick a different agent.",
});

export function errorHintFor(code: ErrorCode | string): string {
  return (ERROR_HINTS as Record<string, string | undefined>)[code] ?? "";
}
