import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolDef } from "./tool-defs.js";

export const STATELESS_TOOL_NAMES = [
  "search",
  "add_to_cart",
  "view_cart",
  "quote",
  "checkout",
  "order_status",
  "cancel_order",
  "return_order",
] as const;

export type StatelessToolName = (typeof STATELESS_TOOL_NAMES)[number];

const itemTypeEnum = z.enum(["product", "stay", "flight", "bus", "service"]);

const StatelessCartZ = z.object({
  agentId: z.string(),
  agentBaseUrl: z.string().url(),
  itemType: itemTypeEnum,
  currency: z.string(),
  lines: z.array(
    z.object({
      itemType: itemTypeEnum,
      itemId: z.string(),
      quantity: z.number().int().min(1),
      extra: z.record(z.unknown()).optional(),
    }),
  ),
});

const StatelessQuoteZ = z
  .object({
    quoteToken: z.string(),
    cartId: z.string(),
    itemType: itemTypeEnum,
    totalMinor: z.number().int().nonnegative(),
    currency: z.string(),
    expiresAt: z.string(),
  })
  .passthrough();

export type StatelessCart = z.infer<typeof StatelessCartZ>;
export type StatelessQuote = z.infer<typeof StatelessQuoteZ>;

const Schemas: Record<StatelessToolName, z.ZodTypeAny> = {
  search: z.object({
    itemType: itemTypeEnum,
    q: z.string().optional().describe("Free-text query"),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
  }),
  add_to_cart: z.object({
    agentId: z.string().describe("From a search result."),
    itemType: itemTypeEnum.describe("Item vertical. Must match the cart if cart is provided."),
    itemId: z.string(),
    quantity: z.number().int().min(1).default(1),
    cart: StatelessCartZ.optional().describe(
      "Existing cart from a previous add_to_cart result. Omit to start a fresh cart.",
    ),
  }),
  view_cart: z.object({
    cart: StatelessCartZ,
  }),
  quote: z.object({
    cart: StatelessCartZ,
  }),
  checkout: z.object({
    cart: StatelessCartZ,
    quote: StatelessQuoteZ,
    paymentMethod: z.string().describe("e.g. cod, razorpay_routes, stripe_connect"),
    paymentRef: z.string().optional(),
  }),
  order_status: z.object({ orderId: z.string() }),
  cancel_order: z.object({ orderId: z.string(), reason: z.string() }),
  return_order: z.object({ orderId: z.string(), reason: z.string() }),
};

const Descriptions: Record<StatelessToolName, string> = {
  search:
    "Search across registered OpenKarta agents for items of a given type. Returns a list of items each tagged with agentId.",
  add_to_cart:
    "Add an item to a cart. Pass the prior cart to extend it; omit cart to start a new one. Returns the updated cart, which you must thread into subsequent view_cart, quote, and checkout calls.",
  view_cart: "Echo the cart contents. Stateless — pass the cart you got from add_to_cart.",
  quote:
    "Quote the supplied cart against the agent. Returns a signed quote token plus the cart unchanged. Pass both into checkout.",
  checkout:
    "Place an order using the supplied cart and signed quote token plus a payment method. Returns the orderId.",
  order_status: "Read fulfilment status for a placed order.",
  cancel_order: "Cancel an open order with a reason.",
  return_order: "Initiate a return for a delivered order.",
};

export function buildStatelessToolDefs(): ToolDef[] {
  return STATELESS_TOOL_NAMES.map((name) => ({
    name,
    description: Descriptions[name],
    parameters: zodToJsonSchema(Schemas[name], { target: "openApi3" }) as ToolDef["parameters"],
  }));
}

export const StatelessSchemas = Schemas;
