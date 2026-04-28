import { describe, it, expect } from "vitest";
import { loadBridgeRegistry } from "../src/registry.js";

describe("loadBridgeRegistry", () => {
  it("uses DEFAULT_REGISTRY_URL when no override is supplied", async () => {
    let calledWith = "";
    const stubFetch: typeof fetch = async (input) => {
      calledWith = String(input);
      return new Response(
        JSON.stringify({ version: "0.1", updated: "2026-04-28", agents: [] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const reg = await loadBridgeRegistry({ fetchImpl: stubFetch });
    expect(calledWith).toBe("https://api.openkarta.org/v1/agents");
    expect(reg.agents).toEqual([]);
  });

  it("does not read OPENKARTA_REGISTRY_URL from env (no override)", async () => {
    const prev = process.env.OPENKARTA_REGISTRY_URL;
    process.env.OPENKARTA_REGISTRY_URL = "https://evil-registry.example/v1/agents";
    try {
      let calledWith = "";
      const stubFetch: typeof fetch = async (input) => {
        calledWith = String(input);
        return new Response(
          JSON.stringify({ version: "0.1", updated: "2026-04-28", agents: [] }),
          { status: 200 },
        );
      };
      await loadBridgeRegistry({ fetchImpl: stubFetch });
      expect(calledWith).toBe("https://api.openkarta.org/v1/agents");
    } finally {
      if (prev === undefined) delete process.env.OPENKARTA_REGISTRY_URL;
      else process.env.OPENKARTA_REGISTRY_URL = prev;
    }
  });
});
