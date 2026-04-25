import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const TOOL_NAMES = [
  'search', 'add_to_cart', 'view_cart', 'quote', 'checkout',
  'order_status', 'cancel_order', 'return_order',
] as const;

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

const itemTypeEnum = z.enum(['product', 'stay', 'flight', 'bus', 'service']);

const Schemas: Record<typeof TOOL_NAMES[number], z.ZodTypeAny> = {
  search: z.object({
    itemType: itemTypeEnum,
    q: z.string().optional().describe('Free-text query'),
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
  }),
  add_to_cart: z.object({
    agentId: z.string(),
    itemId: z.string(),
    quantity: z.number().int().min(1).default(1),
  }),
  view_cart: z.object({}),
  quote: z.object({}),
  checkout: z.object({
    paymentMethod: z.string().describe('e.g. cod, razorpay_routes, stripe_connect'),
    paymentRef: z.string().optional(),
  }),
  order_status: z.object({ orderId: z.string() }),
  cancel_order: z.object({ orderId: z.string(), reason: z.string() }),
  return_order: z.object({ orderId: z.string(), reason: z.string() }),
};

const Descriptions: Record<typeof TOOL_NAMES[number], string> = {
  search: 'Search across registered OpenKarta agents for items of a given type.',
  add_to_cart: 'Add an item to the current homogeneous cart. The cart is bound to a single agent and item type.',
  view_cart: 'Return the current cart contents.',
  quote: 'Quote the current cart against the agent. Returns price + signed token.',
  checkout: 'Place an order using the verified quote token + a payment.',
  order_status: 'Read fulfilment status for a placed order.',
  cancel_order: 'Cancel an open order with a reason.',
  return_order: 'Initiate a return for a delivered order.',
};

export function buildToolDefs(): AnthropicToolDef[] {
  return TOOL_NAMES.map((name) => ({
    name,
    description: Descriptions[name],
    input_schema: zodToJsonSchema(Schemas[name], { target: 'openApi3' }) as AnthropicToolDef['input_schema'],
  }));
}
