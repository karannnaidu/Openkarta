import type { ItemType } from "@openkarta/spec";

export interface OrchestratorCart {
  agentId: string;
  agentBaseUrl: string;
  itemType: ItemType;
  currency: string;
  lines: {
    itemType: ItemType;
    itemId: string;
    quantity: number;
    extra?: Record<string, unknown>;
  }[];
}

export function newCart(
  init: Pick<OrchestratorCart, "agentId" | "agentBaseUrl" | "itemType" | "currency">,
): OrchestratorCart {
  return { ...init, lines: [] };
}

export interface AddLineInput {
  itemId: string;
  quantity: number;
  /** Vertical-specific line fields merged into the wire CartLine (e.g. checkIn/checkOut for stays, passengers for flights). */
  extra?: Record<string, unknown>;
  /** Internal type-narrow guard — callers should never pass this. */
  _agentIdSanityCheck?: string;
}

export function addLine(cart: OrchestratorCart, line: AddLineInput): OrchestratorCart {
  if (line._agentIdSanityCheck && line._agentIdSanityCheck !== cart.agentId) {
    throw new Error(
      `cart belongs to agent "${cart.agentId}", refusing line from "${line._agentIdSanityCheck}"`,
    );
  }
  if (line.quantity < 1 || !Number.isInteger(line.quantity)) {
    throw new Error("quantity must be a positive integer");
  }
  return {
    ...cart,
    lines: [
      ...cart.lines,
      {
        itemType: cart.itemType,
        itemId: line.itemId,
        quantity: line.quantity,
        ...(line.extra ? { extra: line.extra } : {}),
      },
    ],
  };
}
