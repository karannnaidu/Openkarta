import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { bootstrap } from "../src/bootstrap.js";
import { buildServer } from "../src/server.js";

const fakeRegistry = {
  version: "0.1" as const,
  updated: "2026-04-28",
  agents: [
    {
      agentId: "halcyon-shop",
      displayName: "Halcyon Shop",
      baseUrl: "https://halcyon.example/api",
      tier: "http" as const,
      supportedItemTypes: ["product" as const],
      addedAt: "2026-04-01",
    },
  ],
};

function harness(dispatchImpl: (name: string, input: Record<string, unknown>) => Promise<unknown>) {
  const server = buildServer({
    registry: fakeRegistry,
    dispatch: vi.fn(dispatchImpl),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  return { server, client, clientTransport, serverTransport };
}

describe("buildServer", () => {
  it("publishes 8 tools on tools/list", async () => {
    const { server, client, clientTransport, serverTransport } = harness(async () => ({}));
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.listTools();
    expect(result.tools).toHaveLength(8);
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "add_to_cart",
      "cancel_order",
      "checkout",
      "order_status",
      "quote",
      "return_order",
      "search",
      "view_cart",
    ]);
  });

  it("routes tools/call into the supplied dispatch", async () => {
    const dispatch = vi.fn().mockResolvedValue([{ agentId: "halcyon-shop", itemId: "sku-1" }]);
    const { server, client, clientTransport, serverTransport } = harness(dispatch);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: "search",
      arguments: { itemType: "product", q: "paneer" },
    });
    expect(dispatch).toHaveBeenCalledWith("search", { itemType: "product", q: "paneer" });
    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ text: string }>;
    expect(content).toHaveLength(1);
    const payload = JSON.parse(content[0]!.text);
    expect(payload[0].agentId).toBe("halcyon-shop");
  });

  it("returns isError envelope when dispatch throws an OpenKarta error", async () => {
    const dispatch = vi.fn().mockRejectedValue({
      error: { code: "quote_expired", message: "expired", retryable: true },
    });
    const { server, client, clientTransport, serverTransport } = harness(dispatch);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: "quote",
      arguments: {
        cart: {
          agentId: "halcyon-shop",
          agentBaseUrl: "https://halcyon.example/api",
          itemType: "product",
          currency: "INR",
          lines: [{ itemType: "product", itemId: "sku-1", quantity: 1 }],
        },
      },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ text: string }>;
    expect(content).toHaveLength(1);
    const payload = JSON.parse(content[0]!.text);
    expect(payload.code).toBe("quote_expired");
    expect(payload.hint).toBeTruthy();
  });
});

describe("bootstrap", () => {
  it("returns a connected server when given a registry snapshot and dispatch", async () => {
    const result = await bootstrap({
      registry: fakeRegistry,
      dispatch: async () => ({}),
      transport: "noop",
    });
    expect(result.server).toBeDefined();
    expect(result.startedAt).toBeInstanceOf(Date);
  });
});

describe("bootstrap module purity", () => {
  it("importing bootstrap does not touch process.argv", async () => {
    // Snapshot argv before, dynamic-import bootstrap, ensure argv unchanged
    // and no exception is thrown for missing/odd argv[1].
    const before = [...process.argv];
    // Sabotage argv[1] so any pathToFileURL(argv[1]) call would throw.
    const sabotaged = [...process.argv];
    sabotaged[1] = "\0"; // pathToFileURL("\0") throws ERR_INVALID_ARG_VALUE
    process.argv = sabotaged;
    try {
      await import("../src/bootstrap.js");
      // If we get here, the import did not call pathToFileURL on argv[1].
    } finally {
      process.argv = before;
    }
  });
});
