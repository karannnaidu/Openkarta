import { describe, it, expect } from "vitest";
import { createStatelessDispatcher } from "../src/llm/stateless-dispatcher.js";
import type { Orchestrator } from "../src/orchestrator.js";
import type { RankedResult } from "../src/types.js";

function fakeOrchestrator(results: Partial<RankedResult>[] = []): Orchestrator {
  return {
    async search() {
      return results as RankedResult[];
    },
  };
}

describe("createStatelessDispatcher", () => {
  it("search returns a compact projection of items with agentId", async () => {
    const orch = fakeOrchestrator([
      {
        agentId: "halcyon-shop",
        agentDisplayName: "Halcyon Shop",
        manifest: { baseUrl: "https://halcyon.example/api" } as never,
        item: { id: "sku-1", title: "Paneer Tikka", priceMinor: 25000, currency: "INR" } as never,
      },
    ]);
    const dispatch = createStatelessDispatcher(orch);
    const result = (await dispatch("search", { itemType: "product", q: "paneer" })) as Array<{
      agentId: string;
    }>;
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("halcyon-shop");
  });

  it("add_to_cart with no cart creates a new cart bound to the agent", async () => {
    const orch = fakeOrchestrator([
      {
        agentId: "halcyon-shop",
        agentDisplayName: "Halcyon Shop",
        manifest: { baseUrl: "https://halcyon.example/api" } as never,
        item: { id: "sku-1", title: "Paneer Tikka", priceMinor: 25000, currency: "INR" } as never,
      },
    ]);
    const dispatch = createStatelessDispatcher(orch);
    const out = (await dispatch("add_to_cart", {
      agentId: "halcyon-shop",
      itemType: "product",
      itemId: "sku-1",
      quantity: 2,
    })) as { cart: { agentId: string; lines: Array<{ itemId: string; quantity: number }> } };
    expect(out.cart.agentId).toBe("halcyon-shop");
    expect(out.cart.lines).toHaveLength(1);
    expect(out.cart.lines[0]!.itemId).toBe("sku-1");
    expect(out.cart.lines[0]!.quantity).toBe(2);
  });

  it("add_to_cart with an existing cart appends a line", async () => {
    const orch = fakeOrchestrator();
    const dispatch = createStatelessDispatcher(orch);
    const out = (await dispatch("add_to_cart", {
      agentId: "halcyon-shop",
      itemType: "product",
      itemId: "sku-2",
      quantity: 1,
      cart: {
        agentId: "halcyon-shop",
        agentBaseUrl: "https://halcyon.example/api",
        itemType: "product",
        currency: "INR",
        lines: [{ itemType: "product", itemId: "sku-1", quantity: 2 }],
      },
    })) as { cart: { lines: Array<unknown> } };
    expect(out.cart.lines).toHaveLength(2);
  });

  it("add_to_cart refuses to mix agents in one cart", async () => {
    const orch = fakeOrchestrator();
    const dispatch = createStatelessDispatcher(orch);
    await expect(
      dispatch("add_to_cart", {
        agentId: "other-agent",
        itemType: "product",
        itemId: "sku-2",
        quantity: 1,
        cart: {
          agentId: "halcyon-shop",
          agentBaseUrl: "https://halcyon.example/api",
          itemType: "product",
          currency: "INR",
          lines: [{ itemType: "product", itemId: "sku-1", quantity: 2 }],
        },
      }),
    ).rejects.toThrow(/agent/);
  });

  it("view_cart echoes the cart it was given", async () => {
    const dispatch = createStatelessDispatcher(fakeOrchestrator());
    const cart = {
      agentId: "halcyon-shop",
      agentBaseUrl: "https://halcyon.example/api",
      itemType: "product" as const,
      currency: "INR",
      lines: [{ itemType: "product" as const, itemId: "sku-1", quantity: 2 }],
    };
    const out = (await dispatch("view_cart", { cart })) as { cart: typeof cart };
    expect(out.cart).toEqual(cart);
  });

  it("throws on unknown tool name", async () => {
    const dispatch = createStatelessDispatcher(fakeOrchestrator());
    await expect(dispatch("not_a_tool", {})).rejects.toThrow(/unknown tool/);
  });
});
