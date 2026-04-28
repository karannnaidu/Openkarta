import { describe, expect, it } from "vitest";
import { signQuoteToken, verifyQuoteToken } from "../src/quote-token";

const secret = "test-secret-32-bytes-long-string!!!";

describe("signQuoteToken / verifyQuoteToken", () => {
  it("round-trips payload", () => {
    const payload = {
      cartId: "c1",
      totalMinor: 12500,
      currency: "INR",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
    const token = signQuoteToken(payload, secret);
    const verified = verifyQuoteToken(token, secret);
    expect(verified.cartId).toBe("c1");
  });

  it("rejects tampered token", () => {
    const payload = {
      cartId: "c1",
      totalMinor: 12500,
      currency: "INR",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
    const token = signQuoteToken(payload, secret);
    const tampered = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");
    expect(() => verifyQuoteToken(tampered, secret)).toThrow(/quote_invalid/);
  });

  it("rejects expired token", () => {
    const past = {
      cartId: "c1",
      totalMinor: 12500,
      currency: "INR",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const token = signQuoteToken(past, secret);
    expect(() => verifyQuoteToken(token, secret)).toThrow(/quote_expired/);
  });
});
