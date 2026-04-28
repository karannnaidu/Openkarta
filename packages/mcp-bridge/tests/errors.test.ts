import { describe, it, expect } from "vitest";
import { ErrorCode } from "@openkarta/spec";
import { toMcpError, BRIDGE_ERROR_HINTS, type BridgeErrorCode } from "../src/errors.js";

describe("toMcpError", () => {
  it("wraps a closed-enum OpenKarta error with a hint", () => {
    const err = {
      error: {
        code: "quote_expired" as const,
        message: "Quote expired at 2026-04-28T10:14:00Z",
        retryable: true,
      },
    };
    const out = toMcpError(err);
    expect(out.isError).toBe(true);
    expect(out.content).toHaveLength(1);
    expect(out.content[0].type).toBe("text");
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.code).toBe("quote_expired");
    expect(parsed.hint).toMatch(/quote/i);
    expect(parsed.message).toMatch(/expired/i);
  });

  it("wraps every closed-enum code with a non-empty hint", () => {
    for (const code of ErrorCode.options) {
      const err = { error: { code, message: "x", retryable: false } };
      const out = toMcpError(err);
      const parsed = JSON.parse(out.content[0].text);
      expect(parsed.hint, `missing hint for ${code}`).toBeTruthy();
    }
  });

  it("synthesizes BRIDGE_INVALID_MERCHANT for unknown agentId", () => {
    const out = toMcpError({ bridgeCode: "bridge_invalid_merchant", message: "agentId not found: foo" });
    expect(out.isError).toBe(true);
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.code).toBe("bridge_invalid_merchant");
    expect(parsed.hint).toBeTruthy();
  });

  it("every BRIDGE_* code has a hint", () => {
    const codes: BridgeErrorCode[] = [
      "bridge_registry_unavailable",
      "bridge_network_error",
      "bridge_invalid_merchant_response",
      "bridge_invalid_merchant",
      "bridge_invalid_args",
    ];
    for (const code of codes) {
      expect(BRIDGE_ERROR_HINTS[code]).toBeTruthy();
    }
  });

  it("falls through with an internal code when input is unrecognized", () => {
    const out = toMcpError(new Error("boom"));
    expect(out.isError).toBe(true);
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.code).toBe("internal");
    expect(parsed.message).toContain("boom");
  });
});
