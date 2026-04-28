import { describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
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

  it("shapes a thrown ZodError as bridge_invalid_args with issues in details", async () => {
    let zodErr: ZodError;
    try {
      z.object({ itemType: z.enum(["product"]) }).parse({ itemType: "bogus" });
      throw new Error("zod did not throw");
    } catch (e) {
      zodErr = e as ZodError;
    }
    const dispatch = vi.fn().mockRejectedValue(zodErr);
    const result = await runTool(dispatch, "search", { itemType: "bogus" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe("bridge_invalid_args");
    expect(parsed.hint).toContain("did not validate");
    expect(parsed.details.issues).toBeInstanceOf(Array);
    expect(parsed.details.issues.length).toBeGreaterThan(0);
  });

  it("shapes a TypeError(\"fetch failed\") as bridge_network_error", async () => {
    const dispatch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await runTool(dispatch, "search", { itemType: "product" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe("bridge_network_error");
    expect(parsed.hint).toContain("Merchant unreachable");
  });

  it("does not misroute non-fetch TypeError to bridge_network_error", async () => {
    const dispatch = vi.fn().mockRejectedValue(new TypeError("not a function"));
    const result = await runTool(dispatch, "search", { itemType: "product" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe("internal");
  });
});
