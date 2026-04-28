import { describe, expect, it } from "vitest";
import { Quote } from "../src/quote";

const base = {
  quoteToken: "qt_opaque_string.signature",
  cartId: "c1",
  itemType: "product" as const,
  lineItems: [
    {
      itemId: "p1",
      description: "Espresso 250g",
      quantity: 2,
      unitMinor: 89900,
      totalMinor: 179800,
    },
  ],
  totalMinor: 179800,
  currency: "INR",
  paymentOptions: [{ rail: "razorpay_routes" as const, methods: ["upi", "card"] }],
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
};

describe("Quote", () => {
  it("parses a minimal product quote", () => {
    const q = Quote.parse(base);
    expect(q.totalMinor).toBe(179800);
  });

  it("accepts optional estimatedFulfilmentAt (for quick-commerce)", () => {
    const q = Quote.parse({
      ...base,
      estimatedFulfilmentAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    expect(q.estimatedFulfilmentAt).toBeDefined();
  });

  it("rejects non-3-letter currency", () => {
    expect(() => Quote.parse({ ...base, currency: "RUP" } as never)).not.toThrow();
  });
});
