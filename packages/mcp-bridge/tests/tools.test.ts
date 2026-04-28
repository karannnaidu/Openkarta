import { describe, expect, it, vi } from "vitest";
import { runTool } from "../src/tools.js";

describe("runTool", () => {
  it("returns a JSON content envelope on success", async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const result = await runTool(dispatch, "search", { itemType: "product" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(JSON.parse(result.content[0]!.text)).toEqual({ ok: true, value: 42 });
    expect(dispatch).toHaveBeenCalledWith("search", { itemType: "product" });
  });

  it("shapes a thrown OpenKartaError-style object as MCP error", async () => {
    const dispatch = vi.fn().mockRejectedValue({
      error: { code: "quote_expired", message: "expired", retryable: true },
    });
    const result = await runTool(dispatch, "quote", { cart: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe("quote_expired");
    expect(parsed.hint).toBeTruthy();
  });

  it("shapes a thrown vanilla Error as bridge_internal", async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error("boom"));
    const result = await runTool(dispatch, "search", { itemType: "product" });
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe("internal");
  });

  it("represents undefined dispatcher results as JSON null", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const result = await runTool(dispatch, "cancel_order", { orderId: "o1", reason: "x" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.text).toBe("null");
  });
});
