import { describe, expect, it } from "vitest";
import { ERROR_HINTS, errorHintFor } from "../src/error-hints";
import { ErrorCode } from "../src/errors";

describe("errorHintFor", () => {
  it("returns a non-empty hint for every closed-enum code", () => {
    for (const code of ErrorCode.options) {
      const hint = errorHintFor(code);
      expect(hint, `missing hint for ${code}`).toBeTruthy();
      expect(hint.length).toBeGreaterThan(10);
    }
  });

  it("returns the canonical hint for quote_expired", () => {
    expect(errorHintFor("quote_expired")).toMatch(/quote/i);
    expect(errorHintFor("quote_expired")).toMatch(/again/i);
  });

  it("returns empty string for an unknown code", () => {
    expect(errorHintFor("not_a_real_code" as never)).toBe("");
  });

  it("exports ERROR_HINTS as a frozen record", () => {
    expect(Object.isFrozen(ERROR_HINTS)).toBe(true);
  });
});
