import { describe, it, expect } from "vitest";
import { buildStatelessToolDefs, STATELESS_TOOL_NAMES } from "../src/llm/stateless-tool-defs.js";

describe("buildStatelessToolDefs", () => {
  it("returns 8 tool definitions matching STATELESS_TOOL_NAMES", () => {
    const defs = buildStatelessToolDefs();
    expect(defs).toHaveLength(8);
    expect(defs.map((d) => d.name).sort()).toEqual([...STATELESS_TOOL_NAMES].sort());
  });

  it("every tool has a description and a JSON schema with type=object", () => {
    for (const def of buildStatelessToolDefs()) {
      expect(def.description.length).toBeGreaterThan(10);
      expect(def.parameters.type).toBe("object");
    }
  });

  it("add_to_cart accepts an optional cart input", () => {
    const def = buildStatelessToolDefs().find((d) => d.name === "add_to_cart")!;
    const props = def.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty("cart");
    expect(props).toHaveProperty("agentId");
    expect(props).toHaveProperty("itemType");
    expect(props).toHaveProperty("itemId");
  });

  it("view_cart, quote, checkout require a cart input", () => {
    const defs = buildStatelessToolDefs();
    for (const name of ["view_cart", "quote", "checkout"] as const) {
      const def = defs.find((d) => d.name === name)!;
      expect((def.parameters.required as string[]) ?? []).toContain("cart");
    }
  });

  it("checkout requires a quote input", () => {
    const def = buildStatelessToolDefs().find((d) => d.name === "checkout")!;
    expect((def.parameters.required as string[]) ?? []).toContain("quote");
  });
});
