import type { Orchestrator } from '../orchestrator.js';
import type { ConversationState } from './memory.js';
import type { ItemType } from '@openkarta/spec';
import { newCart, addLine } from '../cart.js';
import { quoteCart } from '../quote.js';
import { checkoutCart } from '../checkout.js';
import { getOrderStatus, cancelOrder, returnOrder, createOrderStore } from '../orders.js';

export type DispatchFn = (toolName: string, input: Record<string, unknown>) => Promise<unknown>;

export function createDispatcher(
  orch: Orchestrator,
  state: ConversationState,
  opts: { ordersFile?: string } = {},
): DispatchFn {
  const store = createOrderStore(opts.ordersFile ? { ordersFile: opts.ordersFile } : {});

  return async function dispatch(toolName, input) {
    switch (toolName) {
      case 'search': {
        const results = await orch.search({
          itemType: input.itemType as ItemType,
          ...(input.q ? { q: input.q as string } : {}),
          ...(input.country ? {
            region: {
              country: input.country as string,
              ...(input.city ? { city: input.city as string } : {}),
              ...(input.pincode ? { pincode: input.pincode as string } : {}),
            },
          } : {}),
        });
        state.lastSearch = {
          itemType: input.itemType as ItemType,
          agentIdsSeen: Array.from(new Set(results.map((r) => r.agentId))),
        };
        // Return a compact projection — full RankedResult is too large for LLM context.
        return results.slice(0, 10).map((r) => ({
          agentId: r.agentId,
          agentDisplayName: r.agentDisplayName,
          itemId: r.item.id,
          title: r.item.title,
          priceMinor: r.item.priceMinor,
          currency: r.item.currency,
        }));
      }

      case 'add_to_cart': {
        const agentId = input.agentId as string;
        const itemId = input.itemId as string;
        const quantity = (input.quantity as number | undefined) ?? 1;
        if (!state.cart) {
          if (!state.lastSearch) throw new Error('call search first to bind a cart context');
          // Look up the agent baseUrl + currency by querying the orchestrator's registry view.
          const sample = await orch.search({
            itemType: state.lastSearch.itemType,
            agentIds: [agentId],
          });
          if (sample.length === 0) {
            throw new Error(`agent ${agentId} returned no items for type ${state.lastSearch.itemType}`);
          }
          const first = sample[0]!;
          const baseUrl = first.manifest.baseUrl;
          const currency = first.item.currency;
          state.cart = newCart({
            agentId,
            agentBaseUrl: baseUrl,
            itemType: state.lastSearch.itemType,
            currency,
          });
        }
        if (state.cart.agentId !== agentId) {
          throw new Error(`cart is bound to ${state.cart.agentId}; cannot add items from ${agentId}`);
        }
        state.cart = addLine(state.cart, { itemId, quantity });
        return { ok: true, lines: state.cart.lines.length };
      }

      case 'view_cart': {
        return state.cart ?? { lines: [] };
      }

      case 'quote': {
        if (!state.cart) throw new Error('cart is empty');
        const q = await quoteCart(state.cart);
        state.lastQuote = q;
        return { totalMinor: q.totalMinor, currency: q.currency, expiresAt: q.expiresAt };
      }

      case 'checkout': {
        if (!state.cart || !state.lastQuote) throw new Error('quote first, then checkout');
        const order = await checkoutCart({
          cart: state.cart,
          quote: state.lastQuote,
          payment: {
            method: input.paymentMethod as string,
            ...(input.paymentRef ? { ref: input.paymentRef as string } : {}),
          },
          store,
        });
        return { orderId: order.orderId };
      }

      case 'order_status':
        return getOrderStatus(input.orderId as string, { store });

      case 'cancel_order':
        return cancelOrder(input.orderId as string, input.reason as string, { store });

      case 'return_order':
        return returnOrder(input.orderId as string, input.reason as string, { store });

      default:
        throw new Error(`unknown tool: ${toolName}`);
    }
  };
}
