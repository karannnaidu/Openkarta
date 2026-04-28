import type { ItemType } from "@openkarta/spec";
import type { Orchestrator } from "../orchestrator.js";
import { newCart, addLine, type OrchestratorCart } from "../cart.js";
import { quoteCart } from "../quote.js";
import { checkoutCart } from "../checkout.js";
import { getOrderStatus, cancelOrder, returnOrder, createOrderStore } from "../orders.js";
import {
  StatelessSchemas,
  type StatelessCart,
  type StatelessQuote,
} from "./stateless-tool-defs.js";
import type { DispatchFn } from "./dispatcher.js";

export function createStatelessDispatcher(
  orch: Orchestrator,
  opts: { ordersFile?: string } = {},
): DispatchFn {
  const store = createOrderStore(opts.ordersFile ? { ordersFile: opts.ordersFile } : {});

  return async function dispatch(toolName, input) {
    switch (toolName) {
      case "search": {
        const args = StatelessSchemas.search.parse(input);
        const results = await orch.search({
          itemType: args.itemType,
          ...(args.q ? { q: args.q } : {}),
          ...(args.country
            ? {
                region: {
                  country: args.country,
                  ...(args.city ? { city: args.city } : {}),
                  ...(args.pincode ? { pincode: args.pincode } : {}),
                },
              }
            : {}),
        });
        return results.slice(0, 10).map((r) => ({
          agentId: r.agentId,
          agentDisplayName: r.agentDisplayName,
          itemId: r.item.id,
          title: r.item.title,
          priceMinor: r.item.priceMinor,
          currency: r.item.currency,
        }));
      }

      case "add_to_cart": {
        const args = StatelessSchemas.add_to_cart.parse(input);
        let cart: OrchestratorCart;
        if (args.cart) {
          if (args.cart.agentId !== args.agentId) {
            throw new Error(
              `cart is bound to agent "${args.cart.agentId}"; cannot add items from "${args.agentId}"`,
            );
          }
          if (args.cart.itemType !== args.itemType) {
            throw new Error(
              `cart is bound to itemType "${args.cart.itemType}"; cannot add itemType "${args.itemType}"`,
            );
          }
          cart = args.cart as OrchestratorCart;
        } else {
          // Look up the agent's baseUrl + currency by querying the orchestrator.
          const sample = await orch.search({
            itemType: args.itemType as ItemType,
            agentIds: [args.agentId],
          });
          if (sample.length === 0) {
            throw new Error(
              `agent "${args.agentId}" returned no items for itemType "${args.itemType}"`,
            );
          }
          const first = sample[0]!;
          cart = newCart({
            agentId: args.agentId,
            agentBaseUrl: first.manifest.baseUrl,
            itemType: args.itemType as ItemType,
            currency: first.item.currency,
          });
        }
        cart = addLine(cart, { itemId: args.itemId, quantity: args.quantity });
        return { cart: cart as StatelessCart };
      }

      case "view_cart": {
        const args = StatelessSchemas.view_cart.parse(input);
        return { cart: args.cart };
      }

      case "quote": {
        const args = StatelessSchemas.quote.parse(input);
        const q = await quoteCart(args.cart as OrchestratorCart);
        return { cart: args.cart, quote: q as StatelessQuote };
      }

      case "checkout": {
        const args = StatelessSchemas.checkout.parse(input);
        const order = await checkoutCart({
          cart: args.cart as OrchestratorCart,
          quote: args.quote as never,
          payment: {
            method: args.paymentMethod,
            ...(args.paymentRef ? { ref: args.paymentRef } : {}),
          },
          store,
        });
        return { orderId: order.orderId };
      }

      case "order_status": {
        const args = StatelessSchemas.order_status.parse(input);
        return getOrderStatus(args.orderId, { store });
      }

      case "cancel_order": {
        const args = StatelessSchemas.cancel_order.parse(input);
        return cancelOrder(args.orderId, args.reason, { store });
      }

      case "return_order": {
        const args = StatelessSchemas.return_order.parse(input);
        return returnOrder(args.orderId, args.reason, { store });
      }

      default:
        throw new Error(`unknown tool: ${toolName}`);
    }
  };
}
